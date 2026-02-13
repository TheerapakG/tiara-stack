import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from "discord.js";
import { sdkClient } from "../../sdk/index";
import { isOwner } from "../../utils";
import { getValidSessionByThreadId, getWorkspaceById } from "../../services/session";
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
  if (!isOwner(interaction)) {
    await interaction.reply({
      content: "You are not the owner.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const modelName = interaction.options.getString("model", true);
  const threadId = interaction.channelId;

  const { session, error } = await getValidSessionByThreadId(threadId);
  if (error || !session) {
    await interaction.reply({
      content: error ?? "Unknown error",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Fetch workspace to get cwd for session info
  const workspace = await getWorkspaceById(session.workspaceId);
  if (!workspace) {
    await interaction.reply({
      content: "Workspace not found for this session.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Get session info to find available models and their IDs
  const sessionInfo = await sdkClient.getSessionInfo(workspace.cwd);

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
  await sdkClient.setSessionModel(session.acpSessionId, model.id);

  await interaction.reply({
    content: `Model set to "${model.name}" for this session.`,
  });
}

async function executeModeSet(interaction: ChatInputCommandInteraction) {
  if (!isOwner(interaction)) {
    await interaction.reply({
      content: "You are not the owner.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const modeName = interaction.options.getString("mode", true);
  const threadId = interaction.channelId;

  const { session, error } = await getValidSessionByThreadId(threadId);
  if (error || !session) {
    await interaction.reply({
      content: error ?? "Unknown error",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Fetch workspace to get cwd for session info
  const workspace = await getWorkspaceById(session.workspaceId);
  if (!workspace) {
    await interaction.reply({
      content: "Workspace not found for this session.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Get session info to find available modes and their IDs
  const sessionInfo = await sdkClient.getSessionInfo(workspace.cwd);

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
  await sdkClient.setSessionMode(session.acpSessionId, mode.id);

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

  const { session, error } = await getValidSessionByThreadId(threadId);
  if (error || !session) {
    await interaction.reply({
      content: error ?? "Unknown error",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Send the prompt to the SDK session
  await sdkClient.sendPrompt(session.acpSessionId, promptText);

  await interaction.reply({
    content: "Prompt sent to the session.",
  });
}

export const session = { data, execute };
