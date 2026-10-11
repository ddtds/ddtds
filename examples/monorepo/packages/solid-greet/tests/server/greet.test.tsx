import { renderToString } from "solid-js/web";
import { expect, test } from "vitest";
import { Greeting } from "../../src/index.tsx";

test("renders on the server", () => {
  expect(renderToString(() => <Greeting name="Ada" />)).toBe('<p data-hk="00">Hello, Ada!</p>');
});
