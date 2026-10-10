import { expect, test } from "vitest";
import { DocIndex, docModuleName } from "./docs.ts";
import { createLogger } from "./logger.ts";

const options = {
  root: "/repo/pkg",
  moduleDir: "/repo/pkg/__doctests__",
  logger: createLogger("silent"),
};
const run = (code: string, lang = "ts") => `\`\`\`${lang} run\n${code}\n\`\`\`\n`;

function index(sources: Record<string, string>): DocIndex {
  return DocIndex.fromSources(new Map(Object.entries(sources)), options);
}

function summary(index: DocIndex): Record<string, string[]> {
  return Object.fromEntries(
    [...index.docs()].map(([doc, fences]) => [
      doc,
      fences.map((fence) => `${fence.block.line} ${fence.id}`),
    ]),
  );
}

test("fromSources indexes runnable fences and skips docs without any", () => {
  const docs = index({
    "/repo/docs/guide.md": `${run("1")}\n${run("<p />", "tsx")}`,
    "/repo/pkg/prose.md": "# no code\n",
  });
  expect(summary(docs)).toMatchInlineSnapshot(`
    {
      "/repo/docs/guide.md": [
        "1 /repo/pkg/__doctests__/___docs_guide_md_1.ts",
        "5 /repo/pkg/__doctests__/___docs_guide_md_5.tsx",
      ],
    }
  `);
});

test("withDoc replaces one doc's fences and drops docs without any", () => {
  const before = index({ "/repo/pkg/a.md": run("1"), "/repo/pkg/b.md": run("1") });
  const after = before.withDoc("/repo/pkg/a.md", `\n\n${run("2")}`).withDoc("/repo/pkg/b.md", "");
  expect(summary(after)).toMatchInlineSnapshot(`
    {
      "/repo/pkg/a.md": [
        "3 /repo/pkg/__doctests__/a_md_3.ts",
      ],
    }
  `);
  expect(summary(before)).toHaveProperty(["/repo/pkg/b.md"]);
});

test("docModuleName flattens the path relative to the root", () => {
  expect(docModuleName(options.root, "/repo/docs/guide.md")).toBe("___docs_guide_md.test.ts");
});
