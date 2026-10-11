// Checks each library's types with attw on the tarball pnpm publishes. `attw --pack` would use
// `npm pack`, which ignores publishConfig and so checks the repo's source exports instead.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

for (const pkg of ["packages/core", "packages/vitest"]) {
  const dir = mkdtempSync(join(tmpdir(), "ddtds-attw-"));
  execFileSync("pnpm", ["pack", "--pack-destination", dir], { cwd: pkg, stdio: "ignore" });
  const [tarball] = readdirSync(dir);
  if (!tarball) throw new Error(`pnpm pack wrote no tarball for ${pkg}`);
  execFileSync("pnpm", ["exec", "attw", join(dir, tarball), "--profile", "esm-only"], {
    stdio: "inherit",
  });
}
