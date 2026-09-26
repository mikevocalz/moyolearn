// Shared heartbeat contour for the native splash and authored Redraw scene.
// The tip extends into the book's spine; the old 300px oval stopped above it.
// SOT-KEYWORDS: splash heart contour complete lobes tip svg redraw
export const HEART_BOUNDS = { x: 408, y: 300, width: 496, height: 430 } as const;
export const HEART_PATH = [
  'M656 380',
  'C620 330 575 300 530 300',
  'C465 300 408 350 408 425',
  'C408 510 525 610 656 730',
  'C787 610 904 510 904 425',
  'C904 350 847 300 782 300',
  'C737 300 692 330 656 380 Z',
].join(' ');
