import { describe, expect, test } from "vitest";
import { fence, spawn } from "@ddtds/test-utils";
import { vitest, vitestTypechecking } from "./e2e.ts";

const guide = [
  "# Guide",
  "",
  fence('const count: number = "one";\nexpect(count).toBe("one");'),
  fence("const count: number = 1;\nexpect(count).toBe(1);"),
  fence("const name: string = 1;", "compile_fail"),
].join("\n");

describe("typecheck", { timeout: 30_000 }, () => {
  test("type errors do not fail fences without typecheck", async () => {
    await using plain = spawn(vitest(), { "guide.md": guide });
    expect(await plain.run()).toMatchInlineSnapshot(`
      {
        "guide.md:15": "Error",
        "guide.md:3": "passed",
        "guide.md:9": "passed",
      }
    `);
  });

  test("type errors point at the markdown", async () => {
    await using ddt = spawn(vitestTypechecking(), { "guide.md": guide });
    await ddt.run();
    expect(ddt.failures).toMatchInlineSnapshot(`
      {
        "guide.md:3": [
          {
            "column": 7,
            "file": "guide.md",
            "line": 4,
          },
        ],
      }
    `);
  });
});
