# The fixed test set

Fixed so numbers are comparable between runs. Changing it invalidates every recorded gate result; version it and say which version a number came from.

Composition follows the audit's acceptance section: English and Spanish, maths vocabulary, long explanations, silence, hesitation, interruptions.

## Corpus

| ID | Lang | Content | Exercises |
|---|---|---|---|
| `en-01` | en | "Let's put the numerator over the denominator." | maths vocabulary, OOV lexicon |
| `en-02` | en | "Pop the bubble, my bumper, pick a number." | **bilabial** — dense `/p b m/` between open vowels |
| `en-03` | en | "She sells six shapes; is this the sixth?" | **sibilant** — `S`/`SH`/`Z`, `TH` |
| `en-04` | en | "Who knew you'd choose two blue shoes?" | **rounded vowel** — `UW`/`OW`/`W` |
| `en-05` | en | "Three… (2.0 s) …no, wait — four." | **silence**, hesitation, self-correction |
| `en-06` | en | 90-second worked long-division explanation | drift over a long utterance |
| `en-07` | en | "So the perpendicu—" cut at 1.4 s | **interrupted word** |
| `es-01` | es | "Pon el numerador sobre el denominador." | maths vocabulary |
| `es-02` | es | "Pepe puso un poco de pan; mamá también." | **bilabial**, plus `β` approximants |
| `es-03` | es | "Cinco, diez, once, doce, trece." | dialect `θ`/`s` split, `SS` |
| `es-04` | es | "¿Cuánto suman uno, dos y ocho?" | **rounded vowel**, diphthongs |
| `es-05` | es | "Es… (2.0 s) …no, espera — cuatro." | **silence**, hesitation |
| `es-06` | es | 90-second worked fractions explanation | drift over a long utterance |
| `es-07` | es | "Entonces el perpendicu—" cut at 1.4 s | **interrupted word** |

Store renders and their MFA TextGrids under `qa/` alongside the render parameters (voice ID, `model_id`, `voice_settings`, `output_format`, band). A TextGrid without its parameters cannot be reused.

## Numeric gate

Scored per language over the whole corpus, comparing each viseme span's onset to the MFA onset of the phoneme it was generated from.

| Metric | Threshold | Basis |
|---|---|---|
| median \|Δ\| | ≤ 40 ms | Moyo gate, tighter than detectability for jitter headroom |
| p95 \|Δ\| | ≤ 80 ms | Moyo gate |
| max visual-late | ≤ 45 ms | ITU-R BT.1359-1 sound-advanced detectability threshold |

BT.1359-1 gives detectability at sound advanced 45 ms / sound delayed 125 ms, and acceptability at 90 ms / 185 ms. Only the 45 ms figure is used as a gate; the asymmetry is why late is capped hard and early is not. Confirm the in-force revision at <https://www.itu.int/rec/R-REC-BT.1359> before quoting these in a spec.

`scripts/check-timing.mjs` computes all three and exits non-zero on failure.

## Behaviour assertions

Numeric pass is necessary, not sufficient. Each of these asserts a property of the emitted schedule, not "the function returned something".

| Case | Fixtures | Assertion |
|---|---|---|
| Bilabial closure | `en-02`, `es-02` | For every `/p b m/` span: `mouthClose ≥ 0.85` and `jawOpen ≤ 0.06` hold for ≥ 30 ms inside the span. |
| Bilabial exception | `es-02` | For every `β` span: `mouthClose < 0.85` — the lips approach, they do not meet. |
| Sibilant | `en-03`, `es-03` | For every `S`/`SH`/`Z` span: `jawOpen ≤ 0.12` and lip spread > 0. A sibilant that gapes is the energy-only tell. |
| Rounded vowel | `en-04`, `es-04` | For every `UW`/`OW`/`W`/`u`/`o` span: `mouthFunnel ≥ 0.5` at the span's peak. |
| Silence | `en-05`, `es-05` | Across the 2.0 s pause: every channel ≤ 0.02 for at least 1.8 s of it. No held vowel. |
| Interrupted word | `en-07`, `es-07` | No keyframe exists past the cut. The schedule ends inside a release ramp, not at a held pose, and no keyframe from the cancelled generation survives. |
| Diphthong | `en-04` | `AY`/`OW`/`EY` produce two distinct peaks, not one plateau. |
| Stress | `en-01`, `en-06` | Mean `jawOpen` peak on primary-stress vowels exceeds unstressed vowels of the same class. |

## Recording a result

A gate run that is not recorded did not happen. Record: corpus version, date, commit SHA, voice ID, `model_id`, `voice_settings`, `output_format`, MFA model version, per-language median/p95/max-late, and every behaviour assertion's pass/fail. Reviewer observations go beside the numbers, not instead of them.

Never report a gate as passing when MFA was unavailable. Report "not measured".
