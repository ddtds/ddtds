import { test } from "vitest";
import { DdtSession } from "@ddtds/core";
import { parseCodeFences } from "@ddtds/core/fences";
import { adapter } from "./adapter.ts";
import { guide, markdownSources, mdxGuide, root, withoutAnnotations } from "./fixtures.ts";

const doc = guide(50);
const mdx = mdxGuide(50);

const sources = markdownSources(20, 10);
const large = markdownSources(200, 10);
const unannotated = withoutAnnotations(large);
const edited = `${root}/docs/guide-0.md`;

function reader(): () => string {
  const before = guide(1);
  const after = `${before}\n`;
  let flip = false;
  return () => {
    flip = !flip;
    return flip ? after : before;
  };
}

test("parseCodeFences", async ({ bench }) => {
  await bench("find fences in a 50 section markdown doc", () => {
    parseCodeFences(doc, "guide.md");
  }).run();

  await bench("find fences in a 50 section MDX doc", () => {
    parseCodeFences(mdx, "guide.mdx");
  }).run();
});

test("DdtSession", async ({ bench }) => {
  await bench("index 20 docs of 10 sections", () => {
    DdtSession.fromSources(adapter, sources, root);
  }).run();

  await bench("index 200 docs of 10 sections", () => {
    DdtSession.fromSources(adapter, large, root);
  }).run();

  await bench("index 200 docs of 10 sections with no annotated fences", () => {
    DdtSession.fromSources(adapter, unannotated, root);
  }).run();

  const session = DdtSession.fromSources(adapter, sources, root, reader());
  await bench("reindex one changed doc in a 20 doc session", () => {
    session.refresh(edited);
  }).run();

  const many = DdtSession.fromSources(adapter, markdownSources(1_000, 1), root, reader());
  await bench("reindex one changed doc in a 1000 doc session", () => {
    many.refresh(edited);
  }).run();
});
