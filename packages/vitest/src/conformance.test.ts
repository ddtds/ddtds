import { conformance } from "@ddtds/test-utils/conformance";
import { vitest, vitestTypechecking, vitestWithGlobals } from "./e2e.ts";

conformance("vitest", vitest(), {
  equal: (actual, expected) => `expect(${actual}).toBe(${expected});`,
  nativeModules: false,
  typecheck: { runner: vitestTypechecking },
  globals: { names: ["expect", "vi"], runner: vitestWithGlobals },
});
