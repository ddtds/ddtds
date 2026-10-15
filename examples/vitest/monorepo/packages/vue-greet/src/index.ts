export * from "@ddtds/greet";
/**
 * Renders a greeting in a paragraph.
 *
 * ```ts run
 * import { createApp } from "vue";
 * import { Greeting } from "@ddtds/vue-greet";
 *
 * const container = document.createElement("div");
 * const app = createApp(Greeting, { name: "Grace" });
 * app.mount(container);
 *
 * expect(container.textContent).toBe("Hello, Grace!");
 * app.unmount();
 * ```
 */
export { default as Greeting } from "./Greeting.vue";
