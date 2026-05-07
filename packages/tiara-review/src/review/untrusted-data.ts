// This is a formatting boundary, not a complete prompt-injection sanitizer.
// Prompts must still explicitly instruct reviewers to treat labeled content as untrusted data.
export const untrustedDataBlock = (label: string, value: string) =>
  value
    .replaceAll("```", "` ` `")
    .split("\n")
    .map((line) => `${label} ${line}`)
    .join("\n");

// Normalize untrusted field values before interpolating them into structured markdown.
// Without this, a newline inside one field can introduce an unlabeled synthetic field line
// before the surrounding block-level line prefix is applied.
export const untrustedDataField = (value: string) => value.replace(/\s*\r?\n\s*/g, " ");
