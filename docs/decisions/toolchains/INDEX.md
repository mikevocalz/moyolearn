# Toolchain candidates — INDEX

**Durable. Never pruned.** One row per evaluated toolchain candidate. Written by
`compiler-scout`; one file per candidate in this directory.

**Read this table before researching any candidate.** If a candidate already has a row, the
work is done — open its file only if the revisit trigger has fired.

**Rejections are permanent records.** A NOT VIABLE row is as valuable as a VIABLE one: it is
what stops the same candidate being re-proposed in six months. Never delete a row.

| Candidate | Verdict | Confidence | Date | Revisit trigger |
|---|---|---|---|---|
| _none yet_ | | | | |

## Verdict vocabulary

Exactly one per candidate — no hedging, no inventing new values:

| Verdict | Meaning |
|---|---|
| **VIABLE** | Meets the stated capability need; the switch is defensible on evidence. |
| **VIABLE WITH CAVEATS** | Meets it, but with named, specific costs or gaps listed in the dossier. |
| **NOT VIABLE** | Does not meet it. The reason is named specifically, never "mostly conformant". |
| **INSUFFICIENT EVIDENCE** | Could not be established either way. What was missing is stated. |

## Standing rules for every entry

- **The incumbent gets the benefit of the doubt.** The default is to keep the current
  toolchain. A challenger must *earn* the switch against the specific capability we need.
  Novelty is not evidence. Migration cost is a real cost and appears in every comparison.
- **Prior art is mandatory.** A verdict with no prior-art search is incomplete.
- **Confidence and negative space.** Every dossier states a confidence level and an explicit
  "what I could NOT verify" list.
- **The migration may be the wrong remedy.** A dossier is free to conclude the blocker is
  our own code, a version pin, a feature we could implement ourselves, or a binary-only
  dependency that no new compiler fixes.
