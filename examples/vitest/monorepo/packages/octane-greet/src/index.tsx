import type { OctaneNode } from "octane";
import { greet } from "@ddtds/greet";

export * from "@ddtds/greet";

/**
 * Renders a greeting in a paragraph.
 *
 * ```tsx run
 * import { screen } from "@testing-library/dom";
 * import { createRoot, flushSync } from "octane";
 * import { Greeting } from "@ddtds/octane-greet";
 *
 * const container = document.body.appendChild(document.createElement("div"));
 * flushSync(() => createRoot(container).render(<Greeting name="Grace" />));
 *
 * expect(screen.getByText("Hello, Grace!")).toBeInTheDocument();
 * ```
 */
export function Greeting(props: { name: string }): OctaneNode {
  return <p>{greet(props.name)}</p>;
}
