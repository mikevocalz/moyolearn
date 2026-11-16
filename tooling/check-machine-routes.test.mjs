// Exercise the complete CLI on disposable source trees, including broken gates.
// SOT: tooling/check-machine-routes.mjs · packages/app/core/protected-operation.ts
// SOT-KEYWORDS: machine route regression guard removal request forwarding cron
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const routePath = 'apps/web/app/api/marketing/sync/route.ts';
const facadePath = 'apps/web/lib/marketing/marketing.service.ts';
const entryPath = 'packages/app/marketing/index.ts';
const servicePath = 'packages/app/marketing/services/marketing.service.ts';
const corePath = 'packages/app/core/protected-operation.ts';
const guardPath = 'packages/app/marketing/permissions/marketing.permissions.ts';

const fixture = {
  'apps/web/proxy.ts': `const PUBLIC_PATHS = ['/api/marketing/sync', '/api/jobs/drain/cron'];
    const publicPath = (path) => PUBLIC_PATHS.some(prefix => path.startsWith(prefix));`,
  'apps/web/vercel.json': JSON.stringify({ crons: [{ path: '/api/marketing/sync' }, { path: '/api/jobs/drain/cron' }] }),
  'apps/web/app/api/jobs/drain/cron/route.ts': `export function GET(request) {
    const secret = process.env.JOBS_DRAIN_SECRET;
    if (!secret || request.headers.get('authorization') !== \`Bearer \${secret}\`) return new Response(null, {status:401});
    return new Response(null, {status:200});
  }`,
  [routePath]: `import { drainMarketingOutbox } from '@/lib/marketing/marketing.service';
import { MarketingError } from '@/lib/marketing/contract';
import { recheckMoyoPaidInvoice } from '@acme/auth/server';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
export async function GET(request: Request) {
  try {
    const result = await drainMarketingOutbox(request, recheckMoyoPaidInvoice);
    console.info(
      JSON.stringify({
        event: 'moyo.marketing.sync',
        state: result.state,
        processed: result.processed,
      }),
    );
    return Response.json(result, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    if (error instanceof MarketingError && error.status === 401)
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    console.error(
      JSON.stringify({ event: 'moyo.marketing.sync', state: 'failed' }),
    );
    return Response.json(
      { error: 'Marketing delivery could not finish.' },
      { status: 503 },
    );
  }
}`,
  [facadePath]: `import 'server-only'; export * from '@acme/app/marketing';`,
  'packages/app/package.json': JSON.stringify({ exports: { './marketing': './marketing/index.ts' } }),
  [entryPath]: `import 'server-only'; export { drainMarketingOutbox } from './services/marketing.service.ts';`,
  [servicePath]: `import 'server-only'; import { protectedOperation } from '../../core/protected-operation.ts';
    export async function drainMarketingOutbox(request: Pick<Request, 'headers'>, inspectInvoice) {
      return protectedOperation({ source: 'marketing-cron', request,
        telemetry: {op:'marketing.outbox.drain', resource:'marketing-outbox', action:'write'},
        operation: async (ctx) => { return {state:'ready', processed:0}; },
      });
    }`,
  [corePath]: `import { marketingCronContext } from '../marketing/permissions/marketing.permissions.ts';
export function protectedOperation<R>(
  source: MarketingOperation<R>,
): Promise<R>;
export function protectedOperation<R>(
  auth: Auth,
  headers: Headers,
  operation: (ctx: ProtectedCtx) => Promise<R>,
  options?: ProtectedOperationOptions,
): Promise<R>;
export async function protectedOperation<R>(
  source: Auth | MarketingOperation<R>,
  headers?: Headers,
  operation?: (ctx: ProtectedCtx) => Promise<R>,
  options: ProtectedOperationOptions = {},
): Promise<R> {
  const platform = 'source' in source;
  const capability: OperationCapability = platform
    ? 'platform-sales'
    : (options.requires ?? 'practise');
  const authMode: OperationAuthMode = platform
    ? platformAuthMode(source.source)
    : isMockAuth()
      ? 'mock'
      : 'session';
  const descriptor =
    authMode === 'invalid-source'
      ? undefined
      : platform
        ? source.telemetry
        : options.telemetry;
  const startedAt = performance.now();
  let ctxKind: OperationCtxKind = 'anonymous';
  let outcome: OperationOutcome = 'error';
  try {
    let result: R;
    if (!platform) {
      if (!headers || !operation) throw new Error('Missing session operation');
      result = await sessionOperation(
        source,
        headers,
        operation,
        options,
        (kind) => {
          ctxKind = kind;
        },
      );
    } else {
      // A closed source union owns each guard. No caller can provide a context,
      // actor, scope, generic authorization callback or test bypass here.
      switch (source.source) {
        case 'payload-internal': {
          if (source.action !== 'read' && source.action !== 'write')
            throw new MarketingError('Unsupported internal operation.', 403);
          const ctx = marketingInternalContext(
            source.request,
            source.action === 'write',
          );
          ctxKind = ctx.kind;
          result = await source.operation(ctx);
          break;
        }
        case 'public-inquiry': {
          const ctx = marketingPublicContext(source.request);
          ctxKind = ctx.kind;
          result = await source.operation(ctx);
          break;
        }
        case 'marketing-cron': {
          const ctx = marketingCronContext(source.request);
          ctxKind = ctx.kind;
          result = await source.operation(ctx);
          break;
        }
        case 'billing-callback': {
          const ctx = marketingBillingContext(source.payment);
          ctxKind = ctx.kind;
          result = await source.operation(ctx);
          break;
        }
        default:
          throw new Error('Unrecognized operation source');
      }
    }
    outcome = 'ok';
    return result;
  } catch (error) {
    outcome =
      error instanceof CapabilityDenied ||
      error instanceof MembershipDenied ||
      error instanceof InstitutionPermissionDenied ||
      (error instanceof MarketingError && error.status === 403)
        ? 'denied'
        : (error instanceof Error && error.message === 'Unauthenticated') ||
            (error instanceof MarketingError && error.status === 401)
          ? 'unauthenticated'
          : 'error';
    throw error;
  } finally {
    recordOperation(
      operationRecord({
        descriptor,
        capability,
        ctxKind,
        outcome,
        latencyMs: performance.now() - startedAt,
        authMode,
      }),
    );
  }
}`,
  [guardPath]: `export function marketingCronContext(request: Pick<Request, 'headers'>): ReturnType<typeof contexts.machine> {
    const secret = process.env.CRON_SECRET;
    if (!secret || request.headers.get('authorization') !== \`Bearer \${secret}\`)
      throw new MarketingError('Unauthorized', 401);
    return contexts.machine();
  }`,
};

