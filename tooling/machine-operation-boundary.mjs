// Trace the shared machine gate through its actual imports and guarded call.
// Fail closed when the known call shape changes; this is not a route exemption.
// SOT: tooling/check-machine-routes.mjs · packages/app/core/protected-operation.ts
// SOT-KEYWORDS: machine route cron protected operation dependency trace bearer

const string = (value) => JSON.stringify(value);

/** Small lexical reader: prose/string contents cannot impersonate executable tokens. */
function tokens(source) {
  const result = [];
  for (let i = 0; i < source.length;) {
    if (/\s/.test(source[i])) { i++; continue; }
    if (source.startsWith('//', i)) {
      const end = source.indexOf('\n', i + 2);
      i = end < 0 ? source.length : end + 1;
      continue;
    }
    if (source.startsWith('/*', i)) {
      const end = source.indexOf('*/', i + 2);
      if (end < 0) throw new Error('Unclosed comment');
      i = end + 2;
      continue;
    }
    const quote = source[i];
    if (quote === '"' || quote === "'" || quote === '`') {
      let end = i + 1;
      while (end < source.length && source[end] !== quote) end += source[end] === '\\' ? 2 : 1;
      if (end >= source.length) throw new Error('Unclosed string');
      const value = source.slice(i + 1, end);
      result.push(quote === '`' ? `\`${value}\`` : string(value));
      i = end + 1;
      continue;
    }
    const word = /^[A-Za-z_$][\w$]*|^\d+/.exec(source.slice(i));
    if (word) { result.push(word[0]); i += word[0].length; continue; }
    const operator = ['!==', '===', '...', '=>', '||', '&&', '??', '?.', '!=', '==', '<=', '>='].find((value) => source.startsWith(value, i));
    result.push(operator ?? source[i]);
    i += operator?.length ?? 1;
  }
  return result;
}

const equal = (left, right) => left.length === right.length && left.every((value, i) => value === right[i]);
function endOf(sequence, start, open, close) {
  if (sequence[start] !== open) return -1;
  let depth = 0;
  for (let i = start; i < sequence.length; i++) {
    if (sequence[i] === open) depth++;
    if (sequence[i] === close && --depth === 0) return i;
  }
  return -1;
}
function functionBody(sequence, name) {
  const implementations = [];
  const stack = [];
  const closing = { '(': ')', '[': ']', '{': '}' };
  for (let offset = 0; offset < sequence.length; offset++) {
    const token = sequence[offset];
    if (closing[token]) stack.push(closing[token]);
    else if (stack.at(-1) === token) stack.pop();
    if (stack.length || token !== 'function' || sequence[offset + 1] !== name) continue;
    const exported = sequence[offset - 1] === 'export' ||
      (sequence[offset - 1] === 'async' && sequence[offset - 2] === 'export');
    if (!exported) return null;
    const start = sequence.indexOf('(', offset + 2);
    const parametersEnd = endOf(sequence, start, '(', ')');
    if (parametersEnd < 0) return null;
    let bodyStart = parametersEnd + 1;
    while (bodyStart < sequence.length && ![';', '{'].includes(sequence[bodyStart])) bodyStart++;
    if (sequence[bodyStart] !== '{') { offset = bodyStart; continue; } // TypeScript overload declaration.
    const bodyEnd = endOf(sequence, bodyStart, '{', '}');
    if (bodyEnd < 0) return null;
    implementations.push({ parameters: sequence.slice(start + 1, parametersEnd), body: sequence.slice(bodyStart + 1, bodyEnd) });
    offset = bodyEnd;
  }
  return implementations.length === 1 ? implementations[0] : null;
}
function namedBinding(sequence, kind, name, specifier) {
  for (let i = 0; i < sequence.length; i++) {
    if (sequence[i] !== kind || sequence[i + 1] !== '{') continue;
    const end = endOf(sequence, i + 1, '{', '}');
    if (end < 0 || sequence[end + 1] !== 'from' || sequence[end + 2] !== string(specifier)) continue;
    const names = sequence.slice(i + 2, end);
    for (let n = 0; n < names.length; n++) {
      if (names[n] === name && (n === 0 || names[n - 1] === ',') && (n + 1 === names.length || names[n + 1] === ',')) return true;
    }
  }
  return false;
}
function topLevelFields(object) {
  const fields = new Map();
  let start = 0;
  const stack = [];
  const closing = { '(': ')', '[': ']', '{': '}' };
  for (let i = 0; i <= object.length; i++) {
    const value = object[i];
    if ((i === object.length || value === ',') && stack.length === 0) {
      const field = object.slice(start, i);
      if (field.length) {
        const name = field[0];
        if (!/^[A-Za-z_$][\w$]*$/.test(name) || fields.has(name) || (field.length > 1 && field[1] !== ':')) return null;
        fields.set(name, field.length === 1 ? [name] : field.slice(2));
      }
      start = i + 1;
    } else if (closing[value]) stack.push(closing[value]);
    else if (stack.at(-1) === value) stack.pop();
  }
  return stack.length ? null : fields;
}

