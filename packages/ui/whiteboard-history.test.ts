import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { createBoardDoc } from '../app/features/tutor/board-doc.ts';
import {
  handleWhiteboardHistoryKey,
  whiteboardHistoryAction,
  WHITEBOARD_HISTORY_SHIM,
} from './whiteboard-history.ts';

type Shortcut = Parameters<typeof whiteboardHistoryAction>[0];
const shortcut = (overrides: Partial<Shortcut> = {}): Shortcut => ({ key: 'z', ctrlKey: true, ...overrides });

function keyEvent(overrides: Partial<Shortcut> = {}): Event & Shortcut {
  const event = new Event('keydown', { cancelable: true });
  for (const [key, value] of Object.entries(shortcut(overrides))) {
    Object.defineProperty(event, key, { value, configurable: true });
  }
  return event as Event & Shortcut;
}

function nativePage(onAction?: (action: 'undo' | 'redo') => void) {
  const events = new EventTarget();
  const registrations: { type: string; capture: boolean }[] = [];
  const messages: { type: string; action: 'undo' | 'redo' }[] = [];
  const window: Record<string, unknown> = {
    ReactNativeWebView: {
      postMessage(raw: string) {
        const message = JSON.parse(raw) as typeof messages[number];
        messages.push(message);
        onAction?.(message.action);
      },
    },
  };
  const document = {
    addEventListener(type: string, listener: EventListener, capture: boolean) {
      registrations.push({ type, capture });
      events.addEventListener(type, listener, capture);
    },
  };
  const install = () => runInNewContext(WHITEBOARD_HISTORY_SHIM, { window, document });
  install();
  return { events, window, messages, registrations, install };
}

function boardWithTwoUndoSteps() {
  const doc = createBoardDoc();
  const record = (id: string) => ({ id, typeName: 'shape', type: 'draw', props: {} });
  doc.applyDiff({ added: { first: record('first') } }, 'local');
  // Undo/redo ends Yjs's capture window without sleeping or reaching into its
  // private UndoManager. The next authored edit is an independent history step.
  doc.undo();
  doc.redo();
  doc.applyDiff({ added: { second: record('second') } }, 'local');
  doc.applyDiff({ added: { peer: record('peer') } }, 'remote');
  return doc;
}

function ids(doc: ReturnType<typeof createBoardDoc>): string[] {
  return Object.keys((doc.snapshot() as { document: { store: object } }).document.store).sort();
}

test('board shortcuts recognize Ctrl/Cmd Z, Shift Z and Ctrl Y with case-insensitive keys', () => {
  assert.equal(whiteboardHistoryAction(shortcut()), 'undo');
  assert.equal(whiteboardHistoryAction(shortcut({ key: 'Z' })), 'undo');
  assert.equal(whiteboardHistoryAction(shortcut({ ctrlKey: false, metaKey: true })), 'undo');
  assert.equal(whiteboardHistoryAction(shortcut({ shiftKey: true })), 'redo');
  assert.equal(whiteboardHistoryAction(shortcut({ ctrlKey: false, metaKey: true, shiftKey: true })), 'redo');
  assert.equal(whiteboardHistoryAction(shortcut({ key: 'y' })), 'redo');
  assert.equal(whiteboardHistoryAction(shortcut({ key: 'Y' })), 'redo');
  assert.equal(whiteboardHistoryAction(shortcut({ key: 'y', ctrlKey: false, metaKey: true })), null);
  assert.equal(whiteboardHistoryAction(shortcut({ ctrlKey: false })), null);
  assert.equal(whiteboardHistoryAction(shortcut({ altKey: true })), null);
  assert.equal(whiteboardHistoryAction(shortcut({ key: 'ArrowLeft' })), null);
});

test('text inputs, textareas and contenteditable descendants keep their editing history', () => {
  for (const target of [{ tagName: 'INPUT' }, { tagName: 'textarea' }, { tagName: 'SPAN', isContentEditable: true }]) {
    let called = 0;
    const event = keyEvent({ target });
    assert.equal(whiteboardHistoryAction(shortcut({ target })), null);
    assert.equal(handleWhiteboardHistoryKey(event, { undo: () => { called += 1; }, redo: () => { called += 1; } }), false);
    assert.equal(event.defaultPrevented, false);
    assert.equal(called, 0);
  }
  assert.equal(whiteboardHistoryAction(shortcut({ target: { tagName: 'CANVAS', isContentEditable: false } })), 'undo');
});

test('web managed history is off by default and leaves the editor event untouched', () => {
  const target = new EventTarget();
  let engineCalls = 0;
  target.addEventListener('keydown', (event) => {
    assert.equal(handleWhiteboardHistoryKey(event as Event & Shortcut), false);
  });
  target.addEventListener('keydown', () => { engineCalls += 1; });
  const event = keyEvent();
  target.dispatchEvent(event);
  assert.equal(event.defaultPrevented, false);
  assert.equal(engineCalls, 1);
});

