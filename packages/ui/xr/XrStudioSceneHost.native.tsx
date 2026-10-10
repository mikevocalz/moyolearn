'use client';
// The Studio-authored scene's mount point — the only file in the package that
// may name `StudioSceneNavigator`.
//
// Two callers, one answer: a screen mounts this host with a registry-resolved
// `sceneId` (or nothing, for the project's opening scene) and never touches
// the env vars, the manifest keys or the fetch contract — `VRTStudioModule`
// and the Expo plugin own those. When the build carries no project link the
// host renders an engineering notice instead of a navigator whose first fetch
// could only fail, because `studioConnection()` is the honest signal and a
// mounted navigator is not.
//
// The navigator's own loading and error overlays are provided so a failed or
// slow fetch surfaces as words rather than a silent camera feed — the same
// rule the rest of the XR surface keeps, that a child never stares at nothing
// without a sentence saying why.
// SOT: packages/ui/xr/studio-config.ts · apps/mobile/app.config.ts
// SOT-KEYWORDS: xr studio scene host reactvision navigator loading error code-first fallback

import React from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  isStudioApiError,
  StudioSceneNavigator,
} from '@reactvision/react-viro';
import { XR_COLOR } from './xr-colors.ts';
import { studioConnection } from './studio-config.ts';
import type { XrStudioSceneHostProps } from './XrStudioSceneHost.types.ts';

/**
 * THE SENTENCE, NOT THE ERROR OBJECT. `StudioApiError` carries a stable
 * `code` deliberately — its docs warn against matching `message`, which iOS
 * localises — so the detail line is chosen on the code first and the
 * envelope's human-readable `detail` only when the code says nothing new.
 */
function studioErrorDetail(error: Error): string {
  if (isStudioApiError(error)) {
    if (error.code === 'SCENE_NOT_FOUND') return 'That scene is not in the project yet.';
    if (error.code === 'UNAUTHORIZED') return 'This build has no working Studio key.';
    return error.detail ?? error.message;
  }
  return error.message;
}

function StatusPanel({ title, detail, onRetry }: { title: string; detail?: string; onRetry?: () => void }) {
  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
        backgroundColor: XR_COLOR.void,
      }}
    >
      <Text style={{ color: XR_COLOR.onPanel, fontSize: 16, textAlign: 'center' }}>{title}</Text>
      {detail ? (
        <Text style={{ color: XR_COLOR.onPanelMuted, fontSize: 13, marginTop: 8, textAlign: 'center' }}>
          {detail}
        </Text>
      ) : null}
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          style={{ marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, borderWidth: 1, borderColor: XR_COLOR.onPanelMuted }}
        >
          <Text style={{ color: XR_COLOR.onPanel, fontSize: 14 }}>Try again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Mounts a Studio-authored scene under the app's own navigator.
 *
 * `sceneId` comes from `xrStudioSceneId` — a registry entry that has resolved
 * to a real UUID — or is omitted for the project's opening scene. Everything
 * Studio cannot author (the QuickDraw board, the texture host, the stylus
 * arbiter, Natalie) stays code-first in `tutor-xr-screen` and never routes
 * through here.
 */
export function XrStudioSceneHost({
  sceneId,
  onExitViro,
  onError,
  onSceneReady,
}: XrStudioSceneHostProps) {
  if (!studioConnection().configured) {
    return (
      <StatusPanel
        title="Studio is not linked in this build"
        detail="The project id or API key was absent at build time."
      />
    );
  }
  return (
    <StudioSceneNavigator
      sceneId={sceneId}
      onExitViro={onExitViro}
      onError={onError}
      onSceneReady={onSceneReady}
      loadingView={<StatusPanel title="Loading the scene…" />}
      renderError={(error, retry) => (
        <StatusPanel title="The scene did not load" detail={studioErrorDetail(error)} onRetry={retry} />
      )}
      style={{ flex: 1 }}
    />
  );
}
