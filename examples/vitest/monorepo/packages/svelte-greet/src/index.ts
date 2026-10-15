export * from "@ddtds/greet";
/**
 * Renders a greeting in a paragraph.
 *
 * ```ts run
 * import { mount, unmount } from "svelte";
 * import { Greeting } from "@ddtds/svelte-greet";
 *
 * const target = document.createElement("div");
 * const component = mount(Greeting, { target, props: { name: "Grace" } });
 *
 * expect(target.textContent).toBe("Hello, Grace!");
 * unmount(component);
 * ```
 */
export { default as Greeting } from "./Greeting.svelte";
