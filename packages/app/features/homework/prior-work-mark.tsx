'use client';
// Mobbin: https://mobbin.com/screens/1f2a7306-e592-4627-9bd6-e5f943251b8c (Slack iOS: checked and unchecked indicators accompany readable item labels) ·
// https://mobbin.com/screens/054dcddf-43f1-4e84-9d42-1ae63a06504b (Slack iOS: completed items retain visible text) ·
// https://mobbin.com/screens/9e6f7794-da2f-4315-ade0-4d498d46e253 (Slack iOS: the empty control stays beside its named item).
// Previews inspected during PR completion; structure only. The control remains
// Moyo's existing Checkbox and the mark makes no correctness or grading claim.
// SOT: docs/design/homework-prior-work-handoff.md

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
