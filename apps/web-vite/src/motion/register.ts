/**
 * GSAP plugin registration, done once for the whole site.
 *
 * Registration is a module-scope side effect rather than a call each consumer
 * has to remember, because `gsap.timeline({ scrollTrigger })` fails silently
 * without it — the timeline builds, the trigger never does, and the section
 * simply never animates. Anything that touches a timeline imports this module,
 * so there is no ordering to get wrong.
 *
 * This module and everything that imports it must stay OUT of the initial
 * bundle: `MotionRuntime` and `useMotionScene` reach it through `import()`.
 * See apps/web-vite/src/motion/README of record — docs/site/motion-matrix.md §6.
 *
 * SplitText, ScrollTrigger and the rest of the former Club plugins ship in the
 * public `gsap` package since the Webflow acquisition; `node_modules/gsap`
 * carries SplitText.js (17 263 bytes, header "SplitText 3.15.0") and
 * types/split-text.d.ts, so this is verified against disk, not marketing.
 *
 * SOT: node_modules/gsap/types/gsap-core.d.ts:registerPlugin
 *      node_modules/gsap/types/scroll-trigger.d.ts · node_modules/gsap/types/split-text.d.ts
 * SOT-KEYWORDS: site motion gsap register plugin scrolltrigger splittext web-vite
 */
// Named, not default. gsap's entry exports `gsap` both ways, and the default
// import trips import/no-named-as-default.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(ScrollTrigger, SplitText);

export { gsap, ScrollTrigger, SplitText };
