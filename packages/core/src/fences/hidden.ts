import type { MdastNode } from "satteri";
import { positionAfter, zeroBased } from "./placement.ts";
import type { CodeRun } from "./segments.ts";

/** What mdast leaves out of the value of an MDX expression: its opening brace */
const JSX_OPENING_BRACE = "{";
const MARKER = "ddt-setup";

/** mdast has no comment node: a comment is an `html` node or, in MDX, an expression node */
type Comment = {
  node: MdastNode;
  /** The source from the start of the node up to the comment's body */
  opening: string;
  body: string;
};

/**
 * Splits a node value that starts with `open` and ends with `close`, ignoring blanks around
 * them. The parser already ruled out an unclosed comment. A value with another `close` inside
 * holds several comments, so it is not one.
 */
function splitComment(
  value: string,
  open: string,
  close: string,
): { opening: string; body: string } | undefined {
  const openStart = value.length - value.trimStart().length;
  const closeEnd = value.trimEnd().length;
  if (!value.startsWith(open, openStart) || !value.endsWith(close, closeEnd)) return undefined;
  const bodyStart = openStart + open.length;
  const bodyEnd = closeEnd - close.length;
  const body = value.slice(bodyStart, bodyEnd);
  if (body.includes(close)) return undefined;
  return { opening: value.slice(0, bodyStart), body };
}

function commentOf(node: MdastNode): Comment | undefined {
  if (node.type === "html") {
    const parts = splitComment(node.value, "<!--", "-->");
    return parts && { node, ...parts };
  }
  if (node.type === "mdxFlowExpression") {
    const parts = splitComment(node.value, "/*", "*/");
    return parts && { node, body: parts.body, opening: JSX_OPENING_BRACE + parts.opening };
  }
  return undefined;
}

/** How much of `body` the blanks and marker take. The marker must be a word of its own. */
function markerLength(body: string): number | undefined {
  const markerStart = body.length - body.trimStart().length;
  if (!body.startsWith(MARKER, markerStart)) return undefined;
  const markerEnd = markerStart + MARKER.length;
  const endsWord = body.slice(markerEnd, markerEnd + 1).trim() === "";
  return endsWord ? markerEnd : undefined;
}

function setupOf({ node, opening, body }: Comment): CodeRun | undefined {
  const length = markerLength(body);
  if (length === undefined) return undefined;
  if (!node.position) throw new Error("comment node has no position");
  const indent = node.position.start.column - 1;
  const start = zeroBased(
    positionAfter(node.position.start, opening + body.slice(0, length), indent),
  );
  return {
    code: body.slice(length),
    firstTextLine: start.line,
    firstLineColumn: start.column,
    laterLinesColumn: indent,
  };
}

/** The comments directly above `index`, nearest first, stopping at the first other node */
function* commentsAbove(siblings: readonly MdastNode[], index: number): Generator<Comment> {
  for (let i = index - 1; i >= 0; i--) {
    const node = siblings[i];
    if (!node) throw new Error(`no sibling at index ${i}`);
    const comment = commentOf(node);
    if (!comment) return;
    yield comment;
  }
}

/**
 * The `ddt-setup` comments above the fence at `index`, in order: `<!-- ddt-setup code -->` in
 * markdown and `{/* ddt-setup code *\/}` in MDX. Other comments between them are skipped; any
 * other node ends the search.
 */
export function setupBefore(siblings: readonly MdastNode[], index: number): CodeRun[] {
  return [...commentsAbove(siblings, index)]
    .toReversed()
    .flatMap((comment) => setupOf(comment) ?? []);
}
