/**
 * The shot: how far back the camera stands to hold all of her.
 *
 * Fitted rather than authored, because the stage inherited the web scene's hero
 * camera (her face at arm's length) and it cropped her at the collarbone.
 * SOT: packages/app/features/tutor/tutor-avatar-3d.native.tsx
 * SOT-KEYWORDS: camera framing fit height aspect invariant full body natalie pane
 */
import * as THREE from 'three';
/** Fraction of the view height her tightest feature fills. */
export declare const TARGET_FILL = 1;
/**
 * Frames the full height of `body` and points `camera` at it.
 *
 * Height only, ignoring `aspect`: her pane changes width when a neighbouring
 * one opens, never height, so a height fit is a fit that does not resize her.
 * (A contain fit also budgets for arms that are not on screen — `Box3` measures
 * a skinned mesh at its BIND pose, an A-pose with the hands out at x ±0.52,
 * while the scene poses her arms down at ±0.16.)
 */
export declare function frameBody(camera: THREE.PerspectiveCamera, body: THREE.Object3D): void;
