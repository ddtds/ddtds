import { greet } from "@ddtds/greet";

/**
 * Greets everyone in a list, in order.
 *
 * ```ts run
 * import { greetAll } from "@ddtds/node-greet";
 *
 * assert.deepEqual(greetAll(["Ada", "Grace"]), ["Hello, Ada!", "Hello, Grace!"]);
 * ```
 *
 * An empty list greets no one:
 *
 * ```ts run
 * import { greetAll } from "@ddtds/node-greet";
 *
 * assert.deepEqual(greetAll([]), []);
 * ```
 */
export function greetAll(names: string[]): string[] {
  return names.map(greet);
}
