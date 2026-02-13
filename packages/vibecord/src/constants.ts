// Discord API Constants
export const DISCORD_API_VERSION = "10";
export const DISCORD_THREAD_NAME_MAX_LENGTH = 100;
export const DISCORD_MESSAGE_MAX_LENGTH = 2000;

// Discord Application Command Option Types
export const APPLICATION_COMMAND_OPTION_TYPE = {
  SUB_COMMAND: 1,
  SUB_COMMAND_GROUP: 2,
  STRING: 3,
  INTEGER: 4,
  BOOLEAN: 5,
  USER: 6,
  CHANNEL: 7,
  ROLE: 8,
  MENTIONABLE: 9,
  NUMBER: 10,
  ATTACHMENT: 11,
} as const;

// Batch Processing Constants
export const BATCH_INTERVAL_MS = 1000;
export const DIFF_TRUNCATION_LINES = 10;
export const SAFE_SPLIT_THRESHOLD = 0.7; // Don't go below 70% of max length when searching for split point

// Diff Formatting Constants
export const DIFF_CONTEXT_LINES = 1;

// Status Emojis
export const STATUS_EMOJI = {
  COMPLETED: "✓",
  IN_PROGRESS: "◐",
  PENDING: "○",
} as const;

// Update Types
export const UPDATE_TYPE = {
  AGENT_MESSAGE: "agent_message",
  AGENT_THOUGHT: "agent_thought",
  TOOL_CALL: "tool_call",
  DIFF: "diff",
  TODO: "todo",
  USER_MESSAGE: "user_message",
} as const;

// Session Status
export const SESSION_STATUS = {
  RUNNING: "running",
  COMPLETED: "completed",
  IN_PROGRESS: "in_progress",
} as const;