// Recognize the enclosing control flow as well as the selected case. Finding a
// guarded case somewhere in a function would also accept a preceding bypass.
function guardedCore(block) {
  if (!block || !equal(block.parameters, tokens(`
    source: Auth | MarketingOperation<R>, headers?: Headers,
    operation?: (ctx: ProtectedCtx) => Promise<R>,
    options: ProtectedOperationOptions = {},
  `))) return false;
  const prefix = tokens(`
    const platform = 'source' in source;
    const capability: OperationCapability = platform ? 'platform-sales' : (options.requires ?? 'practise');
    const authMode: OperationAuthMode = platform ? platformAuthMode(source.source) : isMockAuth() ? 'mock' : 'session';
    const descriptor = authMode === 'invalid-source' ? undefined : platform ? source.telemetry : options.telemetry;
    const startedAt = performance.now();
    let ctxKind: OperationCtxKind = 'anonymous';
    let outcome: OperationOutcome = 'error';
    try {
      let result: R;
      if (!platform) {
  `);
  if (!equal(block.body.slice(0, prefix.length), prefix)) return false;
  // This branch cannot run for the literal marketing-cron source we traced.
  const sessionEnd = endOf(block.body, prefix.length - 1, '{', '}');
  const switchPrefix = tokens('else { switch (source.source) {');
  if (sessionEnd < 0 || !equal(block.body.slice(sessionEnd + 1, sessionEnd + 1 + switchPrefix.length), switchPrefix)) return false;
  const switchStart = sessionEnd + switchPrefix.length;
  const switchEnd = endOf(block.body, switchStart, '{', '}');
  if (switchEnd < 0) return false;
  const cases = block.body.slice(switchStart + 1, switchEnd);
  const remaining = new Set(['payload-internal', 'public-inquiry', 'marketing-cron', 'billing-callback'].map(string));
  let i = 0;
  while (i < cases.length && cases[i] === 'case') {
    const label = cases[i + 1];
    if (!remaining.delete(label) || cases[i + 2] !== ':' || cases[i + 3] !== '{') return false;
    const end = endOf(cases, i + 3, '{', '}');
    if (end < 0) return false;
    const body = cases.slice(i + 4, end);
    if (label === string('marketing-cron') && !equal(body, tokens(`
      const ctx = marketingCronContext(source.request);
      ctxKind = ctx.kind;
      result = await source.operation(ctx);
      break;
    `))) return false;
    if (!equal(body.slice(-2), ['break', ';'])) return false;
    i = end + 1;
  }
  if (remaining.size || !equal(cases.slice(i), tokens("default: throw new Error('Unrecognized operation source');"))) return false;
  return equal(block.body.slice(switchEnd + 1), tokens(`
    }
    outcome = 'ok';
    return result;
  } catch (error) {
    outcome = error instanceof CapabilityDenied || error instanceof MembershipDenied ||
      error instanceof InstitutionPermissionDenied || (error instanceof MarketingError && error.status === 403)
        ? 'denied'
        : (error instanceof Error && error.message === 'Unauthenticated') ||
          (error instanceof MarketingError && error.status === 401)
          ? 'unauthenticated' : 'error';
    throw error;
  } finally {
    recordOperation(operationRecord({
      descriptor, capability, ctxKind, outcome,
      latencyMs: performance.now() - startedAt, authMode,
    }),);
  }
  `));
}

