import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { onTestFinished } from "vitest";
import { ANNOTATIONS } from "./annotations.ts";
import type { Lang } from "./languages.ts";

/** Writes `files` under a temporary directory, removed when the test finishes. */
export function tempFixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "ddtds-"));
  onTestFinished(() => rmSync(root, { recursive: true, force: true }));
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), content);
  }
  return root;
}

export function markdown(code: string, info: string = ANNOTATIONS.RUN, lang: Lang = "ts"): string {
  return `\`\`\`${lang} ${info}\n${code}\n\`\`\`\n`;
}
