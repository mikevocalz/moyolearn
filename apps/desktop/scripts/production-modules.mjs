// Writes docs/desktop/production-modules.md from .spark/selection-report.json,
// the native modules `spark analyze` keeps for the production build. Run after
// `npm run analyze`; CI compares the result with the committed file.
//
// It also cross-checks the selection against the app's own imports: every
// `@legendapp/spark/*` subpath and `moyo-desktop-core` that App.tsx, index.ts
// or src/ imports for a value is mapped, through the installed Spark package
// (its `exports` map, the vendored module each subpath file re-exports, and
// those modules' `dependencies`), to the native packages it needs. A native
// package is one with a `.podspec` at its root. If any of them is missing from
// the report's `included` list, the script fails: the build would ship a JS
// import whose native half was pruned.
// Usage: node scripts/production-modules.mjs [--check]
// SOT-KEYWORDS: desktop production modules spark analyze selection report native import check
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SPARK = "@legendapp/spark";
const CORE = "moyo-desktop-core";

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

/** The report's lists, sorted. Throws when `included` is missing or empty. */
export function readSelection(report) {
  if (!report || !Array.isArray(report.included) || report.included.length === 0) {
    throw new Error("selection-report.json has no `included` modules. Rerun `npm run analyze`; an empty list would document a build with no native modules.");
  }
  if (report.excluded !== undefined && !Array.isArray(report.excluded)) {
    throw new Error("selection-report.json `excluded` is not a list.");
  }
  const reasons = report.reasons && typeof report.reasons === "object" ? report.reasons : {};
  const sorted = (list) => [...list].map(String).sort((a, b) => a.localeCompare(b));
  return { included: sorted(report.included), excluded: sorted(report.excluded ?? []), reasons };
}

/** Value imports in one source file. `import type` / `export type` are erased at build time and skipped. */
export function importSpecifiers(source) {
  const found = new Set();
  const patterns = [
    /^\s*(?:import|export)\s+(?!type\s)[^;]*?\sfrom\s*["']([^"']+)["']/gm,
    /^\s*import\s*["']([^"']+)["']/gm,
    /\b(?:require|import)\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) for (const match of source.matchAll(pattern)) found.add(match[1]);
  return [...found];
}

function appSourceFiles(app) {
  const files = ["App.tsx", "index.ts"].map((name) => path.join(app, name)).filter((file) => existsSync(file));
  const walk = (dir) => {
    for (const entry of readdirSync(dir).sort()) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(entry)) files.push(full);
    }
  };
  if (existsSync(path.join(app, "src"))) walk(path.join(app, "src"));
  return files;
}

/** `@legendapp/spark/*` and `moyo-desktop-core` value imports, each with the files that import it. */
export function appNativeImports(app) {
  const imports = new Map();
  for (const file of appSourceFiles(app)) {
    for (const specifier of importSpecifiers(readFileSync(file, "utf8"))) {
      const wanted = specifier.startsWith(`${SPARK}/`) || specifier === CORE || specifier.startsWith(`${CORE}/`);
      if (!wanted) continue;
      const key = specifier.startsWith(`${CORE}/`) ? CORE : specifier;
      if (!imports.has(key)) imports.set(key, new Set());
      imports.get(key).add(path.relative(app, file));
    }
  }
  return new Map([...imports].sort(([a], [b]) => a.localeCompare(b)));
}

function isNative(dir) {
  return readdirSync(dir).some((entry) => entry.endsWith(".podspec"));
}

/**
 * Maps one app import to the native packages it needs, from installed package
 * metadata only. Throws when the import cannot be resolved.
 */
