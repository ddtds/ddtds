import { conformance } from "@ddtds/test-utils/conformance";
import { vitest, vitestWithGlobals } from "./e2e.ts";

conformance("vitest", vitest(), {
  equal: (actual, expected) => `expect(${actual}).toBe(${expected});`,
  nativeModules: false,
  globals: { names: ["expect", "vi"], runner: vitestWithGlobals },
});
