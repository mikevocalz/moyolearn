# English — ARPAbet phoneme to viseme class

## Sourcing

The word→phoneme step is a lookup, never a table in this file:

1. **CMUdict** — <https://github.com/cmusphinx/cmudict>. 39-phone ARPAbet set, stress digits `0/1/2` on vowels. Hand-curated; consult it first.
2. **espeak-ng** — <https://github.com/espeak-ng/espeak-ng>, `-v en-us -x` — out-of-vocabulary words only.

Strip the stress digit before the viseme lookup below. Keep it for the jaw amplitude term in `references/viseme-field.md`: a stressed vowel opens further than the same vowel unstressed, and dropping stress is most of why synthetic mouths read flat.

## Viseme classes

The 15-class set is the Oculus/Meta OVRLipSync viseme reference — a published, stable set with the same phoneme groupings used across real-time lipsync tooling: <https://developers.meta.com/horizon/documentation/unity/audio-ovrlipsync-viseme-reference/>. It is used here as the *class* vocabulary; the channel weights each class resolves to are Moyo's own and are listed in `viseme-field.md`.

| Class | Articulation |
|---|---|
| `sil` | silence, closure |
| `PP` | bilabial stop/nasal |
| `FF` | labiodental fricative |
| `TH` | dental fricative |
| `DD` | alveolar stop |
| `kk` | velar stop/nasal |
| `CH` | postalveolar affricate/fricative |
| `SS` | alveolar sibilant |
| `nn` | alveolar nasal/lateral |
| `RR` | rhotic |
| `aa` | open vowel |
| `E` | mid front vowel |
| `ih` | close front vowel/glide |
| `oh` | rounded mid back vowel |
| `ou` | rounded close back vowel/glide |

## ARPAbet → class

All 39 CMUdict phones. Diphthongs carry a target class as well as an onset class — schedule them as two spans, not one held pose.

| ARPAbet | Class | Diphthong target | Notes |
|---|---|---|---|
| `AA` | `aa` | — | |
| `AE` | `aa` | — | |
| `AH` | `aa` | — | Reduced (`AH0`) takes the low-amplitude branch — see viseme-field. |
| `AO` | `oh` | — | Rounded. |
| `AW` | `aa` | `ou` | |
| `AY` | `aa` | `ih` | |
| `B` | `PP` | — | **Bilabial. Closure is enforced.** |
| `CH` | `CH` | — | |
| `D` | `DD` | — | |
| `DH` | `TH` | — | |
| `EH` | `E` | — | |
| `ER` | `RR` | — | |
| `EY` | `E` | `ih` | |
| `F` | `FF` | — | Lower lip to upper teeth. |
| `G` | `kk` | — | |
| `HH` | — | — | No lip target of its own; inherits the following vowel's class at reduced dominance. |
| `IH` | `ih` | — | |
| `IY` | `ih` | — | |
| `JH` | `CH` | — | |
| `K` | `kk` | — | |
| `L` | `nn` | — | |
| `M` | `PP` | — | **Bilabial. Closure is enforced.** |
| `N` | `nn` | — | |
| `NG` | `kk` | — | |
| `OW` | `oh` | `ou` | |
| `OY` | `oh` | `ih` | |
| `P` | `PP` | — | **Bilabial. Closure is enforced.** |
| `R` | `RR` | — | |
| `S` | `SS` | — | Sibilant test case. |
| `SH` | `CH` | — | Sibilant test case. |
| `T` | `DD` | — | |
| `TH` | `TH` | — | |
| `UH` | `ou` | — | Rounded-vowel test case. |
| `UW` | `ou` | — | Rounded-vowel test case. |
| `V` | `FF` | — | |
| `W` | `ou` | — | |
| `Y` | `ih` | — | |
| `Z` | `SS` | — | |
| `ZH` | `CH` | — | |

`HH` is the only phone with no class. It is not a bug and it is not `sil` — an `HH` scheduled as silence closes the mouth mid-word, which is worse than leaving it open. Give it the following vowel's class at the reduced dominance in `viseme-field.md`.

## Maths vocabulary

The test set weights these because a tutor says them far more than general English does, and several are OOV in a general lexicon. Verify each against CMUdict before adding a hand entry:

`numerator`, `denominator`, `hypotenuse`, `quadratic`, `parallelogram`, `isosceles`, `perpendicular`, `coefficient`, `equilateral`, `circumference`.

Digit strings, operators and units are expanded by the provider before synthesis. Index the G2P against the **normalized** text the provider returns, not the text you sent — see `pipeline.md` Stage 1.
