/** Shortens text to at most `length` characters, ending with an ellipsis when cut */
export function truncate(text: string, length: number): string {
  if (length < 1) throw new RangeError("length must be at least 1");
  if (text.length <= length) return text;
  return `${text.slice(0, length - 1)}…`;
}
