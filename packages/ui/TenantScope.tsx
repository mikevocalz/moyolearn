// Tenant scope — native no-op. CSS variables are a web concern; native shells
// resolve tenant color through the existing theme tokens and role scopes.
// SOT: packages/app/core/tenant-theme.ts · packages/ui/TenantScope.web.tsx
// SOT-KEYWORDS: tenant scope native no-op theme
import type { ReactNode } from 'react';

export interface TenantScopeProps {
  variables?: Record<string, string>;
  children: ReactNode;
  className?: string;
}

export function TenantScope({ children }: TenantScopeProps) {
  return <>{children}</>;
}
