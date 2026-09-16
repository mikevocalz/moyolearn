// Reproduce the current capture baseline; no app implementation is changed.
// SOT-KEYWORDS: homework ocr benchmark synthetic unicode math baseline
import sharp from "sharp";
import { readPrinted } from "../../packages/app/features/capture/ocr-web.ts";
import { readDocument } from "../../packages/app/features/capture/read-document.ts";
import { zipSync, strToU8 } from "fflate";
import { writeFile, mkdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const repository = fileURLToPath(new URL("../..", import.meta.url));
const revision = execFileSync("git", ["-C", repository, "rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
import { resolve } from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const output = resolve(process.argv[2] ?? "/tmp/moyo-homework-baseline");
await mkdir(output, { recursive: true });
// Tesseract caches traineddata in cwd. Keep generated files outside the repo.
process.chdir(output);
import os from "node:os";
const cases = [
  { id: "english-student-error", lines: ["2 + 2 = 5"] },
  { id: "spanish-student-error", lines: ["Yo tieno dos hermanos."] },
  { id: "spanish-unicode", lines: ["¿Cuántos lápices?", "12 ÷ 4 = 3"] },
  {
    id: "critical-math",
    lines: ["12 ÷ 4", "12 + 4", "-3²", "(-3)²", "1/(x + 1)", "1/x + 1"],
  },
  { id: "arabic", lines: ["حل ٣ + ٢"] },
  { id: "urdu", lines: ["اردو"] },
];
const escape = (s) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const rows = [];
for (const c of cases) {
  const expected = c.lines.join("\n");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${Math.max(400, 100 + c.lines.length * 95)}"><rect width="100%" height="100%" fill="white"/>${c.lines.map((s, i) => `<text x="70" y="${95 + i * 95}" font-family="Arial" font-size="54" fill="black">${escape(s)}</text>`).join("")}</svg>`;
  const path = `${output}/${c.id}.png`;
  await sharp(Buffer.from(svg)).png().toFile(path);
  const xml = `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${c.lines.map((s) => `<w:p><w:r><w:t>${escape(s)}</w:t></w:r></w:p>`).join("")}</w:body></w:document>`;
  const docx = zipSync({
    "[Content_Types].xml": strToU8(
      '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    ),
    "_rels/.rels": strToU8(
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    ),
    "word/document.xml": strToU8(xml),
  });
  await writeFile(`${output}/${c.id}.docx`, docx);
  await writeFile(`${output}/${c.id}.txt`, expected);
  const documents = {
    text: readDocument(strToU8(expected), "text/plain"),
    docx: readDocument(docx),
  };
  const runs = [];
  for (let i = 0; i < 3; i++) {
    const t = performance.now();
    const result = await readPrinted(path);
    runs.push({
      ms: Math.round(performance.now() - t),
      ...result,
      exact: result.text === expected,
    });
  }
  rows.push({
    id: c.id,
    expected,
    imageSha256: createHash("sha256")
      .update(await readFile(path))
      .digest("hex"),
    documents,
    runs,
  });
  console.log(JSON.stringify(rows.at(-1)));
}
await writeFile(
  `${output}/results.json`,
  JSON.stringify(
    {
      date: new Date().toISOString(),
      revision,
      platform: os.platform(),
      arch: os.arch(),
      cpu: os.cpus()[0]?.model,
      node: process.version,
      tesseract: require("tesseract.js/package.json").version,
      sharp: sharp.versions.sharp,
      note: "Synthetic rendered print only; Node execution of installed web OCR; each call creates a worker; not mobile or browser timings; not a handwriting or accuracy qualification corpus.",
      rows,
    },
    null,
    2,
  ),
);
