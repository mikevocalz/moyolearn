// Tenant theme resolution now lives in @acme/theme so admin, app, and web all
// import from the same source. This file re-exports for backwards compatibility
// with existing @acme/app consumers.
// SOT: packages/theme/tenant.ts
// SOT-KEYWORDS: tenant theme re-export app
export {
  resolveTenantTheme,
  tenantCssVariables,
  accessibleForeground,
  type ResolvedTenantTheme,
  type TenantBrand,
} from '@acme/theme';
