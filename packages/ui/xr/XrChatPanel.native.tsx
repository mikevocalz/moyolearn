'use client';
// The tutor conversation, beside the board — the same session, presented in
// space.
//
// IT IS NOT A SECOND CHAT. The rows are `useTutorStore`'s messages and the live
// turn is the last of them, exactly as `TutorThread` draws them in 2D: one
// session, one voice, one transcript. Entering the headset must not replay
// Natalie's opening or start a second stream, so nothing here owns state — it
// renders what it is handed.
//
// WHY NOT `TutorThread` ITSELF. It is a `LegendList`, and a React Native list
// cannot mount inside a Viro scene: the installed flexbox docs allow only
// `ViroText`, `ViroImage`, `ViroVideo`, `ViroButton`, `ViroSpinner` and nested
// `ViroFlexView` inside a `ViroFlexView`. So the composition is rebuilt from
// Viro primitives and the WINDOW is deliberately small — the last few turns,
// because a spatial transcript a child has to scroll with a ray while holding a
// pencil is a transcript they will not read.
//
// NATALIE'S BODY IS NOT HERE. Her 3D avatar is a react-native-webgpu surface
// (ADR-111) and it is not ported into the Viro scene by this feature; the panel
// carries her name, status and assurance line — the `TutorPresence` rail's
// information — and nothing pretends to be her.
// SOT: packages/ui/TutorThread.tsx · packages/ui/TutorPresence.tsx
// SOT-KEYWORDS: xr chat panel tutor thread conversation live turn status viro spatial companion

import { ViroClickStateTypes, ViroFlexView, ViroText } from '@reactvision/react-viro';
import { XR_MATERIAL } from './spatial-materials.native.ts';
import { minHitSize, spatialSpacing } from './spatial-tokens.ts';

/** A turn, reduced to what a spatial row can honestly show. */
export interface XrChatRow {
  id: string;
  role: 'learner' | 'tutor';
  text: string;
  /** How many attachments the turn carried, named rather than rendered. */
  attachments?: number;
}

/** An action the live turn offers — Try it, Next hint, Back to plan. */
export interface XrChatAction {
  id: string;
  label: string;
  onPress: () => void;
}

export interface XrChatPanelProps {
  width: number;
  height: number;
  distanceM: number;
  handsPrimary: boolean;
  tutorName: string;
  /** Here / Speaking / Thinking / Listening — `statusFor(state)`'s answer. */
  status: string;
  /** The band's assurance line, unchanged from the 2D presence rail. */
  assurance: string;
  /** Oldest first. The caller windows this; the panel does not scroll. */
  rows: readonly XrChatRow[];
  /** How many turns are above the window, so "earlier" is honest. */
  earlierCount: number;
  actions?: readonly XrChatAction[];
  /** True in `ended` and `crisis`, when the 2D composer locks too. */
  inputLocked: boolean;
}

export function XrChatPanel({
  width,
  height,
  distanceM,
  handsPrimary,
  tutorName,
  status,
  assurance,
  rows,
  earlierCount,
  actions,
  inputLocked,
}: XrChatPanelProps) {
  const action = minHitSize(distanceM, handsPrimary);

  return (
    <ViroFlexView
      width={width}
      height={height}
      materials={[XR_MATERIAL.card]}
      style={{ padding: spatialSpacing.xs, flexDirection: 'column' }}
    >
      {/* Her name and what she is doing, which is the whole header. */}
      <ViroText
        text={`${tutorName} · ${status}`}
        style={{ fontSize: 20, color: '#f8fafc' }}
        textLineBreakMode="WordWrap"
      />
      <ViroText
        text={assurance}
        style={{ fontSize: 14, color: '#94a3b8' }}
        textLineBreakMode="WordWrap"
        maxLines={2}
      />

      {earlierCount > 0 ? (
        <ViroText
          text={`${earlierCount} earlier ${earlierCount === 1 ? 'message' : 'messages'} on the normal screen`}
          style={{ fontSize: 13, color: '#94a3b8' }}
          textLineBreakMode="WordWrap"
        />
      ) : null}

      {rows.map((row) => (
        /*
          The attachment is named inside the turn that carried it, never lifted
          out of it — the rule `TutorThread` and `MessageBubble` already agreed
          on, kept here so the two presentations tell the same story about what
          the child sent.
        */
        <ViroText
          key={row.id}
          text={
            row.attachments
              ? `${row.role === 'tutor' ? tutorName : 'You'}: ${row.text} (${row.attachments} attached)`
              : `${row.role === 'tutor' ? tutorName : 'You'}: ${row.text}`
          }
          style={{
            fontSize: 18,
            color: row.role === 'tutor' ? '#f8fafc' : '#cbd5f5',
          }}
          textLineBreakMode="WordWrap"
          maxLines={6}
        />
      ))}

      {/*
        The live turn's own actions, as keys rather than text. Locked states
        render nothing pressable at all, which is what `inputDisabled` means on
        the 2D composer — a child in a `crisis` state is not offered a button.
      */}
      {inputLocked || !actions || actions.length === 0
        ? null
        : actions.map((entry) => (
            <ViroFlexView
              key={entry.id}
              width={Math.min(width - spatialSpacing.sm, action * 2.4)}
              height={action * 0.6}
              materials={[XR_MATERIAL.key]}
              style={{ padding: 0.008, flexDirection: 'column', justifyContent: 'center' }}
              onClickState={(clickState) => {
                if (clickState === ViroClickStateTypes.CLICK_UP) entry.onPress();
              }}
            >
              <ViroText
                text={entry.label}
                style={{ fontSize: 16, color: '#f8fafc', textAlign: 'center' }}
              />
            </ViroFlexView>
          ))}
    </ViroFlexView>
  );
}
