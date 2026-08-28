/**
 * `/globe-lab` — the globe's own proving ground.
 *
 * A self-contained demo of everything ADR-002 claims: the three performance
 * tiers, the reduced-motion path, the imperative seam, and the fact that none
 * of it breaks the SSR lane. It is NOT part of the marketing site.
 *
 * EXCLUDED FROM THE SITEMAP by `robots: noindex, nofollow` and by not being
 * linked from any page — `crawlLinks` in `vite.config.ts` only follows anchors,
 * so nothing reaches this route by crawling. It IS prerendered, deliberately:
 * the most valuable single check on this whole chapter is that a page
 * containing the globe island still emits real HTML, and a route that is never
 * prerendered cannot prove that.
 *
 * The chapter copy, the pinned scroll timeline and the hand-off into chapter 05
 * belong to other agents and are deliberately absent. What this page shows is
 * the engine.
 *
 * SOT: docs/site/adr-002-globe-geometry.md · docs/site/globe-api.md
 * SOT-KEYWORDS: globe lab route demo tiers reduced motion prerender noindex
 *               performance override phase seam
 */
import { Heading, Text } from '@acme/ui/typography';
import { Button, List, ListItem, Main, Paragraph, Section, View } from '@acme/ui/primitives';
import { createFileRoute } from '@tanstack/react-router';
import { globeApi } from '@/globe/api';
import { Globe } from '@/globe/globe';
import { GLOBE_LODS } from '@/globe/generated/manifest';
import { useGlobeStore } from '@/globe/globe-store';
import { type PerfTier, resolveTier, usePerfStore } from '@/stores/perf-store';

