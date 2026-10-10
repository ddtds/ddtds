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
    "examples/monorepo/packages/angular-greet": {
      // used in generated tests; runtime helpers injected by the decorator transform
      ignoreDependencies: ["@angular/platform-browser", "@oxc-project/runtime"],
    },
  },
};

export default config;
