import { expect, test } from "vitest";
import { renderImport, typedImports, type StaticImport } from "@ddtds/core";
import { defaultGlobals, vitestAdapter, vitestImports, vitestTestAdapter } from "./adapter.ts";

const statements = (globals: readonly StaticImport[]): string[] =>
  globals.map((global) => renderImport(global, "esm"));

test("the default globals are expect and vi", () => {
  expect(statements(defaultGlobals)).toEqual([
    "import { expect } from 'vitest';",
    "import { vi } from 'vitest';",
  ]);
  expect(vitestTestAdapter.fenceImports).toBe(defaultGlobals);
});

test("an adapter injects exactly the globals it is given", () => {
  const custom = [
    ...defaultGlobals,
    vitestImports("describe"),
    typedImports<typeof import("node:path")>("node:path")("basename"),
  ];
  expect(statements(vitestAdapter(custom).fenceImports)).toEqual([
    "import { expect } from 'vitest';",
    "import { vi } from 'vitest';",
    "import { describe } from 'vitest';",
    "import { basename } from 'node:path';",
  ]);
  expect(vitestAdapter([]).fenceImports).toEqual([]);
});
