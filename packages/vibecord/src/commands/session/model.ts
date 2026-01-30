import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from "discord.js";
import { getDb, schema } from "../../db/index";
import { eq } from "drizzle-orm";
import { acpClient } from "../../acp/index";
import { isOwner } from "../../utils";

const modelData = new SlashCommandBuilder()
  .setName("model")
  .setDescription("Manage session model")
  .addSubcommandGroup((group) =>
    group
      .setName("set")
      .setDescription("Set the model")
      .addSubcommand((subcommand) =>
        subcommand
          .setName("model-id")
          .setDescription("Model ID to set")
          .addStringOption((option) =>
            option.setName("value").setDescription("Model ID value").setRequired(true),
          ),
      ),
  );

async function executeModel(interaction: ChatInputCommandInteraction) {
  const subcommandGroup = interaction.options.getSubcommandGroup();
  const subcommand = interaction.options.getSubcommand();

  if (subcommandGroup === "set" && subcommand === "model-id") {
    await executeModelSet(interaction);
  }
}

async function executeModelSet(interaction: ChatInputCommandInteraction) {
  if (!isOwner(interaction)) {
    await interaction.reply({
      content: "You are not the owner.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const modelId = interaction.options.getString("value", true);
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

  // Set the model
  await acpClient.setSessionModel(session.acpSessionId, modelId);

  // Update the database
  await db
    .update(schema.session)
    .set({ model: modelId, updatedAt: new Date() })
    .where(eq(schema.session.id, session.id));

  await interaction.reply({
    content: `Model set to "${modelId}" for this session.`,
  });
}

export const sessionModel = { data: modelData, execute: executeModel };
