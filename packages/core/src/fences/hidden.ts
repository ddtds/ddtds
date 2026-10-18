import type { MdastNode } from "satteri";
import { positionAfter, zeroBased } from "./placement.ts";
import type { CodeRun } from "./segments.ts";

/** mdast leaves the opening brace out of an MDX expression value */
const JSX_OPENING_BRACE = "{";
const MARKER = "ddt-setup";

/** mdast has no comment node: a comment is an `html` node or, in MDX, an expression node */
type Comment = {
  node: MdastNode;
  opening: string;
  body: string;
};

/** A value with another `close` inside holds several comments, so it is not one */
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

function endOfMarker(body: string): number | undefined {
  const markerStart = body.length - body.trimStart().length;
  if (!body.startsWith(MARKER, markerStart)) return undefined;
  const markerEnd = markerStart + MARKER.length;
  const endsWord = body.slice(markerEnd, markerEnd + 1).trim() === "";
  return endsWord ? markerEnd : undefined;
}

function setupOf({ node, opening, body }: Comment): CodeRun | undefined {
  const markerEnd = endOfMarker(body);
  if (markerEnd === undefined) return undefined;
  if (!node.position) throw new Error("comment node has no position");
  const indent = node.position.start.column - 1;
  const start = zeroBased(
    positionAfter(node.position.start, opening + body.slice(0, markerEnd), indent),
  );
  return {
    code: body.slice(markerEnd),
    firstTextLine: start.line,
    firstLineColumn: start.column,
    laterLinesColumn: indent,
  };
}

function* commentsAbove(siblings: readonly MdastNode[], index: number): Generator<Comment> {
  for (let i = index - 1; i >= 0; i--) {
    const node = siblings[i];
    if (!node) throw new Error(`no sibling at index ${i}`);
    const comment = commentOf(node);
    if (!comment) return;
    yield comment;
  }
}

/** Other comments between setup comments are skipped; any other node ends the search */
export function setupBefore(siblings: readonly MdastNode[], index: number): CodeRun[] {
  return [...commentsAbove(siblings, index)]
    .toReversed()
    .flatMap((comment) => setupOf(comment) ?? []);
}
