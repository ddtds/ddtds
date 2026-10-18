import { conformance } from "@ddtds/test-utils/conformance";
import { nodeTest } from "./e2e.ts";

conformance("node:test", nodeTest, {
  equal: (actual, expected) => `assert.equal(${actual}, ${expected});`,
});

conformance("node:test (CommonJS)", nodeTest, {
  equal: (actual, expected) => `assert.equal(${actual}, ${expected});`,
  module: "cjs",
});
