import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { fence, fixture, spawn } from "@ddtds/test-utils";
import { vitest } from "./e2e.ts";
import { vitestVersion } from "./test-utils.ts";

/** The cache keys written so far: one entry per transform that had to run. */
function cacheEntries(cache: string): string[] {
  return readdirSync(cache).toSorted();
}

// `fsModuleCache` is Vitest 5+, so the suite is skipped on 4.
describe.skipIf(vitestVersion.major < 5)("fs module cache", () => {
  test("reuses generated modules across runs instead of regenerating them", async () => {
    await using cacheDir = fixture({});
    const cache = join(cacheDir.root, ".ddt-cache");
    await using ddt = spawn(vitest({ test: { fsModuleCache: true, fsModuleCachePath: cache } }), {
      "guide.md": fence("expect(1).toBe(1);"),
    });

    expect(await ddt.run()).toEqual({ "guide.md:1": "passed" });
    const cold = cacheEntries(cache);
    expect(cold.length).toBeGreaterThan(0);

    expect(await ddt.run()).toEqual({ "guide.md:1": "passed" });
    // The ids are content-addressed, so the warm run reuses every key. An id
    // that changed per run would show up here as a new entry.
    expect(cacheEntries(cache)).toEqual(cold);
  });

  test("picks up an edit instead of serving a stale transform", async () => {
    await using cacheDir = fixture({});
    const cache = join(cacheDir.root, ".ddt-cache");
    await using ddt = spawn(vitest({ test: { fsModuleCache: true, fsModuleCachePath: cache } }), {
      "guide.md": fence("expect(1).toBe(1);"),
    });

    expect(await ddt.run()).toEqual({ "guide.md:1": "passed" });
    writeFileSync(join(ddt.root, "guide.md"), fence("expect(1).toBe(2);"));
    expect(await ddt.run()).toEqual({ "guide.md:1": "AssertionError" });
  });
});
