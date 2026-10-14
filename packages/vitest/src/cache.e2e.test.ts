import { existsSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { version } from "vitest/node";
import { fence, fixture } from "./test-utils.ts";
import { run, watch, writeConfig } from "./e2e.ts";

const cacheDir = (root: string): string => join(root, ".ddt-cache");

function cacheProject(root: string): void {
  writeConfig(
    root,
    { logLevel: "fatal" },
    {
      server: { watch: { ignored: ["**/.ddt-cache/**"] } },
      test: { fsModuleCache: true, fsModuleCachePath: ".ddt-cache" },
    },
  );
  rmSync(cacheDir(root), { recursive: true, force: true });
}

function reads(stderr: string): { id: string; path: string }[] {
  return [...stderr.matchAll(/\[read\] (.+?) is cached in (.+?)\s*$/gm)].map((match) => ({
    id: match[1]!,
    path: match[2]!,
  }));
}

const generated = (id: string): boolean => id.endsWith("guide.md") || id.includes("__ddtds__");

describe.skipIf(Number(version.split(".")[0]) < 5)("fs module cache", () => {
  test("never serves a generated module from the fs cache across processes", () => {
    const root = fixture({ "guide.md": fence("expect(1).toBe(1);") });
    cacheProject(root);

    const cold = run(root, { debug: "vitest:cache:fs" });
    expect(cold.status).toBe(0);
    expect(cold.tests).toEqual([{ name: "guide.md:1", status: "passed" }]);
    expect(existsSync(cacheDir(root))).toBe(true);

    const warm = run(root, { debug: "vitest:cache:fs" });
    expect(warm.status).toBe(0);
    expect(warm.tests).toEqual([{ name: "guide.md:1", status: "passed" }]);

    const cached = reads(warm.stderr);
    expect(cached.some(({ id }) => generated(id))).toBe(false);
    expect(warm.stderr).not.toContain("[stale]");
    expect(cached.some(({ path }) => path.startsWith(cacheDir(root)))).toBe(true);
  });

  test("picks up a markdown edit with a warm cache from another process", () => {
    const root = fixture({ "guide.md": fence("expect(1).toBe(1);") });
    cacheProject(root);
    expect(run(root, { debug: "vitest:cache:fs" }).tests).toEqual([
      { name: "guide.md:1", status: "passed" },
    ]);

    writeFileSync(join(root, "guide.md"), fence("expect(1).toBe(2);"));
    const warm = run(root, { debug: "vitest:cache:fs" });
    expect(warm.tests).toEqual([{ name: "guide.md:1", status: "failed" }]);
    expect(warm.status).toBe(1);
  });

  test("reruns a doc with fresh fence code in watch mode", async () => {
    const root = fixture({ "guide.md": fence("expect(1).toBe(1);") });
    cacheProject(root);

    const watcher = watch(root);
    try {
      await watcher.waitFor(() => watcher.summaries().length >= 1);
      writeFileSync(join(root, "guide.md"), fence("expect(1).toBe(2);"));
      await watcher.waitFor(() => watcher.summaries().length >= 2);
      expect(watcher.summaries().at(-1)).toContain("failed");
      expect(watcher.output()).toContain("expected 1 to be 2");
    } finally {
      await watcher.close();
    }
  }, 30_000);
});
