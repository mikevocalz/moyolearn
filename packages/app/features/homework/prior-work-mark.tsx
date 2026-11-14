'use client';

import { Checkbox, Text } from '@acme/ui';
import type { PriorWork } from './homework.types.ts';

export function PriorWorkMark({ value, questionNumber, sourcePage, onChange, disabled = false }: {
  value: PriorWork;
  questionNumber: number;
  sourcePage: number;
  onChange?: (value: PriorWork) => void;
  disabled?: boolean;
}) {
  const complete = value === 'complete';
  if (!onChange) return complete ? <Text variant="caption" tone="muted">✓ Already done before upload</Text> : null;
  return <Checkbox
    label={`Problem ${questionNumber}, page ${sourcePage}: Already done before upload`}
    checked={complete}
    className="min-h-14 py-2"
    disabled={disabled}
    onChange={(checked) => onChange(checked ? 'complete' : 'none')}
  />;
}
