import { spawn } from "node:child_process";
import * as acp from "@agentclientprotocol/sdk";
import * as Diff from "diff";
import { Writable, Readable } from "node:stream";
import { Client, ThreadChannel } from "discord.js";
import { getDb, schema } from "../db/index";
import { eq } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

interface BatchEntry {
  sessionId: string;
  updateType: string;
  content: string;
}

class VibecordClient implements acp.Client {
  private connection: acp.ClientSideConnection | null = null;
  private discordClient: Client | null = null;
  private activeBatch: Map<string, BatchEntry[]> = new Map();
  private flushingBatch: Map<string, BatchEntry[]> = new Map();
  private batchTimer: ReturnType<typeof setInterval> | null = null;
  private batchIntervalMs = 5000;

  setDiscordClient(client: Client): void {
    this.discordClient = client;
  }

  async requestPermission(
    params: acp.RequestPermissionRequest,
  ): Promise<acp.RequestPermissionResponse> {
    // Prefer allow_always, fallback to allow_once, cancel if neither available
    const allowAlways = params.options.find((opt) => opt.kind === "allow_always");
    const allowOnce = params.options.find((opt) => opt.kind === "allow_once");

    const selectedOption = allowAlways ?? allowOnce;

    if (selectedOption) {
      return {
        outcome: {
          outcome: "selected",
          optionId: selectedOption.optionId,
        },
      };
    }

    return {
      outcome: {
        outcome: "cancelled",
      },
    };
  }

  async sessionUpdate(params: acp.SessionNotification): Promise<void> {
    const update = params.update;

    // Get raw content with type (no formatting applied yet)
    const formatted = this.formatUpdate(update);
    if (!formatted) return;

    // Look up the thread from the database
    const thread = await this.getThreadForSession(params.sessionId);
    if (!thread) return;

    // Add to active batch (double buffering)
    const entry = {
      sessionId: params.sessionId,
      updateType: formatted.type,
      content: formatted.content,
    };
    const existing = this.activeBatch.get(params.sessionId);
    if (existing) {
      existing.push(entry);
    } else {
      this.activeBatch.set(params.sessionId, [entry]);
    }

    // Start batch timer if not already running
    this.startBatchTimer();
  }

  private async getThreadForSession(sessionId: string): Promise<ThreadChannel | null> {
    if (!this.discordClient) {
      return null;
    }

    const db = getDb();

    // Look up session to get threadId
    const session = await db
      .select()
      .from(schema.session)
      .where(eq(schema.session.acpSessionId, sessionId))
      .get();

    if (!session || !session.threadId) {
      return null;
    }

    // Fetch the thread from Discord
    try {
      const channel = await this.discordClient.channels.fetch(session.threadId);
      if (channel && "send" in channel) {
        return channel as ThreadChannel;
      }
    } catch {
      // Silently fail - channel may have been deleted
    }

    return null;
  }

  private formatUpdate(update: acp.SessionUpdate): { type: string; content: string } | null {
    switch (update.sessionUpdate) {
      case "agent_message_chunk":
        if (update.content.type === "text") {
          return { type: "agent_message", content: update.content.text };
        }
        return null;
      case "tool_call":
        return this.formatToolCall(update);
      case "tool_call_update":
        if (update.status === "completed") {
          return this.formatToolCall(update);
        }
        return null;
      case "plan":
        if (update.entries && update.entries.length > 0) {
          const planContent = update.entries
            .map((entry, _index) => {
              const status =
                entry.status === "completed" ? "✓" : entry.status === "in_progress" ? "◐" : "○";
              return `${status} ${entry.content}`;
            })
            .join("\n");
          return { type: "plan", content: planContent };
        }
        return null;
      case "agent_thought_chunk":
        if (update.content.type === "text") {
          return { type: "agent_thought", content: update.content.text };
        }
        return null;
      case "user_message_chunk":
        if (update.content.type === "text") {
          return { type: "user_message", content: update.content.text };
        }
        return null;
      default:
        return null;
    }
  }

