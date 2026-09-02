# Overhaul v2 — Deliverable O: Competitor Mobile-vs-Web Structural Summary

What it is: per-product structural answers (what's a tab, what's overflow, where the avatar lives, sidebar-vs-header, what mobile drops, density, resume, assignments, alerts, context switching, analytics drill-down, band differences) for 16 comparators, plus a cross-product adopt/adapt/reject synthesis for Moyo.
Why it exists: doc 36's role-nav decisions need external evidence; every "why 4 tabs, why sidebar" argument in the per-screen gate cites this doc instead of re-researching. Structure only — feature lists are out of scope.
Source of truth: cited vendor URLs (verified 2026-09-01) for competitor facts; docs/pack/36 + 00-binding-decisions.md for what Moyo actually binds. Where this doc and doc 36 disagree, doc 36 wins.
SOT-KEYWORDS: overhaul, competitors, mobile-vs-web, information-architecture, tab-bar, sidebar, role-nav, deliverable-O

Research method note: current help-center/changelog/blog pages + recent reviews; where a product's exact tab labels could not be verified from public sources, that is stated rather than invented. Store-listing screenshots drift; help centers were preferred.

---

## Group 1 — K-12 learning products (priority)

### 1. Khan Academy / Khanmigo
- **Mobile tabs (4):** Home · Search · Bookmarks · Profile (user-reported Android layout, confirmed in help community: https://support.khanacademy.org/hc/en-us/community/posts/360055819912-Android-App-navigation-Galaxy-Tab-S6). Mobile is a *consumption subset*: course browsing + video/exercise playback.
- **What moves to overflow:** almost everything role-shaped. Teacher tools, Khanmigo chat-box, Parent tools are **not in the app at all** (https://support.khanacademy.org/hc/en-us/articles/13982530363533-Where-can-I-access-Khanmigo-while-working-on-Khan-Academy — Khanmigo Activities only, v8.0.0+; chat/teacher/parent tools web-only).
- **Avatar/account:** mobile = Profile tab; web = name in top-right, dropdown to "Learner home" (which holds My Stuff, Khanmigo Activities/History/Settings: https://support.khanacademy.org/hc/en-us/articles/360030629852).
- **Web sidebar vs header:** learner web is header-driven (Explore mega-menu + Learner Home tabs like My Stuff: https://support.khanacademy.org/hc/en-us/articles/39586522176909-Update-New-and-improved-Explore-menu). The 2026 "reimagined" classroom experience moves teachers to a **left-side menu** (Teacher Tools tab in left nav) with a Khanmigo Assistant bar at the *top* as natural-language navigation (https://blog.khanacademy.org/meet-the-new-khan-academy-classroom-experience/, https://blog.khanacademy.org/khan-academy-reimagined-for-districts-2026/).
- **Disappears on mobile:** teacher dashboard, Khanmigo chat, parent tools, coach reports. Deliberate divergence: web = full multi-role platform, mobile = learner-only player.
- **AI placement:** learner Khanmigo = floating icon bottom-right of content pages, disabled on quizzes/tests (same support URL above). Teacher Khanmigo = quick-view panel on right of dashboard + top assistant bar. i.e., AI is **ambient on content, not a tab**.
- **Resume:** Learner Home "continue where you left off" course cards; the 2026 learner dashboard makes "next skill to master" the primary object.
- **Younger vs older:** entirely separate app/brand for young kids (Khan Academy Kids, with its own parental-controls gate: https://khankids.zendesk.com/hc/en-us/articles/360047566151) rather than a band-switched shell.

### 2. IXL (2026 app — key anchor, verified)
- The Aug 2026 app redesign's explicit goal is **mirroring web IA**: "students now land on their dashboard when they sign in, just like on IXL.com" (https://blog.ixl.com/2026/08/26/tour-the-latest-ixl-app/).
- **Mobile structure:** no consumer bottom-tab bar; instead **left nav (subjects) + top menu (videos, games)** — the web's frame reproduced on tablet. "My IXL" tab houses Recommendations wall, Quizzes, Skill Plans (same URL).
- **Resume/assignments:** the dashboard *is* the resume surface — assigned, recommended, and recently practiced skills + assessments-arena icon all on landing. Assignments are not a tab; they're dashboard rows.
- **Analytics drill-down (teacher, web):** Reports tab → question-driven report set: Diagnostic Overview/Strand Analysis → Trouble Spots (prioritized by # students stuck, with question carousel + struggling-student list) → Student Summary → Questions Log (every answer) → Live Classroom real-time alerts (https://www.ixl.com/materials/us/IXL_Teacher_Analytics.pdf, https://www.ixl.com/help-center/article/4430086/how_can_i_use_the_trouble_spots_report). Pattern: drill-down = class-aggregate → concept → student → individual question, each level one click.
- **Parents switch children:** family account = profile picker on entry + account-menu switch (https://www.ixl.com/help-center/article/1274265/how_do_i_switch_users_on_a_family_account); in parent reports, a "Child" selector inside the report header re-scopes the whole report (https://www.ixl.com/userguides/us/IXLQuickStart_FamilyReports.pdf).
- **Divergence:** deliberately *minimized* — IXL's 2026 bet is IA parity so nothing has to be relearned per device. Teacher analytics remain web-first.

### 3. Duolingo
- **Mobile tabs (~6, icon-only):** Path/Home · Leagues · Quests/Goals · Profile · Practice Hub · Shop; stable since the 2022 path redesign (https://blog.duolingo.com/new-duolingo-home-screen-design, https://duolingo.deconstructoroffun.com/mechanics/leagues, https://happilyevertravels.com/duolingo-daily-quests/).
- **What's a tab is a values statement:** leagues (retention mechanic) gets prime tab real estate; content browsing does not exist — there is nothing to browse.
- **Resume:** the Home tab *is* resume — a single linear path with exactly one "next" node; zero resume friction because there is no navigation decision. Stories/tips folded into the path, not tabs.
- **Avatar:** Profile tab (also holds friends/achievements). No hamburger, no More.
- **Web:** near-clone of the app (path center, left rail with the same items) — mobile-first IA exported to web, the inverse of every LMS here.
- **Onboarding:** progressive personalization quiz (goal, level, motivation) before account creation; placement test personalizes the path. Anchor for Moyo's "value before signup" law.
- **Younger vs older:** no band switching; one shell for all ages (plus a separate ABC/Kids product historically). Density never changes.

### 4. Google Classroom
- **Mobile:** hamburger drawer (Classes list, Settings, Notifications history) — *not* a bottom bar at top level; **inside a class**, bottom tabs (Stream · Classwork · People) (https://support.google.com/edu/classroom/answer/9582544?hl=en&co=GENIE.Platform%3DAndroid).
- **Web:** persistent collapsible **left drawer** on every page, collapsed by default, hover-to-expand; in-class tabs move to the **top** (https://support.google.com/edu/classroom/answer/17231999?hl=en, https://www.customguide.com/google-classroom/classroom-navigation).
- **Avatar/account:** top-right profile chip on both; also the Google-account switcher.
- **Mobile-only:** a 30-day in-app notification history that web *lacks* (web has only email-notification settings) (https://support.google.com/edu/classroom/answer/6141557).
- **Web homepage:** role-aware dashboard — "Due soon" module, class learning tools, class cards; role toggle (Teaching/Enrolled/Admin) top-right.
- **Assignments:** surface as Classwork within a class + aggregated "Due soon"/To-do across classes; never a top-level global tab on mobile.
- **Teachers switch classes:** class cards are the switcher; there is no persistent class dropdown — you return to the Classes page. Structural cost: cross-class work is constant round-tripping.
- **Density:** in-class structure identical mobile/web; only tab position flips (bottom vs top). Divergence is *chrome placement*, not IA.

### 5. ClassDojo
- **Teacher/school app (2025 rebuild):** bottom tabs **School · Classes · Chats · Notifications**; secondary top tabs Calendar · Points · Directory. Rebuilt explicitly because the old single-class app couldn't hold school accounts + multi-class (https://help.classdojo.com/hc/en-us/articles/37495808286093-Meet-the-New-Mobile-App-for-Schools).
- **Unified inbox pattern:** all chats in one tab with a class-filter carousel at top; unified notifications view (same URL). Class-scoped chat also reachable *inside* a class via a top "Chats" tab — same data, two scopes.
- **Parent app:** different IA — opens to the **Stories feed** by default; child points buried under Reports → child name (https://apps.apple.com/us/app/classdojo/id552602056, parent-tour video: https://www.youtube.com/watch?v=DjvGBc803_8). Teacher and parent are effectively two products in one binary.
- **Avatar:** profile in top corner both roles; parents join only via teacher code/link.
- **Web:** secondary citizen (teacher dashboard with class sidebar); ClassDojo is mobile-first — the *opposite* divergence of Khan/IXL.
- **Alerts:** notifications are a dedicated tab for teachers (workflow object), a bell for parents (ambient). Stories demoted from tab to embedded feed in the rebuild — evidence that feeds lose tab fights to workflows.

### 6. PowerSchool Mobile
- **Mobile pages:** Dashboard (default) · Classes · Calendar/Schedule · Account · **More** (school info, help, feedback) (https://help.powerschool.com/t5/Help-and-Technical-Support-for/EXPLANATION-OF-PAGES-WITHIN-PARENT-IOS-APP/ta-p/23074).
- **Dashboard = widget stack:** GPA, Class Overview, Assignments Due, Assignments Graded, Attendance, Bulletins, Meal Balance, Fees — user-reorderable/hideable (https://www.powerschool.com/solutions/communication/powerschool-mobile/). Density managed by widget curation, not by hiding pages.
- **Parents switch children:** **horizontal swipe on the student header** — the fastest child-switch in this set; one account holds all children (same help URL).
- **Alerts:** opt-in push for grade-change/attendance events; no triage surface — alerts deep-link to the record.
- **Web (SIS):** admin/teacher SIS is a dense left-nav web app; the mobile app is guardian/student read-only companion. Deliberate divergence: mobile = glanceable record viewer, web = system of record. District config gates which widgets even exist — IA varies by tenant.

### 7. Photomath
- **Structure:** camera **is** the home screen; no dashboard. Secondary: calculator/keyboard entry, graphing, **My Stuff** (History + Bookmarks merged), profile/settings behind a corner menu (https://support.google.com/photomath/answer/14328660?hl=en, https://screensdesign.com/showcase/photomath, https://nibble-app.com/blog/photomath-app).
- **Avatar:** optional — core loop works with no account; account exists only to sync My Stuff.
- **Resume:** My Stuff (recent scans) is the resume surface; solution cards answer-first with expandable steps.
- **Web:** effectively none for the core loop (camera-dependent) — a product where mobile/web divergence is total by nature.
- **Lesson for Moyo:** a capture-first tool wants the capture on the center/default slot and *zero* IA between launch and camera — direct support for doc 36's raised center Snap slot, and for Photomath's "answer first, steps expandable" being the anti-pattern Moyo's no-answer-mode rejects at the pedagogy layer while keeping the capture ergonomics.

---

## Group 2 — adjacent learning products

### 8. Canvas (Instructure)
- **Student app bottom tabs (5):** Dashboard · Calendar · To-Do · Notifications · Inbox (https://spu.atlassian.net/wiki/spaces/ETMH/pages/511836192/What+is+the+Canvas+Student+App, https://www.usu.edu/teach/help-topics/canvas/canvas-app-walkthrough).
- **Web:** persistent far-left **global nav rail** on every page: Account · Dashboard · Courses · Groups · Calendar · Inbox · History · Help (https://community.canvaslms.com/t5/Canvas-Basics-Guide/How-do-I-use-the-Global-Navigation-Menu/ta-p/618767).
- **What mobile drops:** Courses/Groups/History/Help as top-level items (courses reachable through Dashboard cards); institution-injected nav items.
- **What mobile promotes:** To-Do and Notifications become tabs (web folds to-do into the dashboard sidebar and notifications into Account settings). Clean example of *triage objects promoted on mobile, browse objects promoted on web*.
- **Avatar:** web = Account at top of rail (profile + notification prefs); mobile = profile in Dashboard header.
- **Assignments:** To-Do tab (undated items included) + Calendar; per-course inside course nav. Alerts: Notifications = feed of course changes, Inbox = human messages — Canvas structurally separates machine-alerts from human-messages.

### 9. Outschool
- **App tabs:** Marketplace/Search (landing) · Schedule · Messages · Profiles (https://support.outschool.com/en/articles/8608796-outschool-app-for-android-devices).
- **Parent vs learner:** parent profile sees marketplace + all-learner schedule; learners (6+) log in separately, see only their classes/meetings/messages/classroom. Switch via Profiles page (app) or account-menu space switcher (web) (https://support.outschool.com/en/articles/2086860-how-to-use-outschool-as-a-parent).
- **Settings are read-only on mobile** — all account/transaction modification pushed to web (same Android-app URL). Honest scoping: mobile = attend/communicate, web = purchase-admin.
- **Avatar:** Profiles page (parent) top-right settings gear. Web: header nav + account menu, no sidebar.
- **Resume:** upcoming classes on logged-in homepage + Schedule tab; classes are calendar objects, so "resume" = "join next meeting."

### 10. Preply
- **Student app tabs:** Search · Messages · Schedule (+ conditional Practice tab for supported languages — criticized for inconsistency: https://ixd.prattsi.org/2026/02/design-critique-preply-ios-app/). Tutor side pivots on Calendar · Messages · My Lessons.
- **Web:** header nav ("Home"/"My lessons" prominent); lesson entry duplicated across Home, My lessons, and Messages ("Enter Classroom") (https://help.preply.com/en/articles/4182666-preply-classroom-a-student-s-guide). Users report the notes/classroom path as unintuitive — burying artifacts behind Messages→tutor→Classroom is a documented failure.
- **Avatar:** profile in header (web) / settings via profile (app).
- **Structural lesson:** marketplace two-sided apps end up with *join-the-session* as the real primary action; Preply scatters it. Moyo's tutor shell (Today tab = today's sessions) is the fix Preply lacks.

### 11. Quizlet
- **App:** personalized Home feed (Study Bites, progress cards, recommendations: https://help.quizlet.com/hc/en-us/articles/38999971996301-Navigating-your-home-feed-on-mobile-devices), Library organized by content type, Create flow, profile settings (https://quizlet.com/blog/a-beginners-guide-to-quizlet). **Full bottom-tab enumeration could not be verified from public sources** — help center describes Home/Library/Create as the main areas; treat exact labels/order as unconfirmed rather than assumed.
- **Web:** header nav (Home, Library, Create dropdown top-left) — no sidebar; creation is a first-class top-level action on both, unusual in this set.
- **Resume:** feed progress-cards ("jump back into recent study activity") — feed-as-resume rather than a dedicated Continue slot.

### 12. SchoolAI (anchor, verified)
- **Teacher web:** four main sections — **Launchpad (home) · Spaces · Tools · Assistants** — i.e., a persistent menu organized **by job** (deliver learning experiences / run utilities / chat-assist the teacher), not by content type (https://support.sau19.org/help/en-us/107-schoolai/374-utilizing-schoolai-educators, https://help.schoolai.com/en/articles/15538519-getting-started-with-spaces).
- **Student side:** effectively shell-less — student enters a Space via link/QR/LMS and lands in a single chat with "Dot"; no student IA to learn (https://help.schoolai.com/en/articles/10280003-getting-students-into-spaces).
- **Alerts:** Mission Control teacher dashboard is a **live triage surface** — per-student session tiles with engagement/sentiment/stuck alerts and safety flags surfaced to the teacher in real time (https://schoolai.com/blog/how-to-use-schoolai-teacher-dashboard-understand-student-needs-real-time, https://schoolai.com/blog/how-schoolai-protects-students-with-real-time-safety-monitoring). Closest existing analogue to Moyo's guardian Alerts tab + doc 31 incident channel.
- **Mobile:** web-responsive; no distinct native IA to report — thin evidence, stated as such.

### 13. Speak
- **Structure:** thematic units mixing lesson types (video Tutor Lessons, Speaking Drills, Vocab, Roleplay, Free Talk); AI tutor as its own destination; per-concept mastery library driving generated review (https://lingtuitive.com/blog/speak-review, https://www.speak.com/). **Exact bottom-tab labels not verifiable from public text sources** (Mobbin holds the screenshots: https://mobbin.com/explore/flows/77b22c97-2cb0-450b-aa54-d31b96617ec5) — not asserted here.
- **Onboarding (anchor):** personalization questions → account → immediate fluency assessment → goal setting → generated study plan; plan quality explicitly tied to input quality (https://learn.kotoenglish.com/blog/speak-app-review/). Mobile-only product; no meaningful web app.

### 14. Babbel
- **App (post-redesign):** confirmed tabs include a course/home surface with "Show topics" explore-at-the-bottom, a **Practice** tab (Vocabulary/Listening/Speaking hubs), and a **Progress** tab (goal at top, challenges/streak at bottom) (https://support.babbel.com/hc/en-us/articles/25075048448274-New-app-interface — page bot-blocked for full fetch; Home/Profile slots unconfirmed).
- **Web:** parallel lesson player, feature-thinner; Babbel docs maintain separate app/desktop guides (https://support.babbel.com/hc/en-us/articles/360029715932-Using-Babbel-on-a-desktop), with app as the richer surface.
- **Structural note:** Practice (skill-type hub) and Progress (goal + streak) as separate tabs = the "do more" vs "see how I'm doing" split, cleaner than Duolingo's gamification-tab sprawl.

---

## Group 3 — ops/web-shell patterns (Notion · Linear · Slack)

### 15. Notion
- **Mobile tabs (4):** Home · Search · Inbox · Create — always present (https://www.notion.com/help/workspaces-on-mobile). Home reproduces desktop sidebar sections (Teamspaces, Shared, Private, Favorites).
- **Desktop:** fixed ~224px sidebar with top cluster Search/AI/Home/Inbox + workspace tree; utilities pinned at bottom (https://www.notion.com/help/navigate-with-the-sidebar, https://medium.com/@quickmasum/ui-breakdown-of-notions-sidebar-2121364ec78d).
- **Pattern:** sidebar *sections* become the mobile Home tab's *content*; only cross-cutting verbs (search, inbox, create) earn tabs. Documented UX criticism: mobile fails when it assumes desktop deep-work sessions instead of check-ins (https://medium.com/@amnacreative/notion-on-mobile-doesnt-match-the-laptop-experience-here-s-how-ux-can-fix-it-b1928c86d3c1).

### 16. Linear
- **Mobile (2026):** bottom toolbar of core workflows (Inbox, My Issues, favorites, teams/triage), **user-customizable** — rearrange tabs, pin projects/views (https://linear.app/changelog/2026-01-22-customize-your-navigation-in-linear-mobile, https://linear.app/mobile); Create Issue persistent at top of every screen (https://linear.app/changelog/2026-03-12-ui-refresh).
- **Desktop:** keyboard-first sidebar (Inbox `G I`), team trees, triage queues (https://linear.app/docs/inbox).
- **Pattern:** mobile explicitly scoped as **away-from-keyboard triage** (swipe/snooze on inbox), not a port; the deepest surfaces (views, cycles config, admin) simply don't ship on mobile.

### 17. Slack
- **Mobile tabs (5):** Home · DMs · Activity · More · You — DMs promoted to a tab because the old swipe-gesture access failed discoverability; Activity became core once promoted (https://slack.com/blog/productivity/simpler-more-organized-slack-mobile-app, https://slack.com/help/articles/29788684062739-Customize-the-Slack-mobile-app).
- **Desktop (2023+):** left rail Home/DMs/Activity/Later/More + Create; profile moved bottom-left; workspace tiles collapsed to one — and **user revolt forced the optional workspace-switcher rail back** (https://slack.com/help/articles/44134792609555, https://tidbits.com/2023/09/21/how-to-restore-the-slack-workspace-sidebar/, https://slack.com/help/articles/1500002200741-Switch-between-workspaces). Desktop later consolidated further behind a More tab while "the tabs at the bottom of the mobile apps will stay the same."
- **Pattern + cautionary tale:** Activity = one prioritized feed with type sub-tabs (mentions/threads/reactions); tenant switching must stay one visible gesture — hiding it behind extra clicks is the single most-litigated shell regression in this whole set.

---

## Synthesis — patterns for Moyo (adopt / adapt / reject)

1. **ADOPT — Landing = resume, never a menu.** IXL 2026 lands students on the dashboard with next steps (blog.ixl.com), Duolingo's path has exactly one next node, Quizlet's feed leads with progress cards. Moyo: learner Today/Home is resume-first (already bound, doc 36); K-2 Today should be Duolingo-degree singular — one "next" tile, not a feed.
2. **ADOPT — Separate shells per role, not one conditional tree.** ClassDojo runs teacher and parent as different IAs in one binary; Khan splits learner web / teacher left-nav / Kids app; Outschool splits parent/learner spaces with a switcher. Nobody successful serves guardian+learner from one nav tree. Confirms doc 36's navigator law for Moyo's five shells.
3. **ADOPT — Promote triage verbs on mobile, browse nouns on web.** Canvas promotes To-Do/Notifications to mobile tabs while web keeps Courses/Groups/History; Linear scopes mobile to inbox-triage; Notion gives tabs only to search/inbox/create. Moyo: guardian mobile = Alerts/Reports triage; org mobile companion = Overview·Schedule·Inbox·Safety (bound) while CRM/Money browse stays web-sidebar.
4. **ADOPT — Job-organized persistent left menu for ops/teacher web.** SchoolAI (Launchpad/Spaces/Tools/Assistants), Khan 2026 teacher left nav, Canvas global rail, Classroom's collapsible drawer, Slack/Notion/Linear rails. Moyo org/district web sidebars (Overview·CRM·Scheduling·Money·Safety·Settings; Outcomes·Schools·Educators·Compliance) match; group by job-to-be-done, never by data model.
5. **ADOPT — Alerts as a first-class destination for safety-bearing roles, split from messages.** Canvas separates Notifications (machine) from Inbox (human); ClassDojo's rebuild gave teachers a Notifications tab + unified filtered inbox; SchoolAI's Mission Control surfaces safety flags live to the adult. Validates Moyo's guardian **Alerts** tab (incidents never under a bell) and org Safety in both sidebar and mobile tabs; keep human messages (tutor↔guardian) structurally separate from incident alerts per doc 31.
6. **ADOPT — One-gesture tenant/child switching, always visible.** PowerSchool: swipe the student header; IXL family: profile icons + in-report Child selector; Outschool: Profiles tab; Slack's hidden workspace switcher had to be reinstated after revolt. Moyo: guardian child-switch belongs on the Family/Reports header (swipe or chip row), tutor class/learner switch in the Learners pane header, org school/location switch pinned in the sidebar top — never inside Settings, never >1 tap.
7. **ADOPT — Capture-first center slot for the camera loop.** Photomath makes the camera the home screen with My Stuff as history/resume. Moyo's raised center Snap slot in every learner band (bound) is the tab-bar version of the same law; Snap history lives under My Stuff/Me, mirroring Photomath's merged History+Bookmarks.
8. **ADAPT — Analytics drill-down as question → cohort → concept → student → question-level evidence.** IXL's ladder (Diagnostic Overview → Trouble Spots prioritized by students-affected, with actual answered-question carousels → Student Summary → Questions Log) is the strongest model here. Moyo adapts it with doc 34's constraint: every level evidence-linked, movement-vs-position never conflated, no pass/fail coloring; district Outcomes drills school→educator→cohort on the same ladder. Reject IXL's red/green grading skin (redpen rules, doc 08/31).
9. **ADAPT — Band-based shell simplification instead of a separate kids app.** Khan ships a whole second app (Khan Kids) for young children; Duolingo ships one shell for everyone. Moyo's middle path is bound and better for one family account: same product, per-band tab count 3→4→5, K-2 giant tiles/voice/no-search. Adopt Khan Kids' *lesson* (young kids need a different shell, adult-gated settings), reject its *cost* (separate app splits the household).
10. **ADAPT — Progressive personalization onboarding, value before signup.** Speak (questions → assessment → generated plan; plan quality tied to input) and Duolingo (goal/level quiz pre-account) anchor the pattern. Moyo adapts under doc 37's law: ≤3 contextual beats, skippable, camera permission only at first Snap — and the personalization interview belongs to the *guardian* flow (FD-10→15), because the learner code path must stay one-action ("Snap your homework"), unlike Speak's learner-answers-everything model.
11. **REJECT — Mobile as a crippled viewer of a web system of record.** PowerSchool mobile is read-only glance; Khan mobile drops teacher/parent/AI surfaces entirely; Outschool makes mobile settings read-only. For Moyo's learner and guardian, mobile is the *primary* surface — the full loop (snap → tutor → report → alert-response) must complete on device. Only district (web-only, Phase 3) and deep org CRM/Money may be web-reserved, and org mobile still gets Safety in full.
12. **REJECT — Engagement mechanics as navigation real estate.** Duolingo spends 3 of ~6 tabs on leagues/quests/shop; Babbel spends a tab on streak challenges. Doc 33 non-goal 7 (no engagement-pressure mechanics) makes this structurally forbidden: no leaderboard/quest/shop tab in any learner band; Progress (6-8/9-12) carries mastery movement per doc 34, not streaks.
13. **REJECT — Duplicated/conditional entry points for the primary action.** Preply scatters "join lesson" across Home/My lessons/Messages and shows a Practice tab only for some languages — both documented as confusing (prattsi.org critique). Moyo: one canonical entry per job per shell (Snap on center slot; tutor session-join on Today; guardian incident on Alerts); tab sets never vary by entitlement or content availability within a band (paywalls change *content states*, never the tab bar — PW-03b).
14. **ADAPT — AI as ambient assistant, not a tab.** Khanmigo: floating icon on content, disabled on assessments, quick-view panel + top command bar for teachers; SchoolAI: the student's whole surface *is* the chat, teacher assistants a section. Moyo's learner tutor is the session surface itself (Snap leads into it), so no "AI tab" exists; for tutor/org shells, an assistant belongs as a panel/command affordance à la Khan's teacher bar, and it must go silent on assessment-style checks exactly as Khanmigo does.

Deliberate mobile/web divergence, per product, in one line each: Khan (mobile=learner subset), IXL (parity by design), Duolingo (parity, mobile-first exported to web), Classroom (same IA, chrome flips bottom↔top; mobile-only notification history), ClassDojo (mobile-first, web secondary), PowerSchool (mobile=glance widgets, web=SIS), Photomath (mobile-only by nature), Canvas (triage tabs mobile vs browse rail web), Outschool (mobile=attend/message, web=purchase/admin), Preply (accidental, not deliberate), Quizlet (near-parity), SchoolAI (web-first, students shell-less), Speak/Babbel (app-first), Notion/Linear/Slack (mobile=triage companion of a sidebar workspace, with Slack proving switcher visibility is non-negotiable).