test('actual web handler stops the editor second undo and changes only the Yjs local author', () => {
  const doc = boardWithTwoUndoSteps();
  const target = new EventTarget();
  let engineCalls = 0;
  target.addEventListener('keydown', (event) => {
    handleWhiteboardHistoryKey(event as Event & Shortcut, doc);
  }, true);
  // This represents the editor's competing handler. If propagation is not
  // stopped immediately, it takes a second step and removes `first` too.
  target.addEventListener('keydown', () => { engineCalls += 1; doc.undo(); });
  const undo = keyEvent();
  target.dispatchEvent(undo);
  assert.equal(undo.defaultPrevented, true);
  assert.equal(engineCalls, 0);
  assert.deepEqual(ids(doc), ['first', 'peer']);
  target.dispatchEvent(keyEvent({ shiftKey: true }));
  assert.deepEqual(ids(doc), ['first', 'peer', 'second']);
  target.dispatchEvent(keyEvent());
  target.dispatchEvent(keyEvent({ key: 'y' }));
  assert.deepEqual(ids(doc), ['first', 'peer', 'second']);
  assert.equal(engineCalls, 0);
  doc.destroy();
});

test('embedded native shim installs once in capture phase and leaves standalone history alone', () => {
  const page = nativePage();
  page.install();
  assert.deepEqual(page.registrations, [{ type: 'keydown', capture: true }]);
  let engineCalls = 0;
  page.events.addEventListener('keydown', () => { engineCalls += 1; });
  const event = keyEvent();
  page.events.dispatchEvent(event);
  assert.deepEqual(page.messages, []);
  assert.equal(event.defaultPrevented, false);
  assert.equal(engineCalls, 1);
});

test('embedded native shim posts managed actions once and prevents the editor second undo', () => {
  const doc = boardWithTwoUndoSteps();
  const page = nativePage((action) => doc[action]());
  page.window.__moyoHistoryManaged = true;
  let engineCalls = 0;
  page.events.addEventListener('keydown', () => { engineCalls += 1; doc.undo(); });
  const undo = keyEvent();
  page.events.dispatchEvent(undo);
  assert.equal(undo.defaultPrevented, true);
  assert.deepEqual(page.messages, [{ type: 'moyo:history-action', action: 'undo' }]);
  assert.deepEqual(ids(doc), ['first', 'peer']);
  page.events.dispatchEvent(keyEvent({ shiftKey: true }));
  assert.deepEqual(ids(doc), ['first', 'peer', 'second']);
  page.events.dispatchEvent(keyEvent());
  page.events.dispatchEvent(keyEvent({ key: 'y' }));
  assert.deepEqual(ids(doc), ['first', 'peer', 'second']);
  assert.deepEqual(page.messages.map(({ action }) => action), ['undo', 'redo', 'undo', 'redo']);
  assert.equal(engineCalls, 0);
  doc.destroy();
});

test('native managed mode can be toggled without reinstalling or arming spatial calibration', () => {
  const page = nativePage();
  page.events.dispatchEvent(keyEvent());
  page.window.__moyoHistoryManaged = true;
  page.events.dispatchEvent(keyEvent({ ctrlKey: false, metaKey: true }));
  page.window.__moyoHistoryManaged = false;
  const event = keyEvent();
  page.events.dispatchEvent(event);
  assert.equal(event.defaultPrevented, false);
  assert.deepEqual(page.messages, [{ type: 'moyo:history-action', action: 'undo' }]);
  assert.equal(page.registrations.length, 1);
  assert.equal(page.window.__moyo, undefined, 'keyboard routing must not arm or depend on the pointer camera guard');
});

test('native shim exempts text-editing and unrelated shortcuts without suppressing their events', () => {
  const page = nativePage();
  page.window.__moyoHistoryManaged = true;
  let passed = 0;
  page.events.addEventListener('keydown', () => { passed += 1; });
  const cases = [
    shortcut({ target: { tagName: 'INPUT' } }),
    shortcut({ target: { tagName: 'textarea' } }),
    shortcut({ target: { tagName: 'SPAN', isContentEditable: true } }),
    shortcut({ altKey: true }),
    shortcut({ ctrlKey: false }),
    shortcut({ key: 'y', ctrlKey: false, metaKey: true }),
    shortcut({ key: 's' }),
  ];
  for (const value of cases) {
    const event = keyEvent(value);
    page.events.dispatchEvent(event);
    assert.equal(event.defaultPrevented, false);
  }
  assert.deepEqual(page.messages, []);
  assert.equal(passed, cases.length);
});
