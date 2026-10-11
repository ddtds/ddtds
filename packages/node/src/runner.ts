import { typedImports, type Runner, type RuntimeModule } from "@ddtds/core";

const importFrom = typedImports<{
  "node:test": typeof import("node:test");
  "node:assert": typeof import("node:assert");
}>();

/** Fences assert with `assert` from `node:assert`, in strict mode */
export const nodeRunner: Runner = {
  runtime: "@ddtds/node/runtime" satisfies RuntimeModule<typeof import("@ddtds/node/runtime")>,
  testImport: importFrom("node:test", "test"),
  fenceImports: [importFrom("node:assert", "strict as assert")],
};
