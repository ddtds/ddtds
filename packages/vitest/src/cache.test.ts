import { readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { fence, fixture, spawn } from "@ddtds/test-utils";
import { vitest } from "./e2e.ts";
import { vitestVersion } from "./test-utils.ts";

/** Cache entry mtimes, so a rerun that reuses them rather than rewriting is visible. */
function cacheSnapshot(cache: string): Record<string, number> {
  return Object.fromEntries(
    readdirSync(cache).map((file) => [file, statSync(join(cache, file)).mtimeMs]),
  );
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
    const cold = cacheSnapshot(cache);
    expect(Object.keys(cold).length).toBeGreaterThan(0);

    expect(await ddt.run()).toEqual({ "guide.md:1": "passed" });
    // The ids are content-addressed, so the warm run reads the cached transforms
    // back verbatim: nothing is added or rewritten.
    expect(cacheSnapshot(cache)).toEqual(cold);
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
