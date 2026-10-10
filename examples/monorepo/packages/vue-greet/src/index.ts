import { defineComponent, h, type VNode } from "vue";
import { greet } from "@ddtds/greet";

export * from "@ddtds/greet";

export const Greeting = defineComponent({
  props: { name: { type: String, required: true } },
  setup: (props) => (): VNode => h("p", greet(props.name)),
});
