import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { version } from "vitest/node";
import type { ViteUserConfig } from "vitest/config";
import type { DdtPluginOptions } from "./index.ts";

export type TestResult = { name: string; status: string };
export type Outcomes = Record<string, string>;
type Assertion = { title: string; status: string };
export type Report = { testResults?: { assertionResults?: Assertion[] }[] };

export type RunResult = {
  status: number | null;
  report: Report;
  tests: TestResult[];
  outcomes: Outcomes;
  stdout: string;
  stderr: string;
};

export type RunOptions = { args?: string[]; debug?: string; report?: string };
export type WatchOptions = { args?: string[] };
export type Watcher = {
  output: () => string;
  summaries: () => string[];
  waitFor: (condition: () => boolean) => Promise<void>;
  close: () => Promise<void>;
};

const source = join(import.meta.dirname, "index.ts");
const runtime = join(import.meta.dirname, "runtime.ts");
const configFile = "vitest.config.ts";

export const vitestVersion: { full: string; major: number } = {
  full: version,
  major: Number(version.split(".")[0]),
};

const bin = join(
  dirname(createRequire(import.meta.url).resolve("vitest/package.json")),
  "vitest.mjs",
);

function env(extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const clean = Object.entries(process.env).filter(
    ([key]) => !/^(VITEST|CI|DEBUG|FORCE_COLOR)/.test(key),
  );
  return {
    ...Object.fromEntries(clean),
    NO_COLOR: "1",
    FORCE_COLOR: "0",
    NODE_ENV: "test",
    ...extra,
  };
}

export function writeConfig(
  root: string,
  plugin: DdtPluginOptions = {},
  config: ViteUserConfig = {},
): string {
  const alias = { "@ddtds/vitest/runtime": runtime, "@ddtds/vitest": source };
  writeFileSync(
    join(root, configFile),
    [
      'import { defineConfig } from "vitest/config";',
      `import { ddtPlugin } from ${JSON.stringify(pathToFileURL(source).href)};`,
      "export default defineConfig({",
      `  resolve: { alias: ${JSON.stringify(alias)} },`,
      `  plugins: [ddtPlugin(${JSON.stringify(plugin)})],`,
      `  ...${JSON.stringify(config)},`,
      "});",
      "",
    ].join("\n"),
  );
  return configFile;
}

export function run(
  root: string,
  { args = [], debug, report = "result.json" }: RunOptions = {},
): RunResult {
  const output = join(root, report);
  rmSync(output, { force: true });
  const result = spawnSync(
    process.execPath,
    [bin, "run", "--config", configFile, "--reporter=json", "--outputFile", output, ...args],
    { cwd: root, env: env(debug ? { DEBUG: debug } : {}), encoding: "utf8" },
  );
  const parsed: Report = existsSync(output) ? JSON.parse(readFileSync(output, "utf8")) : {};
  const tests = (parsed.testResults ?? [])
    .flatMap((file) => file.assertionResults ?? [])
    .map(({ title, status }) => ({ name: title, status }));
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    report: parsed,
    tests,
    outcomes: Object.fromEntries(tests.map(({ name, status }) => [name, status])),
  };
}

export function watch(root: string, { args = [] }: WatchOptions = {}): Watcher {
  const child: ChildProcess = spawn(
    process.execPath,
    [bin, "watch", "--config", configFile, ...args],
    { cwd: root, env: env(), stdio: ["ignore", "pipe", "pipe"] },
  );
  let output = "";
  child.stdout?.on("data", (chunk: Buffer) => (output += chunk));
  child.stderr?.on("data", (chunk: Buffer) => (output += chunk));
  return {
    output: (): string => output,
    summaries: (): string[] => output.match(/Test Files\s+\d+ (?:passed|failed)/g) ?? [],
    async waitFor(condition: () => boolean): Promise<void> {
      const deadline = Date.now() + 20_000;
      await new Promise<void>((resolve, reject) => {
        const poll = (): void => {
          if (condition()) return resolve();
          if (Date.now() > deadline) return reject(new Error(`timed out:\n${output}`));
          setTimeout(poll, 50);
        };
        poll();
      });
    },
    async close(): Promise<void> {
      if (child.exitCode !== null || child.signalCode !== null) return;
      child.kill("SIGTERM");
      await new Promise((resolve) => child.once("exit", resolve));
    },
  };
}
