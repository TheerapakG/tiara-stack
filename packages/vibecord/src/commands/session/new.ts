import {
  SlashCommandSubcommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
} from "discord.js";
import * as acp from "@agentclientprotocol/sdk";
import { getDb, schema } from "../../db/index";
import { eq, and } from "drizzle-orm";
import { acpClient } from "../../acp/index";
import { isOwner } from "../../utils";

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

  const db = getDb();

  // Look up workspace from db
  const workspace = await db
    .select()
    .from(schema.workspace)
    .where(and(eq(schema.workspace.userId, userId), eq(schema.workspace.name, workspaceName)))
    .get();

  if (!workspace) {
    await interaction.reply({
      content: `Workspace "${workspaceName}" not found!`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (workspace.deletedAt) {
    await interaction.reply({
      content: `Workspace "${workspaceName}" has been deleted!`,
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

  const threadName = `session-${workspaceName}-${Date.now()}`;
  let thread;
  try {
    thread = await channel.threads.create({
      name: threadName,
      reason: `Session for workspace ${workspaceName}`,
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as any).code === 50001) {
      await interaction.reply({
        content:
          "I don't have permission to create threads in this channel. Please make sure I have the 'Create Public Threads' permission.",
        flags: MessageFlags.Ephemeral,
      });
    } else {
      await interaction.reply({
        content: `Failed to create thread: ${error instanceof Error ? error.message : "Unknown error"}`,
        flags: MessageFlags.Ephemeral,
      });
    }
    return;
  }

  // Create ACP session with workspace cwd
  const sessionResponse = await acpClient.createSession(workspace.cwd);
  const acpSessionId = sessionResponse.sessionId;

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

  // Store session in db (without model/mode since ACP tracks them)
  await db.insert(schema.session).values({
    workspaceId: workspace.id,
    threadId: thread.id,
    acpSessionId,
  });

  // Format available models list
  const modelsList =
    availableModels.length > 0
      ? availableModels
          .map((m: acp.ModelInfo) => `  - ${m.name}${m.description ? ` (${m.description})` : ""}`)
          .join("\n")
      : "  No models available";

  // Format available modes list
  const modesList =
    availableModes.length > 0
      ? availableModes
          .map((m: acp.SessionMode) => `  - ${m.name}${m.description ? ` (${m.description})` : ""}`)
          .join("\n")
      : "  No modes available";

  // Send initial info to the thread
  await thread.send(
    `## New Session Created\n` +
      `**Workspace:** ${workspaceName}\n` +
      `**CWD:** ${workspace.cwd}\n` +
      `**Session ID:** ${acpSessionId}\n\n` +
      `### Current Settings\n` +
      `**Model:** ${currentModel}\n` +
      `**Mode:** ${currentMode}\n\n` +
      `### Available Models\n` +
      `${modelsList}\n\n` +
      `### Available Modes\n` +
      `${modesList}`,
  );

  // ACP client will look up the thread from the database automatically

  await interaction.reply({
    content: `Session created! See ${thread}`,
  });
}

export const sessionNew = { data: newData, execute: executeNew };
