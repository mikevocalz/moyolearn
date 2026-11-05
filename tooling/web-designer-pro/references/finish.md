# The finish

A page can make every right decision and still look like a wireframe with
good fonts. What separates it from the sites people screenshot is the
**finish**: depth, light, owned colour, things that overlap and cross
edges, images that were directed. This is where the last point on every
rubric line is won, and where AI design is weakest: it either paints
everything (purple gradients, glows) or, told not to, paints nothing.

The first version of this skill painted nothing. Four test briefs (an
invoicing SaaS, a bakery, a motion designer's portfolio, a household money
app) all passed its critic and all came out **flat**: a headline on one
side and a picture on the other, nothing touching; pictures drawn in dots;
thousands of pixels of type and hairlines below the hero. Correct, and
forgettable. This file is the cure.

Read it before Step 2, before Step 4, and again before every critique round.

## 1. The bar, taken apart

The bar is the work people save to their mood boards. Two families keep
coming back, and they share more than they seem to.

### The poster family

Giant type is the image, and it is **locked together** with a photo or a
colour block instead of sitting next to it.

- **A staggered headline broken by a card.** Words set at 120 to 200px,
  each line offset to its own column, and a saturated card (the one hot
  colour) laid over the middle of it, cutting a word. The card carries the
  real content: a line of copy and a link. The word it covers stays
  readable because the reader completes it.
- **Letters over a face.** A condensed, ultra-heavy word in red across a
  portrait on a cobalt ground; the face shows between and behind the
  letters. Small edge labels (credits, a date, "scroll down") in the four
  corners like a magazine cover.
- **An object sitting on the word.** A huge black word on white with a
  small square photo placed over one letter, as if dropped there; a clean
  table of rows underneath.
- **A cut-out on a colour block.** A photo with its background removed (a
  person in a jacket, a gloved hand), standing on a block of the hot colour
  that is cropped by the frame; the subject breaks out above the block. A
  short brand word, very large, sits in the empty corner. Tiny technical
  labels, one vertical line of text, one square arrow button in the colour.
- **Half photo, half colour.** A grainy, desaturated landscape photo on
  the top half, a flat red field on the bottom half, the headline in two
  parts, one on each, in the opposite colour.

What makes them work: **one hot colour** (a red-orange, never a polite
one) on a neutral (grey, white, black, cobalt), **scale contrast** of 20:1
between the headline and the labels, **grain** on the photo, and **one
thing crossing another** on every screen.

### The aura family

Soft, lit objects you want to touch, on calm grounds.

- **Squircle cards lit from within.** Large-radius cards (28 to 40px),
  each in its own hue (rose, sage, magenta, cobalt, rust), with a dark or
  bright radial glow **inside** the card, as if light sits under the
  surface. A big light number (84, 100%, 6.8%) with a smaller unit. One
  tiny precise detail per card: a dot-matrix numeral, a slider with a
  yellow pointer, a row of dots. The card grid floats over a defocused
  photograph of a person.
- **A glass orb.** A sphere with a dusk gradient inside it (navy at the
  top, an amber-and-ember horizon, a dark core), a thin bright rim, a soft
  specular highlight; a state word inside ("Scanning yield..."). Next to
  it a white pearl orb holding the main number. Below, rows as tall dark
  pills, the selected one lifted in a lighter grey.
- **Dusk grounds.** The page background is a sky: slate blue at the top
  fading through a warm horizon to near-black. The interface sits on it
  as a black or white panel with big radii.
- **Grey pills and fading mono text.** A recorder card in mid-grey with a
  silhouette photo thumbnail, a red dot, a thin progress bar; a mono
  transcript under it that fades out at the top with a mask. A big black
  pill button. One orange-red radial glow used as the only colour.

What makes them work: the colour lives **inside objects** (never floating
behind the page), **gradients use neighbouring hues** with light from one
side, radii are generous and concentric, and there is always a **photo
somewhere** (a silhouette, a defocused figure) so it never feels like a
component library.

### What both families share

1. **Depth.** At least three planes on the first screen: a ground, a
   subject, and something that floats over or crosses the subject.
2. **One hot colour against neutrals,** or an owned palette where each hue
   belongs to one object. Never six hues doing six jobs.
3. **Photography, directed:** grain, desaturation, silhouettes, cut-outs,
   defocus. Never a stock photo used straight.
4. **Scale contrast:** the big thing is enormous and the small things are
   tiny and precise.
5. **Every screen has one thing you would point at.**

