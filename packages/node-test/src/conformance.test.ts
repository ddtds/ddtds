import { conformance } from "@ddtds/test-utils/conformance";
import { nodeTest } from "./e2e.ts";

conformance("node:test", nodeTest, {
  equal: (actual, expected) => `assert.equal(${actual}, ${expected});`,
  assertion: "AssertionError ERR_ASSERTION",
  missingImport: "Error ERR_MODULE_NOT_FOUND",
});
