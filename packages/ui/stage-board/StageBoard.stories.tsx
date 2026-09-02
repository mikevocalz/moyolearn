// SOT-KEYWORDS: stage board stories kanban pipeline drag keyboard mobile paged empty column
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Text, View } from '@acme/ui/tw';
// The WEB fork, explicitly: pointer drag and the keyboard move both run in the
// browser with no gesture libs, so this is the fork the story exercises.
import { StageBoard } from './StageBoard.web';
// The NATIVE fork, explicitly, for the one-column-per-page mobile shape.
// Gesture Handler and Reanimated run under Vite's react-native-web build (the
// SwipeableRow precedent), so long-press drag works here too; `pagingEnabled`
// degrades to plain horizontal scrolling on react-native-web, which is why the
// paging itself is documented rather than asserted.
import { StageBoard as StageBoardNative } from './StageBoard.native';
import { StageColumnFrame, CARD_SHELL_CLASS } from './StageColumn';
import type { StageBoardCard, StageBoardColumn } from './types';

const meta = { title: 'UI/StageBoard' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Story-local pipeline. Shapes mirror the org CRM (doc 28 §3's trial-centric
 * stages, tones from the STAGE_TONE codomain) without importing the ops
 * feature — the board is generic and the wall stays intact.
 */
interface DemoCard extends StageBoardCard {
  detail: string;
}

const COLUMNS: readonly StageBoardColumn[] = [
  { id: 'inquiry', title: 'Inquiry', tone: 'neutral' },
  { id: 'trial-scheduled', title: 'Trial scheduled', tone: 'primary' },
  { id: 'trial-completed', title: 'Trial completed', tone: 'primary' },
  { id: 'enrolled', title: 'Enrolled', tone: 'success' },
  // Deliberately empty: an empty stage must still read as a lane a card can
  // land in (and it accepts drops at position 1).
  { id: 'at-risk', title: 'At risk', tone: 'attention' },
];

const CARDS: readonly DemoCard[] = [
  { id: 'l1', columnId: 'inquiry', label: 'Amina O.', detail: 'Fractions · via website form' },
  { id: 'l2', columnId: 'inquiry', label: 'Daniel K.', detail: 'Long division · referral' },
  { id: 'l3', columnId: 'inquiry', label: 'Tomás L.', detail: 'Word problems · walk-in' },
  { id: 'l4', columnId: 'trial-scheduled', label: 'Priya R.', detail: 'Place value · Tue 11:15' },
  { id: 'l5', columnId: 'trial-scheduled', label: 'Sofia M.', detail: 'Reading · Thu 15:00' },
  { id: 'l6', columnId: 'trial-completed', label: 'Kenji T.', detail: 'Chemistry · proposal due' },
  { id: 'l7', columnId: 'enrolled', label: 'Maya S.', detail: 'Algebra II · 2×/week' },
  { id: 'l8', columnId: 'enrolled', label: 'Leo B.', detail: 'Reading · 1×/week' },
];

/** One index step, in dp: 76 of card + the mb-element gap inside the shell. */
const CARD_PITCH = 84;

const renderCard = (card: DemoCard) => (
  <View className="flex-1 justify-center gap-element p-inset-tight">
    <Text className="text-label text-text">{card.label}</Text>
    <Text className="text-caption text-text-muted">{card.detail}</Text>
  </View>
);

/**
 * The story's stand-in for the app's applyStageChange reducer: remove the
 * card, re-home it, insert at the committed index within its new column.
 */
function applyMove(
  cards: readonly DemoCard[],
  cardId: string,
  toColumnId: string,
  index: number,
): readonly DemoCard[] {
  const moving = cards.find((card) => card.id === cardId);
  if (!moving) return cards;
  const rest = cards.filter((card) => card.id !== cardId);
  const targetSlots = rest
    .map((card, flat) => ({ card, flat }))
    .filter((entry) => entry.card.columnId === toColumnId);
  const landed = { ...moving, columnId: toColumnId };
  const last = targetSlots[targetSlots.length - 1];
  const at =
    index < targetSlots.length
      ? targetSlots[index]!.flat
      : last
        ? last.flat + 1
        : rest.length;
  return [...rest.slice(0, at), landed, ...rest.slice(at)];
}

/**
 * The full pipeline, live. Drag a card by its grip — travel past half a
 * column's width commits it one stage over; the pending lane highlights while
 * the drag is in flight and the move commits ONCE on release. From the
 * keyboard: focus a grip, Enter picks the card up, arrows walk stages and
 * positions (each step announced politely), Enter drops, Escape cancels.
 */
export const Pipeline: Story = {
  render: function PipelineStory() {
    const [cards, setCards] = useState<readonly DemoCard[]>(CARDS);
    return (
      <View className="w-full gap-stack bg-surface p-inset">
        <Text className="text-caption text-text-muted">
          Drag by the grip, or focus it and use Enter + arrows. “At risk” is an
          empty stage — cards drop into it at position 1.
        </Text>
        <View style={{ height: 480 }}>
          <StageBoard
            columns={COLUMNS}
            cards={cards}
            renderCard={renderCard}
            cardPitch={CARD_PITCH}
            onMove={(cardId, _fromColumnId, toColumnId, index) =>
              setCards((current) => applyMove(current, cardId, toColumnId, index))
            }
          />
        </View>
      </View>
    );
  },
};

/** Roomy density — the DataTable scale, so board and table read one setting. */
export const RoomyDensity: Story = {
  render: function RoomyStory() {
    const [cards, setCards] = useState<readonly DemoCard[]>(CARDS);
    return (
      <View className="w-full bg-surface p-inset" style={{ height: 480 }}>
        <StageBoard
          columns={COLUMNS}
          cards={cards}
          renderCard={renderCard}
          cardPitch={CARD_PITCH}
          density="roomy"
          onMove={(cardId, _fromColumnId, toColumnId, index) =>
            setCards((current) => applyMove(current, cardId, toColumnId, index))
          }
        />
      </View>
    );
  },
};

/**
 * The mobile shape: one column per horizontal page, long-press (180ms) lifts a
 * card, dragging past half the page width commits it one stage over. Rendered
 * in a phone-width frame; on a device the pager snaps page-per-stage.
 */
export const MobilePaged: Story = {
  render: function MobileStory() {
    const [cards, setCards] = useState<readonly DemoCard[]>(CARDS);
    return (
      <View className="gap-stack bg-surface p-inset">
        <Text className="text-caption text-text-muted">
          390dp frame. Long-press a grip to lift; half a page of horizontal
          travel moves the card one stage.
        </Text>
        <View style={{ width: 390, height: 560 }} className="overflow-hidden rounded-card border-2 border-border">
          <StageBoardNative
            columns={COLUMNS}
            cards={cards}
            renderCard={renderCard}
            cardPitch={CARD_PITCH}
            onMove={(cardId, _fromColumnId, toColumnId, index) =>
              setCards((current) => applyMove(current, cardId, toColumnId, index))
            }
          />
        </View>
      </View>
    );
  },
};

/**
 * Static drag states, for visual regression: the pending drop target (the
 * DataTable selected-row treatment on the lane) beside a resting lane, and a
 * lifted card. What the pointer produces mid-flight, held still.
 */
export const DropTargetHighlight: Story = {
  render: () => (
    <View className="w-full flex-row items-stretch gap-group bg-surface p-inset">
      <View className="w-72 flex-none">
        <StageColumnFrame title="Trial scheduled" tone="primary" count={2} active>
          <View style={{ height: CARD_PITCH * 2 }}>
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: CARD_PITCH }}>
              <View className={CARD_SHELL_CLASS}>
                {renderCard(CARDS[3]!)}
              </View>
            </View>
            <View
              style={{
                position: 'absolute',
                top: CARD_PITCH,
                left: 0,
                right: 0,
                height: CARD_PITCH,
                transform: [{ translateX: 24 }, { translateY: -12 }],
                zIndex: 10,
                opacity: 0.95,
              }}
            >
              <View className={CARD_SHELL_CLASS}>
                {renderCard(CARDS[4]!)}
              </View>
            </View>
          </View>
        </StageColumnFrame>
      </View>
      <View className="w-72 flex-none">
        <StageColumnFrame title="Enrolled" tone="success" count={2}>
          <View style={{ height: CARD_PITCH * 2 }}>
            {CARDS.filter((card) => card.columnId === 'enrolled').map((card, index) => (
              <View
                key={card.id}
                style={{ position: 'absolute', top: index * CARD_PITCH, left: 0, right: 0, height: CARD_PITCH }}
              >
                <View className={CARD_SHELL_CLASS}>{renderCard(card)}</View>
              </View>
            ))}
          </View>
        </StageColumnFrame>
      </View>
    </View>
  ),
};
