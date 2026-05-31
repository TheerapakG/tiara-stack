import { createRemoteJWKSet, customFetch, jwtVerify } from "jose";
import { readFile } from "fs/promises";
import {
  BASE_ERROR_CODES,
  type BetterAuthPlugin,
  type InternalAdapter,
  type Session,
  type User,
} from "better-auth";
import { createAuthEndpoint, type AuthEndpoint, type AuthMiddleware } from "better-auth/plugins";
import { Effect, Option, Schema, SchemaGetter, SchemaIssue } from "effect";
import { APIError } from "better-auth";
import { setSessionCookie } from "better-auth/cookies";
import { sessionMiddleware } from "better-auth/api";
import { PermissionValues, type Permission } from "./shared";

const KUBERNETES_TOKEN_PATH = "/var/run/secrets/kubernetes.io/serviceaccount/token";
const KUBERNETES_JWKS_URL = "https://kubernetes.default.svc.cluster.local/openid/v1/jwks";
export const DISCORD_SERVICE_USER_ID_SENTINEL = "service_user";

const ServiceAccountJwksUrl = Schema.String.pipe(
  Schema.decodeTo(Schema.String, {
    decode: SchemaGetter.transformOrFail((url) =>
      URL.canParse(url)
        ? Effect.succeed(url)
        : Effect.fail(new SchemaIssue.InvalidValue(Option.some(url))),
    ),
    encode: SchemaGetter.passthrough(),
  }),
);
const ServiceAccountEnv = Schema.Struct({
  SERVICE_ACCOUNT_TOKEN_PATH: Schema.optional(Schema.String),
  SERVICE_ACCOUNT_JWKS_URL: Schema.optional(Schema.String),
  SERVICE_ACCOUNT_JWKS_AUTH_TOKEN_PATH: Schema.optional(Schema.String),
  SERVICE_ACCOUNT_JWT_ISSUER: Schema.optional(Schema.String),
});
type ServiceAccountConfig = {
  readonly jwksAuthTokenPath: string;
  readonly jwksUrl: string;
  readonly issuer: string | undefined;
};

/**
 * SERVICE_ACCOUNT_JWKS_AUTH_TOKEN_PATH has three states:
 * undefined uses the service account token, "" disables the Authorization
 * header for external JWKS endpoints, and any other value is a custom path.
 */
let serviceAccountConfig: ServiceAccountConfig | undefined;
function getServiceAccountConfig() {
  if (serviceAccountConfig) return serviceAccountConfig;
  try {
    const env = Schema.decodeUnknownSync(ServiceAccountEnv)(process.env);
    const tokenPath = env.SERVICE_ACCOUNT_TOKEN_PATH?.trim() || KUBERNETES_TOKEN_PATH;
    const jwksUrl = Schema.decodeUnknownSync(ServiceAccountJwksUrl)(
      env.SERVICE_ACCOUNT_JWKS_URL?.trim() || KUBERNETES_JWKS_URL,
    );
    const jwksAuthTokenPath = normalizeJwksAuthTokenPath(
      tokenPath,
      env.SERVICE_ACCOUNT_JWKS_AUTH_TOKEN_PATH,
    );
    const issuer = env.SERVICE_ACCOUNT_JWT_ISSUER?.trim() || undefined;

    serviceAccountConfig = {
      jwksAuthTokenPath,
      jwksUrl,
      issuer,
    };
    return serviceAccountConfig;
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    throw new Error(`Invalid SERVICE_ACCOUNT_* env: ${message}`, { cause });
  }
}

function normalizeJwksAuthTokenPath(tokenPath: string, rawJwksAuthTokenPath: string | undefined) {
  if (rawJwksAuthTokenPath === undefined) return tokenPath;
  const trimmed = rawJwksAuthTokenPath.trim();
  if (trimmed === "" && rawJwksAuthTokenPath !== "") {
    console.warn(
      "SERVICE_ACCOUNT_JWKS_AUTH_TOKEN_PATH contains only whitespace; falling back to SERVICE_ACCOUNT_TOKEN_PATH.",
    );
    return tokenPath;
  }
  return trimmed;
}

