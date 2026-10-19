import { conformance } from "@ddtds/test-utils/conformance";
import { nodeTest, nodeTestWithGlobals } from "./e2e.ts";

conformance("node:test", nodeTest, {
  equal: (actual, expected) => `assert.equal(${actual}, ${expected});`,
  globals: { names: ["assert", "mock"], runner: nodeTestWithGlobals },
});

conformance("node:test (CommonJS)", nodeTest, {
  equal: (actual, expected) => `assert.equal(${actual}, ${expected});`,
  module: "cjs",
  globals: { names: ["assert", "mock"], runner: nodeTestWithGlobals },
});
