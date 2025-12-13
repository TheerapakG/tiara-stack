import { bindObject } from "@/utils";
import { Effect, pipe } from "effect";
import { WebSocketClient } from "typhoon-client-ws/client";
import { SheetApisClient } from "~~/src/client/sheetApis";

export class BotGuildConfigService extends Effect.Service<BotGuildConfigService>()(
  "BotGuildConfigService",
  {
    effect: pipe(
      Effect.Do,
      bindObject({
        sheetApisClient: SheetApisClient,
      }),
      Effect.map(({ sheetApisClient }) => ({
        getAutoCheckinGuilds: () =>
          pipe(
            WebSocketClient.subscribeScoped(
              sheetApisClient.get(),
              "guildConfig.getAutoCheckinGuilds",
              {},
            ),
            Effect.map(
              Effect.withSpan(
                "BotGuildConfigService.getAutoCheckinGuilds subscription",
                {
                  captureStackTrace: true,
                },
              ),
            ),
            Effect.withSpan("BotGuildConfigService.getAutoCheckinGuilds", {
              captureStackTrace: true,
            }),
          ),
      })),
    ),
    dependencies: [SheetApisClient.Default],
    accessors: true,
  },
) {}
