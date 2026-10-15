import { existsSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { version } from "vitest/node";
import { fence, fixture } from "@ddtds/test-utils";
import { create } from "./test-utils.ts";

const cachePath = (root: string): string => join(root, ".ddt-cache");

/** Run the fixture once through a real Vitest, returning each test's outcome. */
async function outcomes(root: string): Promise<Record<string, string>> {
  // `fsModuleCache` is Vitest 5+; kept in a variable so this still compiles on 4.
  const cacheTest = { fsModuleCache: true, fsModuleCachePath: cachePath(root) };
  await using instance = await create(root, { test: cacheTest });
  await instance.start();
  const results: Record<string, string> = {};
  for (const module of instance.state.getTestModules()) {
    const [moduleError] = module.errors();
    if (moduleError) results[module.moduleId] = moduleError.message;
    for (const testCase of module.children.allTests()) {
      const { state, errors } = testCase.result();
      results[testCase.name] = errors?.[0]?.name ?? state;
    }
  }
  return results;
}

/** Cache entry mtimes, so a rerun that reuses them rather than rewriting is visible. */
function cacheSnapshot(root: string): Record<string, number> {
  const dir = cachePath(root);
  if (!existsSync(dir)) return {};
  return Object.fromEntries(
    readdirSync(dir).map((file) => [file, statSync(join(dir, file)).mtimeMs]),
  );
}

// `fsModuleCache` is Vitest 5+, so the suite is skipped on 4.
describe.skipIf(Number(version.split(".")[0]) < 5)("fs module cache", () => {
  test("reuses generated modules across runs instead of regenerating them", async () => {
    await using dir = fixture({ "guide.md": fence("expect(1).toBe(1);") });

    expect(await outcomes(dir.root)).toEqual({ "guide.md:1": "passed" });
    const cold = cacheSnapshot(dir.root);
    expect(Object.keys(cold).length).toBeGreaterThan(0);

    expect(await outcomes(dir.root)).toEqual({ "guide.md:1": "passed" });
    // The ids are content-addressed, so the warm run reads the cached transforms
    // back verbatim: nothing is added or rewritten.
    expect(cacheSnapshot(dir.root)).toEqual(cold);
  });

  test("picks up an edit instead of serving a stale transform", async () => {
    await using dir = fixture({ "guide.md": fence("expect(1).toBe(1);") });
    expect(await outcomes(dir.root)).toEqual({ "guide.md:1": "passed" });

    writeFileSync(join(dir.root, "guide.md"), fence("expect(1).toBe(2);"));
    expect(await outcomes(dir.root)).toEqual({ "guide.md:1": "AssertionError" });
  });
});
