import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";
import { expect, test } from "vitest";
import { fence, fixture } from "@ddtds/test-utils";

const register = join(import.meta.dirname, "register.ts");
const run = promisify(execFile);

/** The report `node --test` prints for a failing doc, which holds the stack of each failure */
async function report(root: string, doc: string): Promise<string> {
  const env = { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" };
  const options = { cwd: root, env };
  const args = ["--test", "--test-reporter=spec", "--import", register, doc];
  const error = await run(process.execPath, args, options).then(
    () => {
      throw new Error("expected the doc to fail");
    },
    (failed: { stdout: string; stderr: string }) => failed,
  );
  return error.stdout + error.stderr;
}

const throws = 'throw new TypeError("boom");';

test("a failure points at the markdown line that threw", async () => {
  await using dir = fixture({ "guide.md": `# Guide\n\n${fence(`const a = 1;\n${throws}`)}` });
  const output = await report(dir.root, "guide.md");
  expect(output).toContain(`${dir.root}/guide.md:5:7`);
  expect(output).not.toContain("__ddtds__");
});

test("a failure in a CommonJS package points at the markdown line that threw", async () => {
  await using dir = fixture({
    "package.json": '{ "type": "commonjs" }',
    "guide.md": `# Guide\n\n${fence(`const a = 1;\n${throws}`)}`,
  });
  const output = await report(dir.root, "guide.md");
  expect(output).toContain(`${dir.root}/guide.md:5:7`);
  expect(output).not.toContain("__ddtds__");
});

test("a failure points at the line of the JSDoc comment that threw", async () => {
  const math = ["/**", " * ```ts run", ` * ${throws}`, " * ```", " */", "export {};", ""];
  await using dir = fixture({ "math.ts": math.join("\n") });
  const output = await report(dir.root, "math.ts");
  expect(output).toContain(`${dir.root}/math.ts:3:10`);
  expect(output).not.toContain("__ddtds__");
});
