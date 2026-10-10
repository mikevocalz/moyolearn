import type { ReactNode } from 'react';

export interface MetaSpatialTutorLayoutProps {
  renderMain: (workspaceSpatial: boolean) => ReactNode;
  workspace: ReactNode;
}

/**
 * Non-native platforms keep the tutor's existing pane/sheet composition.
 * The native fork promotes the same workspace into a Meta VR Layout window
 * when the glasses runtime offers a spatial slot.
 */
export function MetaSpatialTutorLayout({ renderMain }: MetaSpatialTutorLayoutProps) {
  return renderMain(false);
}
