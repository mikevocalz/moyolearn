'use client';
// The permissions a guardian can see and grant in one place.
//
// WHY A CHECKLIST AND NOT A PROMPT AT FIRST USE. Both, actually — the feature
// still asks when it needs to. What was missing is the surface that says what
// this app wants BEFORE a system dialog appears, and that lets a guardian fix
// one they refused earlier. On Android a refused permission is silent forever
// after the second refusal: the OS shows nothing, the call just fails, and the
// child concludes the app is broken. There has to be somewhere that says
// "microphone is off, here is how to turn it on".
//
// EVERY ROW STATES A REASON, and the reasons are concrete. A guardian deciding
// whether a child's tutor may hear them is owed the actual use, not "to improve
// your experience". The copy lives in `PERMISSION_COPY` so the checklist and
// any inline primer say the same thing.
//
// STATE IS NEVER COLOUR ALONE. Granted carries a check, blocked carries its own
// words and a different action; a guardian reading this in sunlight or with a
// colour-vision difference gets the same information. Same rule the rest of the
// app's status surfaces follow.
// SOT: packages/app/features/permissions/permissions.types.ts
// SOT-KEYWORDS: permission checklist surface guardian grant blocked settings microphone camera photos
// Mobbin: https://mobbin.com/screens/6140e55d-e900-4dc0-b7a1-44f1a4bd9b77 (reason text carried above the row, and the row states its condition in words — "Allowed" / "Not allowed" — so state never rides on colour) ·
//         https://mobbin.com/screens/4c4618b0-43d7-4305-8698-41699d8083bd (order inside a row: icon, permission name, its one-line concrete reason, control trailing — and device permissions grouped apart from every other kind of switch) ·
//         https://mobbin.com/flows/061f8e8e-0916-4118-b509-40f46b6fc2a1 (one trailing column carries either the state or the verb: granted rows read as inert state text, ungranted rows read as the action) ·
//         https://mobbin.com/flows/2f0a2068-c929-428a-b0f9-9a4d26b17482 (a row with nothing left to do keeps its slot and goes inert with a check rather than disappearing, and the ask sits beside the reason it is being asked for)

import { useState } from 'react';
import { Button, Card, Text } from '@acme/ui';
import { View } from '@acme/ui/primitives';
import { Camera, Check, Image, Mic } from '@acme/ui/icons';
import { usePermissions } from './permissions.store.ts';
import { usePermissionRequester } from './permission-request';
import {
  canAsk,
  PERMISSION_COPY,
  PERMISSION_KEYS,
  type PermissionKey,
  type PermissionState,
} from './permissions.types.ts';

const ICON: Record<PermissionKey, typeof Mic> = {
  microphone: Mic,
  camera: Camera,
  photos: Image,
};

/** What the row's button says. `null` means the row has nothing left to do. */
function actionFor(state: PermissionState): 'ask' | 'settings' | null {
  if (state === 'granted') return null;
  return canAsk(state) ? 'ask' : 'settings';
}

interface PermissionChecklistProps {
  /**
   * Which permissions to show. Defaults to everything the app uses.
   *
   * A caller narrows it when the checklist is standing in front of one feature
   * — the spatial tutor asks for the microphone and has no business raising a
   * photo-library dialog on the way in.
   */
  keys?: readonly PermissionKey[];
  /** Runs once every key in `keys` is granted. */
  onAllGranted?: () => void;
}

export function PermissionChecklist({
  keys = PERMISSION_KEYS,
  onAllGranted,
}: PermissionChecklistProps) {
  const statuses = usePermissions((s) => s.statuses);
  const { request, openSettings } = usePermissionRequester();
  /*
    Which row is mid-dialog, so its button cannot be pressed twice. Android
    queues a second request behind the first and answers it with the same
    result, which reads as a button that did nothing.
  */
  const [asking, setAsking] = useState<PermissionKey | null>(null);

  const press = (key: PermissionKey, action: 'ask' | 'settings') => {
    if (action === 'settings') {
      openSettings();
      return;
    }
    if (asking !== null) return;
    setAsking(key);
    void request(key)
      .then(() => {
        /*
          Read from the store rather than from this one answer: the caller cares
          whether the WHOLE list is satisfied, and the other rows were granted
          on an earlier press.
        */
        const next = usePermissions.getState().statuses;
        if (keys.every((k) => next[k] === 'granted')) onAllGranted?.();
      })
      .finally(() => setAsking(null));
  };

  return (
    <View className="gap-stack">
      {keys.map((key) => {
        const state = statuses[key];
        const action = actionFor(state);
        const copy = PERMISSION_COPY[key];
        const Icon = ICON[key];
        return (
          <Card key={key} className="flex-row items-center gap-group p-4">
            <Icon
              className={state === 'granted' ? 'text-primary' : 'text-text-muted'}
              size={24}
            />
            <View className="flex-1 gap-1">
              <Text className="font-semibold text-text">{copy.title}</Text>
              <Text className="text-sm text-text-muted">{copy.reason}</Text>
              {state === 'blocked' ? (
                /*
                  The one state that needs its own sentence. "Denied" would send
                  a guardian back to a button the OS will ignore; this says the
                  only thing that works.
                */
                <Text className="text-sm text-text-muted">
                  Turned off in system settings — it has to be switched back on there.
                </Text>
              ) : null}
            </View>
            {action === null ? (
              <View className="flex-row items-center gap-1">
                <Check className="text-primary" size={20} />
                <Text className="text-sm font-semibold text-text">On</Text>
              </View>
            ) : (
              <Button
                variant={action === 'settings' ? 'outline' : 'primary'}
                size="sm"
                disabled={asking !== null}
                loading={asking === key}
                title={action === 'settings' ? 'Open settings' : 'Allow'}
                onPress={() => press(key, action)}
              />
            )}
          </Card>
        );
      })}
    </View>
  );
}
