import { ChatInputCommandInteraction, SharedSlashCommand } from "discord.js";
import { Effect } from "effect";

export type Command<E = unknown, R = unknown> = {
  data: SharedSlashCommand;
  execute: (
    interaction: ChatInputCommandInteraction,
  ) => Effect.Effect<unknown, E, R>;
};

export const defineCommand = <E = unknown, R = unknown>(
  data: SharedSlashCommand,
  execute: (
    interaction: ChatInputCommandInteraction,
  ) => Effect.Effect<unknown, E, R>,
): Command<E, R> => ({
  data,
  execute,
});
