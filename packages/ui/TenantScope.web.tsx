// Tenant scope — injects the active tenant's CSS variables into the web shell.
// It is a pure presentational boundary: it does not read session, route, or org
// data; the caller resolves the theme and passes the variable map.
// SOT: packages/app/core/tenant-theme.ts
// SOT-KEYWORDS: tenant scope web css variables theme shell
import type { ReactNode } from 'react';
import type { ViewStyle } from 'react-native';
import { View } from './tw';

export interface TenantScopeProps {
  variables: Record<string, string>;
  children: ReactNode;
  className?: string;
}

export function TenantScope({ variables, children, className }: TenantScopeProps) {
  return (
    <View
      className={className}
      style={variables as unknown as ViewStyle}
    >
      {children}
    </View>
  );
}
