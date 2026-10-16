import type { ReactElement } from "react";
import { greet } from "@ddtds/greet";

export * from "@ddtds/greet";

/**
 * Renders a greeting in a paragraph.
 *
 * ```tsx run
 * import { render, screen } from "@testing-library/react";
 * import { Greeting } from "@ddtds/react-greet";
 *
 * render(<Greeting name="Grace" />);
 *
 * expect(screen.getByText("Hello, Grace!")).toBeInTheDocument();
 * ```
 */
export function Greeting({ name }: { name: string }): ReactElement {
  return <p>{greet(name)}</p>;
}
