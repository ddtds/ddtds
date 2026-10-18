import { fence, fixture } from "@ddtds/test-utils";
import { expect, test } from "vitest";
import { mochaRunner } from "./e2e.ts";

test("a doc ddtds cannot parse fails alone", async () => {
  await using project = fixture({
    "bad.mdx": "# Bad\n\n<Box prop={}} />\n",
    "good.md": fence("1;"),
  });
  const { outcomes, failures } = await mochaRunner.run(project.root, ["bad.mdx", "good.md"]);
  expect(outcomes["bad.mdx"]).not.toBe("passed");
  expect(outcomes["good.md:1"]).toBe("passed");
  expect(Object.keys(failures)).toEqual(["bad.mdx"]);
});
