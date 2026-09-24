// The regions UIKit reserves inside the app window: a fold `division` and a
// camera `occlusion`, each with a frame in window points and whether it is
// currently active (a flat Duo reports its fold inactive at zero width).
// SOT: apps/mobile/modules/reserved-regions/ios/ReservedRegionRecord.swift
// SOT-KEYWORDS: reserved regions fold division occlusion iphone duo types
export interface ReservedRegion {
  kind: 'division' | 'occlusion';
  x: number;
  y: number;
  width: number;
  height: number;
  margins: { top: number; left: number; bottom: number; right: number };
  active: boolean;
}
