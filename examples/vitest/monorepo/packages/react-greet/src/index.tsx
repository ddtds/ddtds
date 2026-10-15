import type { ReactElement } from "react";
import { greet } from "@ddtds/greet";

export * from "@ddtds/greet";

/**
 * Renders a greeting in a paragraph.
 *
 * ```tsx run
 * import { createRoot } from "react-dom/client";
 * import { flushSync } from "react-dom";
 * import { Greeting } from "@ddtds/react-greet";
 *
 * const container = document.createElement("div");
 * flushSync(() => createRoot(container).render(<Greeting name="Grace" />));
 *
 * expect(container.innerHTML).toBe("<p>Hello, Grace!</p>");
 * ```
 */
export function Greeting({ name }: { name: string }): ReactElement {
  return <p>{greet(name)}</p>;
}
