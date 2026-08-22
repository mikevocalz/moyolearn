/**
 * `next/image`, for Storybook only.
 *
 * The kit's Image is SolitoImage, which resolves to next/image on web. That
 * component validates every remote host against `next.config.ts` — a file Vite
 * never reads — so any story with a remote src dies with "Invalid src prop"
 * rather than rendering. This is aliased in .storybook/main.ts.
 *
 * Deliberately dumb: it exists so image stories render, not to reproduce
 * next/image. Optimisation, srcset and lazy behaviour are Next's job and are
 * exercised by the web app, not here.
 *
 * The bare <img> is the one place in this repo it is correct — this file IS the
 * boundary that keeps raw DOM out of app code.
 */
import type { CSSProperties } from 'react';

interface ShimProps {
  src?: string | { src?: string };
  alt?: string;
  width?: number | string;
  height?: number | string;
  fill?: boolean;
  style?: CSSProperties;
  className?: string;
  contentFit?: string;
  // next/image props that have no meaning here but must not reach the DOM.
  priority?: boolean;
  quality?: number;
  loader?: unknown;
  placeholder?: string;
  blurDataURL?: string;
  unoptimized?: boolean;
  onLoadingComplete?: unknown;
  [key: string]: unknown;
}

export default function NextImageShim({
  src,
  alt = '',
  width,
  height,
  fill,
  style,
  className,
  contentFit,
  priority: _priority,
  quality: _quality,
  loader: _loader,
  placeholder: _placeholder,
  blurDataURL: _blurDataURL,
  unoptimized: _unoptimized,
  onLoadingComplete: _onLoadingComplete,
  ...rest
}: ShimProps) {
  const resolved = typeof src === 'string' ? src : src?.src;
  const fillStyle: CSSProperties = fill
    ? { position: 'absolute', inset: 0, width: '100%', height: '100%' }
    : {};
  return (
    <img
      src={resolved}
      alt={alt}
      width={fill ? undefined : (width as number | undefined)}
      height={fill ? undefined : (height as number | undefined)}
      className={className}
      style={{ objectFit: (contentFit as CSSProperties['objectFit']) ?? 'cover', ...fillStyle, ...style }}
      {...(rest as Record<string, unknown>)}
    />
  );
}
