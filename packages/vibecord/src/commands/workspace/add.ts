import {
  SlashCommandSubcommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
} from "discord.js";
import { isOwner } from "../../utils";
import { createOrUpdateWorkspace } from "../../services/workspace";

const addData = new SlashCommandSubcommandBuilder()
  .setName("add")
  .setDescription("Add a workspace")
  .addStringOption((option) =>
    option.setName("name").setDescription("Workspace name").setRequired(true),
  )
  .addStringOption((option) =>
    option.setName("cwd").setDescription("Working directory").setRequired(true),
  );

async function executeAdd(interaction: ChatInputCommandInteraction) {
  if (!isOwner(interaction)) {
    await interaction.reply({ content: "You are not the owner.", flags: MessageFlags.Ephemeral });
    return;
  }

  const name = interaction.options.getString("name", true);
  const cwd = interaction.options.getString("cwd", true);
  const userId = interaction.user.id;

  const { action } = await createOrUpdateWorkspace(userId, name, cwd);

  if (action === "updated") {
    await interaction.reply(`Workspace "${name}" updated!`);
  } else {
    await interaction.reply(`Workspace "${name}" added!`);
  }
}

export const workspaceAdd = { data: addData, execute: executeAdd };
