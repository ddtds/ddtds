import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { version } from "vitest/node";
import type { ViteUserConfig } from "vitest/config";
import { fixture } from "./test-utils.ts";
import type { DdtPluginOptions } from "./index.ts";

export type Outcomes = Record<string, "passed" | "failed">;
type Assertion = { title: string; status: string };
export type Report = { testResults?: { assertionResults?: Assertion[] }[] };

export type Run = {
  status: number | null;
  outcomes: Outcomes;
  report: Report;
  stdout: string;
  stderr: string;
};

export type RunnerOptions = {
  plugin?: DdtPluginOptions;
  config?: ViteUserConfig;
  debug?: string;
  args?: string[];
};

export type Watcher = {
  started(): Promise<Run>;
  next(): Promise<Run>;
  close(): Promise<void>;
};

export type Runner = {
  name: string;
  prepare(root: string, options: RunnerOptions): void;
  run(root: string, options: RunnerOptions): Run;
  watch(root: string, options: RunnerOptions): Watcher;
};

export type Framework = {
  root: string;
  write(file: string, content: string): void;
  edit(file: string, content: string): Promise<Run>;
  run(): Promise<Run>;
  watch(): Promise<Run>;
  [Symbol.asyncDispose](): Promise<void>;
};

export const vitestVersion: { full: string; major: number } = {
  full: version,
  major: Number(version.split(".")[0]),
};

const source = join(import.meta.dirname, "index.ts");
const runtime = join(import.meta.dirname, "runtime.ts");
const configFile = "vitest.config.ts";
const resultFile = "result.json";
const bin = join(
  dirname(createRequire(import.meta.url).resolve("vitest/package.json")),
  "vitest.mjs",
);

function cleanEnv(extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
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

function outcomesOf(report: Report): Outcomes {
  return Object.fromEntries(
    (report.testResults ?? [])
      .flatMap((file) => file.assertionResults ?? [])
      .map(({ title, status }) => [title, status === "passed" ? "passed" : "failed"]),
  );
}

function readReport(root: string, output: string, stdout: string, stderr: string): Run {
  const path = join(root, output);
  const report: Report = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};
  return { status: null, report, stdout, stderr, outcomes: outcomesOf(report) };
}

function writeConfig(root: string, plugin: DdtPluginOptions, config: ViteUserConfig): void {
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
}

async function until(condition: () => boolean): Promise<void> {
  const deadline = Date.now() + 20_000;
  await new Promise<void>((resolve, reject) => {
    const poll = (): void => {
      if (condition()) return resolve();
      if (Date.now() > deadline) return reject(new Error("timed out"));
      setTimeout(poll, 50);
    };
    poll();
  });
}

export const vitest: Runner = {
  name: "vitest",
  prepare(root, { plugin = {}, config = {} }) {
    writeConfig(root, plugin, config);
  },
  run(root, { args = [], debug }) {
    const output = join(root, resultFile);
    rmSync(output, { force: true });
    const result = spawnSync(
      process.execPath,
      [bin, "run", "--config", configFile, "--reporter=json", "--outputFile", output, ...args],
      { cwd: root, env: cleanEnv(debug ? { DEBUG: debug } : {}), encoding: "utf8" },
    );
    const run = readReport(root, resultFile, result.stdout, result.stderr);
    return { ...run, status: result.status };
  },
  watch(root, { args = [], debug }) {
    const output = join(root, resultFile);
    rmSync(output, { force: true });
    const child = spawn(
      process.execPath,
      [bin, "watch", "--config", configFile, "--reporter=json", "--outputFile", output, ...args],
      {
        cwd: root,
        env: cleanEnv(debug ? { DEBUG: debug } : {}),
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => (stdout += chunk));
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk));
    const writes = (): number => (stdout.match(/JSON report written/g) ?? []).length;
    return {
      async started() {
        await until(() => writes() >= 1);
        return readReport(root, resultFile, stdout, stderr);
      },
      async next() {
        const seen = writes();
        await until(() => writes() > seen);
        return readReport(root, resultFile, stdout, stderr);
      },
      async close() {
        if (child.exitCode !== null || child.signalCode !== null) return;
        child.kill("SIGTERM");
        await new Promise((resolve) => child.once("exit", resolve));
      },
    };
  },
};

export function spawnFramework(config: {
  runner: Runner;
  files?: Record<string, string>;
  options?: RunnerOptions;
}): Framework {
  const { runner, files = {}, options = {} } = config;
  const root = fixture(files);
  runner.prepare(root, options);
  let watcher: Watcher | undefined;
  return {
    root,
    write: (file, content) => writeFileSync(join(root, file), content),
    async edit(file, content) {
      writeFileSync(join(root, file), content);
      return watcher ? watcher.next() : runner.run(root, options);
    },
    run: () => Promise.resolve(runner.run(root, options)),
    async watch() {
      watcher = runner.watch(root, options);
      return watcher.started();
    },
    async [Symbol.asyncDispose]() {
      await watcher?.close();
    },
  };
}