let issuerWarningLogged = false;

async function readServiceAccountToken(tokenPath: string): Promise<string> {
  try {
    return (await readFile(tokenPath, "utf-8")).trim();
  } catch (cause) {
    throw new Error(
      `Failed to read service account token from ${tokenPath}. ` +
        `Ensure the workload has a mounted service account token.`,
      { cause },
    );
  }
}

// Cached JWKS instance to avoid reading K8s token on every verification.
let jwksInstance: ReturnType<typeof createRemoteJWKSet> | undefined;

function getJWKS() {
  if (jwksInstance) return jwksInstance;
  const { jwksUrl, jwksAuthTokenPath } = getServiceAccountConfig();

  jwksInstance = createRemoteJWKSet(
    new URL(jwksUrl),
    jwksAuthTokenPath === ""
      ? undefined
      : {
          [customFetch]: async (input: RequestInfo | URL, init?: RequestInit) => {
            const headers = new Headers(init?.headers);
            headers.set(
              "Authorization",
              `Bearer ${await readServiceAccountToken(jwksAuthTokenPath)}`,
            );
            return fetch(input, {
              ...init,
              headers,
            });
          },
        },
  );
  return jwksInstance;
}

/**
 * Verify Kubernetes projected ServiceAccount token
 *
 * Validates the token signature and audience. Issuer validation is optional:
 * when SERVICE_ACCOUNT_JWT_ISSUER is unset, jwtVerify receives issuer:
 * undefined and skips issuer validation. Set SERVICE_ACCOUNT_JWT_ISSUER in
 * non-Kubernetes environments that use a custom JWKS, or enforce equivalent
 * issuer checks at the trust boundary.
 *
 * Note: This only validates the K8s token structure. The discord_user_id
 * should be provided separately in the request body.
 */
export async function verifyKubernetesToken(
  token: string,
  expectedAudience: string,
): Promise<{ exp: number | undefined; sub: string }> {
  const jwks = getJWKS();
  const { issuer } = getServiceAccountConfig();
  if (!issuer && !issuerWarningLogged) {
    issuerWarningLogged = true;
    console.warn("SERVICE_ACCOUNT_JWT_ISSUER is unset; JWT issuer validation is disabled.");
  }

  const { payload } = await jwtVerify(token, jwks, {
    audience: expectedAudience,
    issuer,
  });

  // Validate that this is a ServiceAccount token
  if (!payload.sub?.startsWith("system:serviceaccount:")) {
    throw new Error("Invalid token: not a ServiceAccount token");
  }

  return {
    exp: payload.exp,
    sub: payload.sub,
  };
}

export interface KubernetesOAuthOptions {
  /**
   * Expected audience for Kubernetes tokens
   */
  audience: string;
}

const createSessionBody = Schema.Struct({
  token: Schema.String,
  discord_user_id: Schema.String,
}).pipe(Schema.toStandardSchemaV1);

type KubernetesOAuthCreateSessionEndpoint = AuthEndpoint<
  "/kubernetes-oauth/create-session",
  {
    method: "POST";
    body: typeof createSessionBody;
    metadata: {
      allowedMediaTypes: string[];
    };
  },
  {
    session: Session;
    user: User;
  }
>;

type KubernetesOAuthGetImplicitPermissionsEndpoint = AuthEndpoint<
  "/kubernetes-oauth/get-implicit-permissions",
  {
    method: "GET";
    use: AuthMiddleware[];
  },
  {
    permissions: Permission[];
  }
>;

type KubernetesOAuthPlugin = BetterAuthPlugin & {
  id: "kubernetes-oauth";
  endpoints: {
    createSession: KubernetesOAuthCreateSessionEndpoint;
    getImplicitPermissions: KubernetesOAuthGetImplicitPermissionsEndpoint;
  };
};

