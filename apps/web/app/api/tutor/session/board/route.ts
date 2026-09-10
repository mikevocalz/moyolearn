// GET / PUT /api/tutor/session/board — the learner's whiteboard, across devices.
//
// The board is one base64 Yjs update and this route never looks inside it. That
// is deliberate rather than lazy: it is a child's scratch paper, so the fewest
// possible places should be able to read it, and an endpoint that cannot parse
// a document cannot be talked into parsing a malicious one.
//
// PUT rather than POST because it is idempotent in the way that matters here —
// a device sends its WHOLE document every time, so the same body twice is the
// same board once. The service merges instead of replacing (`MergeBoard`), so
// two devices in the same session both keep their strokes.
//
// `sessionId` is the only handle the client supplies, and owning it is checked
// downstream: the repository scopes by `ctx.learnerId`, so a stranger's id
// resolves to nothing and this answers 404 — the same answer a genuinely
// missing session gets, so the endpoint cannot be used to discover which ids
// exist.
// SOT: CLAUDE.md §The block · packages/app/features/tutor/board-doc.ts
// SOT-KEYWORDS: tutor session board api route yjs whiteboard persist cross-device merge
import { NextRequest, NextResponse } from 'next/server';
import { readBoardUpdate, saveBoardUpdate, SessionNotFound } from '@acme/app/server';
import { mergeBoard, readBoard } from '@/lib/tutor-session.repository';
import { auth } from '@/lib/auth';
import { reportRouteError } from '@/lib/report-error';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const str = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

function failure(error: unknown): NextResponse {
  if (error instanceof Error) reportRouteError(error);
  if (error instanceof SessionNotFound) {
    return NextResponse.json({ error: 'No such session' }, { status: 404 });
  }
  const message = error instanceof Error ? error.message : 'Server error';
  return NextResponse.json({ error: message }, { status: message === 'Unauthenticated' ? 401 : 500 });
}

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('sessionId');
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
  }
  try {
    const update = await readBoardUpdate(auth, request.headers, sessionId, readBoard);
    /*
      `null` is a 200, not a 404. A session with no board is the ordinary state
      of every session before a child draws anything, and answering "not found"
      would make the client's first read look like a failure it should retry.
    */
    return NextResponse.json({ update });
  } catch (error) {
    return failure(error);
  }
}

export async function PUT(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!isRecord(body)) {
    return NextResponse.json({ error: 'sessionId and update are required' }, { status: 400 });
  }
  const sessionId = str(body.sessionId);
  const update = str(body.update);
  if (sessionId === undefined || update === undefined) {
    return NextResponse.json({ error: 'sessionId and update are required' }, { status: 400 });
  }
  try {
    await saveBoardUpdate(auth, request.headers, { sessionId, update }, mergeBoard);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
