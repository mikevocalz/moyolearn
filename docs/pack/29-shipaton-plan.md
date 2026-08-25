# Shipaton 2026 — Battle Plan
**Doc 27 · Moyo platform pack · Date:** Aug 24, 2026 · **Status:** urgent, operational
**Sources:** [shipaton.com](https://www.shipaton.com/) · [Devpost overview](https://revenuecat-shipaton-2026.devpost.com/) · [Official Rules](https://revenuecat-shipaton-2026.devpost.com/rules) (rules prevail over the overview page wherever they disagree — §11.4)

---

## 1. Timeline reality check — you have 5 more weeks than you think
| Milestone | Date |
|---|---|
| Submission Period | Jul 31 2026 8:00am PDT → **Sep 30 2026 11:45pm PDT** |
| #BuildInPublic Engagement Period | Jul 31 → Sep 30 |
| Judging | Oct 1 – Oct 13 |
| Winners announced | Oct 21 (trophies at App Growth Annual, NYC) |

**Three dates, not one — don't conflate them:**
| What | When | Bar |
|---|---|---|
| **Live demo — [Shipaton x Expo AI Meetup NYC](https://partiful.com/e/1osTbNUE8w3lZzmIkoVg)** | **Thu Sep 3** (note: a Thursday) | A build on a device that survives a room. **No App Review, no store listing, no privacy labels, no paywall polish.** |
| Self-imposed readiness | Mon Aug 31 | Demo-complete with 3 days of rehearsal buffer — keep it |
| Store submission | Aug 31 – early Sep | App Review is the long pole; earlier = more earning days |
| Devpost submission | Sep 30 11:45pm PDT | All assets + per-category paragraphs |

**The demo bar is far lower than the ship bar — but the ship date still matters:**
1. **The Grand Prize shortlist is built from total revenue reported in RevenueCat during the Submission Period.** Every day live is a day earning. Ship Aug 31 → 30 earning days. Ship Sep 29 → 1.
2. **"Early and Effective Release" is a *named* Grand Prize criterion** — judges literally ask when you first put a live usable version in front of real users and why you shipped then.
3. **App Review is in the critical path and the rules warn about it explicitly.** Aug 31 submission leaves four weeks of rejection-and-resubmit buffer. A Sep 25 submission leaves none.
So: **Aug 31 = store submission target. Sep 30 = Devpost submission deadline.** The month between them is the growth phase that most categories actually score.

## 2. Hard eligibility (non-negotiable)
- **Brand-new app.** First *public* release must fall inside the Submission Period. The project may have existed before — TestFlight/internal testing does not count as public release — but it must never have been publicly released on any eligible store before Jul 31.
- **RevenueCat SDK powering at least one in-app or web purchase** (or RevenueCat Ads).
- **Published to App Store, Google Play, or Samsung Galaxy Store**, iOS/iPadOS/macOS/Android, and **accessible from the United States**.
- **Free for judges** — free trial *or* a promo code unlocking all premium features, available until judging ends.

**Submission assets checklist:**
- [ ] Text description of features/functionality
- [ ] Demo video **< 2 minutes**, on YouTube/Vimeo, publicly visible, showing the app running on-device, no third-party trademarks or unlicensed music
- [ ] URL to the fully published store listing
- [ ] 1024×1024 app icon
- [ ] ≥1 screenshot at **exactly 1179×2556, no device frame**
- [ ] Free trial or judge promo code
- [ ] Per-category paragraphs (see §4) — each category requires its own description block

## 3. The slice — what you actually ship
**Moyo as specced across 26 docs is a 12-month platform. It cannot ship in 7 days. Ship one loop.**

**Recommended: "Moyo — Homework Coach."** Point camera at a problem → guided coaching that never hands over the answer → progress you can see. That is a complete, demoable, monetizable product on its own, it's the strongest 2-minute video in the pack, and the differentiator states itself in one line: **everyone else vends answers; this one teaches.**

**In scope (7 days):** doc-24 capture flow (guided frame → crop → confirm) · doc-18 pedagogy contract on the tutor turn · streaming chat surface (doc 15) · lightweight mastery/streak view · paywall + RevenueCat · the brand (doc: logo kit, tokens).
**Cut ruthlessly:** 3D Natalie · ExecuTorch/on-device models (v1 sends the crop straight to a vision model — this is the single biggest schedule saver) · Yjs collab · Fishjam · LMS/LTI · CRM · district reporting · i18n beyond English · Bun migration (doc 21 waits).

**App Review risk — the one that can kill the timeline:** do **not** opt into the App Store Kids Category. Kids Category carries stricter review, third-party-analytics restrictions, and slower turnaround. Ship rated 4+/9+ as a **student-and-parent homework help app** with a parent-facing purchase flow. Same product, materially faster review. Have the privacy nutrition labels and a plain-English privacy policy ready before you submit — those are the common rejection triggers.

## 4. Category strategy — one app, seven entries
Multi-category entry is explicitly allowed (only the Influencer awards are one-per-project, and one Influencer entry doesn't block non-Influencer categories). Each category needs its own description paragraph in the submission. **Note the prize table in the Rules differs from the overview page — the Rules govern.**

**Enter these (ranked by expected value):**
1. **#BuildInPublic — $30k/$20k/$10k.** The biggest prize you can realistically win, and **audience size explicitly does not matter** — it's judged on story, community engagement, and lessons learned. You have 26 architecture docs and a genuinely unusual set of decisions (no emotion-recognition AI, the business/learning data wall, edge-is-senses-never-brain, Sankofa brand research). That's a stronger public build story than almost anyone in the field. **You're ~3.5 weeks late to the engagement period — start posting today**, tag #Shipaton, and don't backfill fake history; narrate forward from here plus a "how I got to the spec" retrospective thread.
2. **OneSignal — Keep Them Coming Back — $25k/$15k/$5k.** Second-largest pot and **a single deployed message is sufficient for eligibility.** Your angle is genuinely differentiated: spaced-repetition review reminders are the *pedagogically correct* use of push — notifications that serve learning rather than farm engagement, which is doc 19's metric hierarchy made visible. Judges score implementation quality, user value, and creative use. Cheap to enter, strong story.
3. **RevenueCat Peace Prize — $15k.** Criteria are Impact and Feasibility. The honest story: kids whose families can't afford $50/hr tutoring get a coach that refuses to just give answers. Cite the doc-19 equity framing.
4. **RevenueCat Design Award — $15k.** Criteria are "innovative ideas" and "aesthetics — fun animations, smooth gesture-based interactions." Your Skia guided-frame overlay, crop handles, streaming markdown, and band-adapted type scale are exactly this. You're a trained designer with an original brand system — this is your home category.
5. **HAMM — $15k.** Judged on articulated monetization strategy, paywall craft, pricing/packaging, and scalability. Doc 05 already contains the thinking; the submission needs the paywall built well and the strategy written plainly.
6. **Grand Prize — $100k.** Auto-eligible; shortlisted on RevenueCat revenue. Long shot, costs one extra paragraph on post-launch growth. Write it.
7. **Layers — Growth Loop — $15k.** SDK install + one focused experiment + an honest writeup of what you learned. Explicitly *not* judged on traction size. Low effort, decent odds.

**Optional if time allows:** Stripe Funnel Vision ($15k — RevenueCat Funnels + Stripe web-to-app funnel; you already have a Next.js web app, so this is closer than it looks) · Samsung Best App for Galaxy (extra store publish, 20% of score is Galaxy optimization, prize is featured placement not cash) · Noise Most Viral.

**Do not enter:** Catvertising (ads in a children's app contradicts your entire ethic — skip it) · Ship Kotlin (you're React Native) · Replit Idea to Income (not your stack) · Next Gen (students only) · all five Influencer categories (none match; and using an influencer's name/likeness without written consent is a disqualification trigger).

## 5. Sponsor / partner stack — you're already using four of them
*Precision that matters in a room full of them:* the Official Rules name only seven **Category Sponsors** — JetBrains, Noise, Samsung, Replit, OneSignal, Layers, Stripe. Expo and Software Mansion are **event partners / Ship Kit tooling**, not category sponsors. Say "partner" on Sep 3, not "sponsor."
| Sponsor | Status | Action |
|---|---|---|
| **Expo** (event partner) | ✅ already core | Say so loudly in the submission; EAS Build + EAS Submit is your ship path |
| **Software Mansion** (event partner) | ✅ already core | Skia, Reanimated, VisionCamera, ExecuTorch — name them |
| **Sentry** | ✅ connector available | Wire it before ship; crash-free rate is a growth-narrative asset |
| **Mobbin** | ✅ connector available | Paywall + onboarding reference during design |
| **RevenueCat** | ⬜ required | SDK + one IAP; hit all 5 Ship Kit milestones fast |
| **OneSignal** | ⬜ add | Required for the $25k category — one campaign minimum |
| **ElevenLabs** | ⬜ consider | Natalie's voice for the demo video; Ship Kit credits |
| **OpenRouter** | ⬜ consider | Model routing without wiring two vendor SDKs in week one |
| **Layers** | ⬜ add if entering | SDK must be installed and verifiable *before* judging |
| **AppScreens** | ⬜ useful | Generates the 1179×2556 store screenshots |
| **Codemagic** | ⬜ backup | Alternative CI if EAS queues bite |

**Ship Kit:** up to 25 sponsor perks unlock across five milestones — registration complete, RevenueCat project created, first test purchase, first Store API call, first real purchase. Register and create the RevenueCat project **today** so credits start flowing while you build.

## 6. The 10 days (re-anchored on Sep 3)
**Demo-first ordering — build only what appears on stage, in the order it appears.**
- **Mon Aug 24 (today):** Register on Devpost. Create the RevenueCat project (Ship Kit milestone 2). Lock the demo scope in writing — the loop and nothing else. Post #BuildInPublic #1.
- **Tue 25:** Capture flow end-to-end on a **physical device** (guided frame → crop → confirm) against a vision model. Print the demo worksheet.
- **Wed 26:** The coaching turn — pedagogy contract prompt, streaming into the chat surface. This is the money shot; nothing else matters until it lands.
- **Thu 27:** Misconception response (wrong answer → named diagnosis) + progress view with pre-seeded mastery so it's never empty. Post #2 with the first clip.
- **Fri 28:** Demo-proofing pass (§8). Full dress rehearsal on hotspot. Record the backup video.
- **Sat–Sun 29–30:** Brand pass (icon, splash, empty/error states, doc-08 type scale). Paywall + RevenueCat entitlement + **first test purchase** (Ship Kit milestone 3). TestFlight build + QR code.
- **Mon Aug 31:** **Demo-complete.** Rehearse three times end-to-end, timed. Submit to App Store review if the build is store-worthy — otherwise keep building; review can start any time before ~mid-Sep without hurting you.
- **Tue–Wed Sep 1–2:** Rehearse. Fix only demo-path bugs. Freeze the model and prompt — no live experimentation after Tuesday.
- **Thu Sep 3:** **Demo night.** Run §8. Collect TestFlight signups. Post the recap same night.
- **Sep 4–29:** Store ship if not already live, weekly updates, Layers experiment, OneSignal campaign, keep posting. Two more NYC opportunities on the calendar: [Swift Excelsior workshop Sep 5](https://luma.com/7s67790i) and [Swift Excelsior Shipaton Launch Party Sep 26](https://luma.com/1ul7k57c) — the 26th is a second demo slot with a month more product behind it.
- **By Sep 30:** Devpost submission, all seven category paragraphs.

## 7. Risks
- **App Review rejection** — mitigate by avoiding the Kids Category, having the privacy policy and labels ready, and shipping Aug 31 for buffer.
- **Scope creep back toward the platform** — the 26-doc pack is a *roadmap*, not a v1 spec. The slice is the product this month.
- **AI safety in a public kids-adjacent app** — doc 07's Safety Plane gets a v1 form (input/output screening, no PII in prompts, refusal behavior) even in the slice. Non-negotiable, and it's also a Peace Prize talking point.
- **Prize amounts** — overview page and Rules disagree on several categories (overview says $20k where the Rules table says $15k). The Rules govern; don't plan around the larger number.

## 8. Demo-night runbook — Sep 3, Expo AI Meetup NYC
**Know the room.** This is an Expo/AI meetup — React Native engineers, not a general startup crowd. Expo and Software Mansion are both Shipaton sponsors and both are already load-bearing in your stack (Expo SDK 57 + New Arch, VisionCamera, Skia, Reanimated). That's not trivia here, it's credibility: have a 20-second stack answer ready, because in this room "how did you build the guided frame overlay" is a question you *will* get, and answering it well is how you meet the people worth meeting.

**The 3-minute arc — wow first, context second:**
1. **0:00–0:20 — the hook, physical.** Hold up a printed worksheet. "Every homework app on the store will read this and hand over the answer. Watch this one refuse." Point the camera.
2. **0:20–1:10 — the refusal.** It asks a question back instead of solving. Stop talking and let the room read it. That silence is the demo.
3. **1:10–1:50 — the diagnosis.** Give a *wrong* answer on purpose; it names the misconception rather than saying "incorrect."
4. **1:50–2:20 — the payoff.** Mastery moves, review gets scheduled. "It's not a chat log, it's a model of what this kid actually knows."
5. **2:20–3:00 — stack + ask.** Name Expo, VisionCamera, Skia, RevenueCat. Then the ask: **TestFlight QR on screen — "I want 20 testers before I leave tonight."**

**Failure-proofing (where demos actually die):**
- **Never trust venue wifi.** Personal hotspot as primary, tested in advance. Keep a **pre-recorded screen capture of the exact same flow** on the device — one tap away, no apology needed if you use it.
- **Physical device, wired mirroring.** USB to the Mac via QuickTime beats AirPlay in a crowded room every time. Bring cable + dongle + charger. Test on the venue's display before doors if you can.
- **Device prep:** Focus/DND on, notifications off, auto-lock never, Low Power Mode **off**, brightness up, 100% battery.
- **Paper, not screens.** Photographing a laptop screen invites glare and moiré and will make the vision model look stupid. Matte printed worksheet, in the bag, plus a spare.
- **One known-good problem**, rehearsed 20 times. Keep audience-suggested problems as a *finale* after the scripted run lands — high reward, but never risk it before the point is made.
- **Short client timeout with a graceful line**, not an infinite spinner. Rehearse the words for a slow response: narrate what it's doing.
- **Freeze the prompt and model Tuesday.** No clever tweaks on demo day.
- **Pre-seed the learner profile** so the progress screen isn't an empty state.

**Extract the value from the night:** have someone film the demo — that clip is your #BuildInPublic asset and probably your Devpost video B-roll. Names worth finding: Expo team, Software Mansion folks, any RevenueCat staff. And every TestFlight signup from the room is a real early user, which feeds the Grand Prize revenue narrative, the Layers growth-loop writeup, and the "Early and Effective Release" criterion at once.

## 9. Fine print that changes tactics (verified against the Official Rules)
1. **Judges may never open your app.** *"Judges are not required to test the Project and may choose to judge based solely on the text description, images, and video provided in the Submission."* Treat the **2-minute video and the written description as the primary deliverable**, not as packaging around the app. Budget real time for them in late September — a great app with a mediocre video loses to the reverse. The video *should be under two minutes* and **judges are not required to watch past 2:00**, so the refusal moment has to land in the first 30 seconds.
2. **#BuildInPublic requires a published app.** *"Entrants who publish their app during the submission period AND submit links to the publicly visible posts…"* Your highest-EV category is **not** a standalone writing prize — the store ship is mandatory to collect it. That moves App Store submission from "nice to have by mid-September" to a hard dependency on a $30k line.
3. **The Design Award asks you to direct the judges' eyes.** The submission must *"include a description of the app's unique design elements and what areas judges should look for to see standout design and animations."* Write that section as a **viewing guide** — "open capture, watch the frame snap to the page edges; send a wrong answer, watch the misconception line animate in" — not as an adjective list.
4. **Access must stay open through Oct 13** (end of Judging Period), free of charge and unrestricted — free trial or a judge promo code that unlocks *all* premium features. Don't let a trial expire mid-judging.
5. **Registration opened May 15** and runs to Sep 30 — no lateness penalty for registering today.
6. **Multiple submissions are allowed** if each is *"unique and substantially different."* Not advisable this cycle; noted so you don't wonder.
7. **Not eligible for you:** Next Gen (active students with verified academic email only) and the Conflict of Interest Award (RevenueCat/sponsor employees only).
8. **Admin:** prizes payable to the individual; US winners file a W-9; Required Forms due within 10 business days; disputes run under New York law and AAA arbitration.
