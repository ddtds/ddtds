import codspeedPlugin from "@codspeed/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [codspeedPlugin()],
  test: {
    environment: "node",
    // Load the workspace libraries natively instead of through Vite's module
    // runner. Its export getters add measurable overhead to fast benchmarks
    // (https://vitest.dev/guide/benchmarking#module-runner-overhead), and the
    // benchmarks import the built output, which Node runs as-is.
    // Load the workspace libraries natively instead of through Vite's module
    // runner. Its export getters add measurable overhead to fast benchmarks
    // (https://vitest.dev/guide/benchmarking#module-runner-overhead), and the
    // benchmarks import the built output, which Node runs as-is.
    server: { deps: { external: [/[/\\]packages[/\\][^/\\]+[/\\]dist[/\\]/] } },
  },
});
