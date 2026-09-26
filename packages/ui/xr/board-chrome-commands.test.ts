import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BOARD_COMMAND,
  decodeBoardCommand,
  inkToRive,
  toolToRive,
} from './board-chrome-commands.ts';

test('every control decodes to the verb the tray already owns', () => {
  assert.deepEqual(decodeBoardCommand(BOARD_COMMAND.pen), { kind: 'tool', tool: 'draw' });
  assert.deepEqual(decodeBoardCommand(BOARD_COMMAND.highlighter), { kind: 'tool', tool: 'highlight' });
  assert.deepEqual(decodeBoardCommand(BOARD_COMMAND.eraser), { kind: 'tool', tool: 'eraser' });
  assert.deepEqual(decodeBoardCommand(BOARD_COMMAND.togglePalette), { kind: 'togglePalette' });
  assert.deepEqual(decodeBoardCommand(BOARD_COMMAND.closePalette), { kind: 'closePalette' });
  assert.deepEqual(decodeBoardCommand(BOARD_COMMAND.undo), { kind: 'undo' });
  assert.deepEqual(decodeBoardCommand(BOARD_COMMAND.redo), { kind: 'redo' });
  assert.deepEqual(decodeBoardCommand(BOARD_COMMAND.clear), { kind: 'clear' });
  assert.deepEqual(decodeBoardCommand(BOARD_COMMAND.askNatalie), { kind: 'askNatalie' });
});

test('ink selection is the palette index — all seven, in the tray order', () => {
  const inks = ['black', 'blue', 'red', 'green', 'yellow', 'orange', 'violet'] as const;
  inks.forEach((ink, i) => {
    assert.deepEqual(decodeBoardCommand(BOARD_COMMAND.inkBase + i), { kind: 'ink', ink });
    assert.equal(inkToRive(ink), i);
  });
});

test('a malformed command is a dead button, never a wrong action', () => {
  /* 17 is `closePalette` — deliberate overlap made impossible by the artboard
     only ever emitting ink indices 0..6; 17.5 and beyond-17 are malformed. */
  for (const bad of [-1, 9, 18, 17.5, Number.NaN, Infinity]) {
    assert.deepEqual(decodeBoardCommand(bad), { kind: 'none' }, `command ${bad}`);
  }
  assert.deepEqual(decodeBoardCommand(BOARD_COMMAND.none), { kind: 'none' });
});

test('presentation mapping is total over the board vocabulary', () => {
  assert.equal(toolToRive('draw'), 0);
  assert.equal(toolToRive('highlight'), 1);
  assert.equal(toolToRive('eraser'), 2);
});
