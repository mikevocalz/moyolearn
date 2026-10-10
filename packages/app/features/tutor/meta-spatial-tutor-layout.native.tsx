import { SpatialSceneProvider } from '@metavr/layout-compat';
import {
  OffsetNear,
  SpatialWindow,
  createWindowScene,
  useSpatialWindowState,
} from '@metavr/layout-window-compat';
import type { ReactNode } from 'react';

export interface MetaSpatialTutorLayoutProps {
  renderMain: (workspaceSpatial: boolean) => ReactNode;
  workspace: ReactNode;
}

const WORKSPACE_LABEL = 'moyo-tutor-workspace';

/*
 * Scene policy is fixed for the provider's lifetime. `drop` matters here:
 * while a spatial slot is unavailable, TutorScreen keeps rendering its one
 * existing workbench in the normal pane/sheet. Once Meta promotes this window,
 * that inline copy unmounts and this copy takes its place in space.
 */
const WINDOW_SCENE = createWindowScene({
  fallback: 'drop',
  retryConfig: { attempts: 5, holdoffMs: 250 },
});

function SpatialTutorContent({ renderMain, workspace }: MetaSpatialTutorLayoutProps) {
  const { placement } = useSpatialWindowState(WORKSPACE_LABEL);
  const workspaceSpatial = placement === 'spatial';

  return (
    <>
      {renderMain(workspaceSpatial)}
      <SpatialWindow
        label={WORKSPACE_LABEL}
        priority={20}
        windowWidth={720}
        windowHeight={640}
        anchor="end"
        offset={{ start: -1, z: OffsetNear }}
        fallback="drop"
      >
        {workspace}
      </SpatialWindow>
    </>
  );
}

/**
 * Meta VR Glasses keep the 1024x640 activity as the tutor's primary window
 * and place the 720x640 workbench beside it. These are supporting-window
 * dimensions, not changes to the established application window contract.
 */
export function MetaSpatialTutorLayout(props: MetaSpatialTutorLayoutProps) {
  return (
    <SpatialSceneProvider initializer={WINDOW_SCENE}>
      <SpatialTutorContent {...props} />
    </SpatialSceneProvider>
  );
}
