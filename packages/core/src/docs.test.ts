import { expect, test } from "vitest";
import { docModuleName, indexDocs, type DocIndex } from "./docs.ts";
import { createLogger } from "./logger.ts";

const options = {
  root: "/repo/pkg",
  outputDir: "/repo/pkg/__doctests__",
  logger: createLogger("silent"),
};
const run = (code: string, lang = "ts") => `\`\`\`${lang} run\n${code}\n\`\`\`\n`;

function index(sources: Record<string, string>): DocIndex {
  return indexDocs(new Map(Object.entries(sources)), options);
}

function summary({ docs }: DocIndex): Record<string, string[]> {
  return Object.fromEntries(
    [...docs].map(([doc, fences]) => [
      doc,
      fences.map((fence) => `${fence.block.line} ${fence.id}`),
    ]),
  );
}

test("indexDocs indexes runnable fences and skips docs without any", () => {
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

test("docModuleName flattens the path relative to the root", () => {
  expect(docModuleName(options.root, "/repo/docs/guide.md")).toBe("___docs_guide_md.test.ts");
});
