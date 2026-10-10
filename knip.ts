import type { KnipConfig } from "knip";

const config: KnipConfig = {
  rules: {
    types: "off",
  },
  workspaces: {
    "examples/react": {
      // used in generated tests
      ignoreDependencies: ["react", "react-dom", "@testing-library/react"],
    },
  },
};

export default config;
