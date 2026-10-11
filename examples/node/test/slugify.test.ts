import { equal } from "node:assert/strict";
import { test } from "node:test";
import { slugify } from "../src/index.ts";

void test("drops punctuation", () => {
  equal(slugify("Hello, World!"), "hello-world");
});
