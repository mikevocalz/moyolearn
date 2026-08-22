# Screens-First Build Order & Mock-Session Contract
**Doc 09 · Companion to the platform pack · Date:** Aug 19, 2026
**The decision this doc encodes:** build and *see* the screens first; wire auth afterward. This reorders the PR sequence across docs 03/05/06 — where orderings conflict, **this doc wins.** Skills applied: frontend-design, design-system, system-design (the contract below is what makes deferral safe instead of expensive).

---

## 1. Why this works (and the one way it goes wrong)
Deferring auth is the right call for seeing the product fast — the failure mode is building screens that *assume no auth* and then rewriting them. The fix is a contract: screens code against the **session interface from day one**, and only the implementation is mocked. When auth lands, it's a provider swap, not a refactor.

## 2. The Mock-Session Contract
**One interface, two implementations, one env flag.**

```
packages/app/provider/session/
  types.ts        # the contract — mirrors the verified Better Auth client shape
  mock.tsx        # MockSessionProvider (fixtures) — dev only
  live.tsx        # LiveSessionProvider (Better Auth authClient) — Wave 3
  index.tsx       # picks by EXPO_PUBLIC_AUTH_MODE = "mock" | "live"
```

```ts
// types.ts — the shape screens are allowed to know
export interface AppSession {
  user: { id: string; name: string; kind: RoleKind } | null
  activeContext: ActiveContext            // { kind, orgId?, learnerId?, gradeBand? }
  memberships: Membership[]
  status: 'loading' | 'authed' | 'anon'
}
export function useAppSession(): AppSession
export function useSetContext(): (ctx: ActiveContext) => void
```
Rules (CI-enforceable):
1. **Screens import only `@acme/app/provider/session`** — importing `mock.tsx` directly anywhere outside the provider folder fails lint.
2. `MockSessionProvider` reads **persona fixtures** (`packages/app/fixtures/personas.ts`): *Maya (learner, K–2)*, *Jordan (learner, gr 6)*, *Dana (guardian, 2 kids)*, *James (tutor)*, *Ms. Rivera (teacher)*, *Priya (owner, 2 locations)*. Each persona carries `gradeBand` — so doc 08's age-band target tokens and the Hot/Cool dial render truthfully per persona from day one.
3. **Dev RoleSwitcher** in the drawer header (dev builds only; stripped by env + conditional require): one tap swaps persona → `activeContext` flips → the shell tree re-resolves. This is also how every screenshot/review happens.
4. The **guard tree ships in Wave 2** consuming `useAppSession()` — `Stack.Protected` works identically under mock, so Wave 3 changes *zero* navigation code (the Protected API guarantees — deep-link guarding, history purge on context flip — get exercised early, on fixtures).
5. `EXPO_PUBLIC_AUTH_MODE=live` + deleting the switcher is the entire Wave-3 screen-side migration. The personas graduate into permanent test fixtures for the doc-05 §3.2 visibility-matrix tests.

## 3. The reordered roadmap (supersedes earlier PR orderings)
**Wave 1 · Look** — PR-0 (repo hygiene), PR-1 (dial groundwork), PR-20 (token completion: UI ramp, spacing tiers, target tokens), PR-21 (component anatomy + Storybook density/ramp pages). *Exit: the design system is visible in Storybook at both dials.*
**Wave 2 · Screens (mock session)** — the visible spine, in order:
1. **Student Home + AI-session shell** (brief S1/S22; Hot dial; the path-based home per §4) — the heart of the product, first thing anyone sees.
2. **Tutor Today + SessionPrepCard** (S4) — the tutor wow moment on demo data.
3. **Ops Resource Schedule** (S8) — ~70% exists in the repo's schedule feature; port + dial + EventPeek L1.
4. **Parent Home + child card + activity review** (S5, plus the S27 memory screen as static comp).
5. **Paywall + trial status** (S16/S17) as static comps — visible now, wired in Wave 4.
6. Remaining briefs from docs 04/05/06 in Duet/Triptych order.
*Per-screen definition of done: §5.*
**Wave 3 · Auth becomes real** — PR-2 (Better Auth foundation), PR-14 (flows: guardian→child creation, restricted-account hooks, resets), PR-15 (Stripe×Auth config), PR-9 flips guards to live. Provider swap; RoleSwitcher deleted.
**Wave 4 · Data & money** — PR-3/4/5 (Payload collections + relationship-scoped projections replace fixtures screen by screen), PR-8 (subscriptions/trials live), PR-11/12 (Connect M1 + payroll v1).
**Wave 5 · AI & safety & polish** — PR-17 (Safety Plane), PR-18 (Student Model v1 + S27 live), PR-19 (client hardening), PR-16 (onboarding live), PR-13 (Connect M2 payouts).
Safety note kept honest: **no real child ever talks to the AI before Wave 5's Safety Plane exists** — Wave 2's AI-session shell runs scripted demo content on fixtures only.

