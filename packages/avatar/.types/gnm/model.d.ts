/**
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * TypeScript port of google/xrblocks, samples/avatar_lab/gnm/GNMModel.js.
 *
 * GNM (Generative aNthropometric Model) head forward function, mirroring
 * gnm/shape/gnm_common.py:
 *
 *   bind  = template + identity_basis^T id + expression_basis^T expr
 *   joints = template_joints + joint_identity_basis^T id
 *   world = LinearBlendSkinning(bind + pose_correctives, FK(joints, rotations))
 *
 * The model data is read from a 'GNMW' container produced by
 * tools/export_gnm_web.py. The large PCA bases are int8-quantized with one
 * float32 scale per component; coefficients fold the scale in at accumulation
 * time so dequantization is free.
 *
 * This file is dependency-free (typed arrays only) so it runs in Node for
 * verification as well as in the browser.
 */
export interface GNMMeta {
    model: string;
    gnmVersion: string;
    variant: string;
    numVertices: number;
    numJoints: number;
    identityDim: number;
    expressionDim: number;
    identityNames: string[];
    expressionNames: string[];
    jointNames: string[];
    componentNames: string[];
    materialNames: string[];
    regionNames: string[];
    bboxMin: number[];
    bboxMax: number[];
    hasPoseCorrectives: boolean;
}
export interface GNMSections {
    template: Float32Array;
    triangles: Uint16Array;
    quads: Uint16Array;
    template_joints: Float32Array;
    joint_parents: Int32Array;
    skinning_weights: Float32Array;
    joint_identity_basis: Float32Array;
    identity_basis: Int8Array;
    identity_scales: Float32Array;
    expression_basis: Int8Array;
    expression_scales: Float32Array;
    component_id: Uint8Array;
    material_id: Uint8Array;
    region_id: Uint8Array;
    landmark_indices: Uint16Array;
    landmark_weights: Float32Array;
}
/** Parses a GNMW container buffer into {meta, sections}. */
export declare function parseContainer(buffer: ArrayBuffer): {
    meta: GNMMeta;
    sections: GNMSections;
};
/** Fetches a URL into an ArrayBuffer, reporting streaming progress. */
export declare function fetchWithProgress(url: string, onProgress?: (fraction: number) => void): Promise<ArrayBuffer>;
/** Rodrigues' formula matching gnm_common.axis_angle_to_rotation_matrix. */
export declare function axisAngleToMatrix(x: number, y: number, z: number, out: Float32Array, offset?: number): void;
export declare class GNMHeadModel {
    meta: GNMMeta;
    numVertices: number;
    numJoints: number;
    identityDim: number;
    expressionDim: number;
    template: Float32Array;
    triangles: Uint16Array;
    quads: Uint16Array;
    templateJoints: Float32Array;
    jointParents: Int32Array;
    skinningWeights: Float32Array;
    jointIdentityBasis: Float32Array;
    identityBasis: Int8Array;
    identityScales: Float32Array;
    expressionBasis: Int8Array;
    expressionScales: Float32Array;
    componentId: Uint8Array;
    materialId: Uint8Array;
    regionId: Uint8Array;
    landmarkIndices: Uint16Array;
    landmarkWeights: Float32Array;
    identity: Float32Array;
    expression: Float32Array;
    rotations: Float32Array;
    translation: Float32Array;
    jointsWorld: Float32Array;
    dirty: boolean;
    private _lockedJoints;
    private _idSum;
    private _exprSum;
    private _incrementalUpdates;
    private _idBlend;
    private _exprBlend;
    private _bind;
    private _jointsBind;
    private _rotWorld;
    private _skinTrans;
    constructor(meta: GNMMeta, sections: GNMSections);
    static load(url: string, onProgress?: (fraction: number) => void): Promise<GNMHeadModel>;
    /** Adds `factor` times basis component `index` into `sum`. */
    private _addComponent;
    private _accumulate;
    private _maybeReaccumulate;
    setIdentityParam(index: number, value: number): void;
    setExpressionParam(index: number, value: number): void;
    setIdentityVector(values: ArrayLike<number>): void;
    setExpressionVector(values: ArrayLike<number>): void;
    resetIdentity(): void;
    resetExpression(): void;
    /**
     * Marks joints whose rotation is owned by another layer (§8: the BODY owns
     * neck/head — GNM's own neck/head joints stay at identity forever). Dev
     * writes to a locked joint throw.
     */
    lockJoints(indices: Iterable<number>): void;
    setJointRotation(jointIndex: number, x: number, y: number, z: number): void;
    setTranslation(x: number, y: number, z: number): void;
    resetPose(): void;
    private _beginBlend;
    beginIdentityBlend(target: ArrayLike<number>): void;
    beginExpressionBlend(target: ArrayLike<number>): void;
    private _applyBlend;
    setIdentityBlend(t: number): void;
    setExpressionBlend(t: number): void;
    private _computeJointsBind;
    /**
     * Forward kinematics matching gnm_common.joint_transforms_world, followed
     * by the skinning-transform construction from linear_blend_skinning:
     * per joint, rotation R_world and translation t_world − R_world·j_bind.
     */
    private _computeJointTransforms;
    /**
     * Runs the full forward pass and writes world-space vertices into `out`
     * (Float32Array of length numVertices*3). Also refreshes `jointsWorld`.
     */
    /**
     * Runs the joint FK and hands back the world rotations (row-major 3x3 per
     * joint) and the skinning translations.
     *
     * These are LIVE VIEWS of the model's internal buffers, not copies — read
     * them, do not keep them. They exist as public API because the GPU path
     * (`src/compute/head.ts`, doc 22 §4 row 14) deliberately leaves FK on the CPU
     * and uploads this result as uniforms; without an accessor the compute path
     * would have to duplicate Rodrigues, and two copies of a transform chain is
     * how a head ends up twisting the wrong way on one code path only.
     */
    prepareSkinTransforms(): {
        rotWorld: Float32Array;
        skinTrans: Float32Array;
    };
    computeVertices(out: Float32Array): void;
    /** Barycentric landmark extraction (68 × 3 vertices/weights). */
    computeLandmarks(vertices: Float32Array, out: Float32Array): number;
    /** World-space rotation frame (row-major 3x3) of a joint after FK. */
    getJointWorldRotation(jointIndex: number): Float32Array<ArrayBufferLike>;
}
