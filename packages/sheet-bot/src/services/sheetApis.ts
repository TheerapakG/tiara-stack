import { config } from "@/config";
import {
  FileSystem,
  HttpApiClient,
  HttpBody,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
  UrlParams,
} from "@effect/platform";
import { Cache, Duration, Effect, Exit, Ref, pipe, Schedule, Schema } from "effect";
import { Api } from "sheet-apis/api";

interface CachedToken {
  readonly token: string;
  readonly expiresIn: number;
}

const TokenResponseSchema = Schema.Struct({
  token: Schema.String,
  expires_in: Schema.Number,
});

const exchangeClientCredentials = (
  httpClient: HttpClient.HttpClient,
  tokenEndpoint: string,
  k8sToken: string,
  discordUserId: string,
): Effect.Effect<CachedToken, Error> => {
  return pipe(
    HttpClientRequest.post(tokenEndpoint),
    HttpClientRequest.setBody(
      HttpBody.urlParams(
        UrlParams.fromInput({
          token: k8sToken,
          discord_user_id: discordUserId,
        }),
      ),
    ),
    (request) => httpClient.execute(request),
    Effect.flatMap(HttpClientResponse.filterStatusOk),
    Effect.flatMap(HttpClientResponse.schemaBodyJson(TokenResponseSchema)),
    Effect.map((response) => ({
      token: response.token,
      expiresIn: response.expires_in,
    })),
    Effect.catchAll((error) =>
      pipe(
        Effect.logError(error),
        Effect.andThen(() => Effect.fail(new Error(`Failed to exchange token: ${error}`))),
      ),
    ),
  );
};

export class SheetApisClient extends Effect.Service<SheetApisClient>()("SheetApisClient", {
  scoped: pipe(
    Effect.all({
      fs: FileSystem.FileSystem,
      httpClient: HttpClient.HttpClient,
      k8sTokenRef: Ref.make(""),
      tokenEndpoint: pipe(
        config.sheetAuthIssuer,
        Effect.map((issuer) => `${issuer.replace(/\/$/, "")}/kubernetes-oauth/token`),
      ),
      baseUrl: config.sheetApisBaseUrl,
    }),
    Effect.tap(({ fs, k8sTokenRef }) =>
      // Periodic K8s token refresh every 5 minutes
      Effect.forkScoped(
        pipe(
          fs.readFileString("/var/run/secrets/tokens/sheet-auth-token", "utf-8"),
          Effect.map((token) => token.trim()),
          Effect.flatMap((token) => Ref.set(k8sTokenRef, token)),
          Effect.retry({ schedule: Schedule.exponential("1 second"), times: 3 }),
          Effect.catchAll(() => Effect.void),
          Effect.repeat(Schedule.spaced("5 minutes")),
        ),
      ),
    ),
    Effect.bind("tokenCache", ({ httpClient, tokenEndpoint, k8sTokenRef }) =>
      Cache.makeWith({
        capacity: Infinity,
        lookup: (discordUserId: string) =>
          pipe(
            Ref.get(k8sTokenRef),
            Effect.flatMap((k8sToken) =>
              exchangeClientCredentials(httpClient, tokenEndpoint, k8sToken, discordUserId),
            ),
          ),
        // Set TTL based on token's expires_in (minus 60 second buffer for safety)
        timeToLive: (exit) =>
          Exit.match(exit, {
            onFailure: () => Duration.minutes(1),
            onSuccess: (token) => Duration.seconds(token.expiresIn - 60),
          }),
      }),
    ),
    Effect.bind("client", ({ tokenCache, baseUrl }) =>
      HttpApiClient.make(Api, {
        transformClient: HttpClient.mapRequestEffect((request) =>
          pipe(
            // Future: extract discordUserId from request context for per-user impersonation
            tokenCache.get("dummy_discord_user_id"),
            Effect.map(({ token }) => HttpClientRequest.bearerToken(request, token)),
            Effect.catchAll(() => Effect.succeed(request)),
          ),
        ),
        baseUrl,
      }),
    ),
    Effect.map(({ client }) => ({
      get: () => client,
    })),
  ),
  accessors: true,
}) {}
