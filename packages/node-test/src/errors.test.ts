import { expect, test } from "vitest";
import { fence, spawn } from "@ddtds/test-utils";
import { nodeTest } from "./e2e.ts";

test("invalid MDX fails its doc and leaves the other docs running", async () => {
  await using ddt = spawn(nodeTest, {
    "broken.mdx": `# Guide\n\n<!-- TODO: explain -->\n\n${fence("assert.equal(1, 1);")}`,
    "fine.md": fence("assert.equal(1, 1);"),
  });
  expect(await ddt.run()).toEqual({ "broken.mdx": "failed", "fine.md:1": "passed" });
});
