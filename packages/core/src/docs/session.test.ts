import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, onTestFinished, test, vi } from "vitest";
import { adapter } from "../codegen/test-utils.ts";
import { DocIndex } from "./docs.ts";
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

function source(name: string): string {
  return `/**\n * \`\`\`ts run\n * expect(1).toBe(1);\n * \`\`\`\n */\nexport const ${name} = 1;\n`;
}

function docsOf(session: DdtSession, root: string): string[] {
  return Array.from(session.index.docs(), ([doc]) => doc.slice(root.length + 1)).toSorted();
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
    expect(Array.from(session.index.docs(), ([doc]) => doc)).toEqual([join(root, "guide.md")]);
    expect(session.index.hasDoc(join(root, "guide.md"))).toBe(true);
    expect(session.index.fence(fence!.id)).toBe(fence);
    expect(session.load(session.entry("guide.md")!)?.code).toContain('test("guide.md:1"');
    expect(session.load(fence!.id)?.code).toContain("expect(1).toBe(1);");
    expect(session.load(join(root, "guide.md"))).toBeUndefined();
    expect(session.entry("missing.md")).toBeUndefined();
  });
});

describe("DdtSession.fromFiles source files", () => {
  const files = {
    "src/a.ts": source("a"),
    "src/b.ts": source("b"),
    "dist/a.d.ts": source("built"),
    "node_modules/pkg/index.js": source("dep"),
  };

  test("scans source files by default, skipping dependencies and build output", () => {
    const root = fixture(files);
    expect(docsOf(sessionOver(root), root)).toEqual(["src/a.ts", "src/b.ts"]);
  });

  test("scans only the given include", () => {
    const root = fixture(files);
    const session = DdtSession.fromFiles(adapter, { root, include: ["src/a.ts"] });
    expect(docsOf(session, root)).toEqual(["src/a.ts"]);
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
    // the fence id is content-addressed, so the edit produces a new id
    const [after] = session.index.fences();
    expect(after!.id).not.toBe(fence!.id);
    expect(session.load(after!.id)?.code).toContain("expect(2).toBe(2);");
  });

  test("refreshes a doc when the watcher reports a root-relative id", () => {
    const root = fixture({ "guide.md": doc("expect(1).toBe(1);") });
    const session = sessionOver(root);

    writeFileSync(join(root, "guide.md"), doc("expect(2).toBe(2);"));
    session.refresh("guide.md");

    const [updated] = session.index.fences();
    expect(session.load(updated!.id)?.code).toContain("expect(2).toBe(2);");
    expect(Array.from(session.index.docs(), ([doc]) => doc)).toEqual([join(root, "guide.md")]);
  });

  test("picks up the first fence of a discovered doc without fences", () => {
    const root = fixture({ "guide.md": "# Guide\n" });
    const session = sessionOver(root);
    const path = join(root, "guide.md");
    expect(session.index.size).toBe(0);

    writeFileSync(path, doc("expect(1).toBe(1);"));
    expect(session.entry(path)).toBe(`${path}?ddtds`);
    expect(session.index.size).toBe(1);
  });

  test("does not run a doc it was never given", () => {
    const root = fixture({ "guide.md": doc("expect(1).toBe(1);") });
    const session = DdtSession.fromSources(adapter, new Map(), root);
    expect(session.entry("guide.md")).toBeUndefined();
  });

  test("indexes a doc it has not seen yet", () => {
    const root = fixture({});
    const session = DdtSession.fromSources(adapter, new Map(), root);
    const path = join(root, "guide.md");
    writeFileSync(path, doc("expect(1).toBe(1);"));

    session.refresh(path);
    expect(session.index.hasDoc(path)).toBe(true);
    const [fence] = session.index.fences();
    expect(session.load(session.entry(path)!)?.code).toContain("test(");
    expect(session.load(fence!.id)?.code).toContain("expect(1).toBe(1);");
  });

  test("leaves anything that is not a doc alone", () => {
    const root = fixture({ "guide.md": doc("expect(1).toBe(1);") });
    const session = sessionOver(root);

    expect(session.index.hasDoc(join(root, "src/index.ts"))).toBe(false);
    session.refresh(join(root, "src/index.ts"));
    expect(session.entry(join(root, "src/index.ts"))).toBeUndefined();
  });

  test("skips reindexing when a reread doc is unchanged", () => {
    const root = fixture({ "guide.md": doc("expect(1).toBe(1);") });
    const session = sessionOver(root);
    const withDoc = vi.spyOn(DocIndex.prototype, "withDoc");
    onTestFinished(() => withDoc.mockRestore());

    session.refresh(join(root, "guide.md"));
    session.entry("guide.md");
    expect(withDoc).not.toHaveBeenCalled();

    writeFileSync(join(root, "guide.md"), doc("expect(2).toBe(2);"));
    session.refresh(join(root, "guide.md"));
    expect(withDoc).toHaveBeenCalledTimes(1);
  });
});

describe("DdtSession.resolve", () => {
  test("resolves absolute and root-relative fence ids", () => {
    const root = fixture({ "guide.md": doc("expect(1).toBe(1);") });
    const session = sessionOver(root);
    const [fence] = session.index.fences();

    expect(session.resolve(fence!.id)).toBe(fence!.id);
    expect(session.resolve(fence!.id.slice(root.length))).toBe(fence!.id);
    expect(session.resolve("guide.md")).toBeUndefined();
  });
});
