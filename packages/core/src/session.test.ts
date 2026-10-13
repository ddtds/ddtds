import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, onTestFinished, test } from "vitest";
import { adapter } from "./codegen/test-utils.ts";
import { DdtSession } from "./session.ts";

function fixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "ddtds-session-"));
  onTestFinished(() => rmSync(root, { recursive: true, force: true }));
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), content);
  }
  return root;
}

function doc(code: string): string {
  return `\`\`\`ts run\n${code}\n\`\`\`\n`;
}

function sessionOver(root: string): DdtSession {
  return DdtSession.fromFiles(adapter, { root });
}

describe("DdtSession.fromFiles", () => {
  test("indexes each doc and serves both its doc and fence modules", () => {
    const root = fixture({ "guide.md": doc("expect(1).toBe(1);") });
    const session = sessionOver(root);
    const [fence] = session.index.fences();

    expect(session.index.root).toBe(root);
    expect(session.index.size).toBe(1);
    expect([...session.index.docs()].map(([doc]) => doc)).toEqual([join(root, "guide.md")]);
    expect(session.index.hasDoc(join(root, "guide.md"))).toBe(true);
    expect(session.module(join(root, "guide.md"))?.code).toContain('test("guide.md:1"');
    expect(session.module(fence!.id)?.code).toContain("expect(1).toBe(1);");
    expect(session.module(join(root, "missing.md"))).toBeUndefined();
    expect(session.index.fence(fence!.id)).toBe(fence);
  });
});

describe("DdtSession.refresh", () => {
  test("re-reads a doc and picks up the edit", () => {
    const root = fixture({ "guide.md": doc("expect(1).toBe(1);") });
    const session = sessionOver(root);
    const [fence] = session.index.fences();

    writeFileSync(join(root, "guide.md"), doc("expect(2).toBe(2);"));
    session.refresh(join(root, "guide.md"));

    expect(session.index.size).toBe(1);
    expect(session.module(fence!.id)?.code).toContain("expect(2).toBe(2);");
  });

  test("indexes a doc it has not seen yet", () => {
    const root = fixture({});
    const session = DdtSession.fromSources(adapter, new Map(), root);
    const path = join(root, "guide.md");
    writeFileSync(path, doc("expect(1).toBe(1);"));

    session.refresh(path);
    expect(session.index.hasDoc(path)).toBe(true);
    const [fence] = session.index.fences();
    expect(session.module(path)?.code).toContain("test(");
    expect(session.module(fence!.id)?.code).toContain("expect(1).toBe(1);");
  });

  test("leaves anything that is not a doc alone", () => {
    const root = fixture({ "guide.md": doc("expect(1).toBe(1);") });
    const session = sessionOver(root);

    expect(session.index.hasDoc(join(root, "src/index.ts"))).toBe(false);
    session.refresh(join(root, "src/index.ts"));
    expect(session.module(join(root, "src/index.ts"))).toBeUndefined();
  });
});
