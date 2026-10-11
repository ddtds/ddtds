import { expect, test } from "vitest";
import { fence, fixture, run } from "./test-utils.ts";

test("fences with a default export run their code", async () => {
  const root = fixture({
    "named-function.md": fence(
      "export default function double(x) {\n  return x * 2;\n}\nexpect(double(2)).toBe(4);",
    ),
    "anonymous-function.md": fence("export default function () {}"),
    "named-class.md": fence("export default class Greeter {}\nexpect(new Greeter()).toBeTruthy();"),
    "anonymous-class.md": fence("export default class {}"),
    "object.md": fence("export default { answer: 42 };"),
    "literal.md": fence("export default 42;"),
  });
  expect(await run(root)).toMatchInlineSnapshot(`
    {
      "anonymous-class.md:1": "passed",
      "anonymous-function.md:1": "passed",
      "literal.md:1": "passed",
      "named-class.md:1": "passed",
      "named-function.md:1": "passed",
      "object.md:1": "passed",
    }
  `);
});