These are the bar, not the style. The brief decides the direction; a
bakery is not a fashion poster. But whatever the direction, the result has
to sit next to these and not look flatter, cheaper or emptier.

## 2. Depth and layering

### Three planes

Plan every first screen, and every major section, in three planes:

| Plane | What it is | Examples |
|---|---|---|
| Ground | The field everything sits on | a colour, a dusk gradient, a full-bleed photo, a grain texture |
| Subject | The thing the section is about | the headline, the product, a cut-out, a photo |
| Float | What crosses or sits on the subject | a card over the headline, an object crossing the section edge, a label on the photo, a chip over a screenshot |

A section with only a ground and a subject is a layout. The float is what
makes it a composition.

### The moves

1. **Card breaks the headline.** A content card (the CTA, a fact) laid over
   the middle of a staggered display headline.
2. **Type behind the subject.** The headline sits behind a cut-out (a
   person, a product) so the subject overlaps the letters. Built with a
   second, cut-out copy of the image over the text, not by painting text
   into the image: the headline stays real, selectable text.
3. **Type over the photo.** Letters cross a portrait or a landscape, with
   contrast measured on the real pixels (the scan does it).
4. **Object crosses the edge.** The product, a card or an illustration
   bleeds over a section boundary or past the frame, so the next section
   is already in view.
5. **Cut-out on a colour block.** A subject with its background removed,
   standing on a cropped block of the hot colour, breaking out above it.
6. **Stack and fan.** Cards in a pile or a fan with real offsets and
   rotation, the front one readable.
7. **Perspective rail.** A row of cards turned in 3D on a dark ground, the
   centre one flat and lit, the outer ones rotated away and dimmer.
8. **Lit object on calm UI.** One glass orb, one glowing card, one 3D object
   in an otherwise quiet interface.

At least one move on the first screen; a different move in at least two
other sections.

### Recipes

```css
/* Card breaks the headline: the card is a sibling, positioned over it. */
.hero { position: relative; display: grid; place-items: center; }
.hero h1 { font-size: clamp(56px, 11vw, 200px); line-height: .88; letter-spacing: -.035em; }
.hero h1 span { display: block; }
.hero h1 span:nth-child(2) { padding-left: 18%; }
.hero h1 span:nth-child(4) { padding-left: 34%; }
.hero .card { position: absolute; left: 42%; top: 38%; width: min(320px, 70vw);
  background: var(--hot); color: var(--on-hot); padding: 24px; }

/* Type behind the subject: same image twice, the cut-out copy on top. */
.portrait { position: relative; isolation: isolate; }
.portrait .photo  { position: absolute; inset: 0; z-index: 0; }  /* full photo */
.portrait h1      { position: relative; z-index: 1; }
.portrait .cutout { position: absolute; inset: 0; z-index: 2; pointer-events: none; } /* PNG/WebP with alpha */

/* Object crosses the edge into the next section. */
.feature .object { margin-bottom: calc(var(--overlap) * -1); position: relative; z-index: 2; }
.next { padding-top: calc(var(--overlap) + var(--s-6)); }

/* Grain over a photo or a colour field (SVG noise, no download). */
.grain::after { content: ""; position: absolute; inset: 0; pointer-events: none; opacity: .14; mix-blend-mode: multiply;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }
```

### Telling the scanner what is deliberate

Two attributes keep the scan from undoing the moves above: `data-wd-float`
on an element laid over type on purpose (the card that breaks the headline,
the cover dropped on the word), and `data-wd-crop` on a word cropped by the
frame on purpose (the giant word cut by the bottom of the screen). Use them
only on those. Giant display type (160px and up) over a photo or a colour
may dip below 3:1 on part of its ground and gets a warning, not a failure,
if most of it reaches 2:1: check the render. Everything smaller keeps the
full contrast rules.

### Layering on a phone

The phone is where layering dies: the easy answer is to stack headline,
then picture, then card. Do not. Recompose for 390px:

- The staggered headline keeps two offsets, not four; the card overlaps
  its lower half instead of its middle.
- Type over a photo stays over the photo; the photo grows taller and the
  headline sits on its quietest area (with a scrim if the scan asks).
- A cut-out on a block: the block becomes full-width, the subject stays
  breaking out above it, the brand word moves under it.
- An object crossing the edge still crosses it, smaller.
- A perspective rail becomes a swipeable row with the centre card at 78%
  of the width and its neighbours peeking.