  private formatToolCall(update: acp.ToolCallUpdate): { type: string; content: string } | null {
    // Check for diff content in the tool call
    const diffContent = update.content?.find((c) => c.type === "diff");
    if (diffContent && diffContent.type === "diff") {
      const diffResult = this.computeDiff(diffContent.oldText ?? "", diffContent.newText);
      const path = diffContent.path;
      const truncated = diffResult.lines.length > 10;
      const displayLines = truncated ? diffResult.lines.slice(0, 10) : diffResult.lines;
      const displayContent = displayLines.join("\n");
      const suffix = truncated ? `\n... (${diffResult.lines.length - 10} more lines)` : "";
      return {
        type: "diff",
        content: `\`modified ${path}\`\n\`\`\`diff\n${displayContent}\n\`\`\`${suffix}`,
      };
    }

    // Fall back to title if no diff
    if (update.title) {
      return { type: "tool_call", content: update.title };
    }

    return null;
  }

  private computeDiff(oldText: string, newText: string): { lines: string[] } {
    const changes = Diff.diffLines(oldText, newText);
    const result: string[] = [];

    for (const change of changes) {
      const lines = change.value.split("\n");
      // Remove the last empty line that comes from the split
      if (lines[lines.length - 1] === "") {
        lines.pop();
      }

      if (change.added) {
        for (const line of lines) {
          result.push(`+${line}`);
        }
      } else if (change.removed) {
        for (const line of lines) {
          result.push(`-${line}`);
        }
      } else {
        for (const line of lines) {
          result.push(` ${line}`);
        }
      }
    }

    return { lines: result };
  }

  private applyFormatting(type: string, content: string): string {
    switch (type) {
      case "agent_message":
        return content;
      case "tool_call":
        return `\`tool used ${content}\``;
      case "diff":
        // Diffs are already formatted with code blocks, return as-is
        return content;
      case "plan":
        return `[Plan]\n${content}`;
      case "agent_thought":
        return this.applyFormattingWithCodePreserved(content, "-# ", "");
      case "user_message":
        return this.applyFormattingWithCodePreserved(content, "**", "**");
      default:
        return content;
    }
  }

