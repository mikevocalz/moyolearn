'use client';
// Capture entry options — the "choose how to share" body: ONE dominant Snap
// card (Take photo is the product signature, contract primary_action) over a
// labelled group of four lighter alternates, each with a glyph. Mirrors the
// learner-hub tile anatomy (icon well + title + hint on the primary) so the
// K–2 hub's giant Snap tile and this step read as the same door.
//
// Hierarchy is size/weight/space, not colour alone: the primary card carries
// the bg-action-primary fill, the icon well, a hint line, and a taller target;
// the alternates are compact icon rows under a muted "more ways" caption. That
// fill is the SIGNATURE-ACTION token rather than the generic `primary` for the
// reason the hub tile moved to it: the tab bar marks the selected tab in the
// brand yellow, so a Snap surface painted yellow spends the same colour on the
// primary action and on selection. Take photo is teal on every surface it
// appears — this card, the hub tile, the rail's raised slab.
// Targets come from the age-band tokens (doc 08 §2.4) — the primary sits one
// tier above the band's row tier so it dominates on every band.
// Mobbin: mobbin.com/screens/f91c4f65-bc27-4169-a247-c0bddaa4a3fa (Hims — one dominant "Take photo" primary with the alternate sources grouped apart from it) ·
// mobbin.com/screens/ada80534-1361-4ff0-8ffe-f786c567abb3 (Grab Driver — Photo Library / Take Photo / Choose File as icon-led rows in one compact stack) ·
// mobbin.com/screens/85873190-10ce-4079-8267-c09316bfb393 (Fi — icon + label + one-line description per capture option, with a muted "or use…" caption separating the fallback channel) ·
// mobbin.com/screens/79bc88c8-16d5-4d07-b2ff-3df2811fb272 (Cleo AI — photo/gallery/file chooser as a short stacked list under the step's heading). Structure only.
// SOT: docs/pack/24-homework-capture-spec.md §1 · design/screens/learner/learner.capture/contract.md
// SOT-KEYWORDS: capture entry row choose share snap primary camera options age band

import { Heading, PressScale, Text } from '@acme/ui';
import { View } from '@acme/ui/tw';
import { Camera, FileUp, Image as ImageIcon, Keyboard, Mic, type IconProps } from '@acme/ui/icons';
import { captureLabelsForBand, type AgeBand } from './age-band';
import { CaptureMode } from './types';

export interface CaptureEntryRowProps {
  ageBand?: AgeBand;
  onSelect: (mode: CaptureMode) => void;
}

/** Row target from the band token; the primary card sits one tier above it. */
const ROW_TARGET: Record<AgeBand, string> = {
  young: 'min-h-target-young',
  child: 'min-h-target-child',
  teen: 'min-h-target-teen',
  adult: 'min-h-target-adult',
};

const PRIMARY_TARGET: Record<AgeBand, string> = {
  young: 'min-h-target-young',
  child: 'min-h-target-young',
  teen: 'min-h-target-child',
  adult: 'min-h-target-teen',
};

export function CaptureEntryRow({ ageBand = 'teen', onSelect }: CaptureEntryRowProps) {
  const labels = captureLabelsForBand(ageBand);
  const young = ageBand === 'young' || ageBand === 'child';

  const alternates: { mode: CaptureMode; label: string; a11y: string; Icon: React.FC<IconProps> }[] = [
    { mode: 'photo-library', label: labels.choosePhotos, a11y: 'Choose photos from your device', Icon: ImageIcon },
    { mode: 'file', label: labels.uploadFile, a11y: 'Upload a PDF or file', Icon: FileUp },
    { mode: 'type', label: labels.typePaste, a11y: 'Type or paste the problem', Icon: Keyboard },
    { mode: 'voice', label: labels.describeVoice, a11y: 'Describe the work by voice', Icon: Mic },
  ];

  return (
    <View className="w-full gap-group">
      <PressScale
        outerClassName="w-full"
        className={`${PRIMARY_TARGET[ageBand]} w-full flex-row items-center gap-element rounded-card border-2 border-border bg-action-primary p-inset-roomy shadow-card`}
        aria-label="Take a photo of your work"
        onPress={() => onSelect('camera')}
      >
        <View className="h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-border bg-surface">
          <Camera size={28} className="text-text" />
        </View>
        <View className="flex-1 gap-1">
          <Heading level={2} size="title" className="text-on-action-primary">
            {labels.takePhoto}
          </Heading>
          <Text className="text-on-action-primary/80">{labels.photoHint}</Text>
        </View>
      </PressScale>

      <View className="gap-element">
        <Text variant="caption" tone="muted">
          {labels.moreWays}
        </Text>
        {alternates.map(({ mode, label, a11y, Icon }) => (
          <PressScale
            key={mode}
            outerClassName="w-full"
            className={`${ROW_TARGET[ageBand]} w-full flex-row items-center gap-element rounded-control border-2 border-border bg-surface-raised px-inset shadow-card`}
            aria-label={a11y}
            onPress={() => onSelect(mode)}
          >
            <Icon size={young ? 24 : 20} className="shrink-0 text-text" />
            <Text className="flex-1 font-sans text-body font-semibold text-text">{label}</Text>
          </PressScale>
        ))}
      </View>
    </View>
  );
}
