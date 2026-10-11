import { test } from 'node:test';
import assert from 'node:assert/strict';
import { studioViolations } from './check-business-studio-ui.mjs';
for (const source of ['<section />', '<span>hello</span>', "document.createElement('a')", "createElement('div')", '<View dangerouslySetInnerHTML={x} />', '<View draggable onDrop={f} />', 'Gesture.Pan()', "import { runOnJS } from 'react-native-reanimated';", 'useState(0)']) {
  test(`rejects ${source}`, () => assert.ok(studioViolations(source).length));
}
test('allows semantic kit, current hooks and runtime scheduling', () => {
  assert.deepEqual(studioViolations("import { scheduleOnRN } from 'react-native-worklets'; const p=usePanGesture({}); <Section><View><Text>Drag</Text></View></Section>"), []);
});

test('does not mistake TypeScript generics for JSX', () => assert.deepEqual(studioViolations('type Receipt = ReturnType<typeof draftReceipt>; const values = new Map<string, number>(); async function f(): Promise<void> {}'), []));
