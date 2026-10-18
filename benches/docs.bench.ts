import { test } from "vitest";
import { DocIndex, parseCodeFences } from "@ddtds/core";
import { guide, markdownSources, mdxGuide, options, root } from "./fixtures.ts";

const doc = guide(50);
const mdx = mdxGuide(50);

const sources = markdownSources(20, 10);
const index = DocIndex.fromSources(sources, options);

test("parseCodeFences", async ({ bench }) => {
  await bench("find fences in a 50 section markdown doc", () => {
    parseCodeFences(doc, "guide.md");
  }).run();

  await bench("find fences in a 50 section MDX doc", () => {
    parseCodeFences(mdx, "guide.mdx");
  }).run();
});

test("DocIndex", async ({ bench }) => {
  await bench("index 20 docs of 10 sections", () => {
    DocIndex.fromSources(sources, options);
  }).run();

  await bench("reindex one changed doc", () => {
    index.withDoc(`${root}/docs/guide-0.md`, guide(11));
  }).run();
});
