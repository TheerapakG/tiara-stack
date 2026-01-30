import { SlashCommandBuilder } from "discord.js";
import { workspaceAdd } from "./add";
import { workspaceRemove } from "./remove";
import { ChatInputCommandInteraction } from "discord.js";

const data = new SlashCommandBuilder()
  .setName("workspace")
  .setDescription("Manage workspaces")
  .addSubcommand(workspaceAdd.data)
  .addSubcommand(workspaceRemove.data);

async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "add") {
    await workspaceAdd.execute(interaction);
  } else if (subcommand === "remove") {
    await workspaceRemove.execute(interaction);
  }
}

export const workspace = { data, execute };
