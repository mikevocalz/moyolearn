// Band gate for /progress — only 6–8/9–12 ('teen'/'adult') carry a Progress
// surface (doc 36 §3.1), but web URLs stay reachable off-band (C-orphans §Web
// dead-end fragments; G §3.1 delta). Layout-level so any future nested route
// under /progress inherits the gate.
// SOT: docs/design/overhaul-v2/C-orphans-dead-ends.md §Web dead-end fragments ·
//      docs/design/overhaul-v2/G-navigation-maps.md §3.1 ·
//      docs/pack/36-role-navigation-flows.md §3.1
// SOT-KEYWORDS: progress layout band gate young child url reachability
import type { ReactNode } from 'react';
import { BandGate } from '../../../components/site/BandGate';

export default function ProgressLayout({ children }: { children: ReactNode }) {
  return <BandGate surface="/progress">{children}</BandGate>;
}
