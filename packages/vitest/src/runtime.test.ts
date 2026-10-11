import { describe, expect, test } from "vitest";
import { expectFailure } from "./runtime.ts";

async function noop(): Promise<void> {}

describe("expectFailure", () => {
  test("passes when the fence throws anything", async () => {
    await expect(expectFailure(() => Promise.reject(new Error("boom")))()).resolves.toBeUndefined();
  });

  test("fails when the fence does not throw", async () => {
    await expect(expectFailure(noop)()).rejects.toThrow("promise resolved");
  });
});
