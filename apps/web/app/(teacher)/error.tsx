'use client';

import { ErrorScreen } from '@acme/app';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorScreen kind="error" reference={error.digest} onRetry={reset} />;
}
