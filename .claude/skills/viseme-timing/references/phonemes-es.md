# Spanish — IPA phoneme to viseme class

## Sourcing

There is no Spanish CMUdict. The only backend is **espeak-ng** — <https://github.com/espeak-ng/espeak-ng>:

```
espeak-ng -v es    -x --ipa -q --sep=' '   # es-ES
espeak-ng -v es-419 -x --ipa -q --sep=' '  # Latin American
```

`--ipa` is what makes this table usable. espeak-ng's default `-x` output is its own internal mnemonic set, which is not IPA and is not stable across versions; keying a viseme table to it is how a table rots.

## Pick a dialect and pin it

The dialect is a property of the voice, not a runtime option. Record it beside `ELEVENLABS_VOICE_ID` in the registry (`packages/voice/src/registry.ts`) and use the matching espeak-ng voice. The three splits that change visemes:

| Split | `es-ES` | `es-419` | Affects |
|---|---|---|---|
| `c` before `e/i`, `z` | `θ` (`TH`) | `s` (`SS`) | `cinco`, `diez`, `once`, `doce`, `trece` |
| `ll`, `y` | `ʎ` or `ʝ` | `ʝ`/`ʒ`/`ʃ` regionally | `llave`, `ella`, `mayor` |
| syllable-final `s` | `s` | aspirated/elided in several regions | `los`, `más`, `menos` |

Counting words are on the wrong side of every one of these, and a maths tutor counts constantly. Getting the dialect wrong makes `cinco` and `diez` wrong in the same way on every utterance.

## Phoneme → class

Class vocabulary is the same 15-class set as English (`phonemes-en.md`), so one viseme field serves both languages.

### Vowels

Spanish has five, with no length or reduction contrast. That is the reason a Spanish mouth reads *worse* under an English-tuned field, not better: there is no schwa to hide an imprecise target behind.

| IPA | Class |
|---|---|
| `a` | `aa` |
| `e` | `E` |
| `i` | `ih` |
| `o` | `oh` |
| `u` | `ou` |

Glides: `j` → `ih`, `w` → `ou`. Diphthongs are two spans (onset glide + vowel, or vowel + offglide), never one held pose.

### Consonants

| IPA | Class | Notes |
|---|---|---|
| `p` | `PP` | **Bilabial. Closure enforced.** |
| `b` | `PP` | **Bilabial. Closure enforced.** |
| `β` | `PP` | Approximant allophone of `/b/` between vowels. Closure **not** enforced — the lips approach, they do not meet. |
| `m` | `PP` | **Bilabial. Closure enforced.** |
| `f` | `FF` | |
| `t` | `DD` | Dental in Spanish, alveolar in English; same class, tongue is not visible. |
| `d` | `DD` | |
| `ð` | `TH` | Approximant allophone of `/d/`. |
| `θ` | `TH` | `es-ES` only. |
| `s` | `SS` | Sibilant test case. |
| `n` | `nn` | |
| `ɲ` | `nn` | `ñ`. |
| `l` | `nn` | |
| `ʎ` | `nn` | `es-ES` `ll` where distinguished. |
| `ɾ` | `RR` | Tap — `pero`. |
| `r` | `RR` | Trill — `perro`. Longer span; do not collapse it to the tap's duration. |
| `k` | `kk` | |
| `g` | `kk` | |
| `ɣ` | `kk` | Approximant allophone of `/g/`. |
| `x` | `kk` | `j`, `g` before `e/i`. |
| `tʃ` | `CH` | Affricate — two spans, closure then release. |
| `ʝ` | `CH` | |
| `ʃ` | `CH` | Regional realization of `ll`/`y`. |
| `ʒ` | `CH` | Rioplatense `ll`/`y`. |

### The approximant rule

`β ð ɣ` are the stop/approximant alternation: `/b d g/ ` are stops utterance-initially and after a nasal, approximants elsewhere. espeak-ng makes this distinction in its IPA output, which is the reason to read IPA rather than orthography.

It matters visually for exactly one of them. `β` looks like `PP` but the lips do **not** close, so it must be excluded from the bilabial closure enforcement in `viseme-field.md`. Forcing closure on every `b` makes `haber`, `sabe` and `tabla` read as a stutter.

## Spanish maths vocabulary for the test set

`numerador`, `denominador`, `hipotenusa`, `cuadrático`, `paralelogramo`, `isósceles`, `perpendicular`, `coeficiente`, `equilátero`, `circunferencia`, plus `cinco`, `diez`, `once`, `doce`, `trece` for the `θ`/`s` split.

## Before Spanish ships at all

Doc 16 §gates learner AI per locale through `aiTutorLocales`: a language joins it only when the Safety Plane's L1–L5 classifiers and the red-team suite pass in that language. Viseme work for Spanish can proceed ahead of that gate; **Spanish tutoring cannot**. Do not let a working Spanish mouth be read as Spanish readiness.
