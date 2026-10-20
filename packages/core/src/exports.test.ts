import { expect, test } from "vitest";
import * as adapter from "@ddtds/core/adapter";
import * as codegen from "@ddtds/core/codegen";
import * as imports from "@ddtds/core/imports";
import * as config from "@ddtds/core/config";
import * as docs from "@ddtds/core/docs";
import * as session from "@ddtds/core";
import * as annotations from "@ddtds/core/annotations";
import * as errors from "@ddtds/core/errors";
import * as fences from "@ddtds/core/fences";
import * as languages from "@ddtds/core/languages";
import * as log from "@ddtds/core/log";
import * as runtime from "@ddtds/core/runtime";

test.each([
  ["adapter", adapter, []],
  ["annotations", annotations, ["ANNOTATIONS"]],
  ["codegen", codegen, ["moduleFor"]],
  ["config", config, ["defaultDocsExclude", "defaultDocsInclude"]],
  ["docs", docs, ["DocIndex"]],
  ["errors", errors, ["DdtCompileError"]],
  ["fences", fences, ["CodeBlock", "parseCodeFences"]],
  ["imports", imports, ["typedImports"]],
  ["languages", languages, []],
  ["log", log, ["configureLogging"]],
  ["runtime", runtime, ["runtime"]],
  ["session", session, ["DdtSession"]],
] as const)("%s exposes only its public values", (_name, module, keys) => {
  expect(Object.keys(module).toSorted()).toEqual(keys);
});
