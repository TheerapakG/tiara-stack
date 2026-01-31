import { bindObject } from "@/utils";
import { Effect, pipe } from "effect";
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
            sheetApisClient.get().guildConfig.getAutoCheckinGuilds(),
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
