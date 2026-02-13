import {
  SlashCommandSubcommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
} from "discord.js";
import { getDb, schema } from "../../db/index";
import { eq, and } from "drizzle-orm";
import { isOwner } from "../../utils";
import { getWorkspaceByUserAndName } from "../../services/workspace";

const removeData = new SlashCommandSubcommandBuilder()
  .setName("remove")
  .setDescription("Remove a workspace")
  .addStringOption((option) =>
    option.setName("name").setDescription("Workspace name").setRequired(true),
  );

async function executeRemove(interaction: ChatInputCommandInteraction) {
  if (!isOwner(interaction)) {
    await interaction.reply({ content: "You are not the owner.", flags: MessageFlags.Ephemeral });
    return;
  }

  const name = interaction.options.getString("name", true);
  const userId = interaction.user.id;

  const workspace = await getWorkspaceByUserAndName(userId, name);

  if (!workspace) {
    await interaction.reply(`Workspace "${name}" not found!`);
    return;
  }

  const db = getDb();
  await db
    .update(schema.workspace)
    .set({ deletedAt: new Date() })
    .where(and(eq(schema.workspace.userId, userId), eq(schema.workspace.name, name)));

  await interaction.reply(`Workspace "${name}" removed!`);
}

export const workspaceRemove = { data: removeData, execute: executeRemove };
