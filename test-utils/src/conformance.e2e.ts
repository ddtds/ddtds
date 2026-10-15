import { describe, expect, test } from "vitest";
import { fence, spawn, type Runner } from "./index.ts";

/** What a test framework has to say about itself; everything else is shared. */
export type Dialect = {
  /** An assertion that passes when `actual` equals `expected` */
  equal(actual: string, expected: string): string;
  /** The outcome of a fence whose assertion fails */
  assertion: string;
};

/**
 * Registers the end to end scenarios every framework has to pass.
 *
 * To cover a new framework, add three small pieces to its package:
 *   1. a reporter that prints `encode(outcomes)` once per run (see `packages/node-test/src/reporter.ts`)
 *   2. a `cli({ name, command })` runner that starts the framework in run or watch mode
 *   3. a `conformance.test.ts` calling this with a `Dialect`
 */
export function conformance(name: string, runner: Runner, dialect: Dialect): void {
  const passing = dialect.equal("1", "1");
  const failing = dialect.equal("1", "2");

  describe(`${name} conformance`, () => {
    test("reruns a doc when it is edited in watch mode", async () => {
      await using ddt = spawn(runner, { "guide.md": fence(passing) });
      expect(await ddt.watch()).toEqual({ "guide.md:1": "passed" });
      expect(await ddt.edit("guide.md", fence(failing))).toEqual({
        "guide.md:1": dialect.assertion,
      });
    });
  });
}
