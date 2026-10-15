'use client';
// Review the detected QUESTIONS, not merely a page-sized OCR textarea.
// Corrections stay learner-authored. Nothing here authorizes grading.
import { useInstanceStore, useStore, Button, Dialog, Image, Text, Textarea } from '@acme/ui';
import { ScrollView, View } from '@acme/ui/tw';
import { extractWorksheetQuestions, MAX_WORKSHEET_QUESTIONS, type WorksheetQuestion } from './worksheet-questions.ts';
import type { CapturePage } from './types.ts';
import { buttonSizeForBand, type AgeBand } from './age-band.ts';

interface ReviewState {
  questions: WorksheetQuestion[];
  instructions: string;
  warning: string | null;
  editId: string | null;
  editText: string;
  removeId: string | null;
}

export interface WorksheetReviewProps {
  text: string;
  pages: readonly CapturePage[];
  subject: string;
  ageBand: AgeBand;
  onBack: () => void;
  onConfirm: (questions: WorksheetQuestion[], instructions: string) => void;
}

export function WorksheetReview({
  text,
  pages,
  subject,
  ageBand,
  onBack,
  onConfirm,
}: WorksheetReviewProps) {
  // Mounted only for this capture's review stage; the state survives opening
  // and closing its correction dialog, not another learner or upload.
  const store = useInstanceStore<ReviewState>(() => {
    const extraction = extractWorksheetQuestions(text);
    return {
      ...extraction,
      editId: null,
      editText: '',
      removeId: null,
    };
  });
  const { questions, instructions, warning, editId, editText, removeId } = useStore(store);
  const size = buttonSizeForBand(ageBand);
  const ready = questions.length > 0 && questions.every((q) => q.text.trim().length > 0);
  const toEdit = (question: WorksheetQuestion) =>
    store.setState({ editId: question.id, editText: question.text });
  const saveEdit = () => {
    if (!editId || !editText.trim()) return;
    store.setState((state) => ({
      questions: state.questions.map((q) =>
        q.id === editId ? { ...q, text: editText.trim() } : q,
      ),
      editId: null,
      editText: '',
    }));
  };
  const addMissing = () => {
    const id = 'manual-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    store.setState((state) => ({
      questions: [
        ...state.questions,
        { id, sourcePage: Math.max(1, state.questions.at(-1)?.sourcePage ?? 1), sourceNumber: null, text: '' },
      ],
      editId: id,
      editText: '',
    }));
  };
  return (
    <>
      <ScrollView className="flex-1" contentContainerClassName="gap-stack p-inset">
        <Text className="font-sans text-title font-bold text-text">Check your questions</Text>
        <Text className="font-sans text-body text-text-muted">
          {subject ? subject + ' · ' : ''}{questions.length} questions detected.
          Compare each one with your worksheet. Tap Correct to fix numbers, signs,
          fractions, handwriting, or question order before Natalie begins.
        </Text>
        {warning ? (
          <View className="rounded-card border-2 border-border bg-surface-sunken p-3">
            <Text variant="body">{warning}</Text>
          </View>
        ) : null}
        {pages.filter((p) => p.kind !== 'file').length > 0 ? (
          <View className="flex-row flex-wrap gap-element">
            {pages.filter((p) => p.kind !== 'file').map((p, index) => (
              <Image
                key={p.id}
                src={p.uri}
                alt={'Original worksheet page ' + (index + 1)}
                contentFit="contain"
                className="h-36 w-28 rounded-card"
              />
            ))}
          </View>
        ) : null}
        {instructions ? (
          <View className="gap-1">
            <Text variant="label" tone="muted">Directions detected</Text>
            <Text variant="body">{instructions}</Text>
          </View>
        ) : null}
        <View className="gap-element">
          {questions.map((question, i) => (
            <View key={question.id} className="gap-element rounded-card border-2 border-border bg-surface-raised p-3">
              <View className="flex-row flex-wrap items-center justify-between gap-element">
                <Text variant="label" className="font-semibold text-text">
                  Question {i + 1} of {questions.length}
                </Text>
                <Text variant="caption" tone="muted">Page {question.sourcePage}</Text>
              </View>
              <Text variant="body" className="text-text">{question.text || 'Needs correction'}</Text>
              <View className="flex-row flex-wrap gap-element">
                <Button
                  title="Earlier"
                  variant="ghost"
                  size="sm"
                  disabled={i === 0}
                  onPress={() => store.setState((s) => {
                    const reordered = [...s.questions];
                    [reordered[i - 1], reordered[i]] = [reordered[i]!, reordered[i - 1]!];
                    return { questions: reordered };
                  })}
                />
                <Button
                  title="Later"
                  variant="ghost"
                  size="sm"
                  disabled={i === questions.length - 1}
                  onPress={() => store.setState((s) => {
                    const reordered = [...s.questions];
                    [reordered[i], reordered[i + 1]] = [reordered[i + 1]!, reordered[i]!];
                    return { questions: reordered };
                  })}
                />
                <Button
                  title="Correct"
                  variant="outline"
                  size="sm"
                  onPress={() => toEdit(question)}
                  aria-label={'Correct question ' + (i + 1)}
                />
                {questions.length > 1 ? (
                  <Button
                    title="Remove"
                    variant="ghost"
                    size="sm"
                    onPress={() => store.setState({ removeId: question.id })}
                    aria-label={'Remove question ' + (i + 1)}
                  />
                ) : null}
              </View>
            </View>
          ))}
        </View>
        <Button title="Add a missing question" variant="outline" size={size} fullWidth disabled={questions.length >= MAX_WORKSHEET_QUESTIONS} onPress={addMissing} />
        <Button
          title={'Confirm ' + questions.length + ' questions'}
          variant="highlighter"
          size={size}
          fullWidth
          disabled={!ready}
          onPress={() => {
            if (ready) onConfirm(questions, instructions);
          }}
        />
        <Button title="Review the scan again" variant="ghost" size={size} fullWidth onPress={onBack} />
        <Text variant="caption" tone="muted">
          The scan is only a starting point. Confirming questions does not grade or
          check answers; Natalie will guide you through them one at a time.
        </Text>
      </ScrollView>
      <Dialog
        open={editId !== null}
        onClose={() => store.setState({ editId: null, editText: '' })}
        title="Correct the question"
        description="Use the original worksheet to fix the transcription, including signs and fraction bars."
        actions={
          <>
            <Button title="Cancel" variant="outline" size="sm"
              onPress={() => store.setState({ editId: null, editText: '' })} />
            <Button title="Save correction" size="sm" variant="highlighter"
              disabled={!editText.trim()} onPress={saveEdit} />
          </>
        }
      >
        <Textarea
          label="Question as written"
          autoCorrect={false}
          autoCapitalize="none"
          value={editText}
          onChangeText={(value) => store.setState({ editText: value })}
        />
      </Dialog>
      <Dialog
        open={removeId !== null}
        onClose={() => store.setState({ removeId: null })}
        title="Remove this question?"
        description="Only remove it if it is a duplicate or does not belong to the worksheet."
        actions={
          <>
            <Button title="Keep question" variant="outline" size="sm" onPress={() => store.setState({ removeId: null })} />
            <Button title="Remove question" variant="primary" size="sm" onPress={() =>
              store.setState((s) => ({
                questions: s.questions.filter((q) => q.id !== s.removeId),
                removeId: null,
              }))
            } />
          </>
        }
      />
    </>
  );
}
