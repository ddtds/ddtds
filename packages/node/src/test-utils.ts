import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { spawn } from "node:child_process";
import { run } from "node:test";
import { onTestFinished } from "vitest";

/** How docs are run: `node --enable-source-maps --test --import @ddtds/node/register` */
const execArgv = ["--enable-source-maps", "--import", join(import.meta.dirname, "register.ts")];

export function fixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(import.meta.dirname, "../.fixture-"));
  onTestFinished(() => rmSync(root, { recursive: true, force: true }));
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), content);
  }
  return root;
}

export function fence(code: string, annotation = "run"): string {
  return `\`\`\`ts ${annotation}\n${code}\n\`\`\`\n\n`;
}

/** Runs docs with `node --test --import @ddtds/node/register`, outcome by test name */
export async function runDocs(root: string, docs: string[]): Promise<Record<string, string>> {
  const results: Record<string, string> = {};
  const stream = run({
    cwd: root,
    files: docs.map((doc) => join(root, doc)),
    execArgv,
  });
  for await (const event of stream) {
    if (event.type === "test:pass") results[event.data.name] = "passed";
    if (event.type === "test:fail") results[event.data.name] = failure(event.data.details.error);
  }
  return results;
}

/** node:test wraps what a test threw in its `cause` */
function failure(error: Error): string {
  const { cause } = error;
  if (!(cause instanceof Error)) return error.name;
  return "code" in cause ? `${cause.name} ${String(cause.code)}` : cause.name;
}

/** Runs a doc with `node --test --watch`, edits it after the first run, outcomes of both runs */
export async function watchDocs(
  root: string,
  doc: string,
  edit: () => void,
): Promise<Record<string, string>[]> {
  const args = [...execArgv, "--test", "--watch", "--test-reporter=tap", doc];
  const child = spawn(process.execPath, args, { cwd: root });
  onTestFinished(() => void child.kill());
  const runs: Record<string, string>[] = [];
  let output = "";
  for await (const chunk of child.stdout) {
    output += String(chunk);
    // tap prints a plan line like `1..1` after every run
    const plans = output.match(/^1\.\.\d+$/gm) ?? [];
    if (plans.length === runs.length) continue;
    runs.push(tapOutcomes(output.split(/^1\.\.\d+$/m).at(-2) ?? ""));
    if (runs.length === 1) edit();
    if (runs.length === 2) break;
  }
  return runs;
}

function tapOutcomes(tap: string): Record<string, string> {
  const results: Record<string, string> = {};
  for (const [, ok, name] of tap.matchAll(/^(ok|not ok) \d+ - (.+)$/gm)) {
    if (name) results[name] = ok === "ok" ? "passed" : "failed";
  }
  return results;
}

type Report = { location: string; frames?: string[] };

/** Where node:test places each test, and the stack frames inside the fixture of failures */
export async function reportDocs(root: string, docs: string[]): Promise<Record<string, Report>> {
  const results: Record<string, Report> = {};
  const stream = run({
    cwd: root,
    files: docs.map((doc) => join(root, doc)),
    execArgv,
  });
  for await (const event of stream) {
    if (event.type !== "test:pass" && event.type !== "test:fail") continue;
    const { name, file = "", line, column, details } = event.data;
    const location = `${relative(root, file)}:${line}:${column}`;
    if (event.type === "test:pass") results[name] = { location };
    else results[name] = { location, frames: frames(root, details.error) };
  }
  return results;
}

function frames(root: string, { cause }: Error): string[] {
  const stack = cause instanceof Error ? (cause.stack ?? "") : "";
  return [...stack.matchAll(/\((?:file:\/\/)?([^()]+):(\d+):(\d+)\)$/gm)]
    .filter(([, file]) => file?.startsWith(root))
    .map(([, file = "", line, column]) => `${relative(root, file)}:${line}:${column}`);
}
