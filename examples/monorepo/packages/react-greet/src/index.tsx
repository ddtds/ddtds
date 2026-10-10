import type { ReactElement } from "react";
import { greet } from "@ddtds/greet";

export * from "@ddtds/greet";

export function Greeting({ name }: { name: string }): ReactElement {
  return <p>{greet(name)}</p>;
}
