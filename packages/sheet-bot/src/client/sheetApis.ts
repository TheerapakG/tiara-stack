import { Effect, pipe } from "effect";
import type { Server } from "sheet-apis";
import { WebSocketClient } from "typhoon-client-ws/client";
import { Config } from "../config";

export class SheetApisClient extends Effect.Service<SheetApisClient>()(
  "SheetApisClient",
  {
    scoped: pipe(
      Effect.Do,
      Effect.bind("config", () => Config),
      Effect.bind("client", ({ config }) =>
        pipe(
          WebSocketClient.create<Server>(config.sheetApisBaseUrl),
          Effect.tap(WebSocketClient.connect),
        ),
      ),
      Effect.tap(({ client }) =>
        Effect.addFinalizer(() => WebSocketClient.close(client)),
      ),
      Effect.map(({ client }) => ({
        get: () => client,
      })),
    ),
    dependencies: [Config.Default],
    accessors: true,
  },
) {}
