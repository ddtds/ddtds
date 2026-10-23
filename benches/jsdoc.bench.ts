import { test } from "vitest";
import { DdtSession } from "@ddtds/core";
import { adapter } from "./adapter.ts";
import {
  markdownDocs,
  root,
  sourceDocs,
  sourceWithFences,
  sourceWithoutFences,
  withoutAnnotations,
} from "./fixtures.ts";

const filesWithFences = sourceDocs(20, sourceWithFences(5));
const filesWithoutFences = sourceDocs(20, sourceWithoutFences(20));
/** A repo scanned by the default `include`, which covers markdown and source files */
const mixed = new Map([...markdownDocs(10, 20), ...filesWithFences]);

const largeFile = sourceDocs(1, sourceWithFences(250));
const largeFileMostlyProse = sourceDocs(1, sourceWithoutFences(250 - 36) + sourceWithFences(36));
const largeUnannotatedFile = withoutAnnotations(largeFile);

// Bypass Vite's export getter: indexing a fence-free repo is fast enough that the
// getter would dominate. https://vitest.dev/guide/benchmarking#module-runner-overhead
const fromSources = DdtSession.fromSources.bind(DdtSession);

/**
 * Source files are parsed with the TypeScript parser, not the markdown one, so the
 * fence scan is the expensive part of indexing a repo with `@example` docs.
 */
test("DdtSession source docs", async ({ bench }) => {
  await bench("index 20 source files with 5 example fences each", () => {
    fromSources(adapter, filesWithFences, root);
  }).run();

  await bench("index 20 source files with 20 doc comments each and no fences", () => {
    fromSources(adapter, filesWithoutFences, root);
  }).run();

  await bench("index 10 markdown docs and 20 source files", () => {
    fromSources(adapter, mixed, root);
  }).run();
});

/** Costs that grow with a file's size, not just with how many fences it has */
test("DdtSession large source doc", async ({ bench }) => {
  await bench("index a source file with 250 example fences", () => {
    fromSources(adapter, largeFile, root);
  }).run();

  await bench("index a source file with 250 doc comments, 36 with example fences", () => {
    fromSources(adapter, largeFileMostlyProse, root);
  }).run();

  await bench("index a source file with 250 unannotated example fences", () => {
    fromSources(adapter, largeUnannotatedFile, root);
  }).run();
});
