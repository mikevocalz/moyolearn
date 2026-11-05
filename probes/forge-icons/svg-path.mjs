// Build-time conversion of the SVG commands used by Forge's authored glyphs.
// Elliptical arc conversion follows SVG 1.1 implementation notes F.6.5.
const NUMBER = /[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g;
const ARITY = { M: 2, L: 2, H: 1, V: 1, C: 6, Q: 4, A: 7 };
const point = (x, y) => ({ x, y, incoming: [x, y], outgoing: [x, y] });

/** Convert an SVG ellipse arc into cubic segments of at most 45 degrees. */
export function arcCubics(start, [rawRx, rawRy, degrees, large, sweep, endX, endY]) {
  let rx = Math.abs(rawRx), ry = Math.abs(rawRy);
  if (rx === 0 || ry === 0) return [{ c1: start, c2: [endX, endY], end: [endX, endY] }];
  if (start[0] === endX && start[1] === endY) return [];
  const phi = degrees * Math.PI / 180, cos = Math.cos(phi), sin = Math.sin(phi);
  const dx = (start[0] - endX) / 2, dy = (start[1] - endY) / 2;
  const xp = cos * dx + sin * dy, yp = -sin * dx + cos * dy;
  const scale = xp * xp / (rx * rx) + yp * yp / (ry * ry);
  if (scale > 1) { rx *= Math.sqrt(scale); ry *= Math.sqrt(scale); }
  const denominator = rx * rx * yp * yp + ry * ry * xp * xp;
  const numerator = Math.max(0, rx * rx * ry * ry - denominator);
  const coefficient = (large === sweep ? -1 : 1) * Math.sqrt(numerator / denominator);
  const cxp = coefficient * rx * yp / ry, cyp = -coefficient * ry * xp / rx;
  const cx = cos * cxp - sin * cyp + (start[0] + endX) / 2;
  const cy = sin * cxp + cos * cyp + (start[1] + endY) / 2;
  const u = [(xp - cxp) / rx, (yp - cyp) / ry];
  const v = [(-xp - cxp) / rx, (-yp - cyp) / ry];
  const theta = Math.atan2(u[1], u[0]);
  let delta = Math.atan2(u[0] * v[1] - u[1] * v[0], u[0] * v[0] + u[1] * v[1]);
  if (!sweep && delta > 0) delta -= Math.PI * 2;
  if (sweep && delta < 0) delta += Math.PI * 2;
  const count = Math.ceil(Math.abs(delta) / (Math.PI / 4));
  const at = (angle) => [cx + rx * cos * Math.cos(angle) - ry * sin * Math.sin(angle),
    cy + rx * sin * Math.cos(angle) + ry * cos * Math.sin(angle)];
  const tangent = (angle) => [-rx * cos * Math.sin(angle) - ry * sin * Math.cos(angle),
    -rx * sin * Math.sin(angle) + ry * cos * Math.cos(angle)];
  const segments = [];
  for (let i = 0; i < count; i += 1) {
    const a = theta + delta * i / count, b = theta + delta * (i + 1) / count;
    const k = 4 / 3 * Math.tan((b - a) / 4);
    const p0 = at(a), p1 = at(b), t0 = tangent(a), t1 = tangent(b);
    segments.push({ c1: [p0[0] + k * t0[0], p0[1] + k * t0[1]],
      c2: [p1[0] - k * t1[0], p1[1] - k * t1[1]], end: p1 });
  }
  segments.at(-1).end = [endX, endY];
  return segments;
}

/** Parse commands without changing the original geometry, endpoints or subpaths. */
export function parseSvgPath(source) {
  const tokens = source.match(NUMBER) ?? [];
  if (source.replace(NUMBER, '').replace(/[\s,]/g, '') !== '') throw new Error('Unrecognized SVG token');
  const paths = [];
  let index = 0, command, current = [0, 0], path;
  const append = (x, y, c1, c2) => {
    if (!path) throw new Error('SVG path must start with moveto');
    const vertex = point(x, y);
    if (c1) { path.vertices.at(-1).outgoing = c1; vertex.incoming = c2; }
    path.vertices.push(vertex);
    current = [x, y];
  };
  while (index < tokens.length) {
    if (/^[a-z]$/i.test(tokens[index])) command = tokens[index++];
    if (!command) throw new Error('Missing SVG command');
    const upper = command.toUpperCase(), relative = command !== upper;
    if (upper === 'Z') {
      if (!path) throw new Error('closepath before moveto');
      path.closed = true;
      current = [path.vertices[0].x, path.vertices[0].y];
      command = undefined;
      continue;
    }
    const arity = ARITY[upper];
    if (!arity) throw new Error(`Unsupported SVG command ${command}`);
    const values = tokens.slice(index, index + arity).map(Number);
    if (values.length !== arity || values.some((value) => !Number.isFinite(value))) throw new Error('Incomplete SVG command');
    index += arity;
    const xy = (x, y) => [x + (relative ? current[0] : 0), y + (relative ? current[1] : 0)];
    if (upper === 'M') {
      current = xy(...values);
      path = { closed: false, vertices: [point(...current)] };
      paths.push(path);
      command = relative ? 'l' : 'L';
    } else if (upper === 'L') append(...xy(...values));
    else if (upper === 'H') append(values[0] + (relative ? current[0] : 0), current[1]);
    else if (upper === 'V') append(current[0], values[0] + (relative ? current[1] : 0));
    else if (upper === 'C') append(...xy(values[4], values[5]), xy(values[0], values[1]), xy(values[2], values[3]));
    else if (upper === 'Q') {
      const control = xy(values[0], values[1]), end = xy(values[2], values[3]);
      append(...end, [current[0] + 2 / 3 * (control[0] - current[0]), current[1] + 2 / 3 * (control[1] - current[1])],
        [end[0] + 2 / 3 * (control[0] - end[0]), end[1] + 2 / 3 * (control[1] - end[1])]);
    } else if (upper === 'A') {
      if (![0, 1].includes(values[3]) || ![0, 1].includes(values[4])) throw new Error('Invalid SVG arc flags');
      const end = xy(values[5], values[6]);
      for (const segment of arcCubics(current, [...values.slice(0, 5), ...end])) {
        append(...segment.end, segment.c1, segment.c2);
      }
    }
  }
  return paths;
}

/** Independent handle angles/distances preserve each cubic's control points. */
export function riveVertex(vertex) {
  const handle = (value) => ({ angle: Math.atan2(value[1] - vertex.y, value[0] - vertex.x),
    length: Math.hypot(value[0] - vertex.x, value[1] - vertex.y) });
  const incoming = handle(vertex.incoming), outgoing = handle(vertex.outgoing);
  if (incoming.length < 1e-10 && outgoing.length < 1e-10) return { tag: 'StraightVertex', x: vertex.x, y: vertex.y };
  return { tag: 'CubicDetachedVertex', x: vertex.x, y: vertex.y,
    inRotation: incoming.angle, inDistance: incoming.length,
    outRotation: outgoing.angle, outDistance: outgoing.length };
}
