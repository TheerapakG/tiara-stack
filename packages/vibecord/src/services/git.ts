import simpleGit from "simple-git";
import path from "path";
import fs from "fs";
import os from "os";

export interface WorktreeResult {
  worktreePath: string;
  branchName: string;
  error: string | null;
}

export async function createWorktree(repoPath: string, sessionId: string): Promise<WorktreeResult> {
  try {
    const git = simpleGit(repoPath);

    // Check if repo is a git repository
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      return {
        worktreePath: "",
        branchName: "",
        error: "The workspace is not a git repository.",
      };
    }

    // Generate unique branch name based on session ID and timestamp
    const timestamp = Date.now();
    const branchName = `vibecord-session-${sessionId.slice(0, 8)}-${timestamp}`;

    // Get repo name for organizing worktrees
    const repoName = path.basename(repoPath);

    // Create worktrees directory in user's home folder
    const worktreesDir = path.join(os.homedir(), ".vibecord-worktrees", repoName);
    if (!fs.existsSync(worktreesDir)) {
      fs.mkdirSync(worktreesDir, { recursive: true });
    }

    const worktreePath = path.join(worktreesDir, branchName);

    // Create the worktree
    await git.raw(["worktree", "add", "-b", branchName, worktreePath]);

    return {
      worktreePath,
      branchName,
      error: null,
    };
  } catch (error) {
    return {
      worktreePath: "",
      branchName: "",
      error: `Failed to create worktree: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

export async function removeWorktree(
  repoPath: string,
  worktreePath: string,
): Promise<{ success: boolean; error: string | null }> {
  try {
    const git = simpleGit(repoPath);

    // Remove the worktree
    await git.raw(["worktree", "remove", worktreePath]);

    // Clean up the worktree directory if it exists
    if (fs.existsSync(worktreePath)) {
      fs.rmSync(worktreePath, { recursive: true, force: true });
    }

    // Extract branch name from worktree path and delete it
    const branchName = path.basename(worktreePath);
    try {
      await git.raw(["branch", "-D", branchName]);
    } catch {
      /* branch may already be deleted */
    }

    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error: `Failed to remove worktree: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

export async function isGitRepository(repoPath: string): Promise<boolean> {
  try {
    const git = simpleGit(repoPath);
    return await git.checkIsRepo();
  } catch {
    return false;
  }
}
