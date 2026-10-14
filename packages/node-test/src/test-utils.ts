import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { run } from "node:test";
import { onTestFinished } from "vitest";

export function fixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(import.meta.dirname, "../.fixture-"));
  onTestFinished(() => rmSync(root, { recursive: true, force: true }));
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), content);
  }
  return root;
}

export async function runDocs(root: string, docs: string[]): Promise<Record<string, string>> {
  const results: Record<string, string> = {};
  const stream = run({
    cwd: root,
    files: docs.map((doc) => join(root, doc)),
    execArgv: ["--import", join(import.meta.dirname, "register.ts")],
  });
  for await (const event of stream) {
    if (event.type === "test:pass") results[event.data.name] = "passed";
    if (event.type === "test:fail") results[event.data.name] = failure(event.data.details.error);
  }
  return results;
}

function failure(error: Error): string {
  const { cause } = error;
  if (!(cause instanceof Error)) return error.name;
  return "code" in cause ? `${cause.name} ${String(cause.code)}` : cause.name;
}
