# Ops Dashboard Data Architecture — five libraries, five jobs, zero overlap
**Doc 28 · Moyo platform pack · Date:** Aug 25, 2026
**Stack requested:** TanStack Query · Table · Virtual · Pacer + Zustand. All five are adopted. The value of this doc is not "install these" — it's the **ownership boundaries**, because every one of these libraries is capable of doing another one's job badly, and a dashboard where two libraries both think they own the row data is the single most common way this stack rots.

---

## 1. One correction and three maturity facts
- **Zustand is not TanStack** — it's pmndrs. Worth stating because the mental grouping is exactly what causes the overlap bug in §3: people reach for Zustand as "the TanStack state one" and start mirroring server data into it.
- **TanStack Table v9** went beta June 2026 and its GA announcement landed ~3 weeks ago. Its headline is **opt-in, tree-shakable features — a small table starts around ~5kb** instead of v8 bundling everything, which serves the doc-20 size ratchet directly. Migration is designed to be gradual with legacy support.
- **Pacer is beta by its own documentation** ("API is still subject to change"), and **TanStack Store is alpha**. Query and Virtual are stable.
- **Therefore:** the code in this doc targets **v8 stable APIs**; check the installed version at PR and move to v9 if it's GA in your lockfile — the composition below doesn't change, only the table factory call. Pin every version at the PR, never from this doc.

## 2. Ownership — each library owns exactly one thing
| Library | Owns | Never touches |
|---|---|---|
| **TanStack Query** | Server state: fetching, caching, invalidation, background refresh, pagination cursors | UI state, form state, anything the user is mid-editing |
| **TanStack Table** | Headless table *logic*: columns, sort/filter/group models, selection, row identity | Fetching, rendering, persistence |
| **TanStack Virtual** | Windowing: which rows are in the DOM | What the rows contain, when they load |
| **TanStack Pacer** | *When* functions run: debounce, throttle, rate limit, queue, batch | What they do |
| **Zustand** | Durable client view state that outlives a component: visible columns, saved views, density, sidebar | Server data. Ever. |

## 3. The four overlap traps (this is the doc's real content)
1. **Zustand mirroring server data.** The moment `rows` live in a Zustand store, you own cache invalidation by hand and Query becomes a fetch wrapper. Rule: **if it came from the server, Query owns it; components read it with `useQuery`, not from a store.** Zustand holds preferences *about* the data, never the data.
2. **Pacer debouncing the wrong layer.** Don't debounce refetches — Query already has `staleTime`, dedupe, and `placeholderData`. **Debounce the input that changes the query key**, so a search box produces one key transition instead of eight. Pacer times the *user's* keystrokes; Query times the network.
3. **Table state that should be in the URL.** Sorting, filters, and the active view are things people share and bookmark. Keep them in **search params** (source of truth) → feed Table → feed the query key. Zustand is for things nobody would paste into Slack: column visibility, row density.
4. **Query mutations colliding with doc 17.** Doc 17 set the boundary: *self-changing data → TanStack Query; user-action-only → React 19 `useActionState`/`useOptimistic` over a pure change-reducer.* That still holds. A CRM drag-reschedule is a user action — it goes through the doc-17 reducer path for coherent optimistic ordering, **then invalidates the Query key on settle.** Query is the read model; the reducer is the write model. Don't run two optimistic systems over the same rows.

## 4. Where the dashboard lives
**Its own Next.js route in the app — not a Payload admin custom view.** Payload's admin is for content and config editing and has its own opinionated list views; mounting a CRM inside it means fighting that shell for every interaction. Doc 23's Operations Cloud is a *product surface* with its own UX, permissions, and design language. The Payload theme (`custom.scss`) makes the CMS *look* like the product; this dashboard *is* the product. One shared token file keeps them coherent.

## 5. The composition, in one paragraph
Search params hold sort/filter/view. A Pacer-debounced search value feeds the query key. `useInfiniteQuery` fetches server-paginated, server-sorted pages (`manualSorting`/`manualFiltering`/`manualPagination` — never ship all rows to the client for a CRM). Rows flatten into TanStack Table for column and selection logic only. TanStack Virtual windows the flat row list against a scroll container and triggers the next page when the last virtual item nears the end. Zustand holds column visibility and density across sessions. Writes leave through the doc-17 reducer and invalidate on settle.

## 6. Performance budget
Virtualize past ~100 rows; below that it costs more than it saves. Overscan 8–12. Fixed row height where possible (`estimateSize` constant) — dynamic measurement is real work and only worth it for expanding rows. Column virtualization only past ~25 columns. Watch the doc-20 ratchet after adding these: Table v9's tree-shaking should make this a smaller add than v8 was.

## 7. PRs
- **PR-93 · DataTable primitive** — the hook + renderer + store below, one shared component for every ops surface.
- **PR-94 · Leads pipeline surface** on the primitive (doc 23 §3 stages, saved views).
- **PR-95 · Sessions + invoices surfaces** (proves the primitive generalizes; if it doesn't, fix the primitive, not the surface).
- **PR-96 · Write path** wiring doc-17 reducers + invalidation, two-overlapping-moves acceptance test.

## 8. Sources (linked)
[TanStack Pacer overview](https://tanstack.com/pacer/latest/docs/overview) · [Pacer: which utility to choose](https://tanstack.com/pacer/latest/docs/guides/which-pacer-utility-should-i-choose) · [Pacer rate limiting](https://tanstack.com/pacer/latest/docs/guides/rate-limiting) · [Announcing TanStack Table V9](https://tanstack.com/blog/announcing-tanstack-table-v9) · [Table v9 site](https://tanstack.com/table/v9) · [InfoQ on V9 beta](https://www.infoq.com/news/2026/07/tanstack-table-v9-beta/) · [TanStack ecosystem maturity guide](https://blog.openreplay.com/tanstack-ecosystem-guide/) · [TanStack Query](https://tanstack.com/query/latest) · Pack docs 17/20/22/23.
