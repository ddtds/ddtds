import { describe, expect, test } from "vitest";
import { parseInfo } from "./info.ts";

const parsed = (meta: string) => {
  const { words, attributes } = parseInfo(meta);
  return { words, attributes: Object.fromEntries(attributes) };
};

describe("parseInfo", () => {
  test.each([
    ["", [], {}],
    ["run", ["run"], {}],
    ["twoslash run", ["twoslash", "run"], {}],
    ["  run   fail  ", ["run", "fail"], {}],
    ["{1-3}", ["{1-3}"], {}],
    ["title=hi", [], { title: "hi" }],
    ['title="hi there"', [], { title: "hi there" }],
    ["title='hi there'", [], { title: "hi there" }],
    ['title="how to run it" fail', ["fail"], { title: "how to run it" }],
    [
      'title="astro.config.mjs" ins={4} del={5} run',
      ["run"],
      { title: "astro.config.mjs", ins: "{4}", del: "{5}" },
    ],
    ['title="" run', ["run"], { title: "" }],
    ["title= run", ["run"], { title: "" }],
    ["a=1 a=2", [], { a: "2" }],
  ])("%j gives words %j and attributes %j", (meta, words, attributes) => {
    expect(parsed(meta)).toEqual({ words, attributes });
  });
});
