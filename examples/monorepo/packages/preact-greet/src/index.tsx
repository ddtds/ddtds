import type { VNode } from "preact";
import { greet } from "@ddtds/greet";

export * from "@ddtds/greet";

export function Greeting({ name }: { name: string }): VNode {
  return <p>{greet(name)}</p>;
}
