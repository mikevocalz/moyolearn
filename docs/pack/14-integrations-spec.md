# Integrations Spec — the researched catalog, tiered and phased
**Doc 14 · Moyo platform pack · Date:** Aug 20, 2026
**Research base (fetched/searched Aug 20):** Noto's live integrations page · Teachworks' 60–70 integration/add-on library · TutorCruncher's integrations page + help docs · the 2026 virtual-classroom landscape · the 2026 MCP/AI-connector ecosystem. Patterns learned; nothing copied.
**Governing rule:** the doc-13 public API + signed webhooks **is** the integration platform. Every integration below rides it — OAuth apps, Zapier, MCP, all of it. No integration gets a bespoke side door around the Block.

---

## 1. What the field actually has (verified)
- **Noto (16 tiles):** Zapier (headline, dedicated page) + Asana, Calendly, Google Sheets, HubSpot, Typeform, Monday, Mailchimp, ChatGPT, Notion, Google Calendar, Gmail, QuickBooks Online, Salesforce, Slack, WhatsApp notifications. Reading it critically: most tiles are the Zapier catalog wearing logos. **Gaps: no video/classroom at all, no Xero, no SMS, no payroll, one accounting option.**
- **Teachworks (60–70, the deepest library):** Stripe native incl. ACH/SEPA/BECS, **native QuickBooks Online two-way sync** (customers/services/invoices/credit notes/payments), Zapier (6000+ apps), **Lessonspace native** (launch from calendar/reminder, persistent spaces, customer discount), Mailchimp, Google Calendar two-way team sync, Outlook, Zoom/Meet/Skype links in reminders, SMS lesson reminders, Excel export, website booking plugins, 65+ endpoint API.
- **TutorCruncher:** **Wise for tutor payouts, GoCardless for direct debits** (UK-market DNA), Zoom via *per-tutor* OAuth (their licensing workaround — a smart pattern), and the richest classroom bench: ClassIn, Lessonspace, MeritHub, Bitpaper, LearnCube-class. But accounting is **CSV exports** to QuickBooks/Xero/Sage — not sync. 
- **Classroom landscape 2026:** Lessonspace (STEM + tutoring orgs), Pencil Spaces, LearnCube (language, white-label), ClassIn (enterprise OMO), Koala Go (young K-12), Vedamo, Whereby, BigBlueButton (open-source), plus generic Zoom/Meet/Teams.
- **AI connectors 2026:** MCP is the standard — 97M+ monthly SDK downloads, 10k+ servers, 28% of Fortune 500 deployed; one server works across ChatGPT (Apps SDK + connectors), Claude, Copilot, Gemini, Cursor. Vertical SaaS now ships MCP as *the* connection model; both ChatGPT and Claude run submission/directory processes (tool annotations, demo account, domain verification).

## 2. Strategy — three mechanisms, one platform
1. **Native OAuth integrations** for the vital few where depth wins (money, calendar, classroom, comms).
2. **The automation rail** (Zapier first, Make + n8n node after) for the long tail — this is how Noto shows 16 logos; we get the same tail *plus* a real spine, because our triggers/actions derive from the doc-13 event catalog and typed API.
3. **MCP** for the AI layer — the 2026 surface none of the tutoring incumbents ship.
Entitlements per tier come from the registry (doc 11 §5): automation rail + ICS on every paid tier; accounting sync and MCP from Studio; standards track at Institution.

