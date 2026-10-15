// /homework — Parent Daily Work: the child switcher, the upload entry and the
// active ward's full dated homework timeline. Mirrors the mobile stack route.
// SOT: packages/app/features/homework/guardian-homework-screen.tsx · docs/work/pr-100/contract.md §Routes
// SOT-KEYWORDS: guardian homework page web route timeline switcher
import type { Metadata } from 'next';
import { GuardianHomeworkScreen } from '@acme/app/features/homework/guardian-homework-screen.tsx';

export const metadata: Metadata = {
  title: 'Homework — Moyo',
  description: 'Each day’s worksheet, question by question.',
};

export default function GuardianHomeworkPage() {
  return <GuardianHomeworkScreen />;
}
