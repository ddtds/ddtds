export * from "@ddtds/greet";
/**
 * Renders a greeting in a paragraph.
 *
 * ```ts run
 * import { render, screen } from "@testing-library/svelte";
 * import { Greeting } from "@ddtds/svelte-greet";
 *
 * render(Greeting, { props: { name: "Grace" } });
 *
 * expect(screen.getByText("Hello, Grace!")).toBeInTheDocument();
 * ```
 */
export { default as Greeting } from "./Greeting.svelte";
