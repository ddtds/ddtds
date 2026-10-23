/**
 * Binary searches for the index of the first item where `isBefore` is false, given that it
 * is true for a prefix of `sorted` and false after it, like Rust's `partition_point`.
 * Returns `sorted.length` if it is true for every item
 */
export function partitionPoint<T>(sorted: readonly T[], isBefore: (item: T) => boolean): number {
  let low = 0;
  let high = sorted.length;
  let answer = sorted.length;
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);
    const item = sorted[middle];
    if (item !== undefined && isBefore(item)) {
      low = middle + 1;
    } else {
      answer = middle;
      high = middle;
    }
  }
  return answer;
}