/**
 * Find user by Discord user ID via the account table (junction table).
 * The account table links internal user IDs to external OAuth provider IDs.
 */
async function findUserByDiscordId(adapter: InternalAdapter, discordUserId: string) {
  // 1. Find account by providerId + accountId (Discord user ID)
  const account = await adapter.findAccountByProviderId(discordUserId, "kubernetes:discord");

  if (!account?.userId) {
    return undefined;
  }

  return (await adapter.findUserById(account.userId)) ?? undefined;
}

/**
 * Create placeholder user and link it to Discord via account table.
 * This creates both a user record and an account record (junction).
 */
async function createPlaceholderUserWithDiscord(adapter: InternalAdapter, discordUserId: string) {
  const user = await adapter.createUser({
    email: `discord_${discordUserId}@k8s.internal`,
    emailVerified: true,
    name: `Discord User ${discordUserId}`,
  });

  await adapter.createAccount({
    userId: user.id,
    providerId: "kubernetes:discord",
    accountId: discordUserId,
  });

  return user;
}

/**
 * Better Auth plugin for Kubernetes token-based OAuth
 *
 * This plugin adds support for client_credentials grant type using
 * Kubernetes ServiceAccount tokens as the authentication mechanism.
 */
const makeKubernetesOAuth = (options: KubernetesOAuthOptions): KubernetesOAuthPlugin => {
  return {
    id: "kubernetes-oauth",
    endpoints: {
      createSession: createAuthEndpoint(
        "/kubernetes-oauth/create-session",
        {
          method: "POST",
          body: createSessionBody,
          metadata: {
            allowedMediaTypes: ["application/x-www-form-urlencoded", "application/json"],
          },
        },
        async (ctx) => {
          try {
            // Verify the Kubernetes token
            await verifyKubernetesToken(ctx.body.token, options.audience);
          } catch {
            throw new APIError("UNAUTHORIZED", {
              code: "INVALID_TOKEN",
              message: BASE_ERROR_CODES.INVALID_TOKEN,
            });
          }

          // 1. Look up user by discordUserId via account table (junction)
          let user = await findUserByDiscordId(
            ctx.context.internalAdapter,
            ctx.body.discord_user_id,
          );

          // 2. If not found, create placeholder user + account link
          if (!user) {
            user = await createPlaceholderUserWithDiscord(
              ctx.context.internalAdapter,
              ctx.body.discord_user_id,
            );
          }

          const session = await ctx.context.internalAdapter.createSession(user.id, true);

          if (!session) {
            ctx.context.logger.error("Failed to create session");
            throw new APIError("UNAUTHORIZED", {
              code: "FAILED_TO_CREATE_SESSION",
              message: BASE_ERROR_CODES.FAILED_TO_CREATE_SESSION,
            });
          }

          await setSessionCookie(
            ctx,
            {
              session,
              user,
            },
            true,
          );

          return ctx.json({
            session,
            user,
          });
        },
      ),
      getImplicitPermissions: createAuthEndpoint(
        "/kubernetes-oauth/get-implicit-permissions",
        {
          method: "GET",
          use: [sessionMiddleware],
        },
        async (ctx) => {
          const session = ctx.context.session;
          const accounts = await ctx.context.internalAdapter.findAccounts(session.user.id);

          let permissions: Permission[] = [];
          const kubernetesAccount = accounts.find(
            (account) => account.providerId === "kubernetes:discord",
          );
          if (kubernetesAccount?.accountId === DISCORD_SERVICE_USER_ID_SENTINEL) {
            permissions.push(...PermissionValues);
          }

          return ctx.json({
            permissions,
          });
        },
      ),
    },
  } satisfies KubernetesOAuthPlugin;
};

export const kubernetesOAuth: typeof makeKubernetesOAuth = makeKubernetesOAuth;