  private applyFormattingWithCodePreserved(
    content: string,
    openFormat: string,
    closeFormat: string,
  ): string {
    // Regex to match code blocks (triple backticks with optional language)
    const codeBlockRegex = /```[\s\S]*?```/g;
    // Regex to match inline code (single backticks)
    const inlineCodeRegex = /`[^`\n]+`/g;

    // Find all code blocks first
    const codeBlocks: Array<{ start: number; end: number; text: string }> = [];
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      codeBlocks.push({
        start: match.index,
        end: match.index + match[0].length,
        text: match[0],
      });
    }

    // If no code blocks found, process the whole content
    if (codeBlocks.length === 0) {
      return this.applyFormattingToPlainText(content, openFormat, closeFormat, inlineCodeRegex);
    }

    // Build result by processing segments between code blocks
    let result = "";
    let lastEnd = 0;

    for (const block of codeBlocks) {
      // Add the text before the code block (with formatting applied)
      const beforeText = content.slice(lastEnd, block.start);
      if (beforeText.length > 0) {
        result += this.applyFormattingToPlainText(
          beforeText,
          openFormat,
          closeFormat,
          inlineCodeRegex,
        );
      }

      // Add the code block as-is
      result += block.text;
      lastEnd = block.end;
    }

    // Add any remaining text after the last code block
    const afterText = content.slice(lastEnd);
    if (afterText.length > 0) {
      result += this.applyFormattingToPlainText(
        afterText,
        openFormat,
        closeFormat,
        inlineCodeRegex,
      );
    }

    return result;
  }

  private applyFormattingToPlainText(
    text: string,
    openFormat: string,
    closeFormat: string,
    inlineCodeRegex: RegExp,
  ): string {
    return text
      .split("\n")
      .map((line) => {
        if (line.length === 0) return line;

        const inlineCodes: Array<{ start: number; end: number; text: string }> = [];
        let match;

        inlineCodeRegex.lastIndex = 0;
        while ((match = inlineCodeRegex.exec(line)) !== null) {
          inlineCodes.push({
            start: match.index,
            end: match.index + match[0].length,
            text: match[0],
          });
        }

        if (inlineCodes.length === 0) {
          return `${openFormat}${line}${closeFormat}`;
        }

        let result = "";
        let lastEnd = 0;

        for (const code of inlineCodes) {
          const beforeText = line.slice(lastEnd, code.start);
          if (beforeText.length > 0) {
            result += `${openFormat}${beforeText}${closeFormat}`;
          }
          result += code.text;
          lastEnd = code.end;
        }

        const afterText = line.slice(lastEnd);
        if (afterText.length > 0) {
          result += `${openFormat}${afterText}${closeFormat}`;
        }

        return result;
      })
      .join("\n");
  }

  private startBatchTimer(): void {
    if (this.batchTimer) return;

    this.batchTimer = setInterval(() => {
      this.flushBatch();
    }, this.batchIntervalMs);
  }

  private stopBatchTimer(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }
  }

  private async flushBatch(): Promise<void> {
    // Double buffering: swap batches
    // New updates go to activeBatch while we process flushingBatch
    const toFlush = this.flushingBatch;
    this.flushingBatch = this.activeBatch;
    this.activeBatch = toFlush;

    // If there's nothing to flush, return early
    if (this.flushingBatch.size === 0) {
      return;
    }

    // Process each session's batch
    for (const [sessionId, entries] of this.flushingBatch) {
      const thread = await this.getThreadForSession(sessionId);
      if (!thread) continue;

      // All entries except the last one are complete
      const completeEntries = entries.slice(0, -1);
      const incompleteEntry = entries[entries.length - 1];

      // Concatenate consecutive entries of the same type
      const concatenatedEntries = this.concatenateEntries(completeEntries);

      // Apply formatting and send complete entries
      if (concatenatedEntries.length > 0) {
        const formattedEntries = concatenatedEntries.map((e) =>
          this.applyFormatting(e.updateType, e.content),
        );
        const contentToSend = formattedEntries.join("\n");
        try {
          await thread.send(contentToSend);
        } catch {
          // Silently fail - thread may have been deleted
        }
      }

      // If there's an incomplete entry, put it back in activeBatch for this session
      if (incompleteEntry) {
        const existing = this.activeBatch.get(sessionId);
        if (existing) {
          existing.unshift(incompleteEntry);
        } else {
          this.activeBatch.set(sessionId, [incompleteEntry]);
        }
      }
    }

    // Clear the flushed batch
    this.flushingBatch.clear();
  }

  private concatenateEntries(entries: BatchEntry[]): BatchEntry[] {
    const result: BatchEntry[] = [];
    let currentRun: BatchEntry[] = [];

    const pushCurrentRun = () => {
      if (currentRun.length === 0) return;
      if (currentRun.length === 1) {
        result.push(currentRun[0]);
      } else {
        const first = currentRun[0];
        const shouldNotConcat = ["diff", "plan"].includes(first.updateType);
        const shouldCommaConcat = first.updateType === "tool_call";

        if (shouldNotConcat) {
          result.push(...currentRun);
        } else if (shouldCommaConcat) {
          const concatenated = currentRun.map((e) => e.content).join(", ");
          result.push({ ...first, content: concatenated });
        } else {
          const concatenated = currentRun.map((e) => e.content).join("");
          result.push({ ...first, content: concatenated });
        }
      }
      currentRun = [];
    };

    for (const entry of entries) {
      if (currentRun.length === 0 || entry.updateType === currentRun[0].updateType) {
        currentRun.push(entry);
      } else {
        pushCurrentRun();
        currentRun.push(entry);
      }
    }
    pushCurrentRun();

    return result;
  }

  async flushNow(): Promise<void> {
    // Flush all pending updates immediately, including partial lines
    // Use when prompt completes to ensure all output is sent
    if (this.activeBatch.size === 0 && this.flushingBatch.size === 0) {
      return;
    }

    // Send all entries from both batches immediately
    const allBatches = new Map([...this.flushingBatch.entries(), ...this.activeBatch.entries()]);
    this.activeBatch.clear();
    this.flushingBatch.clear();

    // Process each session's entries
    for (const [sessionId, entries] of allBatches) {
      if (entries.length === 0) continue;

      const thread = await this.getThreadForSession(sessionId);
      if (!thread) continue;

      // Concatenate consecutive entries of the same type
      const concatenatedEntries = this.concatenateEntries(entries);

      // Apply formatting and send
      const formattedEntries = concatenatedEntries.map((e) =>
        this.applyFormatting(e.updateType, e.content),
      );
      const contentToSend = formattedEntries.join("\n");
      try {
        await thread.send(contentToSend);
      } catch {
        // Silently fail - thread may have been deleted
      }
    }
  }

  async writeTextFile(params: acp.WriteTextFileRequest): Promise<acp.WriteTextFileResponse> {
    const filePath = params.path;

    // Security: ensure path is within allowed directories
    if (!this.isPathAllowed(filePath)) {
      throw new Error("Access denied: path not allowed");
    }

    try {
      // Ensure parent directory exists
      const parentDir = path.dirname(filePath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      fs.writeFileSync(filePath, params.content, "utf-8");
      return {};
    } catch {
      throw new Error(`Failed to write file: ${filePath}`);
    }
  }

  async readTextFile(params: acp.ReadTextFileRequest): Promise<acp.ReadTextFileResponse> {
    const filePath = params.path;

    // Security: ensure path is within allowed directories
    if (!this.isPathAllowed(filePath)) {
      throw new Error("Access denied: path not allowed");
    }

    try {
      let content = fs.readFileSync(filePath, "utf-8");

      // Apply line/limit constraints if specified
      if (params.line !== undefined || params.limit !== undefined) {
        const lines = content.split("\n");
        const startLine = params.line ?? 1;
        const endLine = params.limit ? startLine + params.limit - 1 : lines.length;
        content = lines.slice(startLine - 1, endLine).join("\n");
      }

      return { content };
    } catch {
      return { content: "" };
    }
  }

  private isPathAllowed(filePath: string): boolean {
    // Resolve to absolute path to prevent traversal attacks
    const resolvedPath = path.resolve(filePath);

    // Allow paths within the workspace or temp directories
    const allowedPrefixes = [os.homedir(), "/tmp", "/var"];

    return allowedPrefixes.some((prefix) => resolvedPath.startsWith(prefix));
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const opencodeProcess = spawn("opencode", ["acp"], {
        stdio: ["pipe", "pipe", "pipe"],
      });

      const stream = acp.ndJsonStream(
        Writable.toWeb(opencodeProcess.stdin),
        Readable.toWeb(opencodeProcess.stdout) as ReadableStream<Uint8Array>,
      );
      this.connection = new acp.ClientSideConnection((_agent) => this, stream);

      opencodeProcess.on("error", () => {
        reject(new Error("OpenCode process failed to start"));
      });

      opencodeProcess.on("exit", async (_code: number) => {
        await this.flushBatch();
        this.stopBatchTimer();
        this.connection = null;
      });

      this.connection
        .initialize({
          protocolVersion: acp.PROTOCOL_VERSION,
          clientCapabilities: {
            fs: {
              readTextFile: true,
              writeTextFile: true,
            },
          },
        })
        .then((_initResult) => {
          resolve();
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  async createSession(cwd: string): Promise<acp.NewSessionResponse> {
    if (!this.connection) {
      throw new Error("Not connected to OpenCode");
    }

    const sessionResult = await this.connection.newSession({
      cwd,
      mcpServers: [],
    });

    return sessionResult;
  }

  async setSessionModel(sessionId: string, modelId: string): Promise<void> {
    if (!this.connection) {
      throw new Error("Not connected to OpenCode");
    }

    await this.connection.unstable_setSessionModel({
      sessionId,
      modelId,
    });
  }

  async setSessionMode(sessionId: string, modeId: string): Promise<void> {
    if (!this.connection) {
      throw new Error("Not connected to OpenCode");
    }

    await this.connection.setSessionMode({
      sessionId,
      modeId,
    });
  }

  async getSessionInfo(cwd: string): Promise<{
    models: Array<{ id: string; name: string }>;
    modes: Array<{ id: string; name: string }>;
    currentModelId?: string;
    currentModeId?: string;
  }> {
    if (!this.connection) {
      throw new Error("Not connected to OpenCode");
    }

    const sessionResult = await this.connection.newSession({
      cwd,
      mcpServers: [],
    });

    return {
      models:
        sessionResult.models?.availableModels.map((m) => ({
          id: m.modelId,
          name: m.name,
        })) ?? [],
      modes:
        sessionResult.modes?.availableModes.map((m) => ({
          id: m.id,
          name: m.name,
        })) ?? [],
      currentModelId: sessionResult.models?.currentModelId,
      currentModeId: sessionResult.modes?.currentModeId,
    };
  }

  async sendPrompt(sessionId: string, text: string): Promise<void> {
    if (!this.connection) {
      throw new Error("Not connected to OpenCode");
    }

    // Send prompt
    this.connection
      .prompt({
        sessionId,
        prompt: [{ type: "text", text }],
      })
      .then(() => {
        // Flush all pending updates immediately when prompt completes
        // This ensures no partial lines are left in the buffer
        return this.flushNow();
      })
      .catch(() => {
        // Silently ignore prompt errors
      });
  }

  async disconnect(): Promise<void> {
    await this.flushBatch();
    this.stopBatchTimer();
    this.connection = null;
  }
}

export const acpClient: VibecordClient = new VibecordClient();
