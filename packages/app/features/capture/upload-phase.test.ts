// SOT-KEYWORDS: upload phase test failed retry error waiting capture
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { uploadPhaseKey } from './upload-phase.ts';

describe('uploadPhaseKey', () => {
  it('is preparing before any row reports movement', () => {
    assert.equal(uploadPhaseKey([], 2, true), 'preparing');
    assert.equal(uploadPhaseKey(['queued', 'queued'], 2, true), 'preparing');
  });

  it('reports uploading and processing while the batch moves', () => {
    assert.equal(uploadPhaseKey(['uploading', 'queued'], 2, true), 'uploading');
    assert.equal(uploadPhaseKey(['processing', 'done'], 2, true), 'processing');
  });

  it('is ready only when every expected item is done', () => {
    assert.equal(uploadPhaseKey(['done', 'done'], 2, true), 'ready');
    assert.equal(uploadPhaseKey(['done', 'queued'], 2, true), 'preparing');
  });

  it('waits for the connection when a failure happens offline', () => {
    assert.equal(uploadPhaseKey(['failed', 'done'], 2, false), 'waiting');
  });

  it('settles online failures into error, never Preparing forever', () => {
    // The P0 this file exists for: failed > 0 && online used to fall through
    // to 'preparing' and the screen hung on a lie.
    assert.equal(uploadPhaseKey(['failed', 'done'], 2, true), 'error');
    assert.equal(uploadPhaseKey(['failed', 'failed'], 2, true), 'error');
  });

  it('keeps reporting movement while a failed sibling waits for its retry', () => {
    assert.equal(uploadPhaseKey(['failed', 'uploading', 'done'], 3, true), 'uploading');
  });
});
