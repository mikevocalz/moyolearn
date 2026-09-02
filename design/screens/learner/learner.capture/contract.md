# Flow Contract — learner.capture (Snap — product signature)

```yaml
screen_id: learner.capture
role: learner
tenant: [app]
band: all   # band-scaled UI (targets, copy, guidance density)
shell: learner
entry_points:
  - "tab: Snap — raised center tab on EVERY band (doc 36 §3.1 law; G §1.1 confirms raised: true all bands)"
  - "push: from learner.home K–2 hub giant tile (band variant primary)"
  - "flow: FD-17 'Snap your homework' — the single landing action after learner onboarding (doc 38 §1.2)"
  - "back_from: learner.tutor (learner returns to snap another problem)"
answers_within_5s:
  - "How do I show Natalie my homework?"
  - "Did the picture come out readable?"
primary_action: "Capture the homework (shutter) → guided frame/crop → on-device OCR review → confirm hands the problem to Natalie (→ learner.tutor)"
secondary_actions:
  - "Pick from library / file instead (entry-row alternates)"
  - "Type it or say it instead (no-camera paths)"
exits:
  confirm_ocr: learner.tutor
  cancel: learner.home
  free_limit_hit: PW-03b
completion_returns_to: learner.tutor
back_behavior: "Cancel/back returns to the originating tab (learner.home by default); in-flight capture is discarded with confirmation on bands 6–12, silently on K–2 (one-question-at-a-time voice law, doc 31). Single-pane, chrome-minimal during framing."
failure_paths:
  offline: "Fully usable to OCR review — capture + OCR are on-device (doc 24 §1.4, ocr-web.ts / ocr-review.*); confirm queues the tutor session and shows band-voiced 'Natalie will look as soon as we're back online'."
  no_data: "n/a — screen is an input surface; blank camera = default state."
  permission: "Camera denied → inline band-copy fallback offering type / say / library paths in place. Never deep-link K–2/3–5 to OS settings (settings are guardian-side, doc 36 §3.1); 6–12 may show a 'fix in settings' hint."
cross_role_propagation:
  - "Confirmed capture starts the session whose doc-34 report reaches guardian.reports / guardian.report-detail"
  - "S3/S4 events in the resulting session reach guardian.alerts via the doc-31 incident channel"
cross_device_continuity: "None for in-flight captures — a framed/cropped image is device-local until confirmed; the session created on confirm is server-backed and follows learner.tutor continuity."
max_interactions_to_primary: 1
state_owner: "capture.store (existing) + realtime-hints.store (existing) for guided-frame hints"
```

**Status:** Route EXISTS — `/(learner)/(tabs)/capture` + web `/capture`, classified **PARTIAL**.

**Notes:**
- **Band defect (b):** `capture.tsx` re-exports `CaptureScreen` bare, so `ageBand` defaults to `'teen'` on every path — a six-year-old gets the teen capture UX (A-audit; F §J1 finding 2). One-line wrapper reading the session band is the fix; this contract's band scaling is fictional until then.
- **Missing fork (J1 finding 3):** post-OCR confirm is hardwired to the AI path. The AI / human-tutor / self-guided fork has no screen and no inventory row. This contract records capture as AI-only (`confirm_ocr → learner.tutor`); adding the fork requires a new inventory row + contract first.
- **No subject-match step (J1 finding 4):** `CapturePayload` carries no subject; downstream mastery attribution depends on it. Contract-relevant: the confirm exit must eventually carry subject context to learner.tutor.
- Camera raised-center on every band is a law of this contract — any tab reconciliation that demotes it is a violation.
- Learner surface: no prices; limit state is PW-03b only.
