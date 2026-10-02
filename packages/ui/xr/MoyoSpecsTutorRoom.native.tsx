'use client';

import * as React from 'react';
import * as Viro from '@reactvision/react-viro';

import { worldSlot } from './world-slot.ts';
import type {
  MoyoSpecsCompiledScene,
  MoyoSpecsTutorRoomProps,
} from './MoyoSpecsTutorRoom.types.ts';

const PANEL_STYLE = {
  width: 0.64,
  height: 0.88,
  backgroundColor: '#111827',
  borderRadius: 0.035,
} as const;

const BOARD_STYLE = {
  width: 1.4,
  height: 0.9,
  backgroundColor: '#f8fafc',
  borderRadius: 0.035,
} as const;

const TITLE_STYLE = {
  fontSize: 7,
  color: '#f8fafc',
  textAlign: 'center',
} as const;

const BODY_STYLE = {
  fontSize: 5,
  color: '#e5e7eb',
  textAlign: 'center',
} as const;

const BOARD_TITLE_STYLE = {
  fontSize: 7,
  color: '#111827',
  textAlign: 'center',
} as const;

const BOARD_BODY_STYLE = {
  fontSize: 5,
  color: '#1f2937',
  textAlign: 'center',
} as const;

type SpecsCompiler = (
  scene: React.ReactNode,
  options?: {
    resolveAssetId?: (
      source: unknown,
      context: { id: string; kind: 'image' | 'model' },
    ) => string | undefined;
  },
) => MoyoSpecsCompiledScene;

/**
 * A deliberately small Moyo Tutor Room authored only with public Viro JSX.
 *
 * It reuses Moyo's existing worldSlot geometry, so Quest/Vision/SPECS do not
 * acquire separate spatial layouts or learning state. SPECS changes the
 * renderer and interaction backend; it does not fork the Tutor Room model.
 */
export function MoyoSpecsTutorRoom({
  headPosition,
  headYawDeg,
  tutorName,
  tutorLine,
  assignmentTitle,
  question,
  progressLabel = 'Ready',
  onAskTutor,
  onOpenAssignment,
  onBoardSelect,
  boardContent,
}: MoyoSpecsTutorRoomProps) {
  const assignment = worldSlot('left', headPosition, headYawDeg);
  const board = worldSlot('center', headPosition, headYawDeg);
  const tutor = worldSlot('right', headPosition, headYawDeg);

  return (
    <Viro.ViroARScene>
      <Viro.ViroFlexView
        viroTag="moyo-specs-assignment"
        position={assignment.position}
        rotation={[0, assignment.yaw, 0]}
        style={PANEL_STYLE}
        onClick={() => onOpenAssignment?.()}
      >
        <Viro.ViroText
          viroTag="moyo-specs-assignment-title"
          text="Assignment"
          position={[0, 0.25, 0.015]}
          style={TITLE_STYLE}
        />
        <Viro.ViroText
          viroTag="moyo-specs-assignment-body"
          text={assignmentTitle}
          position={[0, 0.02, 0.015]}
          style={BODY_STYLE}
        />
        <Viro.ViroText
          viroTag="moyo-specs-progress"
          text={progressLabel}
          position={[0, -0.25, 0.015]}
          style={BODY_STYLE}
        />
      </Viro.ViroFlexView>

      <Viro.ViroFlexView
        viroTag="moyo-specs-board"
        position={board.position}
        rotation={[0, board.yaw, 0]}
        style={BOARD_STYLE}
        onClick={() => onBoardSelect?.()}
      >
        <Viro.ViroText
          viroTag="moyo-specs-board-title"
          text="Work it out"
          position={[0, 0.31, 0.015]}
          style={BOARD_TITLE_STYLE}
        />
        <Viro.ViroText
          viroTag="moyo-specs-question"
          text={question}
          position={[0, 0.08, 0.015]}
          style={BOARD_BODY_STYLE}
        />
        {boardContent}
        <Viro.ViroPolyline
          viroTag="moyo-specs-work-line"
          points={[
            [-0.42, -0.16, 0.02],
            [0, -0.16, 0.02],
            [0.42, -0.16, 0.02],
          ]}
          thickness={0.008}
        />
      </Viro.ViroFlexView>

      <Viro.ViroFlexView
        viroTag="moyo-specs-tutor"
        position={tutor.position}
        rotation={[0, tutor.yaw, 0]}
        style={PANEL_STYLE}
        onClick={() => onAskTutor?.()}
      >
        <Viro.ViroText
          viroTag="moyo-specs-tutor-name"
          text={tutorName}
          position={[0, 0.25, 0.015]}
          style={TITLE_STYLE}
        />
        <Viro.ViroText
          viroTag="moyo-specs-tutor-line"
          text={tutorLine}
          position={[0, 0.02, 0.015]}
          style={BODY_STYLE}
        />
        <Viro.ViroText
          viroTag="moyo-specs-ask"
          text="Ask tutor"
          position={[0, -0.25, 0.015]}
          style={BODY_STYLE}
        />
      </Viro.ViroFlexView>
    </Viro.ViroARScene>
  );
}

/**
 * Compile the exact same Viro scene for the SPECS/Lens backend when the public
 * Viro compiler is present. Moyo's currently vendored Viro 3 build does not
 * expose the compiler yet, so the feature is detected at the boundary instead
 * of breaking today's Quest/Vision/native build.
 */
export function compileMoyoSpecsTutorRoom(
  props: MoyoSpecsTutorRoomProps,
): MoyoSpecsCompiledScene {
  const compiler = (
    Viro as typeof Viro & { compileViroSpecsJSX?: SpecsCompiler }
  ).compileViroSpecsJSX;

  if (!compiler) {
    throw new Error(
      'Moyo SPECS export requires a Viro build with compileViroSpecsJSX(). ' +
        'Vendor the first-class SPECS Viro release before running this export.',
    );
  }

  return compiler(<MoyoSpecsTutorRoom {...props} />);
}
