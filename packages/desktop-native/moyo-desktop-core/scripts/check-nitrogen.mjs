// Fails when nitrogen/generated differs from a fresh Nitrogen run, i.e. when the
// spec changed without regenerating or someone edited generated files by hand.
//
// Nitrogen v1 only writes to the directory that package.json `imports` maps
// `#nitro/*` to (./nitrogen/generated), so the check copies the package's
// inputs (package.json, nitro.json, tsconfig.json, src/) into a temporary
// package, links its node_modules, runs Nitrogen there and compares the result
// byte for byte with the committed tree. The committed files are never touched.
// SOT-KEYWORDS: desktop nitro nitrogen drift check generated v1
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const committed = path.join(root, "nitrogen", "generated");
const scratch = mkdtempSync(path.join(tmpdir(), "moyo-nitrogen-"));
const fresh = path.join(scratch, "nitrogen", "generated");

function files(dir, base = dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? files(full, base) : [path.relative(base, full)];
  });
}

try {
  for (const input of ["package.json", "nitro.json", "tsconfig.json", "src"]) {
    cpSync(path.join(root, input), path.join(scratch, input), { recursive: true });
  }
  symlinkSync(path.join(root, "node_modules"), path.join(scratch, "node_modules"), "dir");
  try {
    execFileSync(path.join(root, "node_modules", ".bin", "nitrogen"), ["--log-level", "error"], { cwd: scratch, stdio: "inherit" });
  } catch {
    throw new Error("nitrogen failed; run `npm ci --ignore-scripts` in this package and read its output above.");
  }
  if (!existsSync(committed)) throw new Error("nitrogen/generated is missing; run `npm run specs` and commit it.");
  const expected = files(fresh).sort();
  const actual = files(committed).sort();
  const problems = [];
  for (const file of new Set([...expected, ...actual])) {
    if (!expected.includes(file)) problems.push(`not produced by nitrogen: ${file}`);
    else if (!actual.includes(file)) problems.push(`missing from nitrogen/generated: ${file}`);
    else if (!readFileSync(path.join(fresh, file)).equals(readFileSync(path.join(committed, file)))) problems.push(`differs: ${file}`);
  }
  if (problems.length) {
    console.error(`nitrogen/generated is out of date (run npm run specs):\n  ${problems.join("\n  ")}`);
    process.exitCode = 1;
  } else {
    console.log(`nitrogen/generated matches a fresh run (${actual.length} files).`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
