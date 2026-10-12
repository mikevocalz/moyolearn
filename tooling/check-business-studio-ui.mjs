// Scoped regression guard, not a general JavaScript security scanner.
// SOT: docs/business/semantic-gestures.md
// SOT-KEYWORDS: business studio semantic ui source guard legacy gesture
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
export function studioViolations(source) {
  const rules = [
    ['raw JSX markup', /<\/?(?!typeof\b|keyof\b|infer\b|string\b|number\b|boolean\b|void\b|never\b)[a-z][\w-]*(?:\s|\/?>)/],
    ['DOM controls', /\b(?:document\.createElement|createElement\s*\(\s*['"])/],
    ['HTML injection', /dangerouslySetInnerHTML/],
    ['browser drag/drop', /\b(?:draggable|onDragStart|onDragOver|onDrop|dataTransfer)\b/],
    ['legacy gesture API', /\b(?:Gesture\.(?:Pan|Tap|Pinch|Rotation|LongPress|Simultaneous|Race|Exclusive)|PanGestureHandler)\b/],
    ['deprecated runtime helpers', /import[\s\S]*?\{[^}]*\brunOn(?:JS|UI)\b[^}]*\}\s*from\s*['"]react-native-(?:reanimated|worklets)['"]/],
    ['React component state instead of instance store', /\buseState\s*\(/],
  ];
  return rules.filter(([, pattern]) => pattern.test(source)).map(([name]) => name);
}
export async function checkStudio() {
  const paths = ['apps/web/components/business/CampaignStudio.tsx', 'packages/ui/email-canvas.tsx', 'packages/ui/email-reorder.web.tsx'];
  for (const path of paths) {
    const problems = studioViolations(await readFile(path, 'utf8'));
    if (problems.length) throw new Error(`${path}: ${problems.join(', ')}`);
  }
  const primitive = await readFile('packages/ui/html/email-document.web.tsx', 'utf8');
  if (!primitive.includes('sandbox=""') || !primitive.includes('referrerPolicy="no-referrer"') || primitive.includes('dangerouslySetInnerHTML')) throw new Error('Opaque document preview policy was weakened');
  const tags = [...primitive.matchAll(/<\/?([a-z][\w-]*)(?:\s|\/?>)/g)].map((match) => match[1]);
  if (tags.some((tag) => tag !== 'iframe')) throw new Error('Document primitive contains application markup');
  console.log('Business studio semantic/gesture source guard passed.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  checkStudio().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
