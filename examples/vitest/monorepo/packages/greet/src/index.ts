/**
 * Greets someone by name.
 *
 * ```ts run
 * import { greet } from "@ddtds/greet";
 *
 * expect(greet("Ada")).toBe("Hello, Ada!");
 * ```
 *
 * The name is used as given:
 *
 * ```ts run
 * import { greet } from "@ddtds/greet";
 *
 * expect(greet("")).toBe("Hello, !");
 * ```
 */
export function greet(name: string): string {
  return `Hello, ${name}!`;
}