export const Route = createFileRoute('/globe-lab')({
  head: () => ({
    meta: [
      { title: 'Globe lab — Moyo' },
      // Prerendered so the SSR lane can be checked, but never indexed: this is
      // engineering scaffolding, not a page anybody should land on from search.
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
  component: GlobeLab,
});

const TIERS = ['A', 'B', 'C'] as const satisfies readonly PerfTier[];

const TIER_SUMMARY = {
  A: `full geometry (${GLOBE_LODS.hi.triangleCount.toLocaleString('en-US')} triangles), grain pass, DPR ≤ 1.5, AA off`,
  B: `reduced geometry (${GLOBE_LODS.lo.triangleCount.toLocaleString('en-US')} triangles), no grain, DPR 1, coarser sphere and rings`,
  C: 'no WebGL — the build-time SVG silhouette, same composition and same facts',
} as const satisfies Record<PerfTier, string>;

const PHASES = [0, 0.25, 0.5, 0.75, 1] as const;

const CONTROL_CLASS =
  'min-h-target-adult items-center justify-center rounded-moyo-card border-moyo-rule border-moyo-outline bg-moyo-paper-raised px-inset py-inset-tight shadow-moyo-1 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/50 focus-visible:ring-offset-2';

const CONTROL_ACTIVE_CLASS =
  'min-h-target-adult items-center justify-center rounded-moyo-card border-moyo-rule border-moyo-outline bg-moyo-sun px-inset py-inset-tight shadow-moyo-2 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/50 focus-visible:ring-offset-2';

function GlobeLab() {
  const override = usePerfStore((state) => state.override);
  const setOverride = usePerfStore((state) => state.setOverride);
  const reason = usePerfStore((state) => state.reason);
  const profile = usePerfStore((state) => state.profile);
  const probeFps = usePerfStore((state) => state.probeFps);
  const reducedMotion = usePerfStore((state) => state.reducedMotion);
  const setReducedMotion = usePerfStore((state) => state.setReducedMotion);
  const tier = usePerfStore(resolveTier);
  const phase = useGlobeStore((state) => state.phase);

  return (
    <Main className="min-h-screen bg-moyo-paper py-section">
      <Section className="mx-auto w-full max-w-content-wide px-inset">
        <Heading level={1} className="font-moyo-display text-site-title text-moyo-ink">
          Globe lab
        </Heading>
        <Paragraph className="mt-stack max-w-content-prose text-site-lead text-moyo-ink-muted">
          Chapter 04&rsquo;s engine on its own. Force a tier to see the three of them differ; the
          detected tier and the frame probe are reported below.
        </Paragraph>

        {/*
          Controls above, globe below at full width — not side by side. The
          stage's container query switches the composition at 44rem, and a
          two-column lab would pin the globe below that on every laptop, so the
          corner-card-plus-leader-line arrangement this chapter is actually
          about would never be the thing on screen.
        */}
        <View className="mt-group gap-group">
          <View className="gap-stack">
            <Text className="text-site-label uppercase text-moyo-secondary">Force a tier</Text>
            <View className="flex-row flex-wrap gap-element">
              {TIERS.map((candidate) => (
                <Button
                  key={candidate}
                  onPress={() => setOverride(override === candidate ? null : candidate)}
                  aria-label={`Force tier ${candidate}: ${TIER_SUMMARY[candidate]}`}
                  className={override === candidate ? CONTROL_ACTIVE_CLASS : CONTROL_CLASS}
                >
                  <Text className="text-site-body text-moyo-ink">Tier {candidate}</Text>
                </Button>
              ))}
              <Button
                onPress={() => setOverride(null)}
                aria-label="Clear the forced tier and use detection"
                className={override === null ? CONTROL_ACTIVE_CLASS : CONTROL_CLASS}
              >
                <Text className="text-site-body text-moyo-ink">Auto</Text>
              </Button>
            </View>

            <Text className="mt-stack text-site-label uppercase text-moyo-secondary">
              Drive the seam
            </Text>
            <View className="flex-row flex-wrap gap-element">
              {PHASES.map((value) => (
                <Button
                  key={value}
                  onPress={() => globeApi.setPhase(value)}
                  aria-label={`Set chapter phase to ${Math.round(value * 100)} percent`}
                  className={
                    Math.abs(phase - value) < 0.001 ? CONTROL_ACTIVE_CLASS : CONTROL_CLASS
                  }
                >
                  <Text className="text-site-body text-moyo-ink">
                    setPhase({value.toFixed(2)})
                  </Text>
                </Button>
              ))}
              <Button
                onPress={() => globeApi.reset()}
                aria-label="Reset the globe to its rest composition"
                className={CONTROL_CLASS}
              >
                <Text className="text-site-body text-moyo-ink">reset()</Text>
              </Button>
              {/*
                Writes the store's reduced-motion flag directly, so the path can
                be demonstrated without changing an OS setting. Legitimate only
                here: the flag's real owner is the module-scope media-query
                listener in `@/stores/perf-store`, which will overwrite this the
                moment the reader actually changes the system preference — which
                is the correct precedence, and why this is a lab control and not
                a site control.
              */}
              <Button
                onPress={() => setReducedMotion(!reducedMotion)}
                aria-label={
                  reducedMotion
                    ? 'Simulate reduced motion being off'
                    : 'Simulate the reader having asked for reduced motion'
                }
                className={reducedMotion ? CONTROL_ACTIVE_CLASS : CONTROL_CLASS}
              >
                <Text className="text-site-body text-moyo-ink">
                  {reducedMotion ? 'reducedMotion: on' : 'reducedMotion: off'}
                </Text>
              </Button>
            </View>

            <List className="mt-group gap-element border-moyo-rule border-moyo-outline bg-moyo-paper-sunken p-inset">
              <ListItem>
                <Text className="text-site-body text-moyo-ink">
                  In force: <Text className="font-bold">Tier {tier}</Text> — {TIER_SUMMARY[tier]}
                </Text>
              </ListItem>
              <ListItem>
                <Text className="text-site-body text-moyo-ink">Reason: {reason}</Text>
              </ListItem>
              <ListItem>
                <Text className="text-site-body text-moyo-ink">
                  Reduced motion: {reducedMotion ? 'on — globe still, all nodes shown' : 'off'}
                </Text>
              </ListItem>
              <ListItem>
                <Text className="text-site-body text-moyo-ink">
                  Frame probe: {probeFps === null ? 'not run (no WebGL tier)' : `${probeFps} fps`}
                </Text>
              </ListItem>
              <ListItem>
                <Text className="text-site-body text-moyo-ink">
                  deviceMemory: {profile?.deviceMemory ?? 'not reported'} ·{' '}
                  hardwareConcurrency: {profile?.hardwareConcurrency ?? 'not reported'} · DPR:{' '}
                  {profile?.devicePixelRatio ?? '—'} · WebGL2: {profile?.webgl2 ? 'yes' : 'no'} ·
                  coarse pointer: {profile?.coarsePointer ? 'yes' : 'no'}
                </Text>
              </ListItem>
            </List>
          </View>

          <View className="mx-auto w-full max-w-content-wide">
            <Globe />
          </View>
        </View>
      </Section>
    </Main>
  );
}
