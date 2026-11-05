---
name: web-designer-pro
description: >
  Web Designer Pro. Design and build websites, web apps and single
  components at mood-board level, not AI slop: giant type locked with
  photos and colour blocks, cut-outs, cards that break the headline, soft
  lit objects (glowing cards, glass orbs, dusk grounds), depth, one owned
  colour, every section designed. Asks first, takes the user's references,
  generates and directs real photos when an image tool is there (or
  designs without any), explores three directions on the real first
  screen, writes copy that converts, builds production code in the user's
  stack, renders every width, scans for slop, checks Windows, Linux,
  Android, Firefox and Safari, and a critic scores it until it passes. Use
  for "design my website", "landing page", "make my site look premium",
  "this looks AI-generated", "make it look like this", "redesign this
  site", "web app UI", "dashboard design", "a pricing component", or any
  web page or app that should look designed by a top studio.
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, AskUserQuestion, Agent, WebFetch
---

# Web Designer Pro

AI slop is not ugly. It is **the average**: every decision left at its most
likely value. In 2026 that average is tasteful: warm paper, a serif headline
with one italic word in green, a "New" pill, mono labels, a black pill
button. Ask for four unrelated sites and you get that page four times.
Great sites are the opposite: a few **specific, defended decisions**,
executed with craft at every pixel, on every screen size, on every computer.

This skill is a process for making those decisions on purpose and proving,
on the rendered page, that you made them.

**Avoiding slop is half the job.** The first version of this skill avoided
it perfectly and still made flat pages: a headline beside a picture,
pictures drawn in dots, type and hairlines below the hero, a critic that
called it done. Pro adds the other half: **depth, light, directed images
and a bar to measure against** ([finish.md](references/finish.md)).

**What you produce:** `DIRECTION.md` (brief, concept, tokens, content,
signature), a three-direction exploration, the site or app as real code in
the user's project, clean scan and matrix results, a scored critique per
round, and collateral (favicon, social card) when shipping.

`<skill>` below is this skill's folder: `~/.claude/skills/web-designer-pro`
in Claude Code, `~/.agents/skills/web-designer-pro` in Codex (on Windows the
same under `%USERPROFILE%`; forward slashes work in every command below, in
Git Bash, PowerShell and cmd).

