import {
  SlashCommandSubcommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
} from "discord.js";

import { isOwner } from "../../utils";
import { getValidSessionByThreadId, getWorkspaceById, closeSession } from "../../services/session";
import { removeWorktree } from "../../services/git";

const closeData = new SlashCommandSubcommandBuilder()
  .setName("close")
  .setDescription("Close the current session and remove the git worktree if one exists");

async function executeClose(interaction: ChatInputCommandInteraction) {
  if (!isOwner(interaction)) {
    await interaction.reply({ content: "You are not the owner.", flags: MessageFlags.Ephemeral });
    return;
  }

  const threadId = interaction.channelId;

  // Defer reply since worktree removal may take a while
  await interaction.deferReply();

  const { session, error } = await getValidSessionByThreadId(threadId);
  if (error || !session) {
    await interaction.editReply({
      content: error ?? "Unknown error",
    });
    return;
  }

  // Get workspace to find the repo path for worktree removal
  const workspace = await getWorkspaceById(session.workspaceId);
  if (!workspace) {
    await interaction.editReply({
      content: "Workspace not found for this session.",
    });
    return;
  }

  // Remove worktree if one exists
  if (session.worktreePath) {
    const result = await removeWorktree(workspace.cwd, session.worktreePath);
    if (!result.success) {
      await interaction.editReply({
        content: `Failed to remove git worktree: ${result.error}\n\nSession close aborted.`,
      });
      return;
    }
  }

  // Close the session (soft delete)
  const closeResult = await closeSession(session.id);
  if (!closeResult.success) {
    await interaction.editReply({
      content: `Failed to close session: ${closeResult.error}`,
    });
    return;
  }

  // Build the response message
  let responseMessage = "Session closed successfully.";

  if (session.worktreePath) {
    responseMessage += `\nGit worktree at \`${session.worktreePath}\` has been removed.`;
  }

  // Lock the thread if possible
  const channel = interaction.channel;
  if (channel && "setLocked" in channel) {
    try {
      await channel.setLocked(true, "Session closed");
      responseMessage += "\n\nThis thread has been locked.";
    } catch {
      responseMessage += "\n\n⚠️ Note: Could not lock the thread.";
    }
  }

  await interaction.editReply({
    content: responseMessage,
  });
}

export const sessionClose = { data: closeData, execute: executeClose };
