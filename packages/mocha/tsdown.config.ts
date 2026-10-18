import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/register.ts", "src/runtime.ts"],
  unused: { level: "error", ignore: { peerDependencies: ["mocha"] } },
});
