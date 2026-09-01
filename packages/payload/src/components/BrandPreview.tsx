'use client';
// Live brand preview for the Organizations admin form. It reads the sibling
// fields (name, brandTheme, brandAccent, logoUrl, logoAspect) from Payload's
// form state and renders a compact shell mock using the same resolver the web
// shell uses, so admins see an accessible, accurate result.
// SOT: packages/theme/tenant.ts
// SOT-KEYWORDS: payload admin brand preview tenant theme organization

import { useField } from '@payloadcms/ui';
import { resolveTenantTheme, tenantCssVariables } from '@acme/theme';
import type { TenantBrand } from '@acme/theme';

export function BrandPreview() {
  const { value: name } = useField<string>({ path: 'name' });
  const { value: logoUrl } = useField<string>({ path: 'logoUrl' });
  const { value: logoAspect } = useField<'square' | 'wide'>({ path: 'logoAspect' });
  const { value: brandTheme } = useField<string>({ path: 'brandTheme' });
  const { value: brandAccent } = useField<string>({ path: 'brandAccent' });

  const brand: TenantBrand = {
    name: name ?? 'Moyo',
    logoUrl: logoUrl ?? undefined,
    logoAspect: logoAspect ?? undefined,
    brandTheme: brandTheme ?? undefined,
    brandAccent: brandAccent ?? undefined,
  };

  const theme = resolveTenantTheme(brand, null);
  const vars = tenantCssVariables(theme);

  const preview: React.CSSProperties = {
    ...vars,
    display: 'grid',
    gridTemplateColumns: '56px 1fr',
    gridTemplateRows: '56px 1fr',
    minHeight: 192,
    borderRadius: 12,
    overflow: 'hidden',
    border: `2px solid ${theme.border}`,
    fontFamily: 'system-ui, sans-serif',
  };

  const header: React.CSSProperties = {
    gridColumn: '1 / -1',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '0 16px',
    backgroundColor: theme.header,
    color: theme.headerForeground,
    borderBottom: `2px solid ${theme.headerBorder}`,
  };

  const sidebar: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    padding: 12,
    gap: 8,
    backgroundColor: theme.sidebar,
    color: theme.sidebarForeground,
  };

  const active: React.CSSProperties = {
    padding: '8px 12px',
    borderRadius: 8,
    backgroundColor: theme.sidebarActive,
    color: theme.sidebarActiveForeground,
  };

  const surface: React.CSSProperties = {
    backgroundColor: theme.surface,
    color: theme.sidebarForeground,
  };

  return (
    <div style={preview}>
      <div style={header}>
        {brand.logoUrl ? (
          <img
            src={brand.logoUrl}
            alt=""
            style={{
              height: 32,
              width: 'auto',
              maxWidth: logoAspect === 'wide' ? 120 : 32,
              objectFit: 'contain',
            }}
          />
        ) : (
          <span
            style={{
              width: 32,
              height: 32,
              display: 'grid',
              placeItems: 'center',
              borderRadius: 6,
              backgroundColor: theme.surfaceSubtle,
              color: theme.sidebarForeground,
              fontWeight: 700,
            }}
          >
            {brand.name[0]?.toUpperCase() ?? 'M'}
          </span>
        )}
        <span style={{ fontWeight: 600 }}>{brand.name}</span>
      </div>
      <div style={sidebar}>
        <div style={active}>Home</div>
        <div>Schedule</div>
        <div>Progress</div>
      </div>
      <div style={surface} />
    </div>
  );
}
