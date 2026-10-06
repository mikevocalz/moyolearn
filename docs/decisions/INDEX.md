# docs/decisions/INDEX.md

**Durable. Never pruned.** The answer surface for "did we already look at X?" — the table
below should settle that question without opening a file. Rejections are recorded
permanently: the reasoning is what stops a candidate being re-litigated in six months.

Every new entry carries a **revisit trigger** — the specific event that would justify
reopening it. Entries predating this index do not all have one; add it when you next touch
the file.

Generated from the files in this directory on 2026-10-02 (Stage 6.2). Keep it current by
hand — nothing regenerates it.

| Decision | Title | Status | Date |
|---|---|---|---|
| [`2026-09-22-migration-drift.md`](2026-09-22-migration-drift.md) | What is checked in but not applied, measured 2026-09-22 | — | — |
| [`2026-09-22-pgboss-migration-analysis.md`](2026-09-22-pgboss-migration-analysis.md) | pg-boss schema 38 → 42: is running it against production reversible? | — | — |
| [`2026-09-23-reset-password-contract.md`](2026-09-23-reset-password-contract.md) | The password-reset contract, read out of the installed better-auth | the sender is wired; findings 1 and 2 are open | — |
| [`adr-101-guardian-tab-set.md`](adr-101-guardian-tab-set.md) | ADR 101: Guardian mobile keeps doc 36's four tabs — Home · Reports · Alerts · Family | accepted | 2026-09-01 |
| [`adr-102-teacher-shell-ia.md`](adr-102-teacher-shell-ia.md) | ADR 102: The teacher shell exists, with four tabs — Home · Classes · Assign · You | accepted | 2026-09-01 |
| [`adr-103-school-admin-ia.md`](adr-103-school-admin-ia.md) | ADR 103: School admin is web-first; mobile parks at Overview-only; no More tab, ever | accepted | 2026-09-01 |
| [`adr-104-district-mobile-retirement.md`](adr-104-district-mobile-retirement.md) | ADR 104: The district mobile tab bar retires — district is web-only, per doc 36 §3.5 | accepted | 2026-09-01 |
| [`adr-105-tutor-web-schedule-item.md`](adr-105-tutor-web-schedule-item.md) | ADR 105: Tutor web drops the Schedule nav item — Today is the sessions timeline | accepted | 2026-09-01 |
| [`adr-106-account-sheet-is-profile-you.md`](adr-106-account-sheet-is-profile-you.md) | ADR 106: The account sheet is the mobile chrome form of Profile/You — not a sixth destination | accepted | 2026-09-01 |
| [`adr-107-learner-pane-ban-reaffirmed.md`](adr-107-learner-pane-ban-reaffirmed.md) | ADR 107: The learner pane ban holds — no split learner UI, any band, any width | amended 2026-09-03 | 2026-09-01 |
| [`adr-108-tutor-learner-edge.md`](adr-108-tutor-learner-edge.md) | ADR 108: Tutor↔learner engagement becomes a first-class row | accepted | 2026-09-02 |
| [`adr-109-family-household-object.md`](adr-109-family-household-object.md) | ADR 109: Family becomes a first-class household object | accepted | 2026-09-02 |
| [`adr-110-sessions-object.md`](adr-110-sessions-object.md) | ADR 110: The human-tutoring session becomes a first-class row | accepted | 2026-09-02 |
| [`adr-111-native-3d-runtime.md`](adr-111-native-3d-runtime.md) | ADR-111 — A native 3D runtime for Natalie, behind a flag, with a hard cutoff | ACCEPTED (the work). The switch is governed by | 2026-09-03 |
| [`adr-112-live-audio2face.md`](adr-112-live-audio2face.md) | ADR-112 — Audio2Face-3D and Audio2Emotion drive Natalie's face LIVE, on Moyo's own GPU host | ACCEPTED (the contract and the client). The ho | 2026-09-03 |
| [`adr-113-body-motion-layer.md`](adr-113-body-motion-layer.md) | ADR-113 — The body motion layer: how Natalie stops moving like a robot | ACCEPTED (layers B and C). Layer A is blocked  | 2026-09-03 |
| [`adr-114-preload-and-loader.md`](adr-114-preload-and-loader.md) | ADR-114 — Never blank: preload Natalie, and a designed loader for the cold path | ACCEPTED | 2026-09-03 |
| [`adr-115-art-direction-authority.md`](adr-115-art-direction-authority.md) | ADR-115 — Which document governs art direction on app surfaces | PROPOSED | 2026-09-05 |
| [`adr-116-native-asset-compression.md`](adr-116-native-asset-compression.md) | ADR-116 — Compression formats are chosen per runtime, not per asset | accepted | — |
| [`adr-117-spatial-whiteboard-bridge.md`](adr-117-spatial-whiteboard-bridge.md) | ADR-117 — The spatial whiteboard's bridge: one engine, two renderers | PROPOSED — unverified on hardware | 2026-09-13 |
| [`adr-118-pico-build-contract.md`](adr-118-pico-build-contract.md) | ADR-118 · What a PICO build actually requires | accepted | — |
| [`adr-119-graded-turns-need-a-locked-revision.md`](adr-119-graded-turns-need-a-locked-revision.md) | ADR-119: a graded turn is bound to a locked current question revision | implemented in code; migration `edu_questions` | 2026-09-16 |
| [`adr-120-strict-typescript-api-deferred.md`](adr-120-strict-typescript-api-deferred.md) | ADR-120: the Strict TypeScript API stays opt-out, blocked on Reanimated | deferred with evidence. `react-native-legacy-d | 2026-09-17 |
| [`adr-121-gpu-device-topology.md`](adr-121-gpu-device-topology.md) | ADR-121: one GPU device for Natalie, Skia and inference — or siblings | proposed. The decision needs Scenario J/K numb | 2026-09-17 |
| [`adr-122-local-inference-router.md`](adr-122-local-inference-router.md) | ADR-122: local inference routes through the gateway that already exists | proposed. The shape is decided by what is alre | 2026-09-17 |
| [`adr-123-pgboss-schema-42.md`](adr-123-pgboss-schema-42.md) | ADR-123 — Take the pg-boss schema to 42, and take `main` with it | decided, migration not yet applied | — |
| [`adr-homework-exact-math.md`](adr-homework-exact-math.md) | Exact arithmetic for homework | implemented checker; production assessment evi | 2026-09-16 |
| [`bunny-storage-presign-spike.md`](bunny-storage-presign-spike.md) | Spike: can a client PUT directly to Bunny Storage? | RESOLVED — yes, verified against a live zone | — |

**28 decisions recorded.**

## Toolchain candidates

Compiler and toolchain evaluations live in [`toolchains/`](toolchains/INDEX.md) with their
own index — one file per candidate, written by `compiler-scout`. That index is the first
place to look before researching any candidate.