**In Codex:** the sandbox blocks the network and can block launching
Chrome or writing outside the project. When `doctor.mjs`, `shoot.mjs`,
`matrix.mjs`, `history.mjs` or a font download fails with a sandbox or
permission error, rerun the same command with
escalated permissions (ask the user once and say why: "to open a headless
browser and render your page"). Generate images with your own image tool
(imagery.md §6), not `image.mjs`.

## The references

Read each when its step needs it, not all up front:

| File | Read before |
|---|---|
| [slop.md](references/slop.md) | Step 1. The four faces of 2026 slop, the overcorrection, the tests |
| [finish.md](references/finish.md) | Step 1, Step 4 and before every critique round. The bar, depth and layering, light done well, owned colour, every section designed, the skill's own rut |
| [kits.md](references/kits.md) | Step 2 and Step 4. The rendered kits in `assets/kits/` (aura components, aura landing, dashboard, poster pages, serif sections): the level to start from, re-skinned, never copied |
| [directions.md](references/directions.md) | Step 2 |
| [type.md](references/type.md), [color.md](references/color.md), [layout.md](references/layout.md) | Step 2 tokens and Step 4 |
| [imagery.md](references/imagery.md) | Step 0 (which image tool, §6), Step 2 (what imagery is honest, how to direct it) and Step 7 (collateral) |
| [copy.md](references/copy.md) | Step 3 |
| [app.md](references/app.md) | any web app, before Step 2 |
| [motion.md](references/motion.md) | the signature in Step 2, and Step 4 |
| [motion-craft.md](references/motion-craft.md) | Step 2 and Step 4: the recipe book for pieces that move (dot matrix, ASCII, 3D objects, engraving, line art, 3D cards, folders, glass, kinetic type, particles), and component briefs |
| [stacks.md](references/stacks.md) | Step 4 |
| [platforms.md](references/platforms.md) | Step 5 (what the matrix checks and why) |
| [critique.md](references/critique.md) | Step 5 |
| [redesign.md](references/redesign.md) | any redesign, before Step 1 |

## Setup (once per machine)

```bash
node <skill>/scripts/doctor.mjs --fix
```

It checks Node 18+, installs `playwright-core` into the skill folder, finds
Chrome or Edge (or installs Playwright's Chromium), and renders a test page.
`--engines` adds Firefox and WebKit for the matrix (optional, about 250 MB).

## Step 0: The brief

Ask before designing. One message, short; skip what the user already said:

1. **What is it, and who is it for?** Site, web app, a single component
   (a hero, feature cards, a menu, a footer, an onboarding modal, pricing),
   or a redesign of something that exists (ask for the URL or the repo).
2. **The one job.** For a site: what should a visitor understand and do in
   the first ten seconds? For an app: what does a user open it to do every
   day?
3. **Three words for how it should feel, and references.** Screenshots of
   sites, Dribbble or Pinterest shots, posters, apps, objects, places,
   films: whatever they love. Ask for one line on what they like in each,
   and one or two they find boring. No references is fine.
4. **What exists:** name, logo, colours, fonts, photos, real copy, real data,
   a codebase and its stack.
5. **Images.** Run `node <skill>/scripts/image.mjs --check` first (in Codex,
   your own image tool is the route), then ask
   plainly, because images decide which directions are possible:
   - "Do you have your own photos (product, place, people, work)? Send
     them. They always win."
   - If no image route was found: "Do you pay for ChatGPT? Then run
     `codex login` in a terminal and sign in with ChatGPT: I can generate
     the photos on your plan, no API key. If not, I'll design without
     photos." Never hesitate to ask this; a photo-led page with no photos
     is the worst outcome.
   - If a route was found: "May I generate about N images with it?"
   **No photos and no image tool** means image-free directions only
   ([kits.md](references/kits.md): aura parts, the dashboard, serif
   sections, type posters). Not stock cut-outs, not drawings in code.

Ask these in **one message**, short, with the defaults you would pick
filled in so the user can just say "yes". Wait for the answers (unless the
user said "just do it"): the questions are the first step of the design,
not a formality.

**Break the references down** (if any) in a `## References` section of
DIRECTION.md: for each one, the moves it makes, in finish.md's terms (the
type and its scale, the colour and where it lives, the layering move, the
imagery and its grade, the shapes and radii, the motion). These are moves
to use, never layouts to copy: no reference's composition, brand or
assets appear on the page. Note what the boring ones share; that is a
default to refuse.

If the user is unreachable or says "just do it", answer these yourself, mark
the brief **self-authored**, and do not spend paid credits. Create a working
folder (or use the project), and write the brief at the top of
`DIRECTION.md`. For a redesign, follow [redesign.md](references/redesign.md)
now. For an app, read [app.md](references/app.md) now.

## Step 1: Know the traps

Read [slop.md](references/slop.md) in full, including **"The
overcorrection"**, and [finish.md](references/finish.md) in full: the bar
you will be scored against, and **the skill's own rut** (§7). Then read the history of looks you have already made:

```bash
node <skill>/scripts/history.mjs show
```

Every row is a look you may not repeat (Step 2). On a fresh machine it is
empty, and the rule starts with your first project.

## Step 2: Direction, by exploration

Read [directions.md](references/directions.md) and
[imagery.md](references/imagery.md).

1. **Find out what imagery you can really get** (the user's assets,
   generation if allowed, the product itself, drawn in code, verified
   photos). Do not design a photo-led page with no photos.
2. **Name the category default you are refusing**: what the top three
   competitors share (structure, palette, type), the category colour cliché,
   and which slop faces this brief would naturally fall into. Write it in
   DIRECTION.md.
3. **Write three concept sentences**, "<Product> is a <thing>.", each from a
   **different source family**. At most one may be paper-and-ink.
4. **Start each from a kit** ([kits.md](references/kits.md)): read the
   nearest kit's HTML and look at its shot, then **render the first screen
   three ways**, one file per concept
   (`explore/a.html`, `b.html`, `c.html`, plain HTML and CSS, real content,
   full craft, not wireframes). Budget it: the first screen only, roughly
   20 minutes each. The point is to compare directions, not to finish them. For a site: the first viewport and the start
   of the second section. For an app: the core screen in a realistic mid-use
   state. The three must differ on **all** of:
   - **ground**: paper (warm off-white), light (white or cool), dark,
     colour field or image (three different),
   - **type**: three different families or designs,
   - **richness source**: photo, illustration, shape, colour-material,
     3D object or live data (three different),
   - **accent hue**: three different hue families,
   - **grammar** (site) or **shell** (app): at least two different,
   - **motion technique** (motion-craft.md §1): three different, and each
     exploration *moves*. A static exploration is a wireframe of a motion
     piece.
   - **depth:** each has three planes and a float that crosses something
     (finish.md §2), at least one leads with depth (directions.md M, N, I,
     J or a layered direction of your own), and together they share at
     most one rut item (finish.md §7). No split heroes.
   - **imagery:** if images will be generated, generate the one hero image
     each exploration needs (or a quick draft of it). Judging a photo-led
     direction with a grey box is judging nothing.
5. **Shoot them** at phone and desktop and look at every PNG:

   ```bash
   node <skill>/scripts/shoot.mjs explore/a.html --widths 390,1440 --out shots/explore-a
   ```

   (repeat for b and c; add `--app` for apps). **Choose.** Write which one
   won and one line on why each of the others lost. The safest one is
   usually the wrong pick: choose the one that is most *this product* and
   most memorable. You may merge; say what came from where.
6. **Check it against the history** (use only the listed words):

   ```bash
   node <skill>/scripts/history.mjs check "<kind>|<source>|<ground>|<type>|<accent>|<richness>|<grammar>"
   ```

   It must differ from every earlier project on at least 4 of the 6 look
   columns. If it does not, go back to step 3. The words: kind `site app` ·
   source `printed object place media nature play` · ground `paper light dark
   colour-field image` · type `serif grotesque expanded condensed rounded mono
   custom-display` · accent `red orange yellow green teal blue violet pink
   neutral` · richness `photo illustration shape colour-material 3d-object
   data` · grammar `scroll-story index poster catalogue document tool-first
   single-screen` (apps: `sidebar topbar canvas command split inbox`).
7. **Write the rest of DIRECTION.md:**
   - **Tokens:** colour roles for light and dark (color.md), type families
     with a one-line reason each, the scale (type.md), spacing, radius
     family, grid and max widths (layout.md).
   - **The richness source** as an art direction (imagery.md §2), and the
     image list: every image the site needs, where it comes from
     (theirs, generated, the product, drawn), and its crop per width.
   - **The layering plan:** the first screen's three planes and its move,
     and the move or image of every other section (finish.md §2 and §5).
   - **Rut items used** (finish.md §7), each with the reason this brief
     needs it.
   - **The grammar** (site: the sections, each with the visitor question it
     answers) or **the shell and density** (app).
   - **The signature**: one moment born from the concept, storyboarded with
     trigger, frames, timing, easing and the reduced-motion version
     (motion.md §3).
   - **Voice:** one line (copy.md).

If the user is reachable, show them the three explorations and your pick
before Step 3.

## Step 3: Content first

Read [copy.md](references/copy.md). In a `## Content` section of
DIRECTION.md, write the exact content of every section or screen before any
layout: every headline, line, label, button, price, name, number and image
subject. Specific, uneven, believable data in a realistic state. For apps,
include the states (app.md §3). Content decides the layout, never the
reverse.

## Step 4: Build it

Read [stacks.md](references/stacks.md). Build in the user's stack, or as a
plain static site if there is none.

1. **Tokens and fonts first** (tokens file, Tailwind `@theme`, or shadcn
   variables rewritten), with metric-matched font fallbacks
   (`node <skill>/scripts/fallback.mjs <font.woff2>` writes them).
2. **The core page or screen**, from the content, at every width. Design the
   phone layout; do not just stack the desktop.
3. **States, dark mode, the signature.**
4. **The other pages or screens.**

**Rules, in the order they usually go wrong:**

1. **The first screen carries evidence, what it is, and the one action** on
   both desktop and phone (layout.md §2).
2. **Richness on the first screen** (imagery.md), directed and graded.
   Type on paper is not richness, and dots are not photographs.
3. **Depth.** Three planes on the first screen and something crossing
   something; a layering move or an image in every section; the phone
   recomposed, not stacked (finish.md §2, §5). Light lives inside objects;
   gradients use neighbouring hues and have an owner (finish.md §3).
4. **No slop face, no rut.** Check the page against the four faces, the
   overcorrection and the skill's own rut; three shared features means
   rework.
5. **Type with a voice and a real scale**; tabular figures where numbers
   align.
6. **One hot colour or an owned palette**, concentrated in objects
   (finish.md §4); status colour only where state lives; every pair measured.
7. **Group with space before boxes**; one radius family; shadows only on
   things that float.
8. **It moves, with intent.** One technique from motion-craft.md carries the
   signature, built to its craft rules (slow loops, eased pointer, a beautiful
   still frame, paused off-screen). Content stays visible without
   JavaScript; everything respects reduced motion.
9. **Accessible by construction**: semantic HTML, labels, names on icon
   buttons, visible focus, 24px+ targets, `lang`, viewport, `color-scheme`.
10. **Never** placeholder images, fake logos, fake testimonials, emoji
   icons, lorem, Acme.

## Step 5: Shoot, scan, matrix, critique

Serve the page the way it runs: a file or folder (served over http by the
script), or the project's dev server URL.

```bash
node <skill>/scripts/shoot.mjs <file | folder | http://localhost:3000/> --out shots/r1          # add --app for apps
node <skill>/scripts/shoot.mjs <same> --out shots/r1-dark --dark --widths 390,1440               # only if it has a dark mode
node <skill>/scripts/matrix.mjs <same> --out shots/r1/matrix
node <skill>/scripts/filmstrip.mjs <same> --selector "<the signature's element>" --out shots/r1/film   # add --click/--hover/--scroll-to for its trigger; --live for canvas/WebGL
node <skill>/scripts/record.mjs <same> --seconds 8 --out shots/r1/video   # the loop: loop.mp4 + poster.jpg (add --move, --scroll, --selector)
```

`shoot.mjs` renders 390, 768, 1280 and 1440 (first screen, plus full pages at
390 and the widest, also sliced into readable numbered screens
`390-full-01.png`…), tiles `sheet.png`, and scans the rendered DOM at every
width: the slop faces' tells, type, colour, contrast (including text over
images, measured on real pixels), clipped/overlapping/wrapped text, sideways
scroll, hidden content, images, icons, copy, accessibility names and a
keyboard focus walk, pictures that collapse on a phone or render as a flat
block, and whether the action is in the first screen. Timer-driven
JavaScript and entrance animations are not finished for you: pass `--wait
<ms>` (longer than the slowest entrance) so a render lands on the state you
mean, not a photo half faded in. `filmstrip.mjs` freezes the signature at exact moments
(and in its reduced-motion state) so it can be judged from a still.
`matrix.mjs` puts the page on Windows (125%, 150%, High
Contrast), Linux, Android, Firefox, Safari/iPhone, a 320px reflow, reduced
motion and translation-length stress (platforms.md). Both exit 1 on any FAIL.

