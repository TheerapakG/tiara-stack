import { Effect, Layer, pipe } from "effect";
import { DBSubscriptionContext } from "typhoon-server/db";
import { Bot } from "./bot";
import { buttons } from "./buttons";
import { commands } from "./commands";
import { Config } from "./config";
import { DB } from "./db";
import { GoogleLive } from "./google";
import { ChannelConfigService } from "./services/channelConfigService";
import { GuildConfigService } from "./services/guildConfigService";
import { ScheduleService } from "./services/scheduleService";

const layer = pipe(
  ScheduleService.DefaultWithoutDependencies,
  Layer.provideMerge(
    Layer.mergeAll(
      GuildConfigService.DefaultWithoutDependencies,
      ChannelConfigService.DefaultWithoutDependencies,
    ),
  ),
  Layer.provideMerge(DBSubscriptionContext.Default),
  Layer.provideMerge(DB.DefaultWithoutDependencies),
  Layer.provideMerge(GoogleLive),
  Layer.provideMerge(Config.Default),
);

await Effect.runPromise(
  pipe(
    Effect.Do,
    Effect.bind("bot", () =>
      pipe(
        Bot.create(layer),
        Effect.flatMap(Bot.registerProcessHandlers),
        Effect.flatMap(Bot.addChatInputCommandHandlerMap(commands)),
        Effect.flatMap(Bot.addButtonInteractionHandlerMap(buttons)),
      ),
    ),
    Effect.flatMap(({ bot }) => Bot.login(bot)),
    Effect.provide(layer),
  ),
);
