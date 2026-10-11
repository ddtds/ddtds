import { parseSync } from "oxc-parser";
import { CodeBlock, parseCodeFences } from "./blocks.ts";
import type { Logger } from "./logger.ts";

/** Source files whose JSDoc comments can hold code fences */
export const sourceFile = /\.[cm]?[jt]sx?$/;

const commentLinePrefix = /^\s*\*? ?/;

/**
 * Code fences in a source file's JSDoc comments (`/** … *\/`). Each comment is read as markdown
 * with its `*` prefixes removed, and fence positions are mapped back to the source file.
 */
export function parseJsDocFences(source: string, path: string, log: Logger): CodeBlock[] {
  const { comments } = parseSync(path, source);
  return comments
    .filter(({ type, value }) => type === "Block" && value.startsWith("*"))
    .flatMap(({ start, value }) => {
      const firstLine = source.slice(0, start).split("\n").length;
      const lines = value.split("\n");
      const prefixes = lines.map((line) => commentLinePrefix.exec(line)?.[0].length ?? 0);
      // Blank lines before the comment keep markdown line numbers equal to the file's
      const markdown =
        "\n".repeat(firstLine - 1) + lines.map((line, i) => line.slice(prefixes[i])).join("\n");
      return parseCodeFences(markdown, path, log).map((block) => {
        const prefix = prefixes[block.line - firstLine] ?? 0;
        return shiftColumns(block, prefix);
      });
    });
}

/** The same block, moved right by the comment prefix the markdown didn't have */
function shiftColumns(block: CodeBlock, by: number): CodeBlock {
  const { contents, lang, annotation, file, range, indent } = block.details;
  return new CodeBlock({
    code: contents,
    lang,
    annotation,
    path: file,
    range: {
      start: { ...range.start, column: range.start.column + by },
      end: { ...range.end, column: range.end.column + by },
    },
    indent: indent + by,
  });
}
