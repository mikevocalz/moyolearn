'use client';
import { useMemo, type ComponentProps } from 'react';
import { ViroGeometry } from '@reactvision/react-viro';
import { roundedPanel } from './rounded-panel.ts';
import { spatialCorners } from './spatial-tokens.ts';

type Props = Omit<ComponentProps<typeof ViroGeometry>, 'vertices' | 'normals' | 'texcoords' | 'triangleIndices'> & {
  width: number;
  height: number;
  radius?: number;
  roundTop?: boolean;
  roundBottom?: boolean;
};
export function XrRoundedQuad({ width, height, radius = spatialCorners.panel, roundTop = true, roundBottom = true, ...props }: Props) {
  const mesh = useMemo(() => roundedPanel(width, height, radius, roundTop, roundBottom), [width, height, radius, roundTop, roundBottom]);
  return <ViroGeometry {...mesh} {...props} />;
}
