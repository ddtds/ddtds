import { test } from "vitest";
import { DdtSession } from "@ddtds/core";
import { adapter } from "./adapter.ts";
import {
  markdownSources,
  root,
  sourceDocs,
  sourceWithFences,
  sourceWithoutFences,
  withoutAnnotations,
} from "./fixtures.ts";

const withFences = sourceDocs(20, 5, sourceWithFences);
const withoutFences = sourceDocs(20, 20, sourceWithoutFences);
const large = sourceDocs(1, 250, sourceWithFences);
const mostlyProse = new Map([
  [`${root}/src/large.ts`, `${sourceWithoutFences(214)}\n${sourceWithFences(36)}`],
]);
const unannotated = withoutAnnotations(large);
/** A repo scanned by the default `include`, which covers markdown and source files */
const mixed = new Map([...markdownSources(10, 10), ...withFences]);

// Bypass Vite's export getter: indexing a fence-free repo is fast enough that the
// getter would dominate. https://vitest.dev/guide/benchmarking#module-runner-overhead
const fromSources = DdtSession.fromSources.bind(DdtSession);

/**
 * Source files are parsed with the TypeScript parser, not the markdown one, so the
 * fence scan is the expensive part of indexing a repo with `@example` docs.
 */
test("DdtSession source docs", async ({ bench }) => {
  await bench("index 20 source docs with 5 example fences", () => {
    fromSources(adapter, withFences, root);
  }).run();

  await bench("index 1 source doc with 250 example fences", () => {
    fromSources(adapter, large, root);
  }).run();

  await bench("index 1 source doc with 250 comments, 36 with example fences", () => {
    fromSources(adapter, mostlyProse, root);
  }).run();

  await bench("index 1 source doc with 250 unannotated example fences", () => {
    fromSources(adapter, unannotated, root);
  }).run();

  await bench("index 20 source docs with no fences", () => {
    fromSources(adapter, withoutFences, root);
  }).run();

  await bench("index a mixed markdown and source repo", () => {
    fromSources(adapter, mixed, root);
  }).run();
});