export function nativeModulesFor(specifier, app) {
  const sparkRoot = path.join(app, "node_modules", "@legendapp", "spark");
  const spark = readJson(path.join(sparkRoot, "package.json"));
  const bundled = new Set(spark.spark?.bundledModules ?? []);
  const vendorRoot = path.join(sparkRoot, spark.spark?.bundledModuleRoot ?? "vendor", "node_modules");
  const packageDir = (name) => (bundled.has(name) ? path.join(vendorRoot, name) : path.join(app, "node_modules", name));

  const native = new Set();
  const seen = new Set();
  const visitPackage = (name, requiredBy) => {
    if (seen.has(name)) return;
    seen.add(name);
    const dir = packageDir(name);
    if (!existsSync(path.join(dir, "package.json"))) throw new Error(`${requiredBy} needs ${name}, which is not installed at ${path.relative(app, dir)}.`);
    const nativeHere = isNative(dir);
    if (nativeHere) native.add(name);
    // Follow bundled Spark modules all the way; outside Spark, follow only
    // native packages, including their peers (a Nitro package declares
    // react-native-nitro-modules as a peer and cannot load without it).
    if (!bundled.has(name) && !nativeHere) return;
    const manifest = readJson(path.join(dir, "package.json"));
    const dependencies = { ...manifest.dependencies, ...(bundled.has(name) ? {} : manifest.peerDependencies) };
    for (const dependency of Object.keys(dependencies).sort()) {
      if (bundled.has(dependency) || existsSync(path.join(app, "node_modules", dependency, "package.json"))) {
        visitPackage(dependency, name);
      }
    }
  };

  if (specifier === CORE) {
    visitPackage(CORE, "the app");
    return [...native].sort();
  }

  const subpath = `./${specifier.slice(SPARK.length + 1)}`;
  const target = spark.exports?.[subpath];
  if (typeof target !== "string") throw new Error(`${specifier} is not in ${SPARK}'s exports map.`);
  // The subpath file re-exports vendored modules; follow relative imports
  // inside the Spark package until they name a module.
  const files = [path.join(sparkRoot, target)];
  const read = new Set();
  while (files.length) {
    const file = files.pop();
    if (read.has(file)) continue;
    read.add(file);
    for (const imported of importSpecifiers(readFileSync(file, "utf8"))) {
      const vendored = imported.match(/(?:^|\/)node_modules\/(@legendapp\/spark-[a-z0-9-]+)/) ?? imported.match(/^(@legendapp\/spark-[a-z0-9-]+)/);
      if (vendored) {
        visitPackage(vendored[1], specifier);
      } else if (imported.startsWith(".")) {
        const base = path.resolve(path.dirname(file), imported);
        const candidate = [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")].find((p) => existsSync(p) && statSync(p).isFile());
        if (candidate && candidate.startsWith(sparkRoot + path.sep) && !candidate.includes(`${path.sep}node_modules${path.sep}`)) files.push(candidate);
      }
    }
  }
  if (seen.size === 0) throw new Error(`${specifier} (${target}) re-exports no Spark module this script can follow.`);
  return [...native].sort();
}

/** Every app import with its native packages, and the ones the selection left out. */
export function importCheck(app, included) {
  const kept = new Set(included);
  const rows = [...appNativeImports(app)].map(([specifier, importers]) => {
    const modules = nativeModulesFor(specifier, app);
    return { specifier, importers: [...importers].sort(), modules, missing: modules.filter((name) => !kept.has(name)) };
  });
  return { rows, missing: rows.filter((row) => row.missing.length > 0) };
}

export function render({ included, excluded, reasons, sparkVersion, rows }) {
  const reasonRow = (name) => `| \`${name}\` | ${reasons[name] ?? ""} |`;
  const prunedReasons = excluded.some((name) => typeof reasons[name] === "string" && reasons[name] !== "");
  const prunedRow = (name) => `| \`${name}\` | ${reasons[name] ?? "not recorded"} |`;
  return [
    "# Moyo Learn for Mac: production native modules",
    "",
    `Generated by \`apps/desktop/scripts/production-modules.mjs\` from \`spark analyze\` (Spark ${sparkVersion}).`,
    "Do not edit by hand; CI regenerates it and fails on a difference.",
    "",
    "SOT-KEYWORDS: desktop production modules spark analyze native selection",
    "",
    `## Included (${included.length})`,
    "",
    "| Module | Why Spark kept it |",
    "| --- | --- |",
    ...included.map(reasonRow),
    "",
    `## Pruned (${excluded.length})`,
    "",
    prunedReasons
      ? "Reasons come from `.spark/selection-report.json`."
      : "`.spark/selection-report.json` records a reason only for included modules (its `reasons` map has no entry for any pruned one), so this table can't say why each was pruned. None of them is needed by an app import (next section).",
    "",
    "| Module | Reason |",
    "| --- | --- |",
    ...excluded.map(prunedRow),
    "",
    "## App imports and the native modules they need",
    "",
    "Every `@legendapp/spark/*` and `moyo-desktop-core` value import in `App.tsx`, `index.ts` and `src/`, mapped through the installed Spark package metadata. The script fails if a needed module is not in Included.",
    "",
    "| Import | Native modules | Imported by |",
    "| --- | --- | --- |",
    ...rows.map(
      (row) =>
        `| \`${row.specifier}\` | ${row.modules.length ? row.modules.map((m) => `\`${m}\``).join(", ") : "none (JavaScript only)"} | ${row.importers.map((f) => `\`${f}\``).join(", ")} |`,
    ),
    "",
  ].join("\n");
}

function main() {
  const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const reportFile = path.join(app, ".spark", "selection-report.json");
  const target = path.resolve(app, "..", "..", "docs", "desktop", "production-modules.md");
  if (!existsSync(reportFile)) throw new Error("No .spark/selection-report.json. Run `npm run analyze` first.");
  const selection = readSelection(readJson(reportFile));
  const { rows, missing } = importCheck(app, selection.included);
  if (missing.length) {
    const lines = missing.map((row) => `  ${row.specifier} (${row.importers.join(", ")}) needs ${row.missing.join(", ")}`);
    throw new Error(`spark analyze pruned native modules the app imports:\n${lines.join("\n")}`);
  }
  const sparkVersion = readJson(path.join(app, "node_modules", "@legendapp", "spark", "package.json")).version;
  const body = render({ ...selection, sparkVersion, rows });
  const counts = `${selection.included.length} included, ${selection.excluded.length} pruned, ${rows.length} app imports covered`;
  if (process.argv.includes("--check")) {
    const current = existsSync(target) ? readFileSync(target, "utf8") : "";
    if (current !== body) throw new Error("docs/desktop/production-modules.md is out of date. Run: node scripts/production-modules.mjs");
    console.log(`production-modules.md matches spark analyze (${counts}).`);
  } else {
    writeFileSync(target, body);
    console.log(`Wrote ${path.relative(process.cwd(), target)} (${counts}).`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
