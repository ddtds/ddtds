import { isAbsolute, relative } from "node:path";
import { fileURLToPath } from "node:url";
import StackUtils from "stack-utils";
import * as v from "valibot";

export const frame = v.strictObject({
  file: v.string(),
  line: v.pipe(v.number(), v.integer(), v.minValue(1)),
  column: v.pipe(v.number(), v.integer(), v.minValue(1)),
});

export type Frame = v.InferOutput<typeof frame>;

const parser = new StackUtils({ cwd: "/" });

export function projectFrames(root: string, frames: readonly Frame[]): Frame[] {
  return frames.flatMap(({ file, line, column }) => {
    if (!isAbsolute(file)) return [];
    const path = relative(root, file);
    return path.startsWith("..") || isAbsolute(path) ? [] : [{ file: path, line, column }];
  });
}

export function framesOf(stack: string | undefined, root: string): Frame[] {
  const frames = (stack ?? "").split("\n").flatMap((text): Frame[] => {
    const parsed = parser.parseLine(text);
    if (!parsed?.file || parsed.line === undefined || parsed.column === undefined) return [];
    const url = URL.parse(parsed.file);
    const file = url?.protocol === "file:" ? fileURLToPath(url) : parsed.file;
    return [{ file, line: parsed.line, column: parsed.column }];
  });
  return projectFrames(root, frames);
}
