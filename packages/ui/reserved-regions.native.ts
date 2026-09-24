// Fold and camera geometry for the current window, from the `ReservedRegions`
// local Expo module (iOS 27.1+; every other platform and version answers []).
//
// Re-queried on every window size change: UIKit publishes no change event for
// reserved regions, and every fold, unfold, rotation and Split View resize
// changes the window, so the window is the signal.
// SOT: apps/mobile/modules/reserved-regions/ios/ReservedRegionsModule.swift
// SOT-KEYWORDS: reserved regions hook fold division occlusion iphone duo native
import { requireOptionalNativeModule } from 'expo';
import { useEffect, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import type { ReservedRegion } from './reserved-regions.types';

export type { ReservedRegion };

interface ReservedRegionsNative {
  query(): Promise<ReservedRegion[]>;
}

const native = requireOptionalNativeModule<ReservedRegionsNative>('ReservedRegions');
const NONE: readonly ReservedRegion[] = [];

export function useReservedRegions(): readonly ReservedRegion[] {
  const { width, height } = useWindowDimensions();
  const [regions, setRegions] = useState<readonly ReservedRegion[]>(NONE);

  useEffect(() => {
    if (!native) return;
    let live = true;
    void native.query().then((next) => {
      if (live) setRegions(next);
    });
    return () => {
      live = false;
    };
  }, [width, height]);

  return regions;
}
