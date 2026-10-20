export type FenceInfo = {
  /** Bare words, like `run` or `twoslash` */
  words: string[];
  /** `key=value` pairs, like `title="hi"`, with surrounding quotes removed */
  attributes: Map<string, string>;
};

const token = /[^\s=]+=(?:"[^"]*"|'[^']*'|\S*)|\S+/g;
const surroundingQuotes = /^(["'])(.*)\1$/;

/** Splits an info string, which other tools share, into bare words and `key=value` attributes */
export function parseInfo(meta: string): FenceInfo {
  const words: string[] = [];
  const attributes = new Map<string, string>();
  for (const part of meta.match(token) ?? []) {
    const separator = part.indexOf("=");
    if (separator === -1) words.push(part);
    else
      attributes.set(
        part.slice(0, separator),
        part.slice(separator + 1).replace(surroundingQuotes, "$2"),
      );
  }
  return { words, attributes };
}