1. **Fix every FAIL. Answer every warn**: fix it, or one line in CRITIQUE.md
   on why it is deliberate. Fix mechanical defects before round 1 goes to
   the critic; the critic is for design, not for bugs the scan already named.
2. **Open every PNG yourself**, not only the sheets: the first screens, every
   numbered full-page slice, every matrix pass with a FAIL, the filmstrip. The
   scan catches mechanics; your eye catches design (a thumbnail gone black,
   an illustration missing on the phone).
3. **Run the six tests** in slop.md §9.
4. **Run finish.md §10** (the checklist before every round) and fix what
   it finds.
5. **Score it** with [critique.md](references/critique.md). If you can
   spawn an agent (Claude Code's Agent tool, a Codex sub-agent), spawn
   **one** critic for the whole job, brief it as critique.md says, and wait
   for its scores before editing. In Codex without sub-agents, run the
   critic as a fresh session (critique.md, "In Codex"). Only if neither
   works, score it yourself, harder than feels fair. Write scores and
   findings to `CRITIQUE.md`.

## Step 6: Iterate

Fix what the critique found, shoot into a new folder (`r2`, `r3`), compare.
**At least two rounds, at most four.** Done, plateau and budget are defined
in critique.md. Once done, **go for 5** if there is time: up to two more
rounds on the critic's "change that would make it a 5" list. Always end with no FAILs and every warn answered.

When you stop, record the look so the next project cannot repeat it (`add`
re-checks: another project may have been recorded while you worked; if it
refuses, change the look or record it with `--force` and a reason in
DIRECTION.md):

```bash
node <skill>/scripts/history.mjs add "<project>|<kind>|<source>|<ground>|<type>|<accent>|<richness>|<grammar>"
```

## Step 7: Ship

- **Collateral** (imagery.md §5), in the site's root: `favicon.svg`,
  `apple-touch-icon.png` (180), `icon-512.png`, `og.png` (from `og.html`
  shot with `--widths 1200 --height 630 --scale 1`), and a `<title>` and meta
  description written in the voice.
- **Performance basics**: hero image preloaded and sized, fonts preloaded and
  subset, nothing large below the fold loaded eagerly, no layout shift.
- **Hand-off**: where the tokens live and how to add a page that matches.

## Hard rules

| Never | Instead |
|---|---|
| Committing to a direction without rendering three | Step 2: three grounds, three type families, three richness sources |
| The Paper Edition: warm paper, serif headline with an italic green or vermilion word, "New" pill, mono eyebrows, black pill + ghost pill | slop.md face 1. Name it in DIRECTION.md and refuse it |
| The template sequence: pill, hero, logos, features, bento, testimonials, three-tier pricing, FAQ, CTA band | A grammar from the visitor's questions, four to six sections |
| A row of KPI cards as the first thing in an app | The work owns the screen; numbers as one quiet line |
| The overcorrection: off-white, giant type, numbered mono labels, coordinates and a clock, one rust accent, no images | A richness source on the first screen |
| Repeating a row of the history | Differ on 4 of 6 look columns |
| Indigo gradients, gradient text, glows on buttons, a blurred orb behind the headline, dot grids | Light inside objects, crafted gradients with an owner (finish.md §3) |
| The flat page: headline beside a picture, nothing touching; type and hairlines below the hero | Three planes and a float; a move or an image in every section (finish.md §2, §5) |
| Pictures drawn in dots or simple shapes where photos were needed | Generated and directed images, the user's photos, or drawing at product quality (imagery.md §6) |
| This skill's own rut: red accent, dark + condensed, tool-first, split hero, dot-matrix | At most two, each with a written reason (finish.md §7) |
| Six status colours doing six jobs | One hot colour, or an owned palette where each hue belongs to one object |
| Default-reach fonts as an unexamined choice | A face with a written reason (type.md) |
| Boxes inside boxes; one radius on everything | Space and hairlines; a radius family |
| Content hidden until JavaScript reveals it | Visible by default; motion as enhancement |
| Placeholder images, stock avatars, fake logos or testimonials, Acme, lorem | Real assets, art-directed generation, or a designed field |
| Emoji as icons, ✨ for AI, marketing words, two-beat aphorism headlines | copy.md |
| Checking only on your own Mac | matrix.mjs: Windows, Linux, High Contrast, Firefox, Safari, l10n, reduced motion |
| Grading your own work and calling it done | One continued critic, critique.md's stop rule |

## Report

Short: the three concepts and why two lost, the images generated (tool,
count) or supplied, the category default refused,
the grammar or shell, the signature, paths to the latest `sheet.png` files
(shoot and matrix), scan and matrix results, rubric scores per round and
what changed between rounds, and what you could not verify (glyph shapes and
ClearType on real Windows, real devices, screen readers, real performance).
Say if the brief was self-authored. For a redesign: the before/after, the
keep list checked off, and the decisions the user needs to make.
