// Band gate for /subjects — K–2 ('young') has no Subjects surface (doc 36
// §3.1), but web URLs stay reachable off-band (C-orphans §Web dead-end
// fragments; G §3.1 delta). Layout-level so any future nested detail route
// under /subjects inherits the gate — a page-level wrap would cover only the
// index.
// SOT: docs/design/overhaul-v2/C-orphans-dead-ends.md §Web dead-end fragments ·
//      docs/design/overhaul-v2/G-navigation-maps.md §3.1 ·
//      docs/pack/36-role-navigation-flows.md §3.1
// SOT-KEYWORDS: subjects layout band gate young K-2 url reachability
import type { ReactNode } from 'react';
import { BandGate } from '../../../components/site/BandGate';

export default function SubjectsLayout({ children }: { children: ReactNode }) {
  return <BandGate surface="/subjects">{children}</BandGate>;
}