## 3. The catalog (tiers × phases)
### T1 · Money — Phase 1–2
- **Stripe** — native core, already the ledger (doc 05). Cards + ACH-first, Connect payouts. *Not an "integration"; the spine.*
- **QuickBooks Online** — **native two-way sync** (customers, services, invoices, payments, credit notes) at Teachworks depth; this is where TutorCruncher's CSV approach loses and we don't.
- **Xero** — native sync fast-follow for UK/ANZ businesses; **GoCardless** direct-debit evaluated with it (same market).
- **Gusto Embedded** — *evaluate only*: our contractor payouts are Stripe Connect native; embedded W-2 payroll is a Scale-tier question with real compliance weight. ADR before any build.
### T2 · Time — Phase 1
- **Google Calendar** two-way per-staff sync (busy-block import + session export) · **Microsoft 365/Outlook** sync · **ICS feeds for everyone** — parents and tutors subscribe read-only from day one (cheapest integration with the highest daily value) · Calendly stays off the roadmap: booking is native; their tile on Noto's page is lead-capture we do in-product.
### T3 · Meet & teach — Phase 1–2 (the tier Noto entirely lacks)
- **Meeting-link automation:** Zoom via per-tutor OAuth (the TutorCruncher pattern — avoids org-license cost), Google Meet via Workspace, Teams — links minted per session, injected into reminders and the session record.
- **Classroom provider adapter** (one interface, pluggable providers): **Lessonspace first** (tutoring-org fit, persistent spaces, recordings back onto the session), **Pencil Spaces** second; LearnCube where language schools ask. Recordings/attendance flow back through webhooks onto the session timeline.
### T4 · Comms — Phase 2
- **Twilio SMS** session reminders + guardian alerts (A2P 10DLC registration accounted in setup) · **Gmail / Outlook send-as** so business email leaves as the business · **WhatsApp Business** notifications (Noto-parity; global families) · **Slack** for ops teams — day one via the automation rail, native app later. All family-directed comms sit behind consent records (doc 07); channels are consent-scoped per guardian.
### T5 · Growth — Phase 2–3
- **Mailchimp** audience sync (members/leads, tag-based) · **Meta Lead Ads + Google Ads lead forms → `leads`** endpoint (the highest-ROI growth integration for local tutoring businesses) · HubSpot/Salesforce via the rail first, native only on pull · Typeform/Jotform via the rail (native forms exist).
- **Google Sheets** live export via the rail + first-party CSV/Sheets sync for reporting parity with Noto's tile.
### T6 · Education — Phase 4 (doc 13 §11, unchanged)
LTI 1.3 / OneRoster / Clever / ClassLink — plus **Google Classroom** roster-lite for businesses that tutor school cohorts.
### T7 · The automation rail — Phase 1 launch requirement
**Zapier app** (triggers from the webhook event catalog: `session.created`, `invoice.paid`, `lead.created`, `payout.settled`…; actions from the typed API: create member/session/invoice) · **Make** module + **n8n** community node after. Because triggers/actions are *generated* from the doc-13 catalog, the rail can't drift from the API.
### T8 · AI — Phase 2 flagship differentiator
**The Moyo MCP server**: ops-scoped tools (today's schedule, roster lookups, invoice status, draft session, revenue summaries) with proper `readOnlyHint`/`destructiveHint` annotations, org-scoped API-key auth, listed in the Claude connectors directory and ChatGPT Apps. One server, every AI host — the integration surface no tutoring incumbent ships, and the one that makes "ask your AI where your Tuesday gaps are" real for a studio owner. **Child-safety line, restated for this tier:** the MCP surface is the *public ops API* wearing a protocol — learner learning data (transcripts, knowledge graph, AI sessions) is structurally absent, same CI check as doc 13 §5.

## 4. Architecture (all tiers)
- **Integration framework on the Block:** encrypted per-org OAuth token vault; every outbound call through a provider adapter with pg-boss retries + dead-letter; per-integration scopes; org-level kill-switch; audit events on connect/disconnect/sync.
- **Health surface:** an integrations dashboard — last sync, error state, dead-letter count, re-auth prompts. Silent integration rot is how trust dies; ours is visible.
- **Registry-gated:** which tier gets which integration is a registry entry, so the paywall copy, the gate, and the docs stay one fact.
- **PII minimization outward:** calendar/video titles default to first-name-plus-initial; full learner details never leave for T2/T3 providers beyond what the session requires; comms channels per-guardian consent-scoped.

## 5. Competitive position after this doc
| | Noto | Teachworks | TutorCruncher | **Moyo plan** |
|---|---|---|---|---|
| Automation rail | Zapier ✓ | Zapier ✓ | – | Zapier + Make + n8n, catalog-generated |
| Accounting | QBO (tile) | **QBO native** | CSV exports | QBO + Xero native two-way |
| Classroom/video | **none** | Lessonspace + links | richest bench | provider adapter: Lessonspace → Pencil, links for Zoom/Meet/Teams |
| Payouts | Stripe | Stripe | Wise/GoCardless | Stripe Connect native (+GoCardless eval UK) |
| SMS/WhatsApp | WhatsApp only | SMS ✓ | – | Twilio SMS + WhatsApp, consent-scoped |
| Education standards | – | – | – | LTI/OneRoster/Clever/ClassLink track |
| **AI/MCP** | ChatGPT (rail tile) | – | – | **First-party MCP server in both directories** |

## 6. PRs
- **PR-32 · Integration framework (Wave 4):** token vault, provider adapter interface, health dashboard, registry gating, kill-switch, audit events.
- **PR-33 · T1/T2 natives:** QBO two-way sync, Google Calendar sync, ICS feeds; Xero fast-follow.
- **PR-34 · Automation rail:** Zapier app generated from the event catalog + typed actions; Make/n8n after certification.
- **PR-35 · Classroom adapter:** interface + Lessonspace provider; meeting-link automation (Zoom per-tutor OAuth, Meet, Teams).
- **PR-36 · Moyo MCP server:** ops toolset with annotations, directory submissions (demo org, domain verification), abuse-rate limits.
- **PR-37 · Comms:** Twilio SMS (10DLC), WhatsApp Business, send-as email — consent-gated.
Launch minimum (with public API GA): Stripe native, GCal + ICS, meeting links, Zapier, webhooks. Fast-follow: QBO, SMS, Lessonspace, MCP.

## 7. Sources (linked)
**Noto:** [integrations page](https://www.withnoto.com/integrations) · [Zapier page](https://www.withnoto.com/zapier-integration)
**Teachworks:** [integrations](https://www.teachworks.com/features/integrations) · [60+ integrations post](https://blog.teachworks.com/2023/06/celebrating-over-60-teachworks-integrations-add-ons/) · [common integrations](https://blog.teachworks.com/2024/11/maximizing-efficiency-common-software-integrations-for-tutor-management-systems/) · [resource list](https://blog.teachworks.com/the-ultimate-resource-list-for-educational-businesses/) · [Stripe integration doc](https://teachworks.zendesk.com/hc/en-us/articles/360004870534-Stripe-Integration) · [Lessonspace add-on](https://www.teachworks.com/addons/lessonspace)
**TutorCruncher:** [integrations](https://tutorcruncher.com/integrations) · [Zoom per-tutor model](https://help.tutorcruncher.com/en/articles/14182754-integrating-with-zoom) · [Xero import flow](https://help.tutorcruncher.com/en/articles/11088759-importing-accounting-data-into-xero)
**Classroom landscape:** [Kaltura top-5 2026](https://corp.kaltura.com/blog/virtual-classrooms-platforms/) · [Tutorbase video tools 2026](https://tutorbase.com/blog/best-video-conferencing-tools-for-online-tutoring) · [Koala Go comparisons](https://www.teachwithkoala.com/answers/online-tutoring-platforms) · [spotSaaS category](https://www.spotsaas.com/category/virtual-classroom-software)
**MCP/AI:** [MCP spec & registry](https://modelcontextprotocol.io/) · [Truto MCP 2026 guide](https://truto.one/blog/what-is-mcp-model-context-protocol-the-2026-guide-for-saas-pms/) · [Truto MCP architecture guide](https://truto.one/blog/what-is-an-mcp-server-the-2026-architecture-guide-for-saas-pms/) · [ayautomate MCP analysis](https://www.ayautomate.com/blog/mcp-protocol-explained) · [Advisable MCP strategy](https://www.advisable.com/insights/the-mcp-revolution-what-model-context-protocol-means-for-saas-products-and-startups-in-2026) · [first-person connector submission writeup](https://joeir.substack.com/p/submitting-my-mcp-server-as-a-claude)
All studied for patterns; no copy reproduced.