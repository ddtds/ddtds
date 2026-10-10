import type { KnipConfig } from "knip";

const config: KnipConfig = {
  rules: {
    types: "off",
  },
  ignoreDependencies: ["publint"],
  workspaces: {
    "examples/react": {
      // used in generated tests
      ignoreDependencies: ["react", "react-dom", "@testing-library/react"],
    },
    "examples/monorepo/packages/react-greet": {
      // used in generated tests
      ignoreDependencies: ["react-dom", "@types/react-dom"],
    },
    "examples/monorepo/packages/octane-greet": {
      // build tool used internally by the octane compiler
      ignoreDependencies: ["@tsrx/oxc"],
    },
  },
};

export default config;
