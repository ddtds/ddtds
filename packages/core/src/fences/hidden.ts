import type { MdastNode } from "satteri";
import type { Position } from "./compile-error.ts";

/**
 * Code from a comment above a fence. `start` is the 1 based position of `code` in the text, and
 * `indent` the columns a container such as a list item strips from every line after the first.
 */
export type SetupPiece = { code: string; start: Position; indent: number };

const HTML_COMMENT = /^<!--([\s\S]*)-->$/;
const JSX_COMMENT = /^\/\*([\s\S]*)\*\/$/;
const MARKER = /^\s*ddt-setup(?![\w-])/;

function commentOf(node: MdastNode): { open: string; body: string } | undefined {
  if (node.type === "html") {
    const body = HTML_COMMENT.exec(node.value.trim())?.[1];
    return body === undefined ? undefined : { open: "<!--", body };
  }
  if (node.type === "mdxFlowExpression") {
    const body = JSX_COMMENT.exec(node.value.trim())?.[1];
    return body === undefined ? undefined : { open: "{/*", body };
  }
  return undefined;
}

function setupPiece(
  node: MdastNode,
  comment: { open: string; body: string },
): SetupPiece | undefined {
  const marker = MARKER.exec(comment.body)?.[0];
  if (marker === undefined || !node.position) return undefined;
  const { line, column } = node.position.start;
  return {
    code: comment.body.slice(marker.length),
    start: { line, column: column + comment.open.length + marker.length },
    indent: column - 1,
  };
}

/**
 * The `ddt-setup` comments above the fence at `index`, in order: `<!-- ddt-setup code -->` in
 * markdown and `{/* ddt-setup code *\/}` in MDX. Other comments between them are skipped; any
 * other node ends the search.
 */
export function setupBefore(siblings: readonly MdastNode[], index: number): SetupPiece[] {
  const pieces: SetupPiece[] = [];
  for (let i = index - 1; i >= 0; i--) {
    const node = siblings[i];
    if (!node) break;
    const comment = commentOf(node);
    if (!comment) break;
    const piece = setupPiece(node, comment);
    if (piece) pieces.unshift(piece);
  }
  return pieces;
}
