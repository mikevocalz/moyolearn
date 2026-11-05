# Imagery and richness

Every page carries a **richness source** on its first screen: something to
look at that belongs to this product. Type on paper is not one.

## 1. What imagery can you honestly get?

Decide this before the directions (SKILL.md Step 2), so you do not design a
photo-led page with no photos.

1. **The user's own assets**: product photos, the shop, the team, the
   building, screenshots, brand illustrations. Always first. Ask for them.
2. **Generated images**, through whatever image tool this machine has
   (§6), if the user agreed to spend credits. One art direction for the
   whole set (camera, light, distance, grade, palette), written in
   DIRECTION.md before the first prompt. Never generate fake customers,
   fake team members, fake reviews or photos presented as a real place.
3. **The product itself**: real UI built in HTML at full fidelity, real data,
   real states. For software this is often the strongest image there is.
4. **Drawn in code**, at product quality (finish.md §6): SVG illustration
   in one hand, CSS materials, a colour field, a three.js object. This is
   the last resort for imagery, not the default: in testing, dot-matrix
   bread and code-drawn "films" made pages look cheap.
5. **Data as image**: a map, a chart, a timetable, a big number, if the data
   is real.
6. **Verified photos** from a source with a licence (the user's library,
   Unsplash with the photographer credited, Wikimedia Commons with the
   licence checked). Load every URL to verify it before using it, and
   download the ones you use into the site's assets rather than hotlinking.
   On Commons, `https://commons.wikimedia.org/wiki/Special:FilePath/<File name>?width=1600`
   returns a resized file directly (raw thumbnail URLs often answer 400).

### When the category is photo-led and there are no photos

Architects, restaurants, hotels, fashion, products: these are sold by
photographs, and inventing them is dishonest. In order of preference:

1. **Ask for them.** Even phone photos of real work beat any illustration;
   design the frames so their crop and grade make them look intended.
2. **Generated imagery**, only if the user agrees and only for atmosphere,
   never presented as their real work, place or people.
3. **The artefacts of the work**: drawings, plans, sections, material
   samples, menus, fabric swatches, recipes, receipts. Real, specific, theirs.
4. **Type and colour carrying the page** (directions F and D), with photo
   frames designed to receive the real photos later and captioned honestly.

Watch for the drift into generic illustration: isometric buildings on a
pale ground read as 2018 SaaS art, however well drawn.

## 2. Art direction

Write it like a brief to a photographer or illustrator:

- **Photography:** subject, distance (macro, table-top, room, landscape),
  light (window light at 8am, flash at night, overcast), lens feel, grade
  (warm and lifted, cold and crushed), what is never in frame.
- **Illustration:** one hand, one line weight, one palette, one level of
  detail, used everywhere.
- **Shape language:** the motif from the concept (the tide line, the
  ticket stub, the arch of the warehouse door), used for dividers, masks,
  buttons and loaders.

## 3. Banned

The unDraw person, the 3D glossy blob, the gradient mesh as personality, the
generic laptop-and-latte stock, the greyscale logo wall, placeholder
services (placehold.co, picsum, pravatar, source.unsplash.com) **[scan]**,
broken image URLs **[scan]**.

## 4. Craft

- Modern formats (AVIF, WebP) with `srcset` and `sizes`; the hero image is
  preloaded or `fetchpriority="high"`; everything below the fold
  `loading="lazy"`.
- `width` and `height` attributes, or `aspect-ratio`, on every image, so
  nothing jumps **[scan]**.
- Art-direct crops per breakpoint with `<picture>` when the subject would
  be lost on a phone.
- `alt` that says what the image shows and why it is there; `alt=""` for
  decoration **[scan]**.
- Text over images: measured by the scan; use a scrim or a band when it
  fails.

## 5. Collateral (Step 7)

The same direction carries to the small things people see first:

- **Favicon set:** an SVG favicon that works on light and dark tabs
  (`prefers-color-scheme` inside the SVG, or a shape with its own ground),
  plus a 180px `apple-touch-icon` and a 512px PNG for the manifest.
- **Social card:** `og.html` at 1200×630, built from the tokens, kept inside
  the site folder (the script serves only the file's own folder, so a link to
  `../site/styles.css` would 404), rendered with
  `shoot.mjs site/og.html --widths 1200 --height 630 --scale 1 --no-scan`. Real headline,
  real image, readable at thumbnail size.
- **Email header, README hero, slide cover**: same tokens, same type.

## 6. Generating images

Pro makes real images when it can. Version one drew everything in code, and
that was the main reason its pages felt cheap.

### Find the tool

`scripts/image.mjs` does the finding and the generating:

```bash
node <skill>/scripts/image.mjs --check     # which route this machine has
node <skill>/scripts/image.mjs --prompt-file prompts/hero.txt --out site/assets/hero.png --aspect landscape
node <skill>/scripts/image.mjs --prompt "<...>" --out site/assets/bun.png --aspect square --transparent   # a cut-out
```

**Inside Codex** (you are Codex): do not run `image.mjs`, which starts a
second Codex. Use your own image generation tool with the same prompt,
then copy the file it saved (in `~/.codex/generated_images/<session id>/`)
to the target path. Everything below about directing images still holds.

Elsewhere, it uses, in order:

1. **Codex signed in with a ChatGPT plan.** GPT Image on the user's own
   subscription, no API key, about a minute per image. Most people who
   pay for ChatGPT have this without knowing it (`codex login`).
2. **`OPENAI_API_KEY`**: the OpenAI Images API (GPT Image).
3. **`AI_GATEWAY_API_KEY`**: Vercel AI Gateway (paid credits only).
4. **An image tool connected to the agent** (an MCP server or plugin):
   use it directly if `--check` finds no route and the tool is there.
5. **None:** ask the user for their own photos (best anyway), and tell
   them that a ChatGPT plan plus `codex login` unlocks generation. If they
   have neither, design **without images** (kits.md lists the image-free
   kits). Do not fill the gap with stock cut-outs or drawings in code.

### Cut-outs from the user's own photos

On a Mac (macOS 14+), `swift <skill>/scripts/cutout.swift <photo> <out.png>`
lifts the main subject with Apple's Vision framework (the same model as
"lift subject" in Photos), hardens the edge and crops to the subject, in
seconds, offline. Use it on the user's own photos only. Check the edge at
200% on the colour it will sit on; hair, spokes and glass often fail. If
the edge isn't clean, don't use the cut-out: use the photo whole, or ask
the user for one shot on a plain background. On Windows and Linux, point
the user to "lift subject" on an iPhone or remove.bg.

`--transparent` asks for a PNG with alpha: that is the cut-out the layering
moves need (type behind the subject, a subject on a colour block). Check
the alpha by eye on a coloured ground before building on it.

Every generation costs the user something (plan limits or money). Say which
route and roughly how many images (usually 3 to 8 for a site) and get a
yes at Step 0. If the brief is
self-authored and nobody answered, do not spend credits.

### Direct it like a shoot

Write one **art direction** in DIRECTION.md before the first prompt, and
reuse it word for word in every prompt so the set looks like one shoot:

```
<subject, specific: "a sourdough loaf with a dark, blistered crust, scored with one long ear">,
<setting and distance: "on a steel bakery rack, close, three-quarter view">,
<light: "single window light from the left, early morning, deep shadows">,
<lens and grade: "50mm, shallow depth of field, fine film grain, slightly desaturated, warm shadows, cool highlights">,
<composition: "subject in the right third, empty dark space on the left for a headline">,
no text, no logos, no hands unless stated
```

- **Composition is for the layout:** ask for the empty area where the
  headline will sit, the crop the phone needs, a subject that can be cut out.
- **Cut-outs:** generate the subject on a plain contrasting background,
  then remove the background (most image tools have a remove-background
  call; otherwise ask for a plain backdrop and mask it in CSS or SVG). Save
  as WebP or PNG with alpha. Cut-outs are what let type sit behind a
  subject and a subject stand on a colour block (finish.md §2).
- **One grade for the set**, finished in CSS where possible (a shared
  `filter`, a grain overlay, a colour cast with `mix-blend-mode`), so new
  images later match.
- **Look at every image at full size** before using it: hands, text,
  extra fingers, warped objects and plastic skin mean regenerate. Two or
  three tries per image is normal.
- **Save into the site's assets**, converted to WebP or AVIF at the sizes
  used, with `width` and `height` set. Never hotlink a generation URL: they
  expire.

### Honesty

- Atmosphere, objects, materials, products the user really sells, abstract
  scenes: fine.
- People presented as customers, staff or reviewers; a place presented as
  the user's real shop; work presented as the user's real portfolio: never.
  For a portfolio or a shop, generated images are placeholders for the
  real ones, and the report says so.

