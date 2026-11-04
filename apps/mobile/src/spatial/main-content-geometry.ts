/** Authored center surface baseline from the existing 1024×640 Horizon launch contract. */
export const MAIN_CONTENT_ASPECT_RATIO = 1024 / 640;

/** Fits the center surface inside its measured host without changing OS window bounds. */
export function fitMainContent(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  const contentWidth = Math.min(width, height * MAIN_CONTENT_ASPECT_RATIO);
  const contentHeight = contentWidth / MAIN_CONTENT_ASPECT_RATIO;
  return { width: contentWidth, height: contentHeight, left: (width - contentWidth) / 2, top: (height - contentHeight) / 2 };
}
