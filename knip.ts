import type { KnipConfig } from "knip";

const config: KnipConfig = {
  rules: {
    types: "off",
  },
  workspaces: {
    ".": {
      // used in generated README tests
      ignoreDependencies: [
        "react",
        "react-dom",
        "@testing-library/react",
        "@testing-library/user-event",
      ],
    },
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
    "packages/node-test": {
      // loaded by `node --test --test-reporter`, not imported
      entry: ["src/reporter.ts"],
    },
  },
};

export default config;
