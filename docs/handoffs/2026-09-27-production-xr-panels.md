# Production XR panels and Natalie

The learner `tutor-xr` route now loads the authored board and question chrome on Android. Production uses its existing BoardSession, engine, tutor request path and audioQueue. It does not mount either fixture probe or replace the current lesson.

| Control | Production action |
| --- | --- |
| Pen / highlighter / eraser | Set the shared engine tool |
| Palette / seven inks | Set engine ink; selecting ink leaves eraser mode |
| Undo / redo | Engine history, gated by real availability |
| Clear | Arm a five-second confirmation, then clear |
| Ask Natalie / Listen | Start or stop the same XR recorder; send speech and board together |
| Ask board | Export the current board through the tutor's attachment path |
| Hint | Ask the existing tutor for a hint about the current problem |
| Next / previous page | Read the rest of the current problem, without changing or grading it |
| Board / recenter | Place the workspace from the current head pose |
| Back to lesson | Exit the XR route while retaining the lesson |
| Reload Natalie | Retry a failed model load; voice and captions remain available |

The question panel displays the current tutor problem as a conversation. It does not fabricate multiple-choice answers, assignment sequencing or grading evidence. The structured question evaluator remains the separate, existing evidence-checked path. Long problem text is paged, and the native fallback and conversation rail retain full text instead of silently truncating turns.

## Lifecycle and rendering

- The Rive frame, visible paper, and input surface use the same content rectangle. Android live textures and Vision Pro raster/ink presentation stay separate.
- Missing Rive assets/runtime fall back to native lesson and drawing controls.
- Identical panel presentations generate no native property writes or revision bumps.
- Bindings acknowledge commands before dispatch; replayed sequences, unavailable history actions, busy submissions and post-disposal callbacks cannot trigger those actions.
- Speech and its board image are queued atomically and claimed together. Image export/staging failures preserve speech.
- Recording permission is explicitly requested on Apple platforms using the installed AudioManager API. The visionOS app has a microphone purpose string.
- Recording/transcription is invalidated on background/exit. Probe recording also has an explicit cancellation path and resolves native transcription.
- Natalie uses the existing speech queue, receives listening/thinking signals, pauses face updates in the background, and avoids piling up native morph writes. Dragging commits React state on release rather than every pointer sample.
- The lazy XR entry has a failure boundary and an exit during loading.

## Verified in the Linux workspace

- App, UI and mobile TypeScript checks.
- 158 XR geometry, input, command binding, pagination and question-flow/evaluator tests.
- UI lint and targeted app/mobile lint: no errors (existing import-order/probe warnings remain).
- `git diff --check` and visionOS permission plist parsing.

## Native verification still required

The full Android Metro export did not produce a completed bundle in this session and is not counted as a pass. No Xcode build, headset interaction run, frame-time profiling, or physical Logitech Muse test was performed here. Smoothness cannot be certified by the JavaScript checks.

The vendored `nitro-canvas-in-Vision@0.0.2-rive.4` implements `RivePanelFactory` only on Android. Its `createRiveCanvasRuntime` requires SurfaceTexture; its Apple code implements a canvas surface, not a Rive producer. Therefore production intentionally loads Rive only on Android. Vision Pro receives complete native lesson/drawing controls and the raster/ink board. Actual Rive-on-Metal is still a separate native implementation requirement.

Natalie's experimental bone drive remains disabled because its rest-pose matrices have not been verified on hardware; her speech-driven face remains active. This change does not certify full-body animation.

The generated visionOS test no longer waits ten minutes for the nonexistent React welcome screen. It now checks the linked spatial input module and required permission strings. Those native tests still need to run on macOS.
