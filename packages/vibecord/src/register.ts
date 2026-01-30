import { REST, Routes } from "discord.js";
import { Config } from "./config/config";
import { commands } from "./commands";
import { Effect, pipe } from "effect";

const program = pipe(
  Effect.gen(function* () {
    const config = yield* Config;

    const rest = new REST({ version: "10" }).setToken(config.discordToken);

    console.log("Started refreshing application (/) commands.");

    yield* Config.use(async (config) => {
      await rest.put(Routes.applicationCommands(config.discordClientId), {
        body: commands.map((cmd) => cmd.data.toJSON()),
      });
    });

    console.log("Successfully reloaded application (/) commands.");
  }),
  Effect.provide(Config.Default),
);

Effect.runPromise(program);
