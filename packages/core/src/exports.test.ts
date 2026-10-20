import { expect, test } from "vitest";
import * as codegen from "@ddtds/core/codegen";
import * as config from "@ddtds/core/config";
import * as docs from "@ddtds/core/docs";
import * as session from "@ddtds/core";
import * as errors from "@ddtds/core/errors";
import * as fences from "@ddtds/core/fences";
import * as log from "@ddtds/core/log";
import * as runtime from "@ddtds/core/runtime";

test.each([
  ["codegen", codegen, ["moduleFor"]],
  ["config", config, ["defaultDocsExclude", "defaultDocsInclude", "typedImports"]],
  ["docs", docs, ["DocIndex"]],
  ["errors", errors, ["DdtCompileError"]],
  ["fences", fences, ["ANNOTATIONS", "CodeBlock", "parseCodeFences"]],
  ["log", log, ["configureLogging"]],
  ["runtime", runtime, ["runtime"]],
  ["session", session, ["DdtSession"]],
] as const)("%s exposes only its public values", (_name, module, keys) => {
  expect(Object.keys(module).toSorted()).toEqual(keys);
});
