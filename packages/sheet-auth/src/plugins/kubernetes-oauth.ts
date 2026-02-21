import { createRemoteJWKSet, customFetch, jwtVerify } from "jose";
import { readFileSync } from "fs";
import type { BetterAuthPlugin } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { signJWT } from "better-auth/plugins";

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

// Type definitions for Better Auth adapter operations
interface AdapterQuery {
  field: string;
  value: string;
}

interface AdapterFindOptions {
  model: string;
  where: AdapterQuery[];
}

interface AdapterCreateOptions {
  model: string;
  data: Record<string, unknown>;
}

interface DatabaseAdapter {
  findMany: (options: AdapterFindOptions) => Promise<unknown[]>;
  findOne?: (options: AdapterFindOptions) => Promise<unknown | null>;
  create: (options: AdapterCreateOptions) => Promise<unknown>;
}

/**
 * Find user by Discord user ID via the account table (junction table).
 * The account table links internal user IDs to external OAuth provider IDs.
 */
async function findUserByDiscordId(
  adapter: DatabaseAdapter,
  discordUserId: string,
): Promise<Record<string, unknown> | undefined> {
  // 1. Find account by providerId + accountId (Discord user ID)
  const accounts = await adapter.findMany({
    model: "account",
    where: [
      { field: "providerId", value: "discord" },
      { field: "accountId", value: discordUserId },
    ],
  });

  const account = accounts[0] as Record<string, unknown> | undefined;
  if (!account?.userId) {
    return undefined;
  }

  // 2. Find user by ID
  if (!adapter.findOne) {
    // Fallback: query all users and filter (not ideal for large datasets)
    const users = await adapter.findMany({
      model: "user",
      where: [{ field: "id", value: account.userId as string }],
    });
    return users[0] as Record<string, unknown> | undefined;
  }

  return (await adapter.findOne({
    model: "user",
    where: [{ field: "id", value: account.userId as string }],
  })) as Record<string, unknown> | undefined;
}

/**
 * Create placeholder user and link it to Discord via account table.
 * This creates both a user record and an account record (junction).
 */
async function createPlaceholderUserWithDiscord(
  adapter: DatabaseAdapter,
  discordUserId: string,
): Promise<Record<string, unknown>> {
  const userId = crypto.randomUUID();

  // 1. Create the user with UUID-based email to avoid conflicts
  const user = (await adapter.create({
    model: "user",
    data: {
      id: userId,
      email: `${userId}@k8s.internal`,
      emailVerified: true,
      name: `K8S ServiceAccount ${discordUserId}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  })) as Record<string, unknown>;

  // 2. Create the account link (junction table entry)
  await adapter.create({
    model: "account",
    data: {
      id: crypto.randomUUID(),
      userId: userId,
      providerId: "discord",
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
    hooks: {
      before: [
        {
          matcher: (context) => {
            // Match POST requests to /oauth2/token with Kubernetes provider
            const isTokenEndpoint =
              context.path?.endsWith("/oauth2/token") || context.path === "/oauth2/token";
            const isPost = context.request?.method === "POST";
            return isTokenEndpoint && isPost;
          },
          handler: createAuthMiddleware(async (ctx) => {
            // Parse the request body
            if (!ctx.request) {
              return { context: ctx };
            }

            const contentType = ctx.request.headers.get("content-type") || "";
            let body: Record<string, unknown>;

            try {
              if (contentType.includes("application/json")) {
                body = await ctx.request.json();
              } else {
                const formData = await ctx.request.formData();
                body = {};
                formData.forEach((value, key) => {
                  body[key] = value;
                });
              }
            } catch {
              // If parsing fails, let the request continue to other handlers
              return { context: ctx };
            }

            // Only handle Kubernetes client_credentials requests
            if (body.grant_type !== "client_credentials" || body.provider !== "kubernetes") {
              // Not a Kubernetes request, continue to other handlers
              return { context: ctx };
            }

            const k8sToken = body.token as string | undefined;
            const discordUserId = body.discord_user_id as string | undefined;

            if (!k8sToken) {
              return {
                context: ctx,
                response: new Response(
                  JSON.stringify({
                    error: "invalid_request",
                    error_description: "Missing required parameter: token",
                  }),
                  {
                    status: 400,
                    headers: { "Content-Type": "application/json" },
                  },
                ),
              };
            }

            if (!discordUserId) {
              return {
                context: ctx,
                response: new Response(
                  JSON.stringify({
                    error: "invalid_request",
                    error_description: "Missing required parameter: discord_user_id",
                  }),
                  {
                    status: 400,
                    headers: { "Content-Type": "application/json" },
                  },
                ),
              };
            }

            try {
              // Verify the Kubernetes token
              await verifyKubernetesToken(k8sToken, options.audience);

              // Access adapter from the context
              const adapter = ctx.context.adapter;

              // 1. Look up user by discordUserId via account table (junction)
              let user = await findUserByDiscordId(adapter, discordUserId);

              // 2. If not found, create placeholder user + account link
              if (!user) {
                user = await createPlaceholderUserWithDiscord(adapter, discordUserId);
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

              const accessToken = await signJWT(ctx, {
                options: jwtPlugin.options,
                payload: {
                  sub: user.id as string,
                  iat: Math.floor(Date.now() / 1000),
                  exp: Math.floor(expiresAt.getTime() / 1000),
                },
              });

              // Return OAuth 2.0 token response with correct expiration
              return {
                context: ctx,
                response: new Response(
                  JSON.stringify({
                    access_token: accessToken,
                    token_type: "Bearer",
                    expires_in: SESSION_EXPIRES_IN_SECONDS,
                    scope: "openid profile",
                  }),
                  {
                    status: 200,
                    headers: {
                      "Content-Type": "application/json",
                      "Cache-Control": "no-store",
                      Pragma: "no-cache",
                    },
                  },
                ),
              };
            } catch (error) {
              const message = error instanceof Error ? error.message : "Token verification failed";
              return {
                context: ctx,
                response: new Response(
                  JSON.stringify({
                    error: "invalid_grant",
                    error_description: message,
                  }),
                  {
                    status: 400,
                    headers: { "Content-Type": "application/json" },
                  },
                ),
              };
            }
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;
}
