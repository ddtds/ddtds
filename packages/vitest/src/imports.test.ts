import { expect, test } from "vitest";
import { fence, fixture } from "@ddtds/test-utils";
import { vitest } from "./e2e.ts";

const files = {
  "reimport.md": fence("import { expect } from 'vitest';\nexpect(1).toBe(1);"),
  "alias.md": fence(
    "import { expect as check } from 'vitest';\ncheck(1).toBe(1);\nexpect(2).toBe(2);",
  ),
  "type-only.md": fence("import type { expect as unused } from 'vitest';\nexpect(1).toBe(1);"),
  "declared.md": fence("const value = 1;\nexpect(value).toBe(1);"),
};

test("a fence can import a name the runner injects", async () => {
  await using dir = fixture(files);
  const { outcomes } = await vitest().run(dir.root, Object.keys(files));
  expect(Object.values(outcomes).every((outcome) => outcome === "passed")).toBe(true);
});
