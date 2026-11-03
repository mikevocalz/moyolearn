import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createForgeBoardPngSaver, type ForgeBoardExportDirectory } from './forge-board-export.shared.ts';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const payload = PNG.split(',')[1]!;

function folder(options: { write?: () => Promise<void>; read?: () => Promise<string> } = {}) {
  const calls: string[] = [];
  let bytes: string | undefined;
  let createdName = '';
  const directory: ForgeBoardExportDirectory = {
    createFile(name, type) {
      calls.push('create');
      assert.equal(type, 'image/png');
      assert.match(name, /^moyo-board-[\w-]+\.png$/);
      createdName = name;
      return {
        uri: 'content://user-selected-folder/board.png',
        name,
        async write(content, config) {
          calls.push('write');
          assert.deepEqual(config, { encoding: 'base64' });
          await options.write?.();
          bytes = content;
        },
        async base64() {
          calls.push('read');
          return options.read ? options.read() : bytes!;
        },
        delete() { calls.push('delete'); bytes = undefined; },
      };
    },
  };
  return { directory, calls, get bytes() { return bytes; }, get createdName() { return createdName; } };
}

test('selected-folder save awaits the write and verifies PNG bytes before reporting success', async () => {
  let finishWrite!: () => void;
  const pending = new Promise<void>((resolve) => { finishWrite = resolve; });
  const target = folder({ write: () => pending });
  const save = createForgeBoardPngSaver(async () => target.directory);
  let completed = false;
  const saving = save(PNG).then((result) => { completed = true; return result; });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(completed, false);
  assert.deepEqual(target.calls, ['create', 'write']);
  finishWrite();
  assert.deepEqual(await saving, {
    kind: 'saved', uri: 'content://user-selected-folder/board.png',
    fileName: target.createdName, byteSize: Buffer.from(payload, 'base64').length,
    destination: 'selected-folder',
  });
  assert.equal(target.bytes, payload);
  assert.deepEqual(target.calls, ['create', 'write', 'read']);
});

test('picker cancellation creates no file, reports cancelled, and permits a later save', async () => {
  const target = folder();
  let cancelled = true;
  const save = createForgeBoardPngSaver(async () => {
    if (cancelled) throw Object.assign(new Error('cancelled'), { code: 'ERR_PICKER_CANCELLED' });
    return target.directory;
  });
  assert.deepEqual(await save(PNG), { kind: 'cancelled' });
  assert.deepEqual(target.calls, []);
  cancelled = false;
  assert.equal((await save(PNG)).kind, 'saved');
  const appleSave = createForgeBoardPngSaver(async () => {
    throw Object.assign(new Error('cancelled'), { code: 'ERR_FILE_PICKING_CANCELLED' });
  });
  assert.deepEqual(await appleSave(PNG), { kind: 'cancelled' });
});

test('picker permission/unavailable failures remain errors rather than false cancellation or cache saves', async () => {
  const error = Object.assign(new Error('Permission denied'), { code: 'ERR_PERMISSION_DENIED' });
  const save = createForgeBoardPngSaver(async () => { throw error; });
  await assert.rejects(save(PNG), (value) => value === error);
});

test('failed or corrupt writes remove only the newly created export and never report saved', async () => {
  const failure = new Error('Disk full');
  const target = folder({ write: async () => { throw failure; } });
  await assert.rejects(createForgeBoardPngSaver(async () => target.directory)(PNG), (error) => error === failure);
  assert.deepEqual(target.calls, ['create', 'write', 'delete']);
  const corrupt = folder({ read: async () => 'wrong bytes' });
  await assert.rejects(createForgeBoardPngSaver(async () => corrupt.directory)(PNG), /could not be verified/);
  assert.deepEqual(corrupt.calls, ['create', 'write', 'read', 'delete']);
});

test('invalid, truncated and oversized exports cannot open the picker or create a file', async () => {
  let calls = 0;
  const save = createForgeBoardPngSaver(async () => { calls++; return folder().directory; });
  for (const image of ['', 'data:image/jpeg;base64,abcd', 'data:image/png;base64,!',
    PNG.slice(0, -8), 'data:image/png;base64,' + 'A'.repeat(45 * 1024 * 1024)]) {
    await assert.rejects(save(image), /PNG|image data/);
  }
  assert.equal(calls, 0);
});

test('a second press cannot open a second destination picker while the first save is pending', async () => {
  let choose!: (directory: ForgeBoardExportDirectory) => void;
  const save = createForgeBoardPngSaver(() => new Promise((resolve) => { choose = resolve; }));
  const first = save(PNG);
  await assert.rejects(save(PNG), /already in progress/);
  choose(folder().directory);
  assert.equal((await first).kind, 'saved');
});
