import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from "discord.js";
import { getDb, schema } from "../../db/index";
import { eq } from "drizzle-orm";
import { acpClient } from "../../acp/index";
import { isOwner } from "../../utils";
import { sessionNew } from "./new";

const data = new SlashCommandBuilder()
  .setName("session")
  .setDescription("Manage sessions")
  .addSubcommand(sessionNew.data)
  .addSubcommand((subcommand) =>
    subcommand
      .setName("prompt")
      .setDescription("Send a prompt to the session")
      .addStringOption((option) =>
        option.setName("text").setDescription("Prompt text").setRequired(true),
      ),
  )
  .addSubcommandGroup((group) =>
    group
      .setName("model")
      .setDescription("Manage session model")
      .addSubcommand((subcommand) =>
        subcommand
          .setName("set")
          .setDescription("Set the model")
          .addStringOption((option) =>
            option.setName("model").setDescription("Model name to set").setRequired(true),
          ),
      ),
  )
  .addSubcommandGroup((group) =>
    group
      .setName("mode")
      .setDescription("Manage session mode")
      .addSubcommand((subcommand) =>
        subcommand
          .setName("set")
          .setDescription("Set the mode")
          .addStringOption((option) =>
            option.setName("mode").setDescription("Mode name to set").setRequired(true),
          ),
      ),
  );

async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();
  const subcommandGroup = interaction.options.getSubcommandGroup();

  if (subcommand === "new") {
    await sessionNew.execute(interaction);
  } else if (subcommand === "prompt") {
    await executePrompt(interaction);
  } else if (subcommandGroup === "model" && subcommand === "set") {
    await executeModelSet(interaction);
  } else if (subcommandGroup === "mode" && subcommand === "set") {
    await executeModeSet(interaction);
  }
}

async function executeModelSet(interaction: ChatInputCommandInteraction) {
  const modelName = interaction.options.getString("model", true);
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

  // Get session info to find available models and their IDs
  const sessionInfo = await acpClient.getSessionInfo("");

  // Find the model ID by name
  const model = sessionInfo.models.find((m) => m.name.toLowerCase() === modelName.toLowerCase());
  if (!model) {
    await interaction.reply({
      content: `Model "${modelName}" not found. Available models: ${sessionInfo.models.map((m) => m.name).join(", ")}`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Set the model
  await acpClient.setSessionModel(session.acpSessionId, model.id);

  await interaction.reply({
    content: `Model set to "${model.name}" for this session.`,
  });
}

async function executeModeSet(interaction: ChatInputCommandInteraction) {
  const modeName = interaction.options.getString("mode", true);
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

  // Get session info to find available modes and their IDs
  const sessionInfo = await acpClient.getSessionInfo("");

  // Find the mode ID by name
  const mode = sessionInfo.modes.find((m) => m.name.toLowerCase() === modeName.toLowerCase());
  if (!mode) {
    await interaction.reply({
      content: `Mode "${modeName}" not found. Available modes: ${sessionInfo.modes.map((m) => m.name).join(", ")}`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Set the mode
  await acpClient.setSessionMode(session.acpSessionId, mode.id);

  await interaction.reply({
    content: `Mode set to "${mode.name}" for this session.`,
  });
}

async function executePrompt(interaction: ChatInputCommandInteraction) {
  if (!isOwner(interaction)) {
    await interaction.reply({
      content: "You are not the owner.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const promptText = interaction.options.getString("text", true);
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

  // Send the prompt to the ACP session
  await acpClient.sendPrompt(session.acpSessionId, promptText);

  await interaction.reply({
    content: "Prompt sent to the session.",
  });
}

export const session = { data, execute };
