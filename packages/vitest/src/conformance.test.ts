import { conformance } from "@ddtds/test-utils/conformance";
import { vitest } from "./e2e.ts";

conformance("vitest", vitest(), {
  equal: (actual, expected) => `expect(${actual}).toBe(${expected});`,
  nativeModules: false,
});
