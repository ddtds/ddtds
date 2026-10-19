import { expect, test } from "vitest";
import { DocIndex } from "./docs.ts";

const options = {
  root: "/repo/pkg",
  moduleDir: "/repo/pkg/__doctests__",
};
const run = (code: string, lang = "ts") => `\`\`\`${lang} run\n${code}\n\`\`\`\n`;

function index(sources: Record<string, string>): DocIndex {
  return DocIndex.fromSources(new Map(Object.entries(sources)), options);
}

function summary(index: DocIndex): Record<string, string[]> {
  return Object.fromEntries(
    Array.from(index.docs(), ([doc, fences]) => [
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
        "1 /repo/pkg/__doctests__/___docs_guide_md_1_25d58d7b.ts",
        "5 /repo/pkg/__doctests__/___docs_guide_md_5_427efaac.tsx",
      ],
    }
  `);
});

test("replaceDoc replaces one doc in place", () => {
  const docs = index({ "/repo/pkg/a.md": run("1"), "/repo/pkg/b.md": run("2") });
  const removed = docs.fencesOf("/repo/pkg/a.md")[0]!.id;

  docs.replaceDoc("/repo/pkg/a.md", `\n\n${run("3")}`);

  expect(summary(docs)).toMatchInlineSnapshot(`
    {
      "/repo/pkg/a.md": [
        "3 /repo/pkg/__doctests__/a_md_3_b00973ef.ts",
      ],
      "/repo/pkg/b.md": [
        "1 /repo/pkg/__doctests__/b_md_1_d974e864.ts",
      ],
    }
  `);
  expect(docs.fence(removed)).toBeUndefined();
  expect(docs.fencesOf("/repo/pkg/b.md")).toHaveLength(1);
});

test("replaceDoc keeps a doc that loses all its fences", () => {
  const docs = index({ "/repo/pkg/a.md": run("1") });

  docs.replaceDoc("/repo/pkg/a.md", "# no code\n");

  expect(docs.hasDoc("/repo/pkg/a.md")).toBe(true);
  expect(docs.fencesOf("/repo/pkg/a.md")).toEqual([]);
  expect(docs.size).toBe(0);
});

test("docModuleId flattens the doc path relative to the root", () => {
  expect(index({}).docModuleId("/repo/docs/guide.md")).toBe(
    "/repo/pkg/__doctests__/___docs_guide_md.test.ts",
  );
});

test("sourceOf returns the doc's original text", () => {
  const source = run("1");
  const docs = index({ "/repo/docs/guide.md": source });
  expect(docs.sourceOf("/repo/docs/guide.md")).toBe(source);
  expect(docs.sourceOf("/repo/docs/missing.md")).toBeUndefined();
});