function check(overrides = {}) {
  const root = mkdtempSync(join(tmpdir(), 'moyo-machine-guard-'));
  try {
    for (const name of ['check-machine-routes.mjs', 'machine-operation-boundary.mjs']) {
      const path = join(root, 'tooling', name);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, readFileSync(new URL(name, import.meta.url)));
    }
    for (const [name, content] of Object.entries({ ...fixture, ...overrides })) {
      const path = join(root, name);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, content);
    }
    return spawnSync(process.execPath, [join(root, 'tooling/check-machine-routes.mjs')], { cwd: root, encoding: 'utf8' });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('traces the shared cron guard while retaining direct bearer detection', () => {
  const result = check();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /2 bearer routes \(2 public/);
});

const broken = [
  ['route stops forwarding the original request', routePath, fixture[routePath].replace('drainMarketingOutbox(request,', 'drainMarketingOutbox(new Request("https://example.invalid"),')],
  ['route returns before authorization', routePath, fixture[routePath].replace('try {', 'return Response.json({}); try {')],
  ['route calls the invoice inspector after a rejected guard', routePath, fixture[routePath].replace('} catch (error) {', '} catch (error) { await recheckMoyoPaidInvoice({});')],
  ['route calls the invoice inspector from finally', routePath, fixture[routePath].replace('  }\n}', '  } finally { await recheckMoyoPaidInvoice({}); }\n}')],
  ['guarded GET exists only in a dead nested function', routePath, fixture[routePath].replace('export async function GET', 'function unused() { async function GET') + '} export async function GET(request: Request) { return Response.json({}); }'],
  ['route evaluates a default parameter before authorization', routePath, fixture[routePath].replace('request: Request)', 'request: Request = sideEffect())')],
  ['facade switches to a different export', facadePath, fixture[facadePath].replace('@acme/app/marketing', '@acme/app/other')],
  ['facade shadows the guarded service', facadePath, fixture[facadePath] + ' export const drainMarketingOutbox = async () => ({});'],
  ['package export no longer resolves to the checked domain', 'packages/app/package.json', JSON.stringify({ exports: { './marketing': './other.ts' } })],
  ['public domain exports a different implementation', entryPath, fixture[entryPath].replace('./services/marketing.service.ts', './services/other.ts')],
  ['service changes its protected source', servicePath, fixture[servicePath].replace("'marketing-cron'", "'public-inquiry'")],
  ['service replaces the forwarded request', servicePath, fixture[servicePath].replace("'marketing-cron', request,", "'marketing-cron', request: otherRequest,")],
  ['service changes its operation-boundary import', servicePath, fixture[servicePath].replace('../../core/protected-operation.ts', '../../core/other.ts')],
  ['service eagerly evaluates telemetry', servicePath, fixture[servicePath].replace("telemetry: {op:'marketing.outbox.drain', resource:'marketing-outbox', action:'write'}", "telemetry: (await pruneMarketingRateLimits(), {op:'marketing.outbox.drain', resource:'marketing-outbox', action:'write'})")],
  ['service uses an eager operation factory', servicePath, fixture[servicePath].replace('operation: async (ctx) => { return {state:\'ready\', processed:0}; }', 'operation: await makeOperation()')],
  ['service immediately invokes its operation', servicePath, fixture[servicePath].replace("operation: async (ctx) => { return {state:'ready', processed:0}; }", "operation: (async (ctx) => { return {state:'ready', processed:0}; })()")],
  ['service operation has an executable default parameter', servicePath, fixture[servicePath].replace('async (ctx) =>', 'async (ctx = sideEffect()) =>')],
  ['service reads telemetry from a getter', servicePath, fixture[servicePath].replace("op:'marketing.outbox.drain'", "get op() { return sideEffect(); }")],
  ['service spreads executable telemetry', servicePath, fixture[servicePath].replace("op:'marketing.outbox.drain'", "...sideEffect(), op:'marketing.outbox.drain'")],
  ['service evaluates a default parameter', servicePath, fixture[servicePath].replace('inspectInvoice)', 'inspectInvoice = sideEffect())')],
  ['core runs its callback before the guarded branch', corePath, fixture[corePath].replace("const platform = 'source' in source;", "if ('source' in source && source.source === 'marketing-cron') return source.operation({kind:'machine',scope:'moyo-platform-sales'}); const platform = 'source' in source;")],
  ['core runs its callback before selecting a source', corePath, fixture[corePath].replace('switch (source.source)', 'await source.operation({}); switch (source.source)')],
  ['core catches a rejected guard and runs the callback', corePath, fixture[corePath].replace('throw error;', 'return source.operation({});')],
  ['core runs its callback from finally after rejection', corePath, fixture[corePath].replace('} finally {', '} finally { await source.operation({});')],
  ['core falls through after an invalid source', corePath, fixture[corePath].replace("throw new Error('Unrecognized operation source');", 'break;')],
  ['core omits the rejecting guard', corePath, fixture[corePath].replace('marketingCronContext(source.request)', 'uncheckedContext()')],
  ['core changes the guard import', corePath, fixture[corePath].replace('../marketing/permissions/marketing.permissions.ts', '../other.ts')],
  ['core passes a replacement request', corePath, fixture[corePath].replace('marketingCronContext(source.request)', 'marketingCronContext(otherRequest)')],
  ['guard allows an unset secret', guardPath, fixture[guardPath].replace('!secret || ', '')],
  ['guard accepts a hardcoded token', guardPath, fixture[guardPath].replace('process.env.CRON_SECRET', "'placeholder'")],
  ['guard reverses the bearer comparison', guardPath, fixture[guardPath].replace('!==', '===')],
  ['guard lives only in a comment', guardPath, '/*' + fixture[guardPath] + '*/ export function marketingCronContext(request) { return contexts.machine(); }'],
  ['guard lives only in a quoted string', guardPath, 'const documentary = ' + JSON.stringify(fixture[guardPath]) + '; export function marketingCronContext(request) { return contexts.machine(); }'],
  ['scheduled route deletes its entire guard', routePath, 'export async function GET() { return Response.json({}); }'],
];
for (const [name, path, content] of broken) {
  test(`fails closed when ${name}`, () => {
    const result = check({ [path]: content });
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, /cannot be traced|defends\s+nothing/);
  });
}
