# Moyo Learn SPECS Tutor Room proof

This proof deliberately uses Moyo's existing Tutor Room spatial model rather
than creating a glasses-only product fork.

## One spatial layout

The scene uses worldSlot(), the same source of truth as XrTriPanel.native.tsx.

The three surfaces remain:

- **left:** Assignment / lesson context
- **center:** the student's work / board
- **right:** AI tutor conversation

All three are placed on Moyo's existing 2.6 m comfort arc and turn with the
learner's head-relative yaw.

## One Viro scene, two renderer paths

MoyoSpecsTutorRoom.native.tsx is ordinary Viro JSX. It can render through the
existing ViroCore path today.

When Moyo vendors the first-class SPECS Viro build, the same React element is
fed to compileViroSpecsJSX() via compileMoyoSpecsTutorRoom() and then to the
Lens Studio backend.

No Lens Studio API is imported into Moyo.

## Why compiler access is feature-detected

Moyo currently pins its production Viro package to a local vendor tarball. This
PR must not replace that tarball with an unmerged Git branch or destabilize the
mobile build.

The helper therefore throws only when an explicit SPECS export is requested on
an older Viro build. Existing Quest, mobile AR, web and visionOS paths do not
change.

## Final Lens Studio acceptance

After the Viro runtime/compiler/CLI PRs and @viro-external/specs@0.2.0 are
landed:

1. vendor/update Moyo's Viro package;
2. compile this Tutor Room scene;
3. feed the resulting bundle into the SPECS backend;
4. open the Lens project already available on the validation Mac;
5. verify the three Moyo panels, select events and board polyline in SPECS 27
   Preview;
6. run the persistent LEAF/CLAD loop one final time.

That is the final software acceptance before physical-device certification.
