import type { VNode } from "preact";
import { greet } from "@ddtds/greet";

export * from "@ddtds/greet";

/**
 * Renders a greeting in a paragraph.
 *
 * ```tsx run
 * import { render } from "preact";
 * import { Greeting } from "@ddtds/preact-greet";
 *
 * const container = document.createElement("div");
 * render(<Greeting name="Grace" />, container);
 *
 * expect(container.textContent).toBe("Hello, Grace!");
 * ```
 */
export function Greeting({ name }: { name: string }): VNode {
  return <p>{greet(name)}</p>;
}
