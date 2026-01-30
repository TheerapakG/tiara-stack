import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from "discord.js";
import { getDb, schema } from "../../db/index";
import { eq } from "drizzle-orm";
import { acpClient } from "../../acp/index";
import { isOwner } from "../../utils";

const modeData = new SlashCommandBuilder()
  .setName("mode")
  .setDescription("Manage session mode")
  .addSubcommandGroup((group) =>
    group
      .setName("set")
      .setDescription("Set the mode")
      .addSubcommand((subcommand) =>
        subcommand
          .setName("mode-id")
          .setDescription("Mode ID to set")
          .addStringOption((option) =>
            option.setName("value").setDescription("Mode ID value").setRequired(true),
          ),
      ),
  );

async function executeMode(interaction: ChatInputCommandInteraction) {
  const subcommandGroup = interaction.options.getSubcommandGroup();
  const subcommand = interaction.options.getSubcommand();

  if (subcommandGroup === "set" && subcommand === "mode-id") {
    await executeModeSet(interaction);
  }
}

async function executeModeSet(interaction: ChatInputCommandInteraction) {
  if (!isOwner(interaction)) {
    await interaction.reply({
      content: "You are not the owner.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const modeId = interaction.options.getString("value", true);
  const threadId = interaction.channelId;

  const db = getDb();

  // Look up session by thread ID
  const session = await db
    .select()
    .from(schema.session)
    .where(eq(schema.session.threadId, threadId))
    .get();

  if (!session) {
    await interaction.reply({
      content: "No session found for this thread.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (session.deletedAt) {
    await interaction.reply({
      content: "This session has been deleted.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Set the mode
  await acpClient.setSessionMode(session.acpSessionId, modeId);

  // Update the database
  await db
    .update(schema.session)
    .set({ mode: modeId, updatedAt: new Date() })
    .where(eq(schema.session.id, session.id));

  await interaction.reply({
    content: `Mode set to "${modeId}" for this session.`,
  });
}

export const sessionMode = { data: modeData, execute: executeMode };
