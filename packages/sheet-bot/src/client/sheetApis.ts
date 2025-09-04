import { Config } from "@/config";
import { Effect, pipe } from "effect";
import type { Server } from "sheet-apis";
import { WebSocketClient } from "typhoon-client-ws/client";

export class SheetApisClient extends Effect.Service<SheetApisClient>()(
  "SheetApisClient",
  {
    scoped: Config.use((config) =>
      pipe(
        Effect.acquireRelease(
          pipe(
            WebSocketClient.create<Server>(config.sheetApisBaseUrl),
            Effect.tap(WebSocketClient.connect),
          ),
          (client) => WebSocketClient.close(client),
        ),
        Effect.map((client) => ({
          get: () => client,
        })),
      ),
    ),
    dependencies: [Config.Default],
    accessors: true,
  },
) {}
