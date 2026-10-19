import { conformance, type Dialect } from "@ddtds/test-utils/conformance";
import { nodeTest, nodeTestWithGlobals } from "./e2e.ts";

const dialect: Dialect = {
  equal: (actual, expected) => `assert.equal(${actual}, ${expected});`,
  globals: { names: ["assert", "mock"], runner: nodeTestWithGlobals },
};

conformance("node:test", nodeTest, dialect);
conformance("node:test (CommonJS)", nodeTest, { ...dialect, module: "cjs" });
