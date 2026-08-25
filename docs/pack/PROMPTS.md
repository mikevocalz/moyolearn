# PROMPTS.md — Moyo working prompts

Paste-ready. Angle brackets are the only thing to fill in. Each one is built so the agent's *first move* is to search and confirm rather than write — the single biggest quality lever.

---

## 1 · Session start
> Read `CLAUDE.md`. We're working on `<area>`.
> Before writing anything: `grep -rl "SOT-KEYWORDS:.*<term>" packages apps` to find the relevant files, open only the matches, and tell me the pattern you found and the file you'd extend.
> Do not read directories to get oriented. Do not write code in this message.

## 2 · New screen (Wave 2)
> Build `<S-number> <screen name>` from the brief in `docs/pack/04-screen-briefs.md`.
> We already have the components, tokens, and layout primitives for this — find and use them; only create something new if a search proves it's missing, and tell me what you searched.
> Constraints: mock session only (`useAppSession()`); `<archetype>` archetype; `<hot|cool>` dial; spacing tiers and age-band target tokens, no raw values; one display moment and one highlighter accent; reduced-motion path.
> Deliver: the screen, a story per dial it supports, and screenshots for personas `<X>` and `<Y>` via the RoleSwitcher. Run `pnpm typecheck` before you hand it back.

## 3 · New domain / feature
> Scaffold with `pnpm gen domain <kebab-name>` — do not hand-roll the folders.
> Then implement `<capability>`: repository is the only code touching `@acme/payload`; the service wraps every operation in `protectedOperation` with the resource and action from the permissions registry; identity comes from `ctx`, never from input.
> Before you start, show me the prerequisite chain in order and which existing services/registry entries you'll reuse. Build nothing until I confirm the order.

## 4 · Complex feature (architecture first)
> We're building `<feature>`. Do not write implementation code yet.
> Produce: (1) the sub-features that are features in their own right, (2) a numbered prerequisite chain, (3) the data/state shape, designed for the features we'll have in six months, not just this one, (4) what in the current codebase this should reuse.
> Challenge my ordering if it's wrong.

## 5 · Bug hunt (white-lie method)
> There's a bug in `<area>`: `<symptom>`. I believe the root cause is `<hypothesis>` and that some of the old `<pattern/approach>` is still wired in somewhere.
> First verify whether that's actually true — do not take my word for it. Then find the real root cause and fix it at the root, not the symptom. Tell me if my hypothesis was wrong.

## 6 · Globalize (the gap method)
> Build `<primary concern>`. **Do not** wire `<secondary concern>` yet — create the single source-of-truth `<service/helper>` for it, log to console, and leave a loud marker.
> The point is that `<secondary concern>` will be reused by `<list of other consumers>`, so it must not be entangled with this feature.

## 7 · Design pass
> Here's `<screen>`. Critique it against `docs/pack/08-visual-hierarchy-spacing-spec.md` before changing anything: does it pass the 5-second squint test, is there exactly one display moment and one highlighter accent, do groups sit at `gap-group` and items at `gap-stack`, do targets meet the age-band token, is any emphasis carried by a border instead of size/weight/space?
> List what fails, then fix only what fails.

## 8 · Pre-merge review
> Review this branch as a skeptical senior reviewer who did not write it.
> Check: cross-relationship and cross-tenant reads, identity taken from input anywhere, operations bypassing `protectedOperation`, repository imports outside repositories, missing `server-only`, `any` or `@ts-expect-error`, raw styling values, stubs or unfinished paths, assertion-free tests, narrating comments, duplicated components or types.
> Report findings by severity. Do not fix anything yet.

## 9 · Gap audit
> Find every surface that renders without passing through `protectedOperation` — Payload admin, Stripe hosted pages, Better Auth endpoints, and any route that renders with no server call and can be deep-linked.
> For each: say what a logged-out or wrong-role user sees today, and propose the layout-level guard.

## 10 · Safety check (learner surfaces)
> This touches a learner surface. Before building, confirm against `docs/pack/07-security-child-ai-safety-spec.md`: does any price, paywall, or upgrade prompt render here; does any AI call bypass the Safety Plane; does any tool signature accept an identity argument; does any copy claim feelings, exclusivity, or secrecy.
> If any answer is yes, stop and tell me instead of building.
