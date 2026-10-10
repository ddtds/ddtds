import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, onTestFinished, test } from "vitest";
import { createVitest } from "vitest/node";
import { ddtPlugin } from "./index.ts";

const fences = {
  "parse error": "const = 1;",
  "runtime syntax error": 'JSON.parse("{");',
  "undeclared name": "missingFn();",
  "missing static import": 'import { x } from "missing-package";\nx;',
  "missing dynamic import": 'await import("./missing.ts");',
  "failed assertion": "expect(1).toBe(2);",
  passes: "expect(1).toBe(1);",
};

function fixture(): { root: string; labels: Map<number, string> } {
  const root = mkdtempSync(join(import.meta.dirname, "../.fixture-"));
  onTestFinished(() => rmSync(root, { recursive: true, force: true }));
  const labels = new Map<number, string>();
  let markdown = "";
  for (const [label, code] of Object.entries(fences)) {
    labels.set(markdown.split("\n").length, label);
    markdown += `\`\`\`ts run\n${code}\n\`\`\`\n\n`;
  }
  writeFileSync(join(root, "guide.md"), markdown);
  return { root, labels };
}

async function run(root: string, labels: Map<number, string>): Promise<Record<string, unknown>> {
  const vitest = await createVitest(
    "test",
    { root, config: false, watch: false, reporters: [{}] },
    {
      plugins: [ddtPlugin({ logLevel: "silent" })],
      resolve: { alias: { "@ddtds/vitest": join(import.meta.dirname, "index.ts") } },
    },
  );
  try {
    await vitest.start();
    const results: Record<string, unknown> = {};
    for (const module of vitest.state.getTestModules()) {
      const line = Number(/_(\d+)\.test\.ts$/.exec(module.moduleId)?.[1]);
      const label = labels.get(line) ?? module.moduleId;
      const [moduleError] = module.errors();
      if (moduleError) results[label] = { state: "module failed", name: moduleError.name };
      for (const testCase of module.children.allTests()) {
        const [error] = testCase.result().errors ?? [];
        results[label] = error
          ? { state: "failed", kind: "kind" in error ? error.kind : undefined }
          : { state: "passed" };
      }
    }
    return results;
  } finally {
    await vitest.close();
  }
}

test("classifies how doc tests fail", async () => {
  const { root, labels } = fixture();
  expect(await run(root, labels)).toMatchInlineSnapshot(`
    {
      "failed assertion": {
        "kind": "runtime-failure",
        "state": "failed",
      },
      "missing dynamic import": {
        "kind": "compile-error",
        "state": "failed",
      },
      "missing static import": {
        "name": "Error",
        "state": "module failed",
      },
      "parse error": {
        "kind": "compile-error",
        "state": "failed",
      },
      "passes": {
        "state": "passed",
      },
      "runtime syntax error": {
        "kind": "runtime-failure",
        "state": "failed",
      },
      "undeclared name": {
        "kind": "compile-error",
        "state": "failed",
      },
    }
  `);
});
