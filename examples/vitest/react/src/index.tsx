import type { ReactElement } from "react";

/**
 * Renders a save button.
 *
 * ```tsx run
 * import { render, screen } from "@testing-library/react";
 * import { SaveButton } from "@ddtds/example-react";
 *
 * render(<SaveButton />);
 *
 * expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
 * ```
 */
export function SaveButton(): ReactElement {
  return <button type="submit">Save</button>;
}
