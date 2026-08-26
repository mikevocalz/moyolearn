import { ONBOARDING_FLOWS, OnboardingFlowScreen } from '@acme/app';

/**
 * The five sequences are a closed set, so they prerender like every other route
 * here. Without this the segment is runtime data and the build refuses to
 * prerender it — and a slug outside the set still renders, via the screen's own
 * fallback, rather than a 404 with no way back.
 */
export function generateStaticParams() {
  return Object.keys(ONBOARDING_FLOWS).map((flow) => ({ flow }));
}

// `params` is a promise in Next 15+.
export default async function OnboardingFlowPage({
  params,
}: {
  params: Promise<{ flow: string }>;
}) {
  const { flow } = await params;
  return <OnboardingFlowScreen flow={flow} />;
}
