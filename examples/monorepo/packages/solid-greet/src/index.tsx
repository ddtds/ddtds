import type { JSX } from "solid-js";
import { greet } from "@ddtds/greet";

export * from "@ddtds/greet";

export function Greeting(props: { name: string }): JSX.Element {
  return <p>{greet(props.name)}</p>;
}
