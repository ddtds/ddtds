import { conformance } from "@ddtds/test-utils/conformance";
import { defaultGlobals, typedImports } from "./index.ts";
import { vitest } from "./e2e.ts";

conformance("vitest", vitest(), {
  equal: (actual, expected) => `expect(${actual}).toBe(${expected});`,
  nativeModules: false,
  globals: {
    names: ["expect", "vi"],
    runner: ({ defaults, extra }) =>
      vitest({
        plugin: {
          globals: [
            ...(defaults ? defaultGlobals : []),
            ...extra.map(({ module, name, alias }) =>
              typedImports<Record<string, unknown>>(module)(name, { alias }),
            ),
          ],
        },
      }),
  },
});
