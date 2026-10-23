import { parseSync } from "oxc-parser";
import { ANNOTATED_FENCE } from "./annotation.ts";
import { parseCodeFences, type CodeBlock } from "./blocks.ts";
import { columnsBeforeOffset, lineIndex, type Placement } from "./placement.ts";

const COMMENT_OPEN_LENGTH = "/*".length;

const LINE_PREFIX = /^\s*\*?[ \t]?/;

function commentMarkdown(
  source: string,
  linesBefore: (offset: number) => number,
  commentStart: number,
  commentValue: string,
): { markdown: string; placement: Placement } {
  const lines = commentValue.split("\n");
  const prefixLengths = lines.map((line) => line.length - line.replace(LINE_PREFIX, "").length);
  const columnsBeforeFirstLine = columnsBeforeOffset(source, commentStart) + COMMENT_OPEN_LENGTH;
  const columnsBeforeLines = prefixLengths.map((length, i) =>
    i === 0 ? columnsBeforeFirstLine + length : length,
  );
  return {
    markdown: lines.map((line, i) => line.slice(prefixLengths[i])).join("\n"),
    placement: {
      linesBefore: linesBefore(commentStart),
      columnsBeforeLine: (line) => {
        const columns = columnsBeforeLines[line];
        if (columns === undefined) throw new Error(`no line ${line} in the comment`);
        return columns;
      },
    },
  };
}

export function parseJsDocFences(source: string, path: string): CodeBlock[] {
  // most source files run nothing
  if (!ANNOTATED_FENCE.test(source)) return [];
  const linesBefore = lineIndex(source);
  return parseSync(path, source)
    .comments.filter(({ type, value }) => type === "Block" && value.startsWith("*"))
    .flatMap(({ start, value }) => {
      const { markdown, placement } = commentMarkdown(source, linesBefore, start, value);
      return parseCodeFences(markdown, path, placement);
    });
}
