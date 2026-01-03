import MagicString from "magic-string";
import { type SourceMapInput, type Plugin } from "rolldown";

export const plugin = (options: { sourcemap?: boolean } = {}): Plugin => {
  const codeHasReplacements = (
    code: string,
    _id: string,
    magicString: MagicString,
  ): boolean => {
    let result = false;
    let match;

    const importPattern =
      /import { stripHandler } from "typhoon-core\/bundler";/g;

    // eslint-disable-next-line no-cond-assign
    while ((match = importPattern.exec(code))) {
      result = true;

      const start = match.index;
      const end = start + match[0].length;

      magicString.overwrite(start, end, "");
    }

    const callPattern = /stripHandler\(/g;

    // eslint-disable-next-line no-cond-assign
    while ((match = callPattern.exec(code))) {
      result = true;

      const start = match.index;
      const end = start + match[0].length;

      const replacement =
        "process.env.TIARA_STRIP_HANDLER === 'true' ? undefined : ((handler) => handler)(";
      magicString.overwrite(start, end, replacement);
    }
    return result;
  };

  const isSourceMapEnabled = () => {
    return options.sourcemap !== false;
  };

  const executeReplacement = (
    code: string,
    id: string,
  ): {
    code: string;
    map?: SourceMapInput;
  } | null => {
    const magicString = new MagicString(code);
    if (!codeHasReplacements(code, id, magicString)) {
      return null;
    }

    const result: { code: string; map?: SourceMapInput } = {
      code: magicString.toString(),
    };
    if (isSourceMapEnabled()) {
      result.map = magicString.generateMap({ hires: true });
    }
    return result;
  };

  return {
    name: "tiaraPlugin",
    renderChunk(code, chunk) {
      const id = chunk.fileName;
      return executeReplacement(code, id);
    },
    transform(code, id) {
      return executeReplacement(code, id);
    },
  };
};
