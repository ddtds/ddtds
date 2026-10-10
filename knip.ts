import type { KnipConfig } from "knip";

const config: KnipConfig = {
  rules: {
    types: "off",
  },
  // @tsrx/oxc: optional peer of @ddtds/core, loaded with require for tsrx code blocks
  ignoreDependencies: ["publint", "@tsrx/oxc"],
  workspaces: {
    "examples/react": {
      // used in generated tests
      ignoreDependencies: ["react", "react-dom", "@testing-library/react"],
    },
    "examples/monorepo/packages/react-greet": {
      // used in generated tests
      ignoreDependencies: ["react-dom", "@types/react-dom"],
    },
  },
};

export default config;
