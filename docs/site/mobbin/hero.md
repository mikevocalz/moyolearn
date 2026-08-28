# Mobbin pass: hero

Chapter 1 of the Moyo marketing site. Target moves: full-viewport editorial type hero; a photographed object overlapping or breaking the type; a character sitting *behind* typography with real depth; three-door CTA stacks (primary / secondary / a visibly-different third door for kids).

**Structure only.** Nothing below is a style, palette, or type recommendation — Moyo's tokens own those. Every row is one compositional move.

## Adopted

| App | Link | Structural move adopted |
| --- | --- | --- |
| SSENSE | [section](https://mobbin.com/sites/sections/4de98a06-dbff-4e54-83c6-a301c519bba0) | The headline is set so large it wraps to a ragged second line, and the only control is a small outlined button roughly one-eighth its height — the size gap alone establishes that the sentence, not the button, is the hero. |
| NEON | [section](https://mobbin.com/sites/sections/1d1863b3-a450-4317-9765-12ae9994db64) | The viewport is split into an image half that bleeds off the left edge and a flat colour half holding three stacked condensed lines, so the photograph and the type are peers instead of type-over-image. |
| Oryzo | [section](https://mobbin.com/sites/sections/9d67f8ac-8069-4a4b-999a-8ae18e7debf0) | A single photographed object is placed dead-centre at enormous scale and the headline and the body paragraph are pushed to the left and right margins, making the object the vertical axis the copy hangs off. |
| MasterClass | [section](https://mobbin.com/sites/sections/8d2a4681-cdad-4b4b-bc6e-83fd0be35983) | The two headline lines are different lengths, and the photo tile is slotted into the notch the shorter line leaves — the image is placed into the type's negative space rather than beside or behind it. |
| The New Yorker | [section](https://mobbin.com/sites/sections/03ca30cc-a924-4eb8-baa8-977472e22098) | The subject enters from the right edge and its wing and the object it carries cross out of the image area entirely, so the depth read comes from an element *escaping the frame*, not from a drop shadow. |
| COLLINS | [section](https://mobbin.com/sites/sections/321fcd6b-4945-4a1a-b2c5-6f0d6bfad8f4) | Physically-made lettering fills the whole canvas as the background layer, and the actual kicker / headline / CTA stack sits small and quiet in the lower-left third — the loud type is scenery, the readable type is a footnote on top of it. |
| Runway | [section](https://mobbin.com/sites/sections/1fcb7257-0639-4121-b5c3-74491b005663) | Display type is dropped almost to the value of the background so it reads as embossed surface texture, and one small hard-edged info card pinned bottom-left carries every actual word the visitor needs. |
| Koto | [section](https://mobbin.com/sites/sections/c2512198-ddc8-43aa-bac7-2a47cd359aac) | One word, centred, on an otherwise empty flooded field — proof that a hero can carry exactly one idea and that the emptiness around the word is what makes it land. |
| Oatly | [section](https://mobbin.com/sites/sections/55f94117-780b-451c-94f4-880f8943ba29) | The headline is a deliberately unfinished sentence ("So you're wondering about…") and three hard rectangular cells directly beneath it each complete it differently — the three doors are grammar, not decoration, so choosing one feels like finishing a thought. |
| Craft | [section](https://mobbin.com/sites/sections/4e363497-beed-4917-9f40-2ddee269fb2c) | Three CTAs sit on one row in three visibly different treatments (solid accent, solid dark, outline) so hierarchy is carried by fill weight rather than by position or size. |
| Linktree | [section](https://mobbin.com/sites/sections/2e4c40b8-7bf9-42ba-9d84-474dc0493871) | A single primary CTA sits immediately under the headline and the three audience doors are demoted to a card row *below* it — the generic path is offered first, the self-identification path second, so nobody is forced to classify themselves to proceed. |
| Poly | [section](https://mobbin.com/sites/sections/c107bf8e-31f4-450c-9f69-aabc31474fcb) | Real objects are photographed scattered on a physical surface as the entire hero, with the navigation collapsed into one small segmented control docked at the bottom — the desk *is* the hero, the chrome gets out of the way. |

## Refused

| App | Link | Pattern | Why refused |
| --- | --- | --- | --- |
| Webflow | [section](https://mobbin.com/sites/sections/52e34f14-9964-42cd-87d3-3c30af769b4d) | Portraits shrunk to circular chips inline inside the headline | It makes people punctuation. Our brief wants a character with real depth *behind* the type; an inline avatar has no z-position at all, and the circle-crop reads as a generic testimonial affordance. |
| Framer | [section](https://mobbin.com/sites/sections/73f07182-e7dc-4b1e-a818-abf1674e93e6) | Floating rounded product screenshots on a dark field with a saturated blue-to-pink gradient card | Two hard-avoids in one frame — gradient panel and fake-dashboard product chrome — and the floating cards have no ground plane, so the "depth" is decorative rather than physical. |
| Phantom | [section](https://mobbin.com/sites/sections/6bfcc47b-94e6-4c1d-909a-654eaae7257e) | Centred headline on a purple glow blob with two pill CTAs | Purple AI-adjacent glow is explicitly out, and two soft pills give no third door and no readable difference between the primary and the secondary. |
| FLORA | [section](https://mobbin.com/sites/sections/34d18078-910f-46c9-8c6d-291d5b260440) | Tiny centred one-liner with a small button and a bare text link | The hero is under-scaled to the point of having no display moment, and the "book a demo" text link is so much weaker than the button that it reads as a hidden second door — the opposite of a legible three-door stack. |
| Büro | [section](https://mobbin.com/sites/sections/45f8be1e-0f49-41f9-b2f9-07123f5af447) | Cartoon characters composited standing in front of a real team photo | This is the exact adjacency we must avoid: illustrated figures pasted over photography slides straight into kindergarten clip-art territory and undercuts the "real teaching happens here" claim. |

## Queries used

- `search_sections`: "hero section with oversized editorial display typography filling the viewport and a photographed object overlapping the letterforms"
- `search_sections`: "hero where a person or character is layered behind the headline text so the type overlaps the subject creating depth"
- `search_sections`: "hero with three distinct entry buttons for different audiences, one primary call to action and a visibly different third option"

**MCP note:** the second query drifted toward "photo with type near it" rather than true type-over-subject occlusion; the New Yorker and MasterClass results are the closest real depth moves the index returned. One returned Studio Freight section rendered as a blank/loading frame and was discarded rather than guessed at.
