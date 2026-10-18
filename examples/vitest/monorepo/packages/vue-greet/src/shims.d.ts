declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const Greeting: DefineComponent<{ name: string }>;
  export default Greeting;
}
