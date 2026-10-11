import { rejects } from "node:assert/strict";
import type { FenceRun } from "@ddtds/core/runtime";

export { compileError, loadFences, missingCompileError } from "@ddtds/core/runtime";

export function expectFailure(run: FenceRun): FenceRun {
  return () => rejects(run);
}
