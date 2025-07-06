import { type } from "arktype";
import { loadConfig } from "c12";
import { REST, Routes } from "discord.js";
import { Effect, pipe } from "effect";
import { validate } from "typhoon-core/schema";
import { commands } from "./commands";

await loadConfig({ dotenv: true });

const envValidator = validate(
  type({
    DISCORD_TOKEN: "string",
    DISCORD_CLIENT_ID: "string",
    "DISCORD_GUILD_ID?": "string",
  }).pipe(({ DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID }) => ({
    discordToken: DISCORD_TOKEN,
    discordClientId: DISCORD_CLIENT_ID,
    discordGuildId: DISCORD_GUILD_ID,
  })),
);

await Effect.runPromise(
  pipe(
    Effect.Do,
    Effect.bind("env", () => envValidator(process.env)),
    Effect.let("rest", ({ env }) => new REST().setToken(env.discordToken)),
    Effect.tap(({ env, rest }) =>
      Effect.try(() =>
        rest.put(
          env.discordGuildId
            ? Routes.applicationGuildCommands(
                env.discordClientId,
                env.discordGuildId,
              )
            : Routes.applicationCommands(env.discordClientId),
          {
            body: Object.values(commands).map((command) =>
              command.data.toJSON(),
            ),
          },
        ),
      ),
    ),
  ),
);
