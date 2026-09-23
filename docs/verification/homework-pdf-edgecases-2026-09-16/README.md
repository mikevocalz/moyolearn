# Homework PDF edge cases — 2026-09-16

## Result

22 documents exercised through the **production browser reader**, real PDF.js worker, local page rendering, and Tesseract. This is coverage of specific cases, not proof of all possible inputs or production OCR accuracy. Raw observations are in `results.json`; timings are one warm local Chrome 152 run, not performance benchmarks. The source PDFs and derivatives stay in ignored `.codex/pdf-qa/sources/`, not in Git.

**Release-blocking accuracy gaps remain:** mixed text/image pages can omit image questions; blur can change operators; stacked fractions lose spatial meaning; handwriting is unreliable. A returned `text` or `ocr` status means extraction ran, not that its answer is correct. Every page needs source review. These tests do not establish safe automatic grading.

## Real homework sources

- [Hayutin scanned math workbook](https://hayutineducation.com/uploads/application/files/lower-level-math-supplements.pdf): 177 scanned pages. PDF pages **65–66** contain a fraction worksheet, its printed answer key, and handwritten notes; they are not completed handwritten student solutions. The local two-page extract is `scanned-fractions-pages65-66.pdf`. Includes PDF rotation, stacked fractions, multiple columns, scan noise and marginal handwriting. Full file explicitly rejected at the 100-page limit.
- [MathWorksheets grade 5 homework packet](https://www.mathworksheets.com/5th-grade/MathWorksheetsGrade5_2_23.pdf): 20 pages, printed questions, diagrams, arithmetic, fractions, and complex layouts. This exposed a broken embedded font mapping: visually readable questions extracted as control characters. Original full packet is `grade5-fractions.pdf`; isolated first page is `broken-font-page1.pdf`.

URLs and SHA-256 checksums are pinned in `scripts/qa/pdf/download-sources.py`. These are publicly downloadable sources, not a claim that they are freely redistributable. No student records were used.

## Executed cases

| Case | Observed result | Verdict / limit |
| --- | --- | --- |
| Deliberately wrong `2 + 2 = 5` | Original text retained | Pass: no answer correction |
| Blank page | Preview retained, `needs-ocr`, empty text | Pass: not silently omitted |
| PDF rotation 90°, 180°, 270° | Text retained, previews produced | Pass for extraction; not raster-orientation OCR |
| Landscape | Text and preview retained | Pass |
| Tiny 100×100-point page | Text and preview retained | Pass for parsing; readability not scored |
| Huge 14,400×14,400-point page | Bounded preview generated, text retained | Pass for this size; tiny printed content is not legible at preview scale |
| Password-protected | PasswordException | Expected rejection; password entry not implemented |
| Truncated PDF | InvalidPDFException | Expected rejection |
| Text file with PDF extension | InvalidPDFException | Expected rejection |
| Zero-page PDF | Explicit page-count rejection | Fixed: no empty success |
| 100 pages | All 100 pages and previews retained | Pass for simple text fixture; not scanned-document stress coverage |
| 101 pages | Explicit rejection | Pass: no truncation |
| Clear raster equation | `Solve2+2=5` | Operators retained, spaces lost |
| Blurred raster equation | `Solve2+2+5` | **Fail: equals became plus** |
| Low-contrast raster equation | `Solve2+2=5` | Operators retained in this sample only |
| Text header + raster question | Only `Homework page 1` extracted | **Fail: question omitted** |
| Broken font, isolated page | OCR fallback now runs; raw font-layer evidence retained | Routing fixed; division/multiplication still misread |
| Scanned fractions, pages 65–66 | Both pages OCR'd and previewed | **Fail: fraction structure and handwritten note unreliable** |
| Full 20-page packet | All 20 pages OCR'd and previewed | Completeness pass; math accuracy fails, not gold-transcribed |
| Full 177-page scanned workbook | Explicit rejection | Pass for limit handling |

The three rotation documents count separately, giving 22 documents total. A separate existing test covers page-tree order differing from object order and failure of a middle page. No assertion that all worksheet questions were correctly recognized is made.

## Fix included

Reject invalid page counts. Detect control/replacement characters in extracted font mappings and route the page to OCR instead of accepting garbled homework. Preserve the raw text layer for evidence (OCR regions replace text-layer regions after fallback); do not invent corrected character mappings. Added six regression cases; targeted PDF suite: 13 passing. Complete app suite: 565 + 105 = 670 passing. Cold workspace type check: 19/19 tasks passed. The saved browser harness also completed a second 22-case run.

This conservative check does **not** detect every broken mapping: plausible but wrong printable letters, stale invisible text, image questions beneath a header, and unsupported glyphs without replacement characters remain separate cases.

## Wider coverage matrix

Each unchecked item needs its own fixture, expected transcription/regions, and assertion. Passing one example never implies the whole category passes. Test pairs and combinations after individual cases, especially multilingual handwriting + blur + rotation + multipage files.

| Area | Remaining cases to cover |
| --- | --- |
| Handwriting | Completed student solutions; cursive; block letters; multiple writers; pencil; colored ink; faint erasures; crossed-out answers; arrows; margin corrections; ambiguous 0/O, 1/l, 5/S, 6/b, 9/g |
| Math | Negative signs vs dashes; × vs x; ÷ vs +; decimal separators; stacked/mixed fractions; exponents; subscripts; radicals; integrals; matrices; inequalities; units; recurring decimals; scientific notation |
| Languages | Arabic/Hebrew RTL; mixed RTL/LTR equations; CJK; Devanagari; combining accents; multilingual pages; localized digits; bidi controls; ligatures |
| Layout | Two/three columns; answer keys vs questions; continued questions across pages; tables; merged cells; diagrams; geometry labels; charts/axes; chemical structures; checkboxes; matching arrows; footnotes; stamps |
| Image capture | Raster 90/180/270°; upside-down handwriting; perspective/skew; glare; shadows; texture; bleed-through; motion blur; JPEG artifacts; cropped problem numbers; cut-off edges; overlapping sheets; curved book pages |
| Text layer | Header-only hybrid (known failure); stale/invisible overlay; duplicate layers; wrong reading order; printable garbage mappings; missing ToUnicode; outlined text; annotations/form values absent from text layer |
| PDF formats | XFA/AcroForm; handwritten ink annotations; signed PDFs; incremental updates; PDF portfolios/attachments; damaged but repairable xref; object streams; embedded files; JavaScript; external links; transparent layers |
| Rendering | Missing fonts/CMaps; JPX/JBIG2; CMYK; alpha masks; rotated CropBox; non-default UserUnit; mixed sizes/orientations; massive embedded images; image decompression bombs; malicious object recursion |
| Boundaries | 32 MiB −1/exact/+1 byte; compressed expansion; 99/100 scanned pages; zero-byte upload; extension/MIME/magic disagreement; Unicode/very long names; duplicate filenames |
| Network/assets | Offline before/after worker cache; worker/font/wasm 404; OCR language download failure; fetch timeout; interrupted upload; signed URL expiry; redirects; denied CORS |
| Lifecycle | Cancel during parsing/OCR; replace source mid-read; rapid double upload; component unmount; return/back; app background/kill/relaunch; memory pressure; dispose worker after exception |
| Review UI | Correct every page; revisit earlier correction; blank vs diagram-only; unavailable preview; zoom/readability; long keyboard text; tiny screens; screen reader; large font; RTL controls; explicit unresolved-page blocking |
| Source integrity | Exact OCR revisions; immutable original; region-to-page transforms after rotation/crop; document/page IDs; durable resume; no silent deduplication; assessment cannot bypass unresolved source |
| Native | iOS/Android PDF adapters; HEIC; camera permissions; platform picker cancellation; real device memory/thermal/latency; native OCR model accuracy and language support |
| DOCX/images | DOCX tables/equations/images/headers; corrupt ZIP; zip bomb; unsupported file type; image orientation metadata; multipage TIFF; animated image; transparent text |
| Security/privacy | Model calls respect safety boundary; no private source URLs/text in logs; deletion/retention; cross-user isolation; content injection in homework; redaction and audit lineage |

## Reproduce

Run from repository root with Node 24 and `pnpm install` already complete. Downloads need network access; OCR may fetch its language/model assets. Python dependencies are isolated in the ignored QA directory.

```sh
uv venv .codex/pdf-qa/venv
uv pip install --python .codex/pdf-qa/venv/bin/python pypdf==6.19.0 reportlab==5.0.1 pillow==12.3.0
.codex/pdf-qa/venv/bin/python scripts/qa/pdf/download-sources.py
.codex/pdf-qa/venv/bin/python scripts/qa/pdf/build-fixtures.py
node apps/web/scripts/copy-pdf-assets.mjs
node scripts/qa/pdf/serve.mjs
```

Open `http://127.0.0.1:4317` in Chrome. The page displays observations once all cases finish; `globalThis.edgeQa` exposes progress. Do not change imported files during the run: Vite reload resets state. The harness calls the actual browser reader, but **does not test the operating-system picker, learner review navigation, server persistence or grading**. Those require separate flow tests. Inspect source pages against extracted text; especially compare each number/operator, not just words or page counts. Stop the local server after use.
