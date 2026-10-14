import { spawnSync, spawn, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, test } from "vitest";
import { version } from "vitest/node";
import { fence, fixture } from "./test-utils.ts";
import type { DdtPluginOptions } from "./index.ts";

// A real `vitest` process, so the fs module cache lives and dies like it does
// for users: the plugin's `configureVitest` hook only runs for a real config
// file, and the cache is only reused across processes (not just across runs).
const vitestBin = join(
  dirname(createRequire(import.meta.url).resolve("vitest/package.json")),
  "vitest.mjs",
);
const source = join(import.meta.dirname, "index.ts");
const runtime = join(import.meta.dirname, "runtime.ts");
const cacheDir = (root: string): string => join(root, ".ddt-cache");

/** A config that imports the plugin's source, so the suite tests what we edit. */
function configSource(options: DdtPluginOptions): string {
  const alias = { "@ddtds/vitest/runtime": runtime, "@ddtds/vitest": source };
  return `import { defineConfig } from "vitest/config";
import { ddtPlugin } from ${JSON.stringify(pathToFileURL(source).href)};

export default defineConfig({
  resolve: { alias: ${JSON.stringify(alias)} },
  server: { watch: { ignored: ["**/.ddt-cache/**"] } },
  plugins: [ddtPlugin(${JSON.stringify(options)})],
  test: { fsModuleCache: true, fsModuleCachePath: ".ddt-cache" },
});
`;
}

function env(debug?: string): NodeJS.ProcessEnv {
  const result: NodeJS.ProcessEnv = { ...process.env, NO_COLOR: "1", NODE_ENV: "test" };
  for (const key of Object.keys(result)) {
    if (/^VITEST/i.test(key) || key === "DEBUG" || key === "CI" || key === "FORCE_COLOR") {
      delete result[key];
    }
  }
  if (debug) result.DEBUG = debug;
  return result;
}

const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");
const stripAnsi = (text: string): string => text.replaceAll(ANSI, "");

type TestResult = { name: string; status: string };
type Run = { status: number | null; tests: TestResult[]; stderr: string; stdout: string };

function run(root: string, { debug = false } = {}): Run {
  const output = join(root, "vitest-result.json");
  rmSync(output, { force: true });
  const result = spawnSync(
    process.execPath,
    [vitestBin, "run", "--config", "vitest.config.ts", "--reporter=json", "--outputFile", output],
    { cwd: root, env: env(debug ? "vitest:cache:fs" : undefined), encoding: "utf8" },
  );
  const report: { testResults?: { assertionResults?: { title: string; status: string }[] }[] } =
    existsSync(output) ? JSON.parse(readFileSync(output, "utf8")) : {};
  const tests = (report.testResults ?? []).flatMap((file) => file.assertionResults ?? []);
  return {
    status: result.status,
    tests: tests.map(({ title, status }) => ({ name: title, status })),
    stderr: stripAnsi(result.stderr),
    stdout: stripAnsi(result.stdout),
  };
}

type CacheEntry = { action: string; id: string; path: string };

/** The `DEBUG=vitest:cache:fs` lines, so we can see what the fs cache did. */
function cacheEntries(stderr: string): CacheEntry[] {
  const entries: CacheEntry[] = [];
  for (const line of stderr.split("\n")) {
    const match = line.match(/\[(read|write)\] (.+?) is cached in (.+?)\s*$/);
    if (match) {
      entries.push({ action: match[1]!, id: match[2]!, path: match[3]! });
    }
  }
  return entries;
}

/** Doc and fence modules have no real file and must never hit the fs cache. */
const isGenerated = (id: string): boolean => id.endsWith("guide.md") || id.includes("__ddtds__");