function inertArguments(fields) {
  const telemetry = fields.get('telemetry') ?? [];
  if (telemetry[0] !== '{' || endOf(telemetry, 0, '{', '}') !== telemetry.length - 1) return false;
  const descriptor = topLevelFields(telemetry.slice(1, -1));
  if (!descriptor || descriptor.size !== 3) return false;
  for (const [name, value] of Object.entries({ op: 'marketing.outbox.drain', resource: 'marketing-outbox', action: 'write' })) {
    if (!equal(descriptor.get(name) ?? [], [string(value)])) return false;
  }
  const operation = fields.get('operation') ?? [];
  const prefix = tokens('async (ctx) => {');
  return equal(operation.slice(0, prefix.length), prefix) &&
    endOf(operation, prefix.length - 1, '{', '}') === operation.length - 1;
}

// Rejecting the gate must lead only to an HTTP response and aggregate logging.
// A callback hidden in catch/finally would execute even for an invalid bearer.
function guardedRoute(handler) {
  return handler?.parameters[0] === 'request' && !handler.parameters.includes('=') &&
    equal(handler.body, tokens(`
      try {
        const result = await drainMarketingOutbox(request, recheckMoyoPaidInvoice);
        console.info(JSON.stringify({
          event: 'moyo.marketing.sync', state: result.state, processed: result.processed,
        }),);
        return Response.json(result, {headers: {'Cache-Control': 'no-store'},});
      } catch (error) {
        if (error instanceof MarketingError && error.status === 401)
          return Response.json({error: 'Unauthorized'}, {status: 401});
        console.error(JSON.stringify({event: 'moyo.marketing.sync', state: 'failed'}),);
        return Response.json({error: 'Marketing delivery could not finish.'}, {status: 503},);
      }
    `));
}

/** undefined means unrelated; null means a declared shared gate is broken. */
export function sharedMachineSecrets(routeSource, readSource) {
  try {
    const route = tokens(routeSource);
    if (!route.includes('drainMarketingOutbox')) return undefined;
    if (!namedBinding(route, 'import', 'drainMarketingOutbox', '@/lib/marketing/marketing.service')) return null;
    const handler = functionBody(route, 'GET');
    if (!guardedRoute(handler)) return null;

    const facade = tokens(readSource('apps/web/lib/marketing/marketing.service.ts'));
    if (!equal(facade, tokens("import 'server-only'; export * from '@acme/app/marketing';"))) return null;
    const manifest = JSON.parse(readSource('packages/app/package.json'));
    if (manifest.exports?.['./marketing'] !== './marketing/index.ts') return null;
    const entry = tokens(readSource('packages/app/marketing/index.ts'));
    if (!namedBinding(entry, 'export', 'drainMarketingOutbox', './services/marketing.service.ts')) return null;

    const service = tokens(readSource('packages/app/marketing/services/marketing.service.ts'));
    if (!namedBinding(service, 'import', 'protectedOperation', '../../core/protected-operation.ts')) return null;
    const drain = functionBody(service, 'drainMarketingOutbox');
    if (drain?.parameters[0] !== 'request' || drain.parameters.includes('=') || !equal(drain.body.slice(0, 4), ['return', 'protectedOperation', '(', '{'])) return null;
    const objectEnd = endOf(drain.body, 3, '{', '}');
    if (objectEnd < 0 || !equal(drain.body.slice(objectEnd + 1), [')', ';'])) return null;
    const fields = topLevelFields(drain.body.slice(4, objectEnd));
    if (!fields || fields.size !== 4 || !fields.has('telemetry') || !fields.has('operation')) return null;
    if (!equal(fields.get('source') ?? [], [string('marketing-cron')])) return null;
    if (!equal(fields.get('request') ?? [], ['request'])) return null;
    if (!inertArguments(fields)) return null;

    const core = tokens(readSource('packages/app/core/protected-operation.ts'));
    if (!namedBinding(core, 'import', 'marketingCronContext', '../marketing/permissions/marketing.permissions.ts')) return null;
    const block = functionBody(core, 'protectedOperation');
    if (!guardedCore(block)) return null;

    const permissions = tokens(readSource('packages/app/marketing/permissions/marketing.permissions.ts'));
    const guard = functionBody(permissions, 'marketingCronContext');
    const expectedGuard = tokens("const secret = process.env.CRON_SECRET; if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) throw new MarketingError('Unauthorized', 401); return contexts.machine();");
    if (guard?.parameters[0] !== 'request' || guard.parameters.includes('=') || !equal(guard.body, expectedGuard)) return null;
    return ['CRON_SECRET'];
  } catch {
    return null;
  }
}
