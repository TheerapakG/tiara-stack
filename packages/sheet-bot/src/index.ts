import { Effect, Layer, pipe } from "effect";
import { DBSubscriptionContext } from "typhoon-server/db";
import { Bot } from "./bot";
import { commands } from "./commands";
import { Config } from "./config";
import { DB } from "./db";
import { GoogleSheets } from "./google";

const layer = Layer.mergeAll(
  Config.Default(),
  DB.Default(),
  GoogleSheets.Default(),
  Layer.effect(DBSubscriptionContext, DBSubscriptionContext.empty()),
);

await Effect.runPromise(
  pipe(
    Effect.Do,
    Effect.bind("bot", () =>
      pipe(
        Bot.create(layer),
        Effect.flatMap(Bot.registerProcessHandlers),
        Effect.flatMap((bot) =>
          Effect.reduce(Object.values(commands), bot, (bot, command) =>
            Bot.addCommand(command)(bot),
          ),
        ),
      ),
    ),
    Effect.flatMap(({ bot }) => Bot.login(bot)),
    Effect.provide(layer),
  ),
);