The scan warns on a **split hero** (headline on one side, picture on the
other, nothing overlapping). It is allowed only with a written reason in
DIRECTION.md; it was every first screen this skill made before this file
existed.

## 3. Light and gradients: crafted, not generated

| The AI gradient | The crafted gradient |
|---|---|
| Indigo to violet, on the hero, the buttons, the background | Neighbouring hues (amber to ember, rose to plum, sky to cobalt) or one deliberate aura |
| Saturated end to end | Stops close in lightness, light from one side |
| On everything, so it means nothing | On an object that owns it: a card, an orb, a badge, a ground with a time of day |
| A blurred colour blob floating behind the headline | Light **inside** an object, or a scene (a sky, a defocused photo) |
| A glow around a button | No glow on controls, ever. The button is solid. |

Recipes (change the hues to your palette; never paste these values):

```css
/* An aura card: light under the surface, neighbouring hues, ink or white by contrast. */
.aura {
  border-radius: 36px; color: #fff; overflow: hidden;
  background:
    radial-gradient(60% 70% at 50% 60%, rgba(10,8,20,.75), transparent 70%),
    linear-gradient(160deg, #5C4A63, #C9727A);
}

/* A glass orb with a dusk inside it. */
.orb {
  aspect-ratio: 1; border-radius: 50%;
  background:
    radial-gradient(45% 30% at 50% 70%, #120E14 0%, #120E14 40%, transparent 70%),   /* dark core */
    radial-gradient(70% 40% at 50% 68%, #E8783A 0%, transparent 70%),                 /* ember horizon */
    linear-gradient(180deg, #2E3555 0%, #556A8C 45%, #C9B9A6 62%, #1A1820 100%);      /* sky */
  box-shadow: inset 0 0 0 1.5px rgba(255,255,255,.55), inset 0 24px 48px rgba(255,255,255,.18), 0 30px 60px -30px rgba(0,0,0,.6);
}

/* A dusk ground for a whole page or section. */
.dusk { background: linear-gradient(180deg, #3B4766 0%, #6E7C99 38%, #C79A7E 52%, #2A2630 70%, #0E0D10 100%); }

/* A pearl orb: white, lit from the top left. */
.pearl { border-radius: 50%; background: radial-gradient(80% 80% at 30% 25%, #fff, #E9E9EC 55%, #BDBDC4 100%);
  box-shadow: 0 30px 60px -30px rgba(0,0,0,.5); }

/* Text fading out at the top (a transcript, a list running under a header). */
.fade-top { -webkit-mask-image: linear-gradient(to bottom, transparent, #000 35%); mask-image: linear-gradient(to bottom, transparent, #000 35%); }
```

- Prefer gradients to `filter: blur()`: a blurred 800px element costs
  real frames on a cheap laptop. Use `backdrop-filter` only on small
  floating pieces (a nav, a chip), never on a full section.
- Never gradient text. Never a glow on a button or a link.
- Text on an aura or a photo is measured on real pixels by the scan.
- In Windows High Contrast, gradients and shadows disappear; the object
  still needs a border (`forced-colors` rules, platforms.md).

## 4. Colour that is owned

- **The one hot colour.** A red-orange, a cobalt, a chartreuse: saturated
  and used at full strength on few, large things (a card, a block, a word).
  Around it, neutrals with a temperature (cool grey, bone, near-black).
- **Or an owned palette.** Each hue belongs to one object or one person (a
  card per metric, a colour per housemate). Five hues are fine when each
  has an owner; the scan warns, and DIRECTION.md answers it.
- **70 / 20 / 10.** About 70% calm ground and surfaces, 20% ink and neutral
  detail, 10% saturated colour concentrated in objects.
- **Dark mode keeps the colour at full strength** and lowers the surfaces,
  so the objects glow.

## 5. Every section designed

The hero is not the page. In testing, every v1 page was rich for one
screen and then became type and hairlines for 5,000 to 9,000 pixels.

- **Each section gets its own composition move** (§2) or its own image.
  Write it per section in DIRECTION.md: "Section 3: the pricing card
  breaks the headline 'One price'".
- **Never more than two consecutive sections of type and rules only.**
- Moves that work below the hero: a full-bleed photo band with a word
  across it; one enormous number with a tiny caption; a cut-out crossing
  into the next section; a horizontal rail of objects; a poster break (one
  line of type, one colour, the whole viewport); the product in a real
  context; a pinned object that changes as the text scrolls past.
- A list is still allowed, when the content is a list. Give it a thumbnail
  of its own object per row, or let one row open into a big image.

