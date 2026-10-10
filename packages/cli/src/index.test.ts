import { describe, test, expect, vi } from "vitest";
import { generate, type GenerateDeps } from "@ddtds/vitest";

describe("generate", () => {
  test("returns 0 and logs when no docs are found", () => {
    expect(generate({ root: "/docs" }, { findDocs: () => [] })).toBe(0);
  });

  test("generates test files for supported code blocks", () => {
    const writes: Array<{ path: string; content: string }> = [];
    const deps: Partial<GenerateDeps> = {
      findDocs: () => ["/repo/guide.md", "/repo/empty.md"],
      readFile: (path) => {
        if (path.endsWith("guide.md")) return "```ts run\nconst x = 1\n```";
        return "# prose only";
      },
      writeFile: (path, content) => writes.push({ path, content }),
      clearDir: vi.fn<() => void>(),
    };
    const total = generate({ root: "/repo" }, deps);

    expect(total).toBe(1);
    expect(writes).toHaveLength(1);
    expect(writes[0]!.path).toBe("/repo/__doctests__/guide.md_1.test.ts");
    expect(writes[0]!.content).toContain('"guide.md:1"');
  });
});
