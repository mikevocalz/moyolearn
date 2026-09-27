import { useMemo, useState } from 'react';
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { ViroText } from '@reactvision/react-viro';
import { QUESTION_CONTENT_RECT_PANEL, questionPages, type XrLearningQuestion } from '@acme/ui/xr';
import type { TutorXrQuestionPanelProps } from '@acme/app/features/tutor/tutor-xr-screen.types.ts';
import { XrQuestionPanel } from './xr-question-panel';
import { questionPresentationOf } from './xr-question-present';

const noop = () => {};
export async function loadTutorQuestionPanel() {
  // Metro requires a static asset reference.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const asset = Asset.fromModule(require('../../assets/rive/moyo_learning_question.riv'));
  await asset.downloadAsync();
  if (!asset.localUri) throw new Error('Question controls could not be loaded');
  const bytes = await new File(asset.localUri).arrayBuffer();
  function TutorQuestionPanel(props: TutorXrQuestionPanelProps) {
    const pages = useMemo(() => questionPages(props.question || 'Ask Natalie about your work.'), [props.question]);
    const [paging, setPaging] = useState({ question: props.question, page: 0 });
    const page = paging.question === props.question ? Math.min(paging.page, pages.length - 1) : 0;
    const turnPage = (delta: number) => setPaging({ question: props.question, page: (page + delta + pages.length) % pages.length });
    // The real tutor problem is conversational. Never seed fixture questions,
    // answer keys or a fabricated graded result into a learner's session.
    const question: XrLearningQuestion = {
      id: 'current-tutor-problem', subject: 'other', subjectLabel: 'Your lesson',
      skillLabel: props.skill, uiLocale: 'en', questionLocale: 'und', textDirection: 'auto',
      prompt: props.question, content: [], interaction: 'tutor-conversation',
      source: 'tutor', evaluation: { kind: 'coach-review' },
    };
    const presentation = questionPresentationOf(question, {
      phase: 'idle', answer: { kind: 'none' }, feedback: null, hintVisible: false,
      generatedHint: null, hintBusy: false, grabbed: false, status: props.status,
    });
    return <XrQuestionPanel
      chromeBytes={bytes} slot={props.slot} carrier={null} grabbed={false} bound={false}
      enabled={props.enabled} movable={false} onCarrierRelease={noop} onGrab={noop}
      gripWorld={{ position: [0, 0, 0], yawDeg: 0 }} onChromeError={props.onError}
      presentation={{ ...presentation, answerValid: props.hasMarks && !props.busy,
        disabled: !props.enabled, submitting: props.busy, reducedMotion: true,
        progressLabel: `Page ${page + 1} / ${pages.length}`, submitLabel: 'ASK BOARD',
        continueLabel: 'NEXT PAGE', skipLabel: 'PREVIOUS', listenLabel: props.listening ? 'SEND' : 'LISTEN' }}
      handlers={{ onSelectChoice: noop, onToggleChoice: noop,
        onSubmit: () => { if (!props.busy && props.hasMarks) props.onSubmit(); },
        onVoice: props.onVoice, onHint: () => { if (!props.busy) props.onHint(); },
        onBoard: props.onBoard, onNext: () => turnPage(1), onSkip: () => turnPage(-1), onRetry: props.onVoice }}
      content={<ViroText text={pages[page] ?? ''}
        width={(QUESTION_CONTENT_RECT_PANEL.width - 0.06) / 0.25}
        height={(QUESTION_CONTENT_RECT_PANEL.height - 0.06) / 0.25}
        scale={[0.25, 0.25, 0.25]} maxLines={12} textClipMode="ClipToBounds" ignoreEventHandling
        style={{ fontSize: 22, color: '#e9f4fa', textAlign: 'left', textAlignVertical: 'top' }} />}
    />;
  }
  return TutorQuestionPanel;
}
