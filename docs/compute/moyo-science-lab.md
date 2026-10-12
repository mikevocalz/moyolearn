# Moyo Science Lab — subject architecture and acceptance

Science Lab is an **interactive first learning domain**, not a set of embedded third-party websites. It is discoverable from the existing Subjects/Explore view, and routed to `/science-lab` on both Next.js and Expo. The shared interface reuses `@acme/ui`, age-band target tokens, and the learner role shell.

## Current in-repo activities

| Subject | K–5/introductory | Middle/high school |
|---|---|---|
| Chemistry | Build one water molecule by manipulating hydrogen and oxygen atom counts | Adjust coefficients to conserve all atoms in water/ammonia reaction models; choose a reaction and use hints |
| Biology | Explore light/water/CO₂ inputs for simplified plant photosynthesis | Predict single-gene Mendelian inheritance for selectable parent genotypes |
| Physics | Run a cart with selected speed, acceleration and elapsed time | Same cart plus kinematics relation; compare distance after changing acceleration |
| Earth & Space | Compare modeled solstice daylight by latitude/hemisphere | Same with idealized scientific assumptions and explicit limitations |

For each: controls change the observation, a hypothesis/action precedes feedback, and the student is asked to explain their findings. Younger learners see an atom-builder and photosynthesis inputs instead of reaction balancing and alleles. Calculations are **deterministic and offline-safe**; there are no network or model costs for these four activities.

### Advanced QDK/Chemistry (grades 6–12)

Science Lab links to the existing advanced `/chemistry-lab` experiment. The backend gates `6-8` and `9-12` voice bands through `protectedOperation`; the Python worker computes genuine classical H₂ Hartree–Fock energy for fixed geometry/basis combinations. Without worker credentials the result is unavailable, never fabricated. QDK is **not** a general chemistry or physics tutor.

## Architectural invariants

- No direct LLM invocations, free-form tool prompts, or student identifiers in these simulation engines. Natalie remains accessible through the existing Tutor Room, with its Safety Plane and no-final-answer pedagogy. The Science Lab prompts are deterministic and do not falsely claim AI personalization.
- No model outputs are auto-graded or recorded as mastery. Integration with learning evidence must use the server's existing educational repository and consent safeguards; do not write raw science activity data into the auth store.
- No new runtime dependencies or licensing obligations. Calculations are educational approximations, labelled as such, not experiments or laboratory measurements. Chemistry equation balancing models conserve **every** represented element; biology is a restricted Mendelian example; physics assumes constant acceleration; solar-day model excludes refraction.
- Science UI is React Native and web compatible; no direct DOM, HTML or WebView dependency. The advanced Python scientific service stays server-side.
- **PhET is not embedded.** Their HTML simulations use CC BY-NC 4.0, and commercial products must obtain a separate license: https://phet.colorado.edu/en/licensing. RDKit remains a possible future chemistry validator (BSD-3-Clause), subject to bundle size, review and interoperability: https://www.rdkit.org/.

## Development/QA checklist

1. `pnpm --filter @acme/app test` (includes `science.models.test.ts`): check atom conservation, genetic distributions, photosynthesis inputs, constant acceleration, equinox/solstice daylight bounds and hemisphere behavior.
2. `pnpm typecheck && pnpm lint && pnpm test`, plus Next.js web build and Expo CI for iOS/Android.
3. Manual teen + child cases: Subjects → Science Lab → four subject tabs → change controls → predict → test → interpret → navigation back; verify no text clipping and accessible controls on phone/tablet/browser.
4. Test zero/unchanged acceleration and equatorial day length; confirm every result is backed by the stated local scientific model.
5. Verify QDK link only for grade bands whose server VoiceBand is `6-8` or `9-12`, and try the unconfigured-worker error flow.

## Roadmap (not implemented)

- Standards-aligned learning objectives, grade-targeted lesson sequence, educator-authored guidance, and student-model mastery evidence.
- Larger periodic table, safe molecular visualizations, and chemically validated equation library.
- Spatial XR experiments with Viro/WebGPU and teacher co-presence, accessible 2D equivalents.
- Real-time avatar/voice integration through existing tutor Safety Plane, evaluated for hallucination and answer leakage.
- More physics/biology/earth systems, with scientific review of simplifying assumptions.
- PhET commercial license negotiation before any embed or redistribution.

## Technical sources

- QDK/Chemistry 2.2: https://microsoft.github.io/qdk-chemistry/user/quickstart.html
- QDK SCF limitations: https://microsoft.github.io/qdk-chemistry/user/comprehensive/algorithms/scf_solver.html
- PhET license: https://phet.colorado.edu/en/licensing
