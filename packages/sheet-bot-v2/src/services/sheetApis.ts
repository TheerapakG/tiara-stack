import { Config } from "@/config";
import { FileSystem, HttpApiClient, HttpClient, HttpClientRequest } from "@effect/platform";
import { Effect, Option, pipe, Schedule, SynchronizedRef } from "effect";
import { Api } from "sheet-apis/api";

export class SheetApisClient extends Effect.Service<SheetApisClient>()("SheetApisClient", {
  scoped: Config.use((config) =>
    pipe(
      Effect.all({
        fs: FileSystem.FileSystem,
        token: SynchronizedRef.make(Option.none<string>()),
      }),
      Effect.tap(({ fs, token }) =>
        Effect.forkScoped(
          pipe(
            fs.readFileString("/var/run/secrets/tokens/sheet-apis-token", "utf-8"),
            Effect.tap((newToken) => SynchronizedRef.update(token, () => Option.some(newToken))),
            Effect.catchAll(() => Effect.void),
            Effect.repeat(Schedule.spaced("5 minutes")),
          ),
        ),
      ),
      Effect.bind("client", ({ token }) =>
        HttpApiClient.make(Api, {
          transformClient: HttpClient.mapRequestEffect((request) =>
            pipe(
              Effect.all({ token: SynchronizedRef.get(token), request: Effect.succeed(request) }),
              Effect.map(({ token, request }) =>
                Option.match(token, {
                  onSome: (token) => HttpClientRequest.bearerToken(request, token),
                  onNone: () => request,
                }),
              ),
            ),
          ),
          baseUrl: config.sheetApisBaseUrl,
        }),
      ),
      Effect.map(({ client }) => ({
        get: () => client,
      })),
    ),
  ),
  dependencies: [Config.Default],
  accessors: true,
}) {}
