// Full Stream round trip: create the video row, sign it, upload real bytes over
// TUS, then poll until Bunny reports it encoded. Re-run after any Stream change.
import nextEnv from '@next/env';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
nextEnv.loadEnvConfig(resolve(dirname(fileURLToPath(import.meta.url)), '../../..'), true, console);
// The PURE signer, not the server-only repository — same code, importable here.
const { createVideo, signUpload } = await import('../lib/bunny-stream-sign.ts');
const cfg = {
  libraryId: process.env.BUNNY_STREAM_LIBRARY_ID!,
  apiKey: process.env.BUNNY_STREAM_ACCESS_KEY!,
  pullZone: process.env.NEXT_PUBLIC_BUNNY_STREAM_PULL_ZONE_URL!.replace(/\/+$/, ''),
};
const e = process.env;

const videoId = await createVideo(cfg, `verify-${Date.now()}`);
console.log('1. createStreamVideo ->', videoId);
const cred = signUpload(cfg, videoId);
console.log('2. signed · expires in', cred.expire - Math.floor(Date.now() / 1000), 's');

/*
  A real, transcodable mp4. Generated with ffmpeg when available, because bytes
  that merely LOOK like a video get accepted by TUS and then fail encoding —
  which proves the transport but tells you nothing about the pipeline.
*/
const { readFileSync, existsSync } = await import('node:fs');
const fixture = process.env.VERIFY_VIDEO_PATH ?? '/private/tmp/claude-501/-Users-mikevocalz/b3d5b448-9a9e-4203-89e7-a1c9bc060e49/scratchpad/real.mp4';
if (!existsSync(fixture)) {
  console.log('   no fixture at', fixture, '— generate one with:');
  console.log('   ffmpeg -f lavfi -i testsrc=duration=2:size=320x240:rate=15 -c:v libx264 -pix_fmt yuv420p -y', fixture);
  process.exit(1);
}
const mp4 = readFileSync(fixture);
console.log(`   fixture: ${mp4.length} bytes`);

// Upload with tus-js-client itself — the same library the app uses, so this
// exercises the real path rather than a hand-rolled approximation of it.
const tus = (await import('tus-js-client')).default ?? (await import('tus-js-client'));
await new Promise<void>((done, fail) => {
  const upload = new tus.Upload(mp4, {
    endpoint: cred.endpoint,
    retryDelays: [0, 1000, 3000],
    headers: {
      AuthorizationSignature: cred.signature,
      AuthorizationExpire: String(cred.expire),
      VideoId: videoId,
      LibraryId: cred.libraryId,
    },
    metadata: { filetype: 'video/mp4', title: 'verify' },
    uploadSize: mp4.length,
    onProgress: (sent, total) => console.log(`3. tus progress -> ${sent}/${total}`),
    onSuccess: () => { console.log('4. tus upload -> COMPLETE'); done(); },
    onError: (err) => { console.log('4. tus upload -> FAILED:', err.message.split('\n')[0]); done(); },
  });
  upload.start();
});

// Bunny's own view of the video: 0 queued, 1 processing, 2 encoding, 3 finished, 4 resolution-finished, 5 failed.
const STATUS = ['queued', 'processing', 'encoding', 'finished', 'resolution-finished', 'failed'];
for (let i = 0; i < 8; i++) {
  await new Promise((r) => setTimeout(r, 3000));
  const v = await fetch(`https://video.bunnycdn.com/library/${cred.libraryId}/videos/${videoId}`, {
    headers: { AccessKey: e.BUNNY_STREAM_ACCESS_KEY!, accept: 'application/json' },
  });
  const body = (await v.json()) as { status?: number; encodeProgress?: number };
  console.log(`5. status -> ${STATUS[body.status ?? 0] ?? body.status} · encode ${body.encodeProgress ?? 0}%`);
  if ((body.status ?? 0) >= 3) break;
}
console.log('   playback:', cred.playbackUrl);

await fetch(`https://video.bunnycdn.com/library/${cred.libraryId}/videos/${videoId}`, {
  method: 'DELETE', headers: { AccessKey: e.BUNNY_STREAM_ACCESS_KEY! },
});
console.log('6. cleaned up');
process.exit(0);
