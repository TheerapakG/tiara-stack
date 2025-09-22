import { loadConfig } from "c12";
import { REST, Routes } from "discord.js";
import { Chunk, Effect, pipe, Schema, Stream } from "effect";
import { Validate } from "typhoon-core/validator";
import { commands } from "./commands/chatInputCommands";
import { InteractionHandlerMap } from "./types/handler";

await loadConfig({ dotenv: true });

const envValidator = Validate.validate(
  pipe(
    Schema.Struct({
      DISCORD_TOKEN: Schema.String,
      DISCORD_CLIENT_ID: Schema.String,
      DISCORD_GUILD_ID: Schema.optional(Schema.String),
    }),
    Schema.rename({
      DISCORD_TOKEN: "discordToken",
      DISCORD_CLIENT_ID: "discordClientId",
      DISCORD_GUILD_ID: "discordGuildId",
    }),
    Schema.standardSchemaV1,
  ),
);

await Effect.runPromise(
  pipe(
    Effect.Do,
    Effect.bind("env", () => envValidator(process.env)),
    Effect.let("rest", ({ env }) => new REST().setToken(env.discordToken)),
    Effect.bind("commands", () =>
      pipe(
        Stream.fromIterable(InteractionHandlerMap.values(commands)),
        Stream.map((command) => command.data.toJSON()),
        Stream.runCollect,
        Effect.map(Chunk.toArray),
      ),
    ),
    Effect.tap(({ env, rest, commands }) =>
      Effect.try(() =>
        rest.put(
          env.discordGuildId
            ? Routes.applicationGuildCommands(
                env.discordClientId,
                env.discordGuildId,
              )
            : Routes.applicationCommands(env.discordClientId),
          {
            body: commands,
          },
        ),
      ),
    ),
  ),
);
