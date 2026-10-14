import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { fence } from "./test-utils.ts";
import { spawnFramework, vitest, vitestVersion, type RunnerOptions } from "./e2e.ts";

const options: RunnerOptions = {
  plugin: { logLevel: "fatal" },
  debug: "vitest:cache:fs",
  config: {
    server: { watch: { ignored: ["**/.ddt-cache/**"] } },
    test: { fsModuleCache: true, fsModuleCachePath: ".ddt-cache" },
  },
};

function reads(stderr: string): { id: string; path: string }[] {
  return [...stderr.matchAll(/\[read\] (.+?) is cached in (.+?)\s*$/gm)].map((match) => ({
    id: match[1]!,
    path: match[2]!,
  }));
}

const generated = (id: string): boolean => id.endsWith("guide.md") || id.includes("__ddtds__");

describe.skipIf(vitestVersion.major < 5)("fs module cache", () => {
  test("never serves a generated module from the fs cache across processes", async () => {
    await using ddt = spawnFramework({
      runner: vitest,
      options,
      files: { "guide.md": fence("expect(1).toBe(1);") },
    });

    const cold = await ddt.run();
    expect(cold.status).toBe(0);
    expect(cold.outcomes).toEqual({ "guide.md:1": "passed" });

    const warm = await ddt.run();
    expect(warm.outcomes).toEqual({ "guide.md:1": "passed" });

    const cached = reads(warm.stderr);
    expect(cached.some(({ id }) => generated(id))).toBe(false);
    expect(warm.stderr).not.toContain("[stale]");
    expect(cached.some(({ path }) => path.startsWith(join(ddt.root, ".ddt-cache")))).toBe(true);
  });

  test("picks up a markdown edit with a warm cache from another process", async () => {
    await using ddt = spawnFramework({
      runner: vitest,
      options,
      files: { "guide.md": fence("expect(1).toBe(1);") },
    });
    expect((await ddt.run()).outcomes).toEqual({ "guide.md:1": "passed" });

    const warm = await ddt.edit("guide.md", fence("expect(1).toBe(2);"));
    expect(warm.outcomes).toEqual({ "guide.md:1": "failed" });
    expect(warm.status).toBe(1);
  });

  test("reruns a doc with fresh fence code in watch mode", async () => {
    await using ddt = spawnFramework({
      runner: vitest,
      options,
      files: { "guide.md": fence("expect(1).toBe(1);") },
    });
    expect((await ddt.watch()).outcomes).toEqual({ "guide.md:1": "passed" });
    const rerun = await ddt.edit("guide.md", fence("expect(1).toBe(2);"));
    expect(rerun.outcomes).toEqual({ "guide.md:1": "failed" });
  });
});
