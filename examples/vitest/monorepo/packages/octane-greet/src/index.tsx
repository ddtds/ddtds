import type { OctaneNode } from "octane";
import { greet } from "@ddtds/greet";

export * from "@ddtds/greet";

export function Greeting(props: { name: string }): OctaneNode {
  return <p>{greet(props.name)}</p>;
}
