import { test } from "vitest";
import { DdtSession } from "@ddtds/core";
import { parseCodeFences } from "@ddtds/core/fences";
import { adapter } from "./adapter.ts";
import { guide, markdownDocs, mdxGuide, root, withoutAnnotations } from "./fixtures.ts";

const markdown = guide(100);
const mdx = mdxGuide(100);

const docs = markdownDocs(20, 20);
const unannotatedDocs = withoutAnnotations(docs);
const edited = `${root}/docs/guide-0.md`;

function reader(): () => string {
  const before = guide(2);
  const after = `${before}\n`;
  let flip = false;
  return () => {
    flip = !flip;
    return flip ? after : before;
  };
}

test("parseCodeFences", async ({ bench }) => {
  await bench("find fences in a markdown doc with 100 runnable fences", () => {
    parseCodeFences(markdown, "guide.md");
  }).run();

  await bench("find fences in an MDX doc with 100 runnable fences", () => {
    parseCodeFences(mdx, "guide.mdx");
  }).run();
});

test("DdtSession", async ({ bench }) => {
  await bench("index 20 docs with 20 runnable fences each", () => {
    DdtSession.fromSources(adapter, docs, root);
  }).run();

  await bench("index 20 docs with no runnable fences", () => {
    DdtSession.fromSources(adapter, unannotatedDocs, root);
  }).run();

  const session = DdtSession.fromSources(adapter, docs, root, reader());
  await bench("reindex one changed doc in a 20 doc session", () => {
    session.refresh(edited);
  }).run();

  const many = DdtSession.fromSources(adapter, markdownDocs(1_000, 2), root, reader());
  await bench("reindex one changed doc in a 1000 doc session", () => {
    many.refresh(edited);
  }).run();
});
