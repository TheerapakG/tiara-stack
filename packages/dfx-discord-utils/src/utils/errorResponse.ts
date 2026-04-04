import { Cause } from "effect";

const DISCORD_MESSAGE_CONTENT_LIMIT = 2_000;
const INLINE_ERROR_CONTENT_LIMIT = 1_800;

const codeBlock = (content: string) => `\`\`\`txt\n${content.replaceAll("```", "`` `")}\n\`\`\``;

const firstMeaningfulLine = (content: string) =>
  content
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);

const getSummaryFromUnknown = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error.trim();
  }

  return fallback;
};

export interface FormattedErrorResponse {
  readonly summary: string;
  readonly fullText: string;
}

export interface DiscordErrorMessageResponse {
  readonly content: string;
  readonly files: ReadonlyArray<File>;
}

export const formatErrorResponse = (error: unknown): FormattedErrorResponse => {
  const cause = Cause.isCause(error) ? error : Cause.fail(error);
  const fullText = Cause.pretty(cause).trim();
  const summarySource = Cause.squash(cause);
  const summary = getSummaryFromUnknown(
    summarySource,
    firstMeaningfulLine(fullText) ?? "Unknown error",
  );

  return {
    summary,
    fullText: fullText.length > 0 ? fullText : summary,
  };
};

export const makeDiscordErrorMessageResponse = (
  label: string,
  formattedError: FormattedErrorResponse,
): DiscordErrorMessageResponse => {
  const inlineContent = codeBlock(formattedError.fullText);

  // `inlineContent` already includes the code-fence markup, so this length check matches the
  // actual Discord message payload size.
  if (inlineContent.length <= INLINE_ERROR_CONTENT_LIMIT) {
    // For short errors, prefer the full pretty-printed Cause output over a prefixed summary line.
    return {
      content: inlineContent,
      files: [],
    };
  }

  const shortContent = `${label}: ${formattedError.summary}\nFull error is attached.`;

  if (shortContent.length > DISCORD_MESSAGE_CONTENT_LIMIT) {
    return {
      content: `${label}\nFull error is attached.`,
      files: [new File([formattedError.fullText], "error.txt", { type: "text/plain" })],
    };
  }

  return {
    content: shortContent,
    files: [new File([formattedError.fullText], "error.txt", { type: "text/plain" })],
  };
};
