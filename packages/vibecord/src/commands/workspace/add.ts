import {
  SlashCommandSubcommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
} from "discord.js";
import { getDb, schema } from "../../db/index";
import { eq, and } from "drizzle-orm";
import { isOwner } from "../../utils";

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

  const db = getDb();

  const existing = await db
    .select()
    .from(schema.workspace)
    .where(and(eq(schema.workspace.userId, userId), eq(schema.workspace.name, name)))
    .get();

  if (existing) {
    await db
      .update(schema.workspace)
      .set({ cwd, updatedAt: new Date() })
      .where(eq(schema.workspace.id, existing.id));
    await interaction.reply(`Workspace "${name}" updated!`);
  } else {
    await db.insert(schema.workspace).values({ userId, name, cwd });
    await interaction.reply(`Workspace "${name}" added!`);
  }
}

export const workspaceAdd = { data: addData, execute: executeAdd };
