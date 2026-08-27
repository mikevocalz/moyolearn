# Sentry on the Free Tier — errors and crash health, nothing else
**Doc 35 · Moyo platform pack · Date:** Aug 27, 2026
**Scope:** how Sentry fits Moyo (Expo RN app · Next 16 web · Payload server · pg-boss workers) on the **free Developer plan** without burning it — plus the child-privacy scrub law that applies regardless of tier, and a verification checklist against the "wired and scrubbed" claim in the repo (which I can't read from here; the checklist is how you prove it).
**Builds on:** doc 12 (workers, cost discipline), doc 19/24 (learner content rules, ≤2s SLO), doc 21 (analytics own latency truth), doc 31 (S4 paging), doc 33 PRD (NFRs).

---

## §1 · The quotas and the mechanics (researched, with one conflict flagged)

**Free Developer plan, 2026:** 1 user, **5,000 errors/month**, 30-day history, 10 dashboards — that's the certain core. ToolPick (verified against the official page Jul 2026) additionally lists **5M spans, 50 replays, 1 uptime monitor, 1 cron monitor, 20 metric monitors, 5GB logs** on Developer; one analyst source attributes some of those to paid plans. **Design rule: treat 5k errors as the scarce, certain resource and everything else as "present but small — verify on the pricing page at setup."** The plan below works even if the extras are half that.

**What does NOT count against quota** (Sentry's own docs — this is the whole strategy):
- Events never sent by the SDK: `sampleRate`, `beforeSend` returning null, `ignoreErrors`/`denyUrls`.
- **Inbound filters — server-side, pre-quota, free filtering** (browser extensions, crawlers, legacy browsers, localhost, specific releases).
- Events dropped by **spike protection** (per-project, dynamic hourly-recalculated threshold; applies to errors, spans, attachments).
- Events past quota (the SDK backs off on 429 and those events are **permanently lost** — which is why §6's burn alert exists).
- Repeats on issues you've set to **Ignore**. (Delete-&-Discard and per-project rate limits are Business-plan features — don't design around them.)

**What DOES count:** every accepted event, including repeats on *resolved* issues (that's regression signal — you want those).

**Free tier can't surprise-bill you** — there's no overage; it goes dark at quota. The failure mode isn't cost, it's **blindness for the rest of the month**. Every rule below is protecting visibility, not money.

## §2 · Role definition — the sentence that saves the tier

**Sentry answers "what broke, for whom, in which release." Nothing else.** In this stack:
- **Latency SLOs (≤2s capture→coach) are measured by our own timing events into Postgres** (docs 21/24) — a 1–2% trace sample produces vanity waterfalls, not SLO truth, and full tracing is the classic quota fire. **`tracesSampleRate: 0` in production.** (If Phase-1 tuning wants waterfalls, a `tracesSampler` returning ~0.02 for the single capture→first-token transaction is the only sanctioned exception, and it goes back to 0 after.)
- **Product analytics live in docs 19/21**, never in Sentry.
- **Uptime/queue health** ride the two free monitors (§5), not events.
- **Local dev sends nothing, ever**: `enabled: !__DEV__` / env-gated DSN, and use Spotlight for local Sentry-style debugging with zero cloud events. Dev noise is the #1 silent quota leak.

## §3 · Project topology and the error budget

Three projects under one org (projects are free; quota is pooled): **`moyo-mobile`**, **`moyo-web`**, **`moyo-server`** (Payload + pg-boss workers share it, separated by a `runtime: server|worker` tag). Separate projects buy clean triage, per-project spike protection, and per-project burn alerts.

**Budget 5,000/mo as alert thresholds** (spend allocation is a paid feature — on free, the budget is enforced by alarms + the client-side breaker, not by Sentry): mobile 2,500 · server/worker 1,500 · web 1,000. That's ~83 mobile errors/day; a healthy app with the discipline below sits far under it.

## §4 · The config that does the work

**Every surface:**
```ts
Sentry.init({
  dsn: process.env.SENTRY_DSN,          // per-project; absent in dev
  enabled: process.env.NODE_ENV === 'production',
  environment: process.env.APP_ENV,      // 'production' | 'preview'
  release: RELEASE_ID,                   // sourcemaps make 5k errors worth 50k
  sendDefaultPii: false,                 // LAW — see §7
  maxBreadcrumbs: 30,
  sampleRate: 1.0,                       // capture all *unique real* errors…
  tracesSampleRate: 0,                   // …and no perf events (per §2)
  ignoreErrors: [
    'Network request failed', 'Failed to fetch', 'Load failed',
    'AbortError', 'TimeoutError',
    /ResizeObserver loop/, /Non-Error promise rejection/,
  ],
  beforeSend: withStormBreaker(scrubEvent),   // §4.1 + §7
})
```

### §4.1 The storm breaker (the free-tier killer, killed client-side)
One device in a retry/render loop can emit thousands of identical events and end your month by lunch. Spike protection helps server-side; kill it before it leaves the device:
```ts
// packages/observability/stormBreaker.ts — pure, bun-testable
const seen = new Map<string, number>()   // fingerprint -> count this session
const MAX_PER_FINGERPRINT = 5
const MAX_PER_SESSION = 20
let sessionTotal = 0

export const withStormBreaker = (next: BeforeSend): BeforeSend => (event, hint) => {
  const fp = fingerprintOf(event)        // type + top frame + message class
  const n = (seen.get(fp) ?? 0) + 1
  seen.set(fp, n)
  sessionTotal++
  if (n > MAX_PER_FINGERPRINT || sessionTotal > MAX_PER_SESSION) {
    if (n === MAX_PER_FINGERPRINT + 1)
      Sentry.addBreadcrumb({ message: `storm-breaker tripped: ${fp}` }) // rides the *next* real event
    return null                          // dropped client-side: no network, no quota
  }
  return next(event, hint)
}
```
Expected-offline errors are the RN-specific storm: doc 24's offline capture queue **must log queue transitions as breadcrumbs, never events** — offline is a state, not an error.

### §4.2 Mobile (`@sentry/react-native` via the Expo plugin)
- New Architecture support: **pin the SDK version against RN 0.86 at PR** (house rule); sourcemaps + dSYM upload through the Expo config plugin in EAS builds.
- **`enableAutoSessionTracking: true`** — release-health sessions power **crash-free rate**, the one mobile health number that matters; sessions are a separate category from errors (verify current accounting at setup, but this has not historically eaten error quota).
- **Session Replay: never on learner surfaces — this is law, not budget** (§7). `replaysSessionSampleRate: 0`, `replaysOnErrorSampleRate: 0` in the mobile app, full stop.
- Native crash handling on; ANR detection on Android (a hung tutor session is a real error).

### §4.3 Web (`@sentry/nextjs` on Next 16)
- Verify current Next 16/Turbopack compatibility of `@sentry/nextjs` at PR — this pairing moved fast through 2025–26.
- `tunnelRoute: '/monitoring'` so ad-blockers don't eat the error reports that *do* matter (an unreported crash is worse than a blocked one).
- Client + server + edge configs all inherit §4's base; **inbound filters ON in project settings** (extensions, crawlers, legacy browsers, localhost) — free, server-side, zero quota.
- Replay on the **admin/ops (Cool) surfaces only, and only later if wanted**: `replaysOnErrorSampleRate: 0.1` fits the 50/mo quota. v1 ships with replay **off everywhere** — masked replays still leak layout and typing cadence, and the learner rule in §7 is simpler to enforce as "no replay SDK on any surface a child can reach."

### §4.4 Server & workers
- `@sentry/node` in Payload hooks and pg-boss handlers; every job wrapped so a throw carries `{ queue, jobId }` tags — **jobId, never payload contents** (§7).
- Unhandled rejection + uncaught exception handlers on; `beforeSend` scrubs request bodies and headers wholesale (allowlist, not denylist).

## §5 · The two free monitors, spent precisely
- **The 1 cron monitor guards the retention/erasure sweep.** Of every scheduled job, the one whose *silent* death is a compliance breach is erasure (docs 12/19) — a dead drain is loud (queues back up), a dead eraser is silent. Check-in wraps the sweep with `monitorSlug: 'retention-sweep'`.
- **The 1 uptime monitor is a dead-man switch for the whole worker fleet:** it polls `/api/health/jobs`, which returns 500 unless every critical queue's `last_success_at` is fresh (thresholds per queue). One monitor, entire fleet, zero events.
- **Vercel-cron sidebar:** you don't need a paid Vercel tier for the */30 drain. pg-boss lives *in* Postgres — **Supabase `pg_cron`** can run the maintenance/enqueue directly in-database (same clock, same database, no HTTP, no Vercel dependency), or a GitHub Actions `schedule` can hit the drain endpoint (free, ~5-min floor, best-effort timing). Either keeps Hobby viable; `pg_cron` is the clean one. The uptime dead-man switch then verifies whichever you choose is actually alive.

## §6 · Alerts (all free-tier)
1. **Quota-burn metric alert per project**: event count > (daily budget × 1.5) in 24h → email. This is the alarm that prevents month-long blindness.
2. New-issue alert (first occurrence only) and **regression alert** (resolved issue re-fires — the repeat class that rightly costs quota).
3. Spike-protection notifications on for all three projects.
4. Weekly digest as the floor.
S4-related paging (doc 31) stays on its own path — **Sentry is not the S4 pager**; safety paging must not share fate with an exhausted error quota.

## §7 · The scrub law — child privacy outranks debugging, every tier
1. `sendDefaultPii: false` on every surface; **"Prevent Storing of IP Addresses" ON** in all three projects' settings and `ip_address: null` on user context — under the amended COPPA (eff. Apr 22, 2026), IP + persistent identifiers are children's personal information.
2. User context is **pseudonymous only**: internal `userId`/`learnerRef` hash. Never a learner's name, email, grade, school. Guardian email never attaches to events from learner surfaces.
3. **No message content anywhere**: transcript text, homework capture text/URLs, TTS payload text, and child answers appear in no event, breadcrumb, context, or tag. Fetch/console breadcrumbs are scrubbed by allowlist (`url` host + status only, bodies dropped).
4. **No Session Replay on any surface a child can reach** — a replay of a tutoring session is a recording of a child's work and chat: learner content with retention/erasure obligations Sentry's 30-day store can't honor. This one is not a sampling decision.
5. Attachments off; screenshots off (`attachScreenshot: false` on mobile — same reason as replay).
6. Signed Bunny URLs, tokens, and DSN-adjacent secrets never in events (allowlist scrubbing catches these); server `beforeSend` drops request bodies wholesale.
7. Tags are an **allowlist**: `band`, `surface`, `release`, `runtime`, `queue`, `jobId`. Anything else is a review.

### The verification checklist (run against the repo)
| # | Check | How |
|---|---|---|
| 1 | `sendDefaultPii` false everywhere | `grep -rn "sendDefaultPii" --include=*.ts` → every hit `false` |
| 2 | No replay on learner surfaces | `grep -rn "replaysSessionSampleRate\|Replay" apps/mobile packages/app` → zero integrations |
| 3 | Dev sends nothing | `grep -rn "enabled:" ` in Sentry inits → gated on production; run dev, confirm 0 events in Sentry |
| 4 | Storm breaker present + tested | `beforeSend` chain includes per-fingerprint/session caps; tests cover the trip |
| 5 | Offline = breadcrumbs | doc-24 queue code emits no `captureException` on expected offline paths |
| 6 | Traces off | `grep -rn "tracesSampleRate"` → 0 in production configs |
| 7 | IP storage off | Sentry UI: all 3 projects → Security & Privacy → prevent IP storage ON |
| 8 | Inbound filters on | Sentry UI: web project filters enabled |
| 9 | Tag allowlist | `grep -rn "setTag\|setContext\|setUser"` → only §7.7 keys; `setUser` carries id only |
| 10 | Sourcemaps land | trigger a test error in preview → stack is readable |
| 11 | Cron + uptime wired | erasure sweep check-in visible; `/api/health/jobs` goes 500 when a queue is stale (test by pausing it) |
| 12 | Burn alert fires | temporarily set threshold to 1, trigger 2 events, confirm email |

## §8 · PRs
- **PR-132 · Observability package** — shared init factory, storm breaker, scrub allowlist (pure fns).
- **PR-133 · Per-surface wiring** — mobile/web/server inits, tunnelRoute, session tracking, sourcemap CI.
- **PR-134 · Monitors + alerts** — erasure-sweep check-in, `/api/health/jobs` dead-man endpoint, burn alerts, spike protection + inbound filters (UI, documented as code comments).
- **PR-135 · Drain off Vercel cron** — `pg_cron` (preferred) or GH Actions schedule; Hobby tier stays viable.
- **PR-136 · Verification** — the §7 checklist as a repeatable script + CI grep gates for the lawful invariants (1/2/6/9).

## §9 · Sources
Sentry quota management docs · Spike protection docs · cubeapm pricing review 2026 · ToolPick Developer-plan limits (Jul 2026) · costbench pricing · PricePulse replay-cost analysis · Spotlight (local, zero-quota) · Pack docs 12/19/21/24/31/33.