## 6. Images that were directed

- **Generated or supplied photos get a grade:** one treatment for the whole
  site (grain, a desaturation, a colour cast, a crop rule). Written in
  DIRECTION.md before the first image.
- **Cut-outs** (background removed) are what let a subject sit on a colour
  block or in front of type. Most image tools can remove a background;
  imagery.md says how.
- **Drawn in code is the last resort, at product quality:** one light
  source, one shadow style, real detail at the size people see it,
  silhouettes that read at 40px. Dots, ASCII and simple SVG shapes are a
  technique for one signature, not a substitute for imagery. In testing,
  bread drawn in dots read as cheap, and "films" drawn as a battery and a
  waveform read as infographics.
- **The work is the page** for portfolios, shops, restaurants and
  architects: if the real images are missing, ask for them before
  designing (imagery.md).

## 7. The skill's own rut

Every anti-slop process grows its own average. In testing, this skill
reached for the same things again and again:

- a **red or red-orange accent** (three briefs out of four),
- a **dark ground with a condensed display face** and a **tool-first**
  page (twice),
- the **split hero** (every time),
- **dot-matrix or ASCII** drawing as the richness,
- **hairline-ruled lists** below the hero.

Each is fine once, with a reason. In DIRECTION.md, list which of these the
chosen direction uses and why this brief needs it. Three or more is a
rework. The three explorations in Step 2 may share at most one.

### The Claude look: never

These came back in testing even with every rule above, and the person
paying for this skill called them out by name. They are banned outright:

- **The white receipt.** A white rectangle of label/value rows ("Model …
  PX 125", "Price … €3,900") set on a colour field or a photo, as a
  "spec card", "order card" or "ticket". It reads as generated instantly.
  Put the facts in the page's own type and layout, or in a kit component
  (an aura card, a pill row, a table that spans the page).
- **Tilted cards.** A card or paper slip rotated a few degrees to look
  casual. Rotation is allowed only for real photographs in a fan or a
  pile, where it shows they are many (a lookbook, a team), never for UI.
- **The default poster.** A big grotesque headline beside a picture with a
  card laid over a colour block. If you can't say which kit or which
  reference a composition came from, it came from the habit.
- **Drawings standing in for photos.** Dots, ASCII, simple SVG loaves,
  infographic "films".
- **Stock cut-outs.** A found photo cut out with a halo, pasted on a
  block. Cut out only the user's own or generated images, check the edge
  at 200% on a coloured ground, and drop it if it isn't clean.
- **Default faces.** Inter, Space Grotesk, Bebas Neue, Anton, Playfair
  as unexamined first picks. Every face needs its written reason
  (type.md).

## 8. The stranger test

Every element must make sense to someone who never read DIRECTION.md. The
concept should be **felt** (in the material, the colour, the type, the
motion), not **illustrated** with props that need explaining. A symbol in
a corner, a giant letter, an object that only means something once you
know the concept: cut it, or make it carry real information.

## 9. The polish pass

Do these before the critic asks; they are what turned 4s into 5s in
testing:

1. **Give every decoration a job.** A drawing that also informs (the orb
   shows the state, the card shows the number) scores higher than one that
   only decorates.
2. **Real objects instead of generic glyphs.** If a row has an icon, make
   it a thumbnail of its own thing.
3. **Display face for display only.** Body, labels and UI in the text
   face; tune tracking at every display size; check that punctuation
   clears the next glyph at 120px.
4. **Spacing that groups:** tight inside a group, a visible break between
   groups, and labels aligned to the same few verticals as the headline.
5. **Specific copy everywhere,** not only in the hero.
6. **Small details at the size people look at:** the edge labels, the
   units, the arrow in the button, the hairline at 8% ink, not 1px of
   mid-grey.
7. **The phone keeps the composition** (§2), not just the content.
8. **Every state designed:** hover says what clicking does, focus is
   visible on every ground (also on the hot colour), pressed is instant.

## 10. Before every critique round

- Three planes on the first screen, and a float that crosses something?
- A layering move in at least two other sections; never more than two
  plain sections in a row?
- Is the colour concentrated in objects that own it?
- Do the gradients use neighbouring hues, light from one side, and an owner?
- Are the images directed (one grade, cut-outs where type meets subject)?
- How many of the rut items (§7), and is each one written up?
- Would a stranger understand every element?
- Put the first screen next to the bar in §1 in your head. If it looks
  flatter, cheaper or emptier, it is not done.
