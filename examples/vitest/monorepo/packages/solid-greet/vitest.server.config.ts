import { defineConfig } from "vitest/config";
import solid from "vite-plugin-solid";
import { ddtPlugin } from "@ddtds/vitest";

// Server-rendered docs need their own config: the ssr transform and a node environment
export default defineConfig({
  plugins: [
    solid({ ssr: true }),
    ddtPlugin({ include: ["../../docs/framework/solid/ssr/**/*.md"] }),
  ],
  test: {
    name: "@ddtds/solid-greet (server)",
    dir: "./tests/server",
    environment: "node",
    server: { deps: { inline: [/solid-js/] } },
  },
});
