import type { JSX } from "solid-js";
import { greet } from "@ddtds/greet";

export * from "@ddtds/greet";

/**
 * Renders a greeting in a paragraph.
 *
 * ```tsx run
 * import { render } from "solid-js/web";
 * import { Greeting } from "@ddtds/solid-greet";
 *
 * const container = document.createElement("div");
 * const dispose = render(() => <Greeting name="Grace" />, container);
 *
 * expect(container.textContent).toBe("Hello, Grace!");
 * dispose();
 * ```
 */
export function Greeting(props: { name: string }): JSX.Element {
  return <p>{greet(props.name)}</p>;
}
