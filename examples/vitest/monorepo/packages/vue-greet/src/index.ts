export * from "@ddtds/greet";
/**
 * Renders a greeting in a paragraph.
 *
 * ```ts run
 * import { render, screen } from "@testing-library/vue";
 * import { Greeting } from "@ddtds/vue-greet";
 *
 * render(Greeting, { props: { name: "Grace" } });
 *
 * expect(screen.getByText("Hello, Grace!")).toBeInTheDocument();
 * ```
 */
export { default as Greeting } from "./Greeting.vue";
