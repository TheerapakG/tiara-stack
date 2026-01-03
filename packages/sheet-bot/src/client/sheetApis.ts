import { Config } from "@/config";
import { FileSystem } from "@effect/platform";
import { Effect, Option, pipe, Schedule } from "effect";
import { serverHandlerDataCollection } from "sheet-apis";
import { WebSocketClient } from "typhoon-client-ws/client";

export class SheetApisClient extends Effect.Service<SheetApisClient>()(
  "SheetApisClient",
  {
    scoped: Config.use((config) =>
      pipe(
        Effect.Do,
        Effect.bind("fs", () => FileSystem.FileSystem),
        Effect.bind("client", () =>
          Effect.acquireRelease(
            pipe(
              WebSocketClient.create(
                serverHandlerDataCollection,
                config.sheetApisBaseUrl,
              ),
              Effect.tap(WebSocketClient.connect),
            ),
            (client) => WebSocketClient.close(client),
          ),
        ),
        Effect.tap(({ fs, client }) =>
          Effect.forkScoped(
            pipe(
              fs.readFileString(
                "/var/run/secrets/tokens/sheet-apis-token",
                "utf-8",
              ),
              Effect.tap((token) =>
                WebSocketClient.token(Option.some(token))(client),
              ),
              Effect.catchAll(() => Effect.void),
              Effect.repeat(Schedule.spaced("5 minutes")),
            ),
          ),
        ),
        Effect.map(({ client }) => ({
          get: () => client,
        })),
      ),
    ),
    dependencies: [Config.Default],
    accessors: true,
  },
) {}
