// Bunny Stream — the only place the Stream API key is read.
//
// The signing and the API call live in `bunny-stream-sign.ts`, which is pure.
// This file supplies environment and nothing else, so the logic stays testable
// without a `server-only` barrier around it.
// SOT: CLAUDE.md §The block
// SOT-KEYWORDS: bunny stream repository video tus signature env
import 'server-only';
import type { CreateStreamVideo, SignStreamUpload } from '@acme/app/server';
import { createVideo, signUpload, type StreamConfig } from './bunny-stream-sign';

const config = (): StreamConfig => {
  const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
  const apiKey = process.env.BUNNY_STREAM_ACCESS_KEY;
  const pullZone = process.env.NEXT_PUBLIC_BUNNY_STREAM_PULL_ZONE_URL;
  if (!libraryId || !apiKey || !pullZone) {
    throw new Error('Bunny Stream is not configured — see .env.example.');
  }
  return { libraryId, apiKey, pullZone: pullZone.replace(/\/+$/, '') };
};

export const createStreamVideo: CreateStreamVideo = (title) => createVideo(config(), title);
export const signStreamUpload: SignStreamUpload = (videoId) => signUpload(config(), videoId);
