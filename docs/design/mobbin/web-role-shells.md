<!-- Mobbin pass: web-role-shells — role-specific web chrome for learner, guardian, tutor, teacher, school/district admin, and business -->
<!-- SOT: apps/web/components/site/RoleShell.tsx · apps/web/components/site/MarketingHeader.tsx -->
<!-- SOT-KEYWORDS: mobbin web role shell sidebar rail navigation admin dashboard -->

## Mobbin pass: web-role-shells

| App | Link | Structural move adopted |
| --- | --- | --- |
| Teachable | https://mobbin.com/screens/6a15e96c-6baf-49ed-8cc1-3e564b8d8b78 | Use a persistent left sidebar with a compact profile block at the top and a clear, role-scoped primary section (`MY SCHOOLS`) so the user always knows which persona they are acting in. |
| ClassDojo | https://mobbin.com/screens/042d21b1-6ee8-462e-8b1a-65d84ccbf5df | Separate the global nav rail from the main content and put the account menu in the top-right; the main canvas stays chrome-free. |
| Docusign | https://mobbin.com/screens/aa2932b5-6c6f-41f7-b11c-ed84a318f9de | Collapse related items into grouped, labeled sections in the sidebar (`INTEGRATIONS`, `AGREEMENT ACTIONS`) so the navigation scales without becoming a flat list. |
| Whop | https://mobbin.com/screens/2a088870-3e95-4162-a236-355b5a7e6890 | Add a `Preview as` switcher in the top bar so the same shell can be tested across roles without rebuilding the page. |
| Google Workspace | https://mobbin.com/screens/71f049c6-935c-42a8-95fb-7a682cf551e2 | Keep the top bar minimal (search, notifications, account) and let the left rail own the role hierarchy; the active item is highlighted and expanded. |
| Shopify | https://mobbin.com/screens/fb76997e-c0aa-4813-9ed7-34c9136b9d85 | Keep marketing / onboarding cards (`Things to do next`) in the main area and out of the navigation; the shell provides the frame, the content provides the next steps. |

### Refused

| App | Link | Pattern | Why refused |
| --- | --- | --- | --- |
| ClassDojo | https://mobbin.com/screens/042d21b1-6ee8-462e-8b1a-65d84ccbf5df | A right-side account dropdown with opaque role switching | The active role must be visible in the shell itself, not hidden behind a top-right menu, so a guardian and teacher never share the same nav by accident. |
| Docusign | https://mobbin.com/screens/aa2932b5-6c6f-41f7-b11c-ed84a318f9de | A single `Admin` top-level that bundles all admin actions | We split school admin, district admin, and business owner into separate role shells so permissions are explicit in the URL and the navigation. |
| Whop | https://mobbin.com/screens/2a088870-3e95-4162-a236-355b5a7e6890 | A preview switcher exposed to every user | The role switcher is dev-only in Moyo; production users have one role per session, and the shell gates on it. |
| Google Workspace | https://mobbin.com/screens/71f049c6-935c-42a8-95fb-7a682cf551e2 | A deeply nested, multi-level admin rail | We keep the role rail to one level plus an account section; deep hierarchies live in the main canvas, not the shell. |
| Shopify | https://mobbin.com/screens/fb76997e-c0aa-4813-9ed7-34c9136b9d85 | Marketing onboarding cards (`Try Shopify Magic`) inside the logged-in dashboard | Moyo keeps promotional upsells off all learner and guardian surfaces; the marketing site is a separate shell. |

### Query used

**Query:** "web dashboard with role-based sidebar or rail navigation for school admin or district admin"  
**Platform:** web  
**Task intent:** Designing role-specific web shells for a K-12 AI tutoring app
