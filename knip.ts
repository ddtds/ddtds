import type { KnipConfig } from "knip";

const config: KnipConfig = {
  rules: {
    types: "off",
  },
  workspaces: {
    "examples/react": {
      // Consumed only by __doctests__/*.test.tsx, generated at test-run
      // time by @ddtds/vitest from components.mdx (gitignored), so knip
      // can't see the imports statically.
      ignoreDependencies: ["react", "react-dom", "@testing-library/react"],
    },
  },
};

export default config;
