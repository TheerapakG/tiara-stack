import { Client, GatewayIntentBits, Collection } from "discord.js";
import { Config } from "../config/config";
import { commands } from "../commands/index";
import { acpClient } from "../acp/index";
import { Effect, pipe } from "effect";

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const commandMap = new Collection<string, unknown>();

for (const cmd of commands) {
  const json = cmd.data.toJSON() as {
    name: string;
    options?: Array<{
      type: number;
      name: string;
      options?: Array<{ type: number; name: string }>;
    }>;
  };

  if (json.options) {
    for (const option of json.options) {
      if (option.type === 1) {
        // Subcommand
        commandMap.set(`${json.name} ${option.name}`, cmd);
      } else if (option.type === 2 && option.options) {
        // Subcommand group with subcommands
        for (const subOption of option.options) {
          if (subOption.type === 1) {
            commandMap.set(`${json.name} ${option.name} ${subOption.name}`, cmd);
          }
        }
      }
    }
  } else {
    commandMap.set(json.name, cmd);
  }
}

const botProgram = pipe(
  Effect.gen(function* () {
    client.on("ready", async () => {
      console.log(`Logged in as ${client.user?.tag}!`);

      await client.application?.fetch();
      console.log(`Owner ID: ${client.application?.owner?.id}`);

      // Set Discord client for ACP client to use for thread lookups
      acpClient.setDiscordClient(client);

      // Connect to OpenCode ACP
      try {
        await acpClient.connect();
      } catch (err) {
        console.error("Failed to connect to OpenCode:", err);
      }
    });

    client.on("interactionCreate", async (interaction) => {
      if (!interaction.isChatInputCommand()) return;

      const commandName = interaction.commandName;
      const subcommand = interaction.options.getSubcommand(false);
      const subcommandGroup = interaction.options.getSubcommandGroup(false);

      let key: string;
      if (subcommandGroup && subcommand) {
        key = `${commandName} ${subcommandGroup} ${subcommand}`;
      } else if (subcommand) {
        key = `${commandName} ${subcommand}`;
      } else {
        key = commandName;
      }

      const cmd = commandMap.get(key);
      if (cmd) {
        const execute = (
          cmd as {
            execute: (
              interaction: import("discord.js").ChatInputCommandInteraction,
            ) => Promise<void>;
          }
        ).execute;
        await execute(interaction);
      }
    });

    const config = yield* Config;
    yield* Effect.tryPromise(() => client.login(config.discordToken));
  }),
  Effect.provide(Config.Default),
);

Effect.runPromise(botProgram);
