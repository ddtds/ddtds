import { describe, expect, test } from "vitest";
import { parseCodeFences } from "./blocks.ts";
import { parseJsDocFences } from "./jsdoc.ts";

const AT_COMMENT = /doc\.md:1:/;

const fence = (...lines: string[]): string => ["```ts run", ...lines, "```", ""].join("\n");

function split(source: string, path = "doc.md") {
  const [block] = parseCodeFences(source, path);
  if (!block) throw new Error("no fence");
  const { imports, body } = block.splitImports();
  return { block, imports: imports.map(String), body: body.map(String) };
}

describe("ddt-setup comments above a fence", () => {
  test("runs the body of each comment before the fence", () => {
    const { imports, body } = split(
      [
        '<!-- ddt-setup import { x } from "pkg" -->',
        "<!-- ddt-setup const y = 1; -->",
        fence("use(x, y);"),
      ].join("\n"),
    );
    expect(imports).toEqual(['import { x } from "pkg"']);
    expect(body).toEqual(["const y = 1;", "use(x, y);"]);
  });

  test("runs a comment spanning several lines", () => {
    const { body } = split(
      ["<!-- ddt-setup", "const a = 1;", "const b = 2;", "-->", fence("use(a, b);")].join("\n"),
    );
    expect(body).toEqual(["const a = 1;", "const b = 2;", "use(a, b);"]);
  });

  test("allows blank lines and other comments between the comment and the fence", () => {
    const { body } = split(
      [
        "<!-- ddt-setup const a = 1; -->",
        "",
        "<!-- prettier-ignore -->",
        "",
        fence("use(a);"),
      ].join("\n"),
    );
    expect(body).toEqual(["const a = 1;", "use(a);"]);
  });

  test("works in a list item", () => {
    const { body } = split(
      ["- item", "", "  <!-- ddt-setup const a = 1; -->", "  ```ts run", "  use(a);", "  ```"].join(
        "\n",
      ),
    );
    expect(body).toEqual(["const a = 1;", "use(a);"]);
  });

  test("works in MDX with a JSX comment", () => {
    const { imports } = split(
      ["{/* ddt-setup import { x } from 'pkg' */}", fence("x();")].join("\n"),
      "doc.mdx",
    );
    expect(imports).toEqual(["import { x } from 'pkg'"]);
  });

  test("works in JSDoc comments", () => {
    const source = [
      "/**",
      " * <!-- ddt-setup import { x } from 'pkg' -->",
      " * ```ts run",
      " * x();",
      " * ```",
      " */",
      "export function f() {}",
    ].join("\n");
    const [block] = parseJsDocFences(source, "src/f.ts");
    expect(block?.splitImports().imports.map(String)).toEqual(["import { x } from 'pkg'"]);
  });

  test.each([
    "<!-- const a = 1; -->",
    "<!-- prettier-ignore -->",
    "<!-- markdownlint-disable MD013 -->",
    "<!-- ddt-setups const a = 1; -->",
  ])("ignores %s, which has no ddt-setup marker", (comment) => {
    const { body } = split([comment, fence("run();")].join("\n"));
    expect(body).toEqual(["run();"]);
  });

  test("ignores a comment separated from the fence by other content", () => {
    const { body } = split(
      ["<!-- ddt-setup const a = 1; -->", "", "Some text.", "", fence("run();")].join("\n"),
    );
    expect(body).toEqual(["run();"]);
  });

  test("does not read comments inside the fence", () => {
    const [block] = parseCodeFences(fence("<!-- ddt-setup const a = 1; -->"), "doc.md");
    expect(block?.code).toBe("<!-- ddt-setup const a = 1; -->");
  });

  test("keeps the fence as the block contents and range", () => {
    const [block] = parseCodeFences(
      ["<!-- ddt-setup const a = 1; -->", fence("run(a);")].join("\n"),
      "doc.md",
    );
    expect(block?.details.contents).toBe("run(a);");
    expect(block?.line).toBe(2);
  });

  test("points positions in the setup at the comment", () => {
    const [block] = parseCodeFences(
      [
        "<!-- ddt-setup",
        "const a = 1;",
        "-->",
        "<!-- ddt-setup const b = 2; -->",
        fence("run(a, b);"),
      ].join("\n"),
      "doc.md",
    );
    const code = block?.code ?? "";
    expect(block?.positionAt(code.indexOf("const a"))).toEqual({ line: 2, column: 1 });
    expect(block?.positionAt(code.indexOf("const b"))).toEqual({ line: 4, column: 16 });
    expect(block?.positionAt(code.indexOf("run"))).toEqual({ line: 6, column: 1 });
  });

  test("joins each setup body and the fence code with one newline", () => {
    const [block] = parseCodeFences(
      [
        "<!-- ddt-setup const a = 1; -->",
        "<!-- ddt-setup const b = 2; -->",
        fence("use(a, b);"),
      ].join("\n"),
      "doc.md",
    );
    expect(block?.code).toBe(" const a = 1; \n const b = 2; \nuse(a, b);");
  });

  test("keeps the fence code unchanged without setup", () => {
    const [block] = parseCodeFences(fence("one();", "two();"), "doc.md");
    expect(block?.code).toBe("one();\ntwo();");
  });

  test("maps every line of a multi line setup and the fence", () => {
    const [block] = parseCodeFences(
      [
        "text",
        "",
        "<!-- ddt-setup",
        "const a = 1;",
        "const b = 2;",
        "-->",
        "<!-- ddt-setup const c = 3; -->",
        fence("one();", "two();"),
      ].join("\n"),
      "doc.md",
    );
    const lines = (block?.code ?? "").split("\n");
    const at = (needle: string) => {
      const line = lines.findIndex((candidate) => candidate.includes(needle));
      return block?.zeroBasedPositionAt(line, lines[line]?.indexOf(needle) ?? -1);
    };
    expect(at("const a")).toEqual({ line: 3, column: 0 });
    expect(at("const b")).toEqual({ line: 4, column: 0 });
    expect(at("const c")).toEqual({ line: 6, column: 15 });
    expect(at("one")).toEqual({ line: 8, column: 0 });
    expect(at("two")).toEqual({ line: 9, column: 0 });
  });

  test("an empty setup comment adds nothing that moves the fence", () => {
    const [block] = parseCodeFences(["<!-- ddt-setup -->", fence("run();")].join("\n"), "doc.md");
    const { body } = block?.splitImports() ?? { body: [] };
    expect(body.map(String)).toEqual(["run();"]);
    expect(block?.positionAt(block.code.indexOf("run"))).toEqual({ line: 3, column: 1 });
  });

  test("keeps the container indent on later lines of a setup in a list", () => {
    const [block] = parseCodeFences(
      [
        "- item",
        "",
        "  <!-- ddt-setup",
        "  const a = 1;",
        "  -->",
        "  ```ts run",
        "  use(a);",
        "  ```",
      ].join("\n"),
      "doc.md",
    );
    const code = block?.code ?? "";
    expect(block?.positionAt(code.indexOf("const a"))).toEqual({ line: 4, column: 3 });
    expect(block?.positionAt(code.indexOf("use"))).toEqual({ line: 7, column: 3 });
  });

  test("points positions in an MDX setup at the comment", () => {
    const [block] = parseCodeFences(
      ["{/* ddt-setup const a = 1; */}", fence("run(a);")].join("\n"),
      "doc.mdx",
    );
    const code = block?.code ?? "";
    expect(block?.positionAt(code.indexOf("const a"))).toEqual({ line: 1, column: 15 });
  });

  test("points setup positions in JSDoc at the comment in the file", () => {
    const source = [
      "/**",
      " * <!-- ddt-setup import { x } from 'pkg' -->",
      " * ```ts run",
      " * x();",
      " * ```",
      " */",
      "export function f() {}",
    ].join("\n");
    const [block] = parseJsDocFences(source, "src/f.ts");
    const code = block?.code ?? "";
    expect(block?.positionAt(code.indexOf("import"))).toEqual({ line: 2, column: 19 });
    expect(block?.positionAt(code.indexOf("x()"))).toEqual({ line: 4, column: 4 });
  });

  test("reports a body that is not code as a compile error at the comment", () => {
    const [block] = parseCodeFences(
      ["<!-- ddt-setup const = ; -->", fence("run();")].join("\n"),
      "doc.md",
    );
    expect(() => block?.splitImports()).toThrowError(AT_COMMENT);
  });
});
