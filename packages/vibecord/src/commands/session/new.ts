import {
  SlashCommandSubcommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
} from "discord.js";

import { sdkClient } from "../../sdk/index";
import { isOwner } from "../../utils";
import { getValidWorkspaceByUserAndName } from "../../services/workspace";
import { getDb, schema } from "../../db/index";

const newData = new SlashCommandSubcommandBuilder()
  .setName("new")
  .setDescription("Create a new session")
  .addStringOption((option) =>
    option.setName("workspace").setDescription("Workspace name").setRequired(true),
  );

async function executeNew(interaction: ChatInputCommandInteraction) {
  if (!isOwner(interaction)) {
    await interaction.reply({ content: "You are not the owner.", flags: MessageFlags.Ephemeral });
    return;
  }

  const workspaceName = interaction.options.getString("workspace", true);
  const userId = interaction.user.id;

  const { workspace, error } = await getValidWorkspaceByUserAndName(userId, workspaceName);
  if (error || !workspace) {
    await interaction.reply({
      content: error ?? "Unknown error",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Create a new Discord thread
  const channel = interaction.channel;
  if (!channel || !("threads" in channel)) {
    await interaction.reply({
      content: "This command must be used in a text channel.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Defer reply since session creation may take a while
  await interaction.deferReply();

  const threadName = `session-${workspaceName}-${Date.now()}`;
  let thread;
  try {
    thread = await channel.threads.create({
      name: threadName,
      reason: `Session for workspace ${workspaceName}`,
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as any).code === 50001) {
      await interaction.editReply({
        content:
          "I don't have permission to create threads in this channel. Please make sure I have the 'Create Public Threads' permission.",
      });
    } else {
      await interaction.editReply({
        content: `Failed to create thread: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
    return;
  }

  // Create SDK session with workspace cwd
  const sessionResponse = await sdkClient.createSession(workspace.cwd);
  const sdkSessionId = sessionResponse.sessionId;

  // Extract model and mode information
  const currentModelId = sessionResponse.models?.currentModelId;
  const availableModels = sessionResponse.models?.availableModels ?? [];
  const currentModeId = sessionResponse.modes?.currentModeId;
  const availableModes = sessionResponse.modes?.availableModes ?? [];

  // Find the name for the current model
  const currentModel = currentModelId
    ? (availableModels.find((m) => m.modelId === currentModelId)?.name ?? currentModelId)
    : "Unknown";

  // Find the name for the current mode
  const currentMode = currentModeId
    ? (availableModes.find((m) => m.id === currentModeId)?.name ?? currentModeId)
    : "Unknown";

  const db = getDb();

  // Store session in db (without model/mode since SDK tracks them)
  await db.insert(schema.session).values({
    workspaceId: workspace.id,
    threadId: thread.id,
    acpSessionId: sdkSessionId,
  });

  // Format available models list
  const modelsList =
    availableModels.length > 0
      ? availableModels
          .map(
            (m: { modelId: string; name: string; description?: string }) =>
              `  - ${m.name}${m.description ? ` (${m.description})` : ""}`,
          )
          .join("\n")
      : "  No models available";

  // Format available modes list
  const modesList =
    availableModes.length > 0
      ? availableModes
          .map(
            (m: { id: string; name: string; description?: string }) =>
              `  - ${m.name}${m.description ? ` (${m.description})` : ""}`,
          )
          .join("\n")
      : "  No modes available";

  // Send initial info to the thread
  await thread.send(
    `## New Session Created\n` +
      `**Workspace:** ${workspaceName}\n` +
      `**CWD:** ${workspace.cwd}\n` +
      `**Session ID:** ${sdkSessionId}\n\n` +
      `### Current Settings\n` +
      `**Model:** ${currentModel}\n` +
      `**Mode:** ${currentMode}\n\n` +
      `### Available Models\n` +
      `${modelsList}\n\n` +
      `### Available Modes\n` +
      `${modesList}`,
  );

  // SDK client will look up the thread from the database automatically

  await interaction.editReply({
    content: `Session created! See ${thread}`,
  });
}

export const sessionNew = { data: newData, execute: executeNew };
