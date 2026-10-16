import type { VNode } from "preact";
import { greet } from "@ddtds/greet";

export * from "@ddtds/greet";

/**
 * Renders a greeting in a paragraph.
 *
 * ```tsx run
 * import { render, screen } from "@testing-library/preact";
 * import { Greeting } from "@ddtds/preact-greet";
 *
 * render(<Greeting name="Grace" />);
 *
 * expect(screen.getByText("Hello, Grace!")).toBeInTheDocument();
 * ```
 */
export function Greeting({ name }: { name: string }): VNode {
  return <p>{greet(name)}</p>;
}
