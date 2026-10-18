declare module "*.svelte" {
  import type { Component } from "svelte";
  const Greeting: Component<{ name: string }>;
  export default Greeting;
}
