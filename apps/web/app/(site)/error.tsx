'use client';

import { ErrorScreen } from '@acme/app';

/**
 * `error.digest`, never `error.message`: the message is raw exception text on a
 * surface a child can reach, and the digest is what maps to the server log.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorScreen kind="error" reference={error.digest} onRetry={reset} />;
}