## 4. New research folded in: the guided path beats the map (Student Home)
Duolingo's November 1, 2022 home-screen redesign replaced the skill tree with a **single guided path** because learners kept saying they weren't sure they were using the app the "right" way; lessons were re-ordered into the mixed-concept sequence Duolingo had always recommended, units got smaller, and **practice/review was built into the path itself** ("practice *is* progress" — von Ahn) on a spaced-repetition backbone. The launch drew loud backlash from tree veterans, but Duolingo's subsequent proficiency whitepaper reports learners on the path reaching Intermediate-Mid ACTFL outcomes — the design held. Lessons for **S1 Student Home**:
- The child's home is **"Today's Path"** — 3–5 stops (warm-up review → new concept with the tutor → practice → star moment), not a subject grid. One obvious next step, zero guesswork (also the NN/g one-task law from doc 08).
- **Review is woven into the path**, never a guilt-trip "go back" — the spaced-repetition slot is just the next stop.
- Subject choice lives one level up (the guardian's plan + the learner's "switch subject" affordance), not as the daily navigation burden.
- Progress renders as the path filling in ink/grade-green behind the child — the neubrutalist take on the gold-path motif, per doc 08's MasteryBar color law.

## 5. Definition of done — every Wave-2 screen
Brief satisfied (docs 04/05/06 format: Job/Research/Layout/Design/Copy/A11y/Metric) · renders at required width classes and both dials where applicable · age-band targets pass the CI measure (doc 08 §7.2) · hierarchy audit passes (one display moment, one highlighter accent, 5-second squint test) · reduced-motion path exists · fixtures are realistic (real-length names, crowded schedules, empty states) · PR carries screenshots per persona via the RoleSwitcher.


---

## 7. The Reference Stack (Mobbin + the video methodology, folded in)
**Standing rule for every Wave-2 screen:** before building, pull **3–5 real-app references from Mobbin** (his connected account) — *flows* for multi-step journeys (onboarding, checkout), *screens* for single surfaces. What we take from references: **structure only** — layout bones, disclosure patterns, information order, empty/edge-state handling. What we never take: **style** — colors, radius, type, shadows are locked by docs 02/08 ("on top of what the app already looks/feels like"). Every brief's Research line gains a `Mobbin:` entry citing the reference URLs used.

**Ready-to-run queries per spine screen** (run in Mobbin when each screen starts):
- S1 Student Home → screens: "kids learning app home screen with guided lesson path and progress" (ios)
- S22 first-run → flows: "children education app onboarding with avatar selection" (ios)
- S4 Tutor Today → screens: "service provider daily schedule with client session cards" (ios)
- S8 Ops schedule → screens: "appointment scheduling calendar with staff columns day view" (web)
- S5 Parent Home → screens: "parental controls dashboard with child profile and activity" (ios)
- S16 Paywall → flows: "subscription paywall with free trial timeline and plan comparison" (ios)

**The working method (from the reference videos, formalized):**
1. *Claude-design discipline* ("Claude Design Builds Beautiful $10,000 Websites — NO AI Slop," Jack Roberts): every screen is built through the frontend-design skill's two-pass process — plan (tokens, layout ASCII, signature) → self-critique against the generic default → build → screenshot-critique. No screen ships from a single generation.
2. *Mobbin-as-reference* ("Claude + Mobbin is a Design CHEAT CODE," Tae Online HD): references are pulled **before** generation and given to the design pass as structural evidence — the model designs from real shipped patterns instead of hallucinated ones, then restyles entirely in our tokens.
3. *Agent workflow* ("The Fastest Way… AI Agents," Calum Johnson): the per-screen loop (brief → references → plan → build → critique → screenshot in PR) is written so an agent can run it end-to-end; doc 05/04 briefs are the prompts.
4. *Auth plugins* ("10 Better Auth plugins…," Dreams of Code): folded into doc 06 §10.
(Videos identified by title/channel metadata; their subjects — the Mobbin workflow, the no-slop design discipline, the plugin roster — are what's encoded here.)

## 6. Sources (adds to the pack's registers)
Duolingo path redesign: blog.duolingo.com "new Duolingo home screen design" (Nov 2022 launch, guided path rationale, practice-in-path, mixed-concept ordering); Luis von Ahn launch post ("practice is progress"); duoplanet review (spaced-repetition framing, tree-veteran backlash); Duolingo proficiency whitepaper (2024, post-redesign STAMP 4S outcomes: Intermediate Mid overall). Better Auth client/Protected-route facts: verified registers in docs 05/06.
