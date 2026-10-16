import type { JSX } from "solid-js";
import { greet } from "@ddtds/greet";

export * from "@ddtds/greet";

/**
 * Renders a greeting in a paragraph.
 *
 * ```tsx run
 * import { render, screen } from "@solidjs/testing-library";
 * import { Greeting } from "@ddtds/solid-greet";
 *
 * render(() => <Greeting name="Grace" />);
 *
 * expect(screen.getByText("Hello, Grace!")).toBeInTheDocument();
 * ```
 */
export function Greeting(props: { name: string }): JSX.Element {
  return <p>{greet(props.name)}</p>;
}
