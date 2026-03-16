import { DateTime, Effect, Option, Redacted, Schema } from "effect";
import { createAuthClient } from "better-auth/client";
import { jwtClient } from "better-auth/client/plugins";
import { jwtVerify, createLocalJWKSet } from "jose";

// =============================================================================
// 1. Errors
// =============================================================================

export class SessionResponseError extends Schema.TaggedError<SessionResponseError>(
  "SessionResponseError",
)("SessionResponseError", {
  statusText: Schema.String,
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

/**
 * Error type for token verification failures
 */
export class TokenVerificationError extends Schema.TaggedError<TokenVerificationError>(
  "TokenVerificationError",
)("TokenVerificationError", {
  statusText: Schema.String,
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

/**
 * Error type for account retrieval failures
 */
export class AccountError extends Schema.TaggedError<AccountError>("AccountError")("AccountError", {
  statusText: Schema.String,
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

/**
 * Error type for Discord access token retrieval failures
 */
export class DiscordAccessTokenError extends Schema.TaggedError<DiscordAccessTokenError>(
  "DiscordAccessTokenError",
)("DiscordAccessTokenError", {
  statusText: Schema.String,
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

// =============================================================================
// 2. Types
// =============================================================================

export type Permission = "bot:manage_guild";

export interface TokenVerificationResult {
  payload: {
    sub: string;
    email?: string;
    name?: string;
    permissions?: Permission[];
    [key: string]: unknown;
  };
}

export type SheetAuthClientOption = ReturnType<typeof SheetAuthClientOption>;
export type SheetAuthClient = ReturnType<typeof createSheetAuthClient>;

// =============================================================================
// 3. Client Factory
// =============================================================================

const SheetAuthClientOption = (baseURL: string) => {
  return {
    baseURL,
    basePath: "/",
    fetchOptions: {
      credentials: "include" as const,
    },
    plugins: [jwtClient()],
  };
};

/**
 * Create a Better Auth client for stateless authentication.
 *
 * This client is used to call Better Auth APIs from services.
 * The JWT token is passed via the Authorization header in fetchOptions.
 *
 * @param baseURL - Base URL of the auth server
 * @returns Better Auth client instance
 *
 * @example
 * ```typescript
 * const client = createSheetAuthClient("https://auth.example.com");
 *
 * // Use with bearer token (from JWT)
 * const { data } = await client.getAccessToken({
 *   providerId: "discord",
 *   fetchOptions: {
 *     headers: {
 *       Authorization: `Bearer ${jwtToken}`,
 *     },
 *   },
 * });
 * ```
 */
export function createSheetAuthClient(baseURL: string) {
  return createAuthClient(SheetAuthClientOption(baseURL));
}

// =============================================================================
// 4. Session
// =============================================================================

export class Session extends Schema.TaggedClass<Session>()("Session", {
  user: Schema.Struct({
    createdAt: Schema.DateTimeUtcFromNumber,
    updatedAt: Schema.DateTimeUtcFromNumber,
    email: Schema.String,
    emailVerified: Schema.Boolean,
    name: Schema.String,
    image: Schema.optional(Schema.NullOr(Schema.String)),
  }),
  session: Schema.UndefinedOr(
    Schema.Struct({
      createdAt: Schema.DateTimeUtcFromNumber,
      updatedAt: Schema.DateTimeUtcFromNumber,
      userId: Schema.String,
      expiresAt: Schema.DateTimeUtcFromNumber,
      token: Schema.String,
      ipAddress: Schema.optional(Schema.NullOr(Schema.String)),
      userAgent: Schema.optional(Schema.NullOr(Schema.String)),
    }),
  ),
}) {}

/**
 * Get the session using the Better Auth client.
 *
 * @param client - Better Auth client instance
 * @returns Effect with the session
 */
export function getSession(
  client: SheetAuthClient,
  headers?: Headers | HeadersInit,
): Effect.Effect<Option.Option<Session>, SessionResponseError> {
  return Effect.gen(function* () {
    const session = yield* Effect.tryPromise({
      try: async () =>
        await client.getSession({
          fetchOptions: {
            headers,
          },
        }),
      catch: (error) =>
        new SessionResponseError({
          statusText: "GET_SESSION_FAILED",
          message: `GET_SESSION_FAILED: ${error instanceof Error ? error.message : "Failed to get session"}`,
          cause: error,
        }),
    });

    if (session.error) {
      yield* Effect.fail(
        new SessionResponseError({
          statusText: session.error.statusText,
          message: `${session.error.statusText}: ${session.error.message || "Failed to get session"}`,
          cause: session.error,
        }),
      );
      return Option.none();
    }

    return Option.fromNullable(session.data).pipe(
      Option.map((data) =>
        Session.make({
          user: {
            createdAt: DateTime.unsafeFromDate(data.user.createdAt),
            updatedAt: DateTime.unsafeFromDate(data.user.updatedAt),
            email: data.user.email,
            emailVerified: data.user.emailVerified,
            name: data.user.name,
            image: data.user.image,
          },
          session: data.session
            ? {
                createdAt: DateTime.unsafeFromDate(data.session.createdAt),
                updatedAt: DateTime.unsafeFromDate(data.session.updatedAt),
                userId: data.session.userId,
                expiresAt: DateTime.unsafeFromDate(data.session.expiresAt),
                token: data.session.token,
                ipAddress: data.session.ipAddress,
                userAgent: data.session.userAgent,
              }
            : undefined,
        }),
      ),
    );
  });
}

// =============================================================================
// 5. Token
// =============================================================================

/**
 * Get the token using the Better Auth client.
 *
 * @param client - Better Auth client instance
 * @returns Effect with the token
 */
export function getToken(client: SheetAuthClient, headers?: Headers | HeadersInit) {
  return Effect.gen(function* () {
    const token = yield* Effect.tryPromise({
      try: async () =>
        await client.token({
          fetchOptions: {
            headers,
          },
        }),
      catch: (error) =>
        new SessionResponseError({
          statusText: "GET_TOKEN_FAILED",
          message: `GET_TOKEN_FAILED: ${error instanceof Error ? error.message : "Failed to get token"}`,
          cause: error,
        }),
    });

    if (token.error) {
      yield* Effect.fail(
        new SessionResponseError({
          statusText: token.error.statusText,
          message: `${token.error.statusText}: ${token.error.message || "Failed to get token"}`,
          cause: token.error,
        }),
      );
      return Option.none();
    }

    return Option.some(token.data.token);
  });
}

// =============================================================================
// 6. Token Verification
// =============================================================================

/**
 * Verify a JWT token using Better Auth's client to fetch JWKS,
 * then verify the token locally with jose.
 *
 * Returns standard JWT claims (sub, email, name).
 * To get Discord user ID, use the Better Auth client separately.
 *
 * @param client - Better Auth client instance (with jwtClient plugin)
 * @param token - JWT token to verify
 * @returns Effect with verification result containing standard claims
 */
export function verifyToken(
  client: SheetAuthClient,
  token: string,
): Effect.Effect<TokenVerificationResult, TokenVerificationError> {
  return Effect.gen(function* () {
    // Fetch JWKS using the client
    const jwksData = yield* Effect.tryPromise({
      try: async () => {
        const result = await client.jwks();

        if (result.error) {
          throw new Error(result.error.message || "Failed to fetch JWKS");
        }

        return result.data;
      },
      catch: (error) =>
        new TokenVerificationError({
          statusText: "FETCH_JWKS_FAILED",
          message: `FETCH_JWKS_FAILED: ${error instanceof Error ? error.message : "Failed to fetch JWKS"}`,
          cause: error,
        }),
    });

    // Verify the token using jose with the fetched JWKS
    const { payload } = yield* Effect.tryPromise({
      try: async () => {
        const JWKS = createLocalJWKSet(jwksData);
        return await jwtVerify(token, JWKS);
      },
      catch: (error) =>
        new TokenVerificationError({
          statusText: "TOKEN_VERIFICATION_FAILED",
          message: `TOKEN_VERIFICATION_FAILED: ${error instanceof Error ? error.message : "Token verification failed"}`,
          cause: error,
        }),
    });

    const userId = payload.sub as string | undefined;

    if (!userId) {
      return yield* new TokenVerificationError({
        statusText: "TOKEN_MISSING_SUB_CLAIM",
        message: "TOKEN_MISSING_SUB_CLAIM: Token missing sub claim",
      });
    }

    return {
      payload: {
        ...payload,
        sub: userId,
        email: payload.email as string | undefined,
        name: payload.name as string | undefined,
        permissions: payload.permissions as Permission[] | undefined,
      },
    };
  });
}

// =============================================================================
// 7. Account
// =============================================================================

export class Account extends Schema.TaggedClass<Account>()("Account", {
  scopes: Schema.Array(Schema.String),
  userId: Schema.String,
  accountId: Schema.String,
  providerId: Schema.String,
  createdAt: Schema.DateTimeUtcFromNumber,
  updatedAt: Schema.DateTimeUtcFromNumber,
}) {}

/**
 * Get account using the Better Auth client.
 *
 * @param client - Better Auth client instance
 * @param providerIds - Provider IDs to filter by
 * @param headers - Headers for authentication
 * @returns Effect with the account
 */
export function getAccount(
  client: SheetAuthClient,
  providerIds: string[],
  headers?: Headers | HeadersInit,
): Effect.Effect<Account, AccountError> {
  return Effect.gen(function* () {
    const accounts = yield* Effect.tryPromise({
      try: async () =>
        await client.listAccounts({
          fetchOptions: {
            headers,
          },
        }),
      catch: (error) =>
        new AccountError({
          statusText: "GET_ACCOUNTS_FAILED",
          message: `GET_ACCOUNTS_FAILED: ${error instanceof Error ? error.message : String(error)}`,
          cause: error,
        }),
    });

    if (accounts.error) {
      return yield* Effect.fail(
        new AccountError({
          statusText: accounts.error.statusText,
          message: `${accounts.error.statusText}: ${accounts.error.message || "Failed to get accounts"}`,
          cause: accounts.error,
        }),
      );
    }

    const account = accounts.data?.find((account) => providerIds.includes(account.providerId));
    if (!account) {
      return yield* Effect.fail(
        new AccountError({
          statusText: "ACCOUNT_NOT_FOUND",
          message: "ACCOUNT_NOT_FOUND: Account not found",
        }),
      );
    }

    return Account.make({
      scopes: account.scopes,
      userId: account.userId,
      accountId: account.accountId,
      providerId: account.providerId,
      createdAt: DateTime.unsafeFromDate(account.createdAt),
      updatedAt: DateTime.unsafeFromDate(account.updatedAt),
    });
  });
}

// =============================================================================
// 8. Discord Access Token
// =============================================================================

/**
 * Get Discord access token using the Better Auth client.
 *
 * This function calls Better Auth's getAccessToken endpoint which:
 * - Returns the current access token if valid
 * - Automatically refreshes the token if expired
 *
 * The JWT token is passed via the Authorization header for authentication.
 *
 * @param client - Better Auth client instance
 * @param jwtToken - JWT bearer token for authentication
 * @returns Effect with the access token
 */
export function getDiscordAccessToken(
  client: SheetAuthClient,
  headers?: Headers | HeadersInit,
): Effect.Effect<{ accessToken: Redacted.Redacted<string> }, DiscordAccessTokenError> {
  return Effect.gen(function* () {
    const accessToken = yield* Effect.tryPromise({
      try: async () =>
        await client.getAccessToken({
          providerId: "discord",
          fetchOptions: {
            headers,
          },
        }),
      catch: (error) =>
        error instanceof DiscordAccessTokenError
          ? error
          : new DiscordAccessTokenError({
              statusText: "GET_DISCORD_ACCESS_TOKEN_FAILED",
              message: `GET_DISCORD_ACCESS_TOKEN_FAILED: ${error instanceof Error ? error.message : "Failed to get Discord access token"}`,
              cause: error,
            }),
    });

    if (accessToken.error) {
      return yield* Effect.fail(
        new DiscordAccessTokenError({
          statusText: accessToken.error.statusText,
          message: `${accessToken.error.statusText}: ${accessToken.error.message || "Failed to get Discord access token"}`,
          cause: accessToken.error,
        }),
      );
    }

    if (!accessToken.data?.accessToken) {
      return yield* Effect.fail(
        new DiscordAccessTokenError({
          statusText: "NO_DISCORD_ACCESS_TOKEN",
          message: "NO_DISCORD_ACCESS_TOKEN: No Discord access token returned from Better Auth",
        }),
      );
    }

    return { accessToken: Redacted.make(accessToken.data.accessToken) };
  });
}
