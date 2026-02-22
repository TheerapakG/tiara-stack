import { createRemoteJWKSet, customFetch, jwtVerify } from "jose";
import { readFileSync } from "fs";
import type { BetterAuthPlugin, DBAdapter } from "better-auth";
import { createAuthEndpoint, signJWT } from "better-auth/plugins";
import { Schema } from "effect";

const KUBERNETES_TOKEN_PATH = "/var/run/secrets/kubernetes.io/serviceaccount/token";
const KUBERNETES_JWKS_URL = "https://kubernetes.default.svc.cluster.local/openid/v1/jwks";

function readKubernetesToken(): string {
  try {
    return readFileSync(KUBERNETES_TOKEN_PATH, "utf-8");
  } catch (cause) {
    throw new Error(
      `Failed to read Kubernetes service account token from ${KUBERNETES_TOKEN_PATH}. ` +
        `Ensure the pod is running in Kubernetes with a mounted service account.`,
      { cause },
    );
  }
}

// Cached JWKS instance to avoid reading K8s token on every verification
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJWKS(expectedAudience: string) {
  const cached = jwksCache.get(expectedAudience);
  if (cached) return cached;

  const jwks = createRemoteJWKSet(new URL(KUBERNETES_JWKS_URL), {
    [customFetch]: (input: RequestInfo | URL, init?: RequestInit) =>
      fetch(input, {
        ...init,
        headers: {
          ...init?.headers,
          Authorization: `Bearer ${readKubernetesToken()}`,
        },
      }),
  });

  jwksCache.set(expectedAudience, jwks);
  return jwks;
}

/**
 * Verify Kubernetes projected ServiceAccount token
 *
 * Validates the token signature, issuer, and audience.
 * Note: This only validates the K8s token structure. The discord_user_id
 * should be provided separately in the request body.
 */
export async function verifyKubernetesToken(
  token: string,
  expectedAudience: string,
): Promise<{ sub: string }> {
  const jwks = getJWKS(expectedAudience);

  const { payload } = await jwtVerify(token, jwks, {
    audience: expectedAudience,
  });

  // Validate that this is a ServiceAccount token
  if (!payload.sub?.startsWith("system:serviceaccount:")) {
    throw new Error("Invalid token: not a ServiceAccount token");
  }

  return {
    sub: payload.sub,
  };
}

export interface KubernetesOAuthOptions {
  /**
   * Expected audience for Kubernetes tokens
   */
  audience: string;
}

/**
 * Find user by Discord user ID via the account table (junction table).
 * The account table links internal user IDs to external OAuth provider IDs.
 */
async function findUserByDiscordId(
  adapter: DBAdapter,
  discordUserId: string,
): Promise<Record<string, unknown> | undefined> {
  // 1. Find account by providerId + accountId (Discord user ID)
  const account = ((await adapter.findOne({
    model: "account",
    where: [
      { field: "providerId", value: "kubernetes:discord" },
      { field: "accountId", value: discordUserId },
    ],
  })) ?? undefined) as Record<string, unknown> | undefined;

  if (!account?.userId) {
    return undefined;
  }

  return ((await adapter.findOne({
    model: "user",
    where: [{ field: "id", value: account.userId as string }],
  })) ?? undefined) as Record<string, unknown> | undefined;
}

/**
 * Create placeholder user and link it to Discord via account table.
 * This creates both a user record and an account record (junction).
 */
async function createPlaceholderUserWithDiscord(
  adapter: DBAdapter,
  discordUserId: string,
): Promise<Record<string, unknown>> {
  const user = (await adapter.create({
    model: "user",
    data: {
      email: `discord_${discordUserId}@k8s.internal`,
      emailVerified: true,
      name: `Discord User ${discordUserId}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  })) as Record<string, unknown>;

  // 2. Create the account link (junction table entry)
  await adapter.create({
    model: "account",
    data: {
      userId: user.id,
      providerId: "kubernetes:discord",
      accountId: discordUserId,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  return user;
}

// Session expiration: 7 days in seconds
const SESSION_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 7;

/**
 * Better Auth plugin for Kubernetes token-based OAuth
 *
 * This plugin adds support for client_credentials grant type using
 * Kubernetes ServiceAccount tokens as the authentication mechanism.
 */
export function kubernetesOAuth(options: KubernetesOAuthOptions): BetterAuthPlugin {
  return {
    id: "kubernetes-oauth",

    endpoints: {
      kubernetesOAuthToken: createAuthEndpoint(
        "/kubernetes-oauth/token",
        {
          method: "POST",
          body: Schema.Struct({
            token: Schema.String,
            discord_user_id: Schema.String,
          }).pipe(Schema.standardSchemaV1),
          metadata: {
            allowedMediaTypes: ["application/x-www-form-urlencoded", "application/json"],
          },
        },
        async (ctx) => {
          try {
            // Verify the Kubernetes token
            await verifyKubernetesToken(ctx.body.token, options.audience);

            // Access adapter from the context
            const adapter = ctx.context.adapter;

            // 1. Look up user by discordUserId via account table (junction)
            let user = await findUserByDiscordId(adapter, ctx.body.discord_user_id);

            // 2. If not found, create placeholder user + account link
            if (!user) {
              user = await createPlaceholderUserWithDiscord(adapter, ctx.body.discord_user_id);
            }

            // 3. Create a session for the user
            const sessionToken = crypto.randomUUID();
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

            await adapter.create({
              model: "session",
              data: {
                id: crypto.randomUUID(),
                token: sessionToken,
                userId: user.id,
                expiresAt: expiresAt,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            });

            // 4. Generate JWT using Better Auth's signJWT directly
            const jwtPlugin = ctx.context.getPlugin("jwt");
            if (!jwtPlugin) {
              throw new Error("JWT plugin not found");
            }

            const token = await signJWT(ctx, {
              options: jwtPlugin.options,
              payload: {
                sub: user.id as string,
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(expiresAt.getTime() / 1000),
              },
            });

            console.log("token", token);

            return ctx.json({
              token: token,
              expires_in: SESSION_EXPIRES_IN_SECONDS,
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : "Token verification failed";
            return ctx.json(
              {
                error: "invalid_grant",
                error_description: message,
              },
              { status: 400 },
            );
          }
        },
      ),
    },
  } satisfies BetterAuthPlugin;
}
