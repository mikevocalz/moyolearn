# Flow Contract — district.people

```yaml
screen_id: district.people
role: district
tenant: [district]
band: n/a
shell: district (web-rail only; rail label **Educators** per doc 36 §3.5 / G §3.2 rename; ADR-d default — no mobile)
entry_points:
  - "rail: Educators"
  - "push: from school.home or district.schools (J7 drill, school → people)"
  - "deep_link: /people on the district host (PeopleListScreen, shared with school today — scope to educators per D action)"
answers_within_5s:
  - "Who teaches in my district (or in the school I drilled from)?"
  - "Can I find a specific educator fast?"
primary_action: "Find and open an educator's detail"
secondary_actions:
  - "Search/filter educators"
  - "Return to the school or district scope drilled from"
exits:
  roll_up_school_scope: school.home
  roll_up_district_scope: district.home
  rail_schools: district.schools
  rail_compliance: district.compliance
  rail_settings: sys.settings
completion_returns_to: self (search/filter state intact); roll-up per J7 to the scope it was entered from
back_behavior: "Browser back walks the drill path up (people → school.home → district.schools → district.home), never dead-ends. Filter state survives return."
failure_paths:
  offline: "Retry"
  no_data: "No educators rostered → honest empty state"
  permission: "An educator row never links to learner-level data — insight past this level waits on J7's class/student [M] nodes; role-mismatched deep link → sys.not-found"
  suppression: "Any per-educator aggregate (outcome roll-ups) obeys k-anon — \"Not shown\" under threshold (E §2). Directory facts (name, school, role) are not aggregates and render normally."
cross_role_propagation:
  - "None outbound. District admins never reach transcripts, reports, or incident contents through this list (E §2 district boundaries)."
cross_device_continuity: "n/a — web-only; URL carries scope (district vs school drill) and query."
max_interactions_to_primary: 2
state_owner: "server (Memberships/Enrollments roster) via React Query; URL owns search/filter"
```

**Status:** PARTIAL (D-screen-inventory verbatim). Web `PeopleListScreen` live but shared with school and not educator-scoped; naming (People → Educators) and scoping per doc 36 §3.5 are the build work.

**Notes:**
- **Drill-down terminates here by contract.** J7: "drill-down stops at people — class and student levels don't exist, so insight can't reach anything actionable." Extending the chain requires new D-inventory rows (class, student), not an exit added here — this contract is the fence.
- Shares the component with school.people; two scoped mounts, one implementation.
