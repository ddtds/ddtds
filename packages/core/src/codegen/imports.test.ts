import { expect, test } from "vitest";
import { rawImport, unshadowed } from "./imports.ts";

const expectImport = rawImport("import { expect } from 'x';", "expect");
const testImport = rawImport("import { test } from 'x';", "test");

test("injected imports that bind a taken name are dropped", () => {
  expect(unshadowed([expectImport, testImport], ["expect"])).toEqual([testImport]);
});

test("nothing is dropped when no name is taken", () => {
  expect(unshadowed([expectImport, testImport], [])).toEqual([expectImport, testImport]);
});
