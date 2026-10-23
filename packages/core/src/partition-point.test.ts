import { expect, test } from "vitest";
import { partitionPoint } from "./partition-point.ts";

test.each([
  [[], 5, 0],
  [[1, 3, 5], 0, 0],
  [[1, 3, 5], 1, 1],
  [[1, 3, 5], 4, 2],
  [[1, 3, 5], 9, 3],
  [[1, 3, 3, 3, 5], 3, 4],
])("partitions %j after the items at most %d", (sorted, target, index) => {
  expect(partitionPoint(sorted, (item) => item <= target)).toBe(index);
});
