/**
 * The non-native half of the 3D stage: nothing at all.
 *
 * `tutor-avatar-3d.native.tsx` imports `react-native-webgpu`, which does not
 * exist off-device, and three's WebGPU build, which is megabytes. Metro picks
 * the `.native` file; every other bundler picks this one, so the web build of
 * `@acme/app` carries no renderer even though `tutor-avatar.tsx` names the
 * module. That is the whole job.
 *
 * It is a real component rather than a thrown error because the caller's flag
 * is an env var, and a misconfigured web build should quietly stay 2D rather
 * than white-screen a child.
 *
 * SOT: ./tutor-avatar-3d.native.tsx · docs/decisions/adr-111-native-3d-runtime.md
 * SOT-KEYWORDS: tutor avatar 3d web stub platform split no renderer
 */
export interface TutorAvatar3DProps {
  active: boolean;
  isSpeaking: boolean;
  sampleMouth?: (nowMs: number) => number;
  sampleSpeaking?: () => boolean;
  reducedMotion?: boolean;
  onUnavailable?: (reason: string) => void;
  onFirstFrame?: () => void;
  modelUri?: string;
}

export function TutorAvatar3D(_props: TutorAvatar3DProps) {
  return null;
}

export default TutorAvatar3D;
