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
        "@types/react",
        "@types/react-dom",
        "@testing-library/react",
      ],
    },
    "examples/vitest/react": {
      // used in generated tests
      ignoreDependencies: [
        "react",
        "react-dom",
        "@types/react",
        "@types/react-dom",
        "@testing-library/react",
      ],
    },
    "examples/vitest/monorepo/packages/react-greet": {
      // used in generated tests
      ignoreDependencies: ["react-dom", "@types/react-dom", "@testing-library/react"],
    },
    "examples/vitest/monorepo/packages/angular-greet": {
      // referenced from angular.json
      entry: ["tests/setup.ts", "vitest-base.config.ts"],
      // peers of the Angular CLI test builder, and used in generated tests
      ignoreDependencies: ["@angular/router", "@testing-library/angular"],
    },
    "examples/vitest/monorepo/packages/preact-greet": {
      // used in generated tests
      ignoreDependencies: ["@testing-library/preact"],
    },
    "examples/vitest/monorepo/packages/solid-greet": {
      // used in generated tests
      ignoreDependencies: ["@solidjs/testing-library"],
    },
    "examples/vitest/monorepo/packages/vue-greet": {
      // used in generated tests
      ignoreDependencies: ["@testing-library/vue"],
    },
    "examples/vitest/monorepo/packages/lit-greet": {
      // used in generated tests
      ignoreDependencies: ["shadow-dom-testing-library"],
    },
    "packages/node-test": {
      // loaded by `node --test --test-reporter`, not imported
      entry: ["src/reporter.ts"],
    },
  },
};

export default config;
