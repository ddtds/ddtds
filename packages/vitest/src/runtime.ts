import { expect } from "vitest";
import type { FenceRun } from "@ddtds/core/runtime";

export { compileError, loadFences, missingCompileError } from "@ddtds/core/runtime";

export function expectFailure(run: FenceRun): FenceRun {
  return async () => {
    // A fail fence may throw any error
    // oxlint-disable-next-line vitest/require-to-throw-message
    await expect(run).rejects.toThrow();
  };
}
