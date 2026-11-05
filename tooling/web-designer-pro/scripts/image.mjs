#!/usr/bin/env node
/**
 * Generate one image for the site, with whatever this machine can use
 * (imagery.md §6). In order:
 *   1. Codex CLI signed in with a ChatGPT plan: uses the plan, no API key.
 *   2. OPENAI_API_KEY: the OpenAI Images API (GPT Image).
 *   3. AI_GATEWAY_API_KEY: Vercel AI Gateway, openai/gpt-image-*.
 *
 *   node image.mjs --prompt "<art direction + subject>" --out site/assets/hero.png
 *   node image.mjs --prompt-file prompts/hero.txt --out hero.png --aspect landscape
 *   node image.mjs --check                      which route would be used, and stop
 *
 * Options: --aspect landscape|portrait|square (default landscape)
 *          --transparent   ask for a transparent background (cut-outs)
 *          --via codex|openai|gateway   force a route
 *          --model <id>    override the model for the route
 * Every call costs the user something (plan limits or money): ask first.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f, d) => { const i = args.indexOf(f); return i > -1 && args[i + 1] ? args[i + 1] : d; };
const die = (m) => { console.error(m); process.exit(1); };

const aspect = val("--aspect", "landscape");
const size = { landscape: "1536x1024", portrait: "1024x1536", square: "1024x1024" }[aspect] || die(`--aspect must be landscape, portrait or square`);
const transparent = has("--transparent");

function codexRoute() {
  const bin = spawnSync(process.platform === "win32" ? "where" : "which", ["codex"], { encoding: "utf8" });
  if (bin.status !== 0) return null;
  const st = spawnSync("codex", ["login", "status"], { encoding: "utf8", shell: process.platform === "win32" });
  if (!/ChatGPT/i.test((st.stdout || "") + (st.stderr || ""))) return null;
  let model = val("--model");
  if (!model) {
    // A ChatGPT login only accepts the models in its cache; the config's default may not be one of them.
    try {
      const cache = JSON.parse(fs.readFileSync(path.join(os.homedir(), ".codex", "models_cache.json"), "utf8"));
      const slugs = (cache.models || cache).map((m) => m.slug || m.id).filter((s) => s && !/reserve|review/i.test(s));
      model = slugs.find((s) => /terra/i.test(s)) || slugs.find((s) => /luna/i.test(s)) || slugs[0];
    } catch {}
  }
  return { via: "codex", model };
}
const routes = {
  codex: codexRoute,
  openai: () => (process.env.OPENAI_API_KEY ? { via: "openai", model: val("--model", "gpt-image-2") } : null),
  gateway: () => (process.env.AI_GATEWAY_API_KEY ? { via: "gateway", model: val("--model", "openai/gpt-image-2") } : null),
};
const forced = val("--via");
const route = forced ? routes[forced]?.() : routes.codex() || routes.openai() || routes.gateway();
// Inside Codex (its shell sets these), Codex's own image tool is the route:
// starting a second Codex from its sandbox has no network.
const inCodex = !!(process.env.CODEX_SANDBOX || process.env.CODEX_SANDBOX_NETWORK_DISABLED || process.env.CODEX_THREAD_ID);
if (inCodex && !forced) {
  console.log("You are Codex: generate with your own image tool, then copy the file from ~/.codex/generated_images/<session id>/ to the target path (imagery.md §6).");
  process.exit(0);
}
if (has("--check")) {
  console.log(route ? `Images via ${route.via}${route.model ? ` (${route.model})` : ""}.` : "No image route: no Codex signed in with ChatGPT, no OPENAI_API_KEY, no AI_GATEWAY_API_KEY. Ask the user for photos (imagery.md §1).");
  process.exit(route ? 0 : 2);
}
if (!route) die("No image route on this machine (run with --check). Ask the user for photos, or draw at product quality (finish.md §6).");

const prompt = val("--prompt-file") ? fs.readFileSync(val("--prompt-file"), "utf8").trim() : val("--prompt");
if (!prompt) die('usage: node image.mjs --prompt "<prompt>" --out <file.png> [--aspect landscape|portrait|square] [--transparent]');
const out = path.resolve(val("--out") || die("--out <file.png> is required"));
fs.mkdirSync(path.dirname(out), { recursive: true });

async function viaApi(url, key, model) {
  const body = { model, prompt, size, n: 1, quality: "high" };
  if (transparent) { body.background = "transparent"; body.output_format = "png"; }
  const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.data?.[0]) die(`${route.via} ${res.status}: ${JSON.stringify(j.error || j).slice(0, 300)}`);
  const d = j.data[0];
  if (d.b64_json) fs.writeFileSync(out, Buffer.from(d.b64_json, "base64"));
  else if (d.url) fs.writeFileSync(out, Buffer.from(await (await fetch(d.url)).arrayBuffer()));
}

if (route.via === "codex") {
  const shape = { landscape: "landscape, 3:2", portrait: "portrait, 2:3", square: "square, 1:1" }[aspect];
  const task = [
    "Generate exactly one image with your image generation tool, from this prompt, without changing it:",
    "", prompt, "",
    `Format: ${shape}.${transparent ? " Transparent background (PNG with alpha), the subject cut out cleanly." : ""} No text, no watermark.`,
    `Save it as ${out} (PNG). Do not copy or reuse any other image file. Do nothing else. Print only the saved path.`,
  ].join("\n");
  const r = spawnSync("codex", ["exec", ...(route.model ? ["-m", route.model] : []), "--skip-git-repo-check", "--sandbox", "workspace-write", "-C", path.dirname(out), task],
    { encoding: "utf8", shell: process.platform === "win32", timeout: 600000, maxBuffer: 1 << 24 });
  // Codex keeps each session's images in ~/.codex/generated_images/<session id>/.
  // Take the image from THIS session's folder, never "the newest one": two
  // generations running at once otherwise grab each other's picture.
  const log = (r.stdout || "") + (r.stderr || "");
  const sid = log.match(/session id:\s*([0-9a-f-]{20,})/i)?.[1];
  const dir = sid && path.join(os.homedir(), ".codex", "generated_images", sid);
  const mine = dir && fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).map((f) => path.join(dir, f)) : [];
  if (mine.length) {
    mine.sort((x, y) => fs.statSync(y).mtimeMs - fs.statSync(x).mtimeMs);
    fs.copyFileSync(mine[0], out);
  }
  if (!fs.existsSync(out)) die(`Codex did not save the image.\n${log.split("\n").filter((l) => /error|not supported|limit/i.test(l)).slice(0, 5).join("\n") || "(no error printed)"}`);
} else if (route.via === "openai") {
  await viaApi("https://api.openai.com/v1/images/generations", process.env.OPENAI_API_KEY, route.model);
} else {
  await viaApi("https://ai-gateway.vercel.sh/v1/images/generations", process.env.AI_GATEWAY_API_KEY, route.model);
}
const kb = Math.round(fs.statSync(out).size / 1024);
console.log(`${out}  (${kb} KB, via ${route.via}). Open it at full size before using it: hands, text, warped objects mean regenerate.`);
