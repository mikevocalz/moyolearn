// Tenant scope — injects the active tenant's CSS variables into the web shell.
// It is a pure presentational boundary: it does not read session, route, or org
// data; the caller resolves the theme and passes the variable map.
// SOT: packages/app/core/tenant-theme.ts
// SOT-KEYWORDS: tenant scope web css variables theme shell
import type { ComponentProps, ReactNode } from 'react';
import { View } from './tw';

/*
  The style type this View actually accepts, derived from the component rather
  than imported from `react-native`. RN 0.88 widened `ViewStyle.backgroundImage`
  to `string | readonly BackgroundImageValue[]` while react-native-web's stays
  `string`, so a value asserted as RN's `ViewStyle` is no longer assignable to
  the web View it is handed to. Deriving the type keeps the two in step by
  construction; there is nothing here to keep updating.
*/
type ViewStyleProp = ComponentProps<typeof View>['style'];

export interface TenantScopeProps {
  variables: Record<string, string>;
  children: ReactNode;
  className?: string;
}

export function TenantScope({ variables, children, className }: TenantScopeProps) {
  return (
    <View
      className={className}
      style={variables as unknown as ViewStyleProp}
    >
      {children}
    </View>
  );
}
