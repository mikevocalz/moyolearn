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
import { XR_COLOR } from './xr-colors.ts';
import { minHitSize, spatialFontSize, spatialSpacing } from './spatial-tokens.ts';
/* Props live outside this file so the web fork can name them without naming
   Viro — the `XrPanel.types.ts` arrangement, for the same reason. */
import type { XrChatPanelProps } from './XrChatPanel.types.ts';

export function XrChatPanel({
  width,
  height,
  distanceM,
  handsPrimary,
  band,
  tutorName,
  status,
  assurance,
  rows,
  earlierCount,
  skippedCount,
  actions,
  inputLocked,
}: XrChatPanelProps) {
  const action = minHitSize(distanceM, handsPrimary, band);

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
        style={{ fontSize: spatialFontSize.title, color: XR_COLOR.onPanel }}
        textLineBreakMode="WordWrap"
      />
      <ViroText
        text={assurance}
        style={{ fontSize: spatialFontSize.caption, color: XR_COLOR.onPanelMuted }}
        textLineBreakMode="WordWrap"
        maxLines={2}
      />

      {earlierCount > 0 ? (
        <ViroText
          text={`${earlierCount} earlier ${earlierCount === 1 ? 'message' : 'messages'} on the normal screen`}
          style={{ fontSize: spatialFontSize.caption, color: XR_COLOR.onPanelMuted }}
          textLineBreakMode="WordWrap"
        />
      ) : null}

      {/*
        WHAT THE HEADSET COULD NOT DRAW, SAID OUT LOUD.

        The spatial board renders freehand and highlighter and nothing else, so
        a typed note or an arrow made on the web app is simply absent here.
        Until this line, nothing marked the gap and nothing counted it: the
        board looked complete and was not, which is a child concluding their
        work was deleted.

        The wording is `04-copy.md` §5.2 verbatim and both of its constraints
        are load-bearing. It says the work is STILL THERE, because the fear is
        deletion and not display. And it does not name the tools — "text, notes,
        arrows and images" is a list a K–2 reader will not finish, and knowing
        which primitive failed to render helps nobody.

        Under the earlier-messages line and in the muted ink, per §5.2's
        placement note: not on the paper, which is the working surface, and not
        as a dialog, which would block a child from their board over something
        they cannot act on.
      */}
      {skippedCount > 0 ? (
        <ViroText
          text={
            skippedCount === 1
              ? "1 thing you added on the computer isn't shown here. It's still on your board."
              : `${skippedCount} things you added on the computer aren't shown here. They're still on your board.`
          }
          style={{ fontSize: spatialFontSize.caption, color: XR_COLOR.onPanelMuted }}
          textLineBreakMode="WordWrap"
          maxLines={3}
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
            fontSize: spatialFontSize.body,
            color: row.role === 'tutor' ? XR_COLOR.onPanel : XR_COLOR.onPanelMuted,
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
              /* Wider than the floor for the label, and never shorter than it:
                 `action × 0.6` was 2.40°, the same one-axis miss the placement
                 keys made. A target is the smaller of its two edges. */
              width={Math.min(width - spatialSpacing.sm, action * 2.4)}
              height={action}
              materials={[XR_MATERIAL.key]}
              style={{ padding: 0.008, flexDirection: 'column', justifyContent: 'center' }}
              onClickState={(clickState) => {
                if (clickState === ViroClickStateTypes.CLICK_UP) entry.onPress();
              }}
            >
              <ViroText
                text={entry.label}
                /* `onKey`, not `onPanel`: this label sits on `XR_MATERIAL.key`,
                   which is a LIGHT surface. The panel's light ink on it was the
                   same 1.09:1 the rail's keys already had corrected. */
                style={{ fontSize: spatialFontSize.body, color: XR_COLOR.onKey, textAlign: 'center' }}
              />
            </ViroFlexView>
          ))}
    </ViroFlexView>
  );
}
