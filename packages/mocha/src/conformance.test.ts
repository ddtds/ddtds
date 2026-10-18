import { conformance } from "@ddtds/test-utils/conformance";
import { mochaRunner } from "./e2e.ts";

conformance("mocha", mochaRunner, {
  equal: (actual, expected) => `assert.equal(${actual}, ${expected});`,
});

conformance("mocha (CommonJS)", mochaRunner, {
  equal: (actual, expected) => `assert.equal(${actual}, ${expected});`,
  module: "cjs",
});
