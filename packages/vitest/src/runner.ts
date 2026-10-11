import { typedImports, type Runner, type RuntimeModule } from "@ddtds/core";

const importFrom = typedImports<{ vitest: typeof import("vitest") }>();

export const vitestRunner: Runner = {
  runtime: "@ddtds/vitest/runtime" satisfies RuntimeModule<typeof import("@ddtds/vitest/runtime")>,
  testImport: importFrom("vitest", "test"),
  fenceImports: [importFrom("vitest", "expect")],
};