// `fsModuleCache` is Vitest 5+, so the suite is skipped on 4.
describe.skipIf(Number(version.split(".")[0]) < 5)("fs module cache", () => {
  test("never serves a generated module from the fs cache across processes", () => {
    const root = fixture({
      "vitest.config.ts": configSource({ logLevel: "fatal" }),
      "guide.md": fence("expect(1).toBe(1);"),
    });
    rmSync(cacheDir(root), { recursive: true, force: true });

    const cold = run(root, { debug: true });
    expect(cold.status).toBe(0);
    expect(cold.tests).toEqual([{ name: "guide.md:1", status: "passed" }]);
    expect(existsSync(cacheDir(root))).toBe(true);

    // A second process shares the cache. The random fence ids change, so Vitest
    // would otherwise read the doc's stale transform and re-resolve its imports.
    const warm = run(root, { debug: true });
    expect(warm.status).toBe(0);
    expect(warm.tests).toEqual([{ name: "guide.md:1", status: "passed" }]);

    const reads = cacheEntries(warm.stderr).filter((entry) => entry.action === "read");
    expect(reads.some((entry) => isGenerated(entry.id))).toBe(false);
    expect(warm.stderr).not.toContain("[stale]");
    // Dependencies still cache across processes, which is the whole point.
    expect(reads.some((entry) => entry.path.startsWith(cacheDir(root)))).toBe(true);
  });

  test("picks up a markdown edit with a warm cache from another process", () => {
    const root = fixture({
      "vitest.config.ts": configSource({ logLevel: "fatal" }),
      "guide.md": fence("expect(1).toBe(1);"),
    });
    rmSync(cacheDir(root), { recursive: true, force: true });
    expect(run(root, { debug: true }).tests).toEqual([{ name: "guide.md:1", status: "passed" }]);

    writeFileSync(join(root, "guide.md"), fence("expect(1).toBe(2);"));
    const warm = run(root, { debug: true });
    expect(warm.tests).toEqual([{ name: "guide.md:1", status: "failed" }]);
    expect(warm.status).toBe(1);
  });

  test("reruns a doc with fresh fence code in watch mode", async () => {
    const root = fixture({
      "vitest.config.ts": configSource({ logLevel: "fatal" }),
      "guide.md": fence("expect(1).toBe(1);"),
    });
    rmSync(cacheDir(root), { recursive: true, force: true });

    const watch = spawnWatch(root);
    try {
      await watch.waitFor(() => watch.summaries().length >= 1);
      writeFileSync(join(root, "guide.md"), fence("expect(1).toBe(2);"));
      await watch.waitFor(() => watch.summaries().length >= 2);
      expect(watch.summaries().at(-1)).toContain("failed");
      expect(watch.output()).toContain("expected 1 to be 2");
    } finally {
      await watch.close();
    }
  }, 30_000);
});

function spawnWatch(root: string): {
  waitFor: (condition: () => boolean) => Promise<void>;
  summaries: () => string[];
  output: () => string;
  close: () => Promise<void>;
} {
  const child: ChildProcess = spawn(
    process.execPath,
    [vitestBin, "watch", "--config", "vitest.config.ts"],
    { cwd: root, env: env(), stdio: ["ignore", "pipe", "pipe"] },
  );
  let output = "";
  child.stdout?.on("data", (chunk: Buffer) => (output += chunk));
  child.stderr?.on("data", (chunk: Buffer) => (output += chunk));
  const clean = (): string => stripAnsi(output);
  return {
    async waitFor(condition: () => boolean): Promise<void> {
      const deadline = Date.now() + 20_000;
      await new Promise<void>((resolve, reject) => {
        const poll = (): void => {
          if (condition()) return resolve();
          if (Date.now() > deadline) return reject(new Error(`timed out waiting:\n${clean()}`));
          setTimeout(poll, 50);
        };
        poll();
      });
    },
    summaries: () => clean().match(/Test Files\s+\d+ (?:passed|failed)/g) ?? [],
    output: clean,
    async close(): Promise<void> {
      if (child.exitCode !== null || child.signalCode !== null) return;
      child.kill("SIGTERM");
      await new Promise((resolve) => child.once("exit", resolve));
    },
  };
}
