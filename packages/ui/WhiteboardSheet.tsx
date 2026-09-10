'use client';
// WhiteboardSheet — the workbench on its own, full screen.
//
// WHY IT EXISTS, and it is a constraint rather than a preference. ADR-107's
// first amendment exempts the tutor session from the learner-pane ban on one
// condition: nothing is reachable in a pane that is not reachable without it.
// The work pane only tiles at `expanded` (840dp), so a board that lived only
// there would be a capability a phone and a tablet in portrait do not have —
// which is exactly the arbitrage the ban exists to prevent.
//
// It takes CHILDREN rather than the board's own props, so the screen mounts the
// same workbench here that it puts in the pane. One board host, one restore,
// one autosave. Given its own copy of the props it would be a second host with
// a second timer writing the same key, and the two would race the moment a
// learner unfolded a device mid-stroke.
//
// A modal rather than a route: the session is still running behind it, the
// composer's draft is still in the composer, and a push would put a back stack
// between a child and the conversation they are mid-answer in. `Lightbox` and
// `Dialog` already take this shape in the kit; this is the full-bleed one,
// because a canvas inset inside a card is a canvas with a dead margin.
// Mobbin: https://mobbin.com/screens/bffbe166-34a2-49ae-8f1d-587a518b3d03 (Freeform — a
// drawing surface opened over what you were doing, its own close in the leading
// corner, no back stack) · https://mobbin.com/screens/fc331c59-afb1-410b-b70a-35d2c48d3eeb
// (Craft — same shape from inside a document; the sheet is full-bleed and the
// controls float on the paper) · https://mobbin.com/screens/23b4ee8f-32d4-4ad1-8bb4-e5c1484fdcdf
// (Apple Mail markup — the title says what you are marking up, so the canvas is
// not anonymous). Structure only.
// SOT: packages/ui/Whiteboard.tsx · docs/decisions/adr-107-learner-pane-ban-reaffirmed.md
// SOT-KEYWORDS: whiteboard sheet modal full screen board compact phone tutor reachable

import type { ReactNode } from 'react';
import { Modal } from 'react-native';
import { SafeArea } from './SafeArea';
import { X } from './icons';
import { Pressable, Text, View } from './primitives';

export interface WhiteboardSheetProps {
  open: boolean;
  onClose: () => void;
  /** What the learner is working on, so the sheet is not an anonymous canvas. */
  title?: string;
  children: ReactNode;
}

export function WhiteboardSheet({ open, onClose, title, children }: WhiteboardSheetProps) {
  return (
    /* `onRequestClose` is the Android back button. Without it the system
       gesture leaves the session running under a board that will not close. */
    <Modal visible={open} animationType="slide" onRequestClose={onClose}>
      <SafeArea className="flex-1 bg-surface">
        <View className="flex-row items-center gap-element border-b-2 border-border px-inset py-inset-tight">
          {/*
            Close leads, not trails. The sheet covers a conversation the child
            was mid-answer in, so the way back is the first thing under the
            thumb rather than the last — and it is a close, not a back: there is
            nothing behind this but the session it was opened from.
          */}
          <Pressable
            onPress={onClose}
            aria-label="Close the board"
            className="min-h-target-adult min-w-target-adult items-center justify-center rounded-control"
          >
            <X size={20} className="text-text" />
          </Pressable>
          <Text numberOfLines={1} className="flex-1 font-display text-title text-text">
            {title ?? 'Your board'}
          </Text>
        </View>
        <View className="flex-1 p-inset">{children}</View>
      </SafeArea>
    </Modal>
  );
}
