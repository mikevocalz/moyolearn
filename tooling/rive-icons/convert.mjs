#!/usr/bin/env node
// Lucide (lucide-react-native cjs icon source) -> RML <Shape> fragments.
//
// Deterministic and rerunnable: reads the icon `node:` arrays out of
// node_modules/lucide-react-native/dist/cjs/icons/*.js, parses each `d`
// attribute (M/L/H/V/C/S/Q/T/A/Z, relative and absolute), elevates quads to
// cubics, converts elliptical arcs to cubics (endpoint -> center
// parametrisation, split at <=90deg), and emits Rive PointsPath vertices
// (StraightVertex / CubicDetachedVertex) or parametric geometry for the
// non-path nodes (circle -> Ellipse, line/polyline/polygon -> PointsPath,
// rect -> Rectangle).
//
// Output is a fragment file meant to be inlined into an .rml scene, or
// injected in place of a `<!-- @rive-icons -->` marker via --inject.
//
// Usage:
//   node convert.mjs                     # write fragments to <out>
//   node convert.mjs --inject scene.rml  # replace marker region in scene.rml
//   node convert.mjs --list              # print the icon table
//
// SOT: geometry for the BoardChrome toolbar icons. Lucide icons are
// stroke-based, 24x24 viewBox, stroke-width 2, round caps/joins.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const LUCIDE_DIR = resolve(REPO, 'node_modules/lucide-react-native/dist/cjs/icons');
const OUT = resolve(REPO, 'probes/rive-panel/rive-board-chrome/build/icons.frag.rml');

// Placement is in BoardChrome artboard units; `cx`,`cy` is the control's icon
// centre and `scale` blows the 24-unit Lucide box up to device pixels.
// idBase keeps every emitted element carrying a deterministic id so `rive`
// never has to write ids back into the generated region.
const ICON_COLOR = 'FFE9F4FA';
const ICONS = [
  { icon: 'pencil', name: 'PenIcon', cx: 64, cy: 88, scale: 1.5, idBase: 700 },
  { icon: 'highlighter', name: 'HighlighterIcon', cx: 180, cy: 88, scale: 1.5, idBase: 750 },
  { icon: 'eraser', name: 'EraserIcon', cx: 296, cy: 88, scale: 1.5, idBase: 800 },
  { icon: 'undo-2', name: 'UndoIcon', cx: 536, cy: 88, scale: 1.5, idBase: 850 },
  { icon: 'redo-2', name: 'RedoIcon', cx: 652, cy: 88, scale: 1.5, idBase: 900 },
  { icon: 'trash', name: 'ClearIcon', cx: 776, cy: 88, scale: 1.5, idBase: 950 },
  { icon: 'sparkles', name: 'AskIcon', cx: 872, cy: 88, scale: 1.2, idBase: 1000 },
  { icon: 'x', name: 'CloseIcon', cx: 912, cy: 88, scale: 1.2, idBase: 1050 },
];

// ---------- lucide source extraction ----------

function loadIconNodes(iconFile) {
  const src = readFileSync(resolve(LUCIDE_DIR, `${iconFile}.js`), 'utf8');
  const start = src.indexOf('node:');
  if (start < 0) throw new Error(`no node array in ${iconFile}`);
  let i = src.indexOf('[', start);
  let depth = 0, inStr = false, strCh = '', j = i;
  for (; j < src.length; j++) {
    const c = src[j];
    if (inStr) {
      if (c === '\\') j++;
      else if (c === strCh) inStr = false;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inStr = true; strCh = c; continue; }
    if (c === '[' || c === '{') depth++;
    if (c === ']' || c === '}') { depth--; if (depth === 0) { j++; break; } }
  }
  const text = src.slice(i, j);
  // eslint-disable-next-line no-eval -- tooling-only: the literal is ours
  return eval(`(${text})`);
}

// ---------- svg path parsing ----------

const CMDS = new Set('MmLlHhVvCcSsQqTtAaZz');

function tokenizePath(d) {
  const tokens = [];
  let i = 0;
  while (i < d.length) {
    const c = d[i];
    if (CMDS.has(c)) { tokens.push(c); i++; continue; }
    if (c === ' ' || c === ',' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }
    // number: [-+]?([0-9]*\.)?[0-9]+([eE][-+]?[0-9]+)?
    const m = /^[-+]?(\d*\.?\d+([eE][-+]?\d+)?)/.exec(d.slice(i));
    if (!m) throw new Error(`bad path token at ${i} in "${d}"`);
    tokens.push(parseFloat(m[0]));
    i += m[0].length;
  }
  return tokens;
}

const rad = (d) => (d * Math.PI) / 180;

// SVG elliptical arc (endpoint form) -> array of cubic segments.
// Returns [[x1,y1,x2,y2,x3,y3,x4,y4], ...] absolute coords.
function arcToCubics(x0, y0, rx, ry, xAxisRot, largeArc, sweep, x1, y1) {
  if (rx === 0 || ry === 0) return null; // degenerate: straight line
  rx = Math.abs(rx); ry = Math.abs(ry);
  const phi = rad(xAxisRot);
  const cosP = Math.cos(phi), sinP = Math.sin(phi);
  const dx = (x0 - x1) / 2, dy = (y0 - y1) / 2;
  const x1p = cosP * dx + sinP * dy;
  const y1p = -sinP * dx + cosP * dy;
  let lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lam > 1) { const s = Math.sqrt(lam); rx *= s; ry *= s; }
  const sign = largeArc !== sweep ? 1 : -1;
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const co = sign * Math.sqrt(Math.max(0, num / den));
  const cxp = (co * rx * y1p) / ry;
  const cyp = (-co * ry * x1p) / rx;
  const cx = cosP * cxp - sinP * cyp + (x0 + x1) / 2;
  const cy = sinP * cxp + cosP * cyp + (y0 + y1) / 2;
  const angle = (ux, uy, vx, vy) => {
    const n = Math.hypot(ux, uy) * Math.hypot(vx, vy);
    let a = Math.acos(Math.min(1, Math.max(-1, (ux * vx + uy * vy) / n)));
    if (ux * vy - uy * vx < 0) a = -a;
    return a;
  };
  const th1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dth = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && dth > 0) dth -= 2 * Math.PI;
  if (sweep && dth < 0) dth += 2 * Math.PI;
  const segs = Math.max(1, Math.ceil(Math.abs(dth) / (Math.PI / 2)));
  const step = dth / segs;
  const out = [];
  for (let s = 0; s < segs; s++) {
    const t1 = th1 + s * step, t2 = t1 + step;
    const alpha = (4 / 3) * Math.tan((t2 - t1) / 4);
    const ep = (t) => [
      cx + rx * Math.cos(t) * cosP - ry * Math.sin(t) * sinP,
      cy + rx * Math.cos(t) * sinP + ry * Math.sin(t) * cosP,
    ];
    const dp = (t) => [
      -rx * Math.sin(t) * cosP - ry * Math.cos(t) * sinP,
      -rx * Math.sin(t) * sinP + ry * Math.cos(t) * cosP,
    ];
    const p1 = ep(t1), p2 = ep(t2);
    const d1 = dp(t1), d2 = dp(t2);
    out.push([
      p1[0] + alpha * d1[0], p1[1] + alpha * d1[1],
      p2[0] - alpha * d2[0], p2[1] - alpha * d2[1],
      p2[0], p2[1],
    ]);
  }
  return out;
}

// Parse `d` into contours. A contour is { closed, anchors } where each anchor is
// { x, y, in:[x,y]|null, out:[x,y]|null } in absolute 24x24 space.
function parsePath(d) {
  const tokens = tokenizePath(d);
  const contours = [];
  let cur = null;          // current contour
  let cx = 0, cy = 0;      // current point
  let sx = 0, sy = 0;      // subpath start (for Z)
  let prevC2 = null;       // previous cubic control point (for S)
  let prevQ = null;        // previous quad control point (for T)
  let i = 0;
  const num = () => tokens[i++];
  const anchor = (x, y) => ({ x, y, in: null, out: null });
  const push = (a) => { cur.anchors.push(a); cx = a.x; cy = a.y; };
  const lineTo = (x, y) => push(anchor(x, y));
  const cubicTo = (x1, y1, x2, y2, x, y) => {
    cur.anchors[cur.anchors.length - 1].out = [x1, y1];
    const a = anchor(x, y); a.in = [x2, y2];
    push(a);
    prevC2 = [x2, y2];
  };

  let cmd = null;
  while (i < tokens.length) {
    if (typeof tokens[i] === 'string') cmd = tokens[i++];
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const ax = (v) => (rel ? cx + v : v);
    const ay = (v) => (rel ? cy + v : v);
    switch (C) {
      case 'M': {
        const x = ax(num()), y = ay(num());
        cur = { closed: false, anchors: [anchor(x, y)] };
        contours.push(cur);
        cx = x; cy = y; sx = x; sy = y;
        prevC2 = prevQ = null;
        cmd = rel ? 'l' : 'L'; // implicit lineto
        break;
      }
      case 'L': { prevC2 = prevQ = null; lineTo(ax(num()), ay(num())); break; }
      case 'H': { prevC2 = prevQ = null; const x = ax(num()); lineTo(x, cy); break; }
      case 'V': { prevC2 = prevQ = null; const y = ay(num()); lineTo(cx, y); break; }
      case 'C': {
        cubicTo(ax(num()), ay(num()), ax(num()), ay(num()), ax(num()), ay(num()));
        prevQ = null;
        break;
      }
      case 'S': {
        const x1 = prevC2 ? 2 * cx - prevC2[0] : cx;
        const y1 = prevC2 ? 2 * cy - prevC2[1] : cy;
        cubicTo(x1, y1, ax(num()), ay(num()), ax(num()), ay(num()));
        prevQ = null;
        break;
      }
      case 'Q': {
        const qx = ax(num()), qy = ay(num()), x = ax(num()), y = ay(num());
        cubicTo(
          cx + (2 / 3) * (qx - cx), cy + (2 / 3) * (qy - cy),
          x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y),
          x, y,
        );
        prevQ = [qx, qy]; prevC2 = null;
        break;
      }
      case 'T': {
        const qx = prevQ ? 2 * cx - prevQ[0] : cx;
        const qy = prevQ ? 2 * cy - prevQ[1] : cy;
        const x = ax(num()), y = ay(num());
        cubicTo(
          cx + (2 / 3) * (qx - cx), cy + (2 / 3) * (qy - cy),
          x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y),
          x, y,
        );
        prevQ = [qx, qy]; prevC2 = null;
        break;
      }
      case 'A': {
        const rx = num(), ry = num(), rot = num(), laf = num(), sf = num();
        const x = ax(num()), y = ay(num());
        const segs = arcToCubics(cx, cy, rx, ry, rot, laf, sf, x, y);
        if (!segs) { lineTo(x, y); }
        else {
          for (const s of segs) cubicTo(s[0], s[1], s[2], s[3], s[4], s[5]);
        }
        prevC2 = null; prevQ = null;
        break;
      }
      case 'Z': {
        if (cur) {
          cur.closed = true;
          // A 'z' with a straight close contributes no extra anchor.
          cx = sx; cy = sy;
        }
        prevC2 = prevQ = null;
        break;
      }
      default: throw new Error(`unhandled path command ${cmd}`);
    }
  }
  return contours;
}

// ---------- rml emission ----------

const fmt = (n) => {
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? '0' : String(r);
};
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

let nextId = 0;
const id = () => `0:${nextId++}`;

// Vertices are emitted in icon-local space centred on (0,0): source coords
// minus (12,12). Handles become polar (rotation rad, distance) pairs on
// CubicDetachedVertex; a missing handle emits distance 0.
function emitContour(contour, indent) {
  const pad = ' '.repeat(indent);
  const lines = [`${pad}<PointsPath id="${id()}"${contour.closed ? ' isClosed="true"' : ''}>`];
  for (const a of contour.anchors) {
    const x = fmt(a.x - 12), y = fmt(a.y - 12);
    if (!a.in && !a.out) {
      lines.push(`${pad}  <StraightVertex id="${id()}" x="${x}" y="${y}" />`);
      continue;
    }
    let attrs = `x="${x}" y="${y}"`;
    if (a.in) {
      attrs += ` inRotation="${fmt(Math.atan2(a.in[1] - a.y, a.in[0] - a.x))}"`;
      attrs += ` inDistance="${fmt(Math.hypot(a.in[0] - a.x, a.in[1] - a.y))}"`;
    }
    if (a.out) {
      attrs += ` outRotation="${fmt(Math.atan2(a.out[1] - a.y, a.out[0] - a.x))}"`;
      attrs += ` outDistance="${fmt(Math.hypot(a.out[0] - a.x, a.out[1] - a.y))}"`;
    }
    lines.push(`${pad}  <CubicDetachedVertex id="${id()}" ${attrs} />`);
  }
  lines.push(`${pad}</PointsPath>`);
  return lines.join('\n');
}

function emitNode(tag, attrs, indent) {
  const pad = ' '.repeat(indent);
  const n = (v) => (typeof v === 'string' ? parseFloat(v) : v);
  switch (tag) {
    case 'path':
      return parsePath(attrs.d).map((c) => emitContour(c, indent)).join('\n');
    case 'circle': {
      const cx = n(attrs.cx) - 12, cy = n(attrs.cy) - 12, r = n(attrs.r);
      return `${pad}<Ellipse id="${id()}" x="${fmt(cx)}" y="${fmt(cy)}" width="${fmt(2 * r)}" height="${fmt(2 * r)}" originX="0.5" originY="0.5" />`;
    }
    case 'line': {
      const c = { closed: false, anchors: [
        { x: n(attrs.x1), y: n(attrs.y1), in: null, out: null },
        { x: n(attrs.x2), y: n(attrs.y2), in: null, out: null },
      ] };
      return emitContour(c, indent);
    }
    case 'polyline':
    case 'polygon': {
      const pts = String(attrs.points).trim().split(/\s+/).map((p) => p.split(',').map(Number));
      const c = {
        closed: tag === 'polygon',
        anchors: pts.map(([x, y]) => ({ x, y, in: null, out: null })),
      };
      return emitContour(c, indent);
    }
    case 'rect': {
      const x = n(attrs.x) + n(attrs.width) / 2 - 12;
      const y = n(attrs.y) + n(attrs.height) / 2 - 12;
      const rx = attrs.rx !== undefined ? ` cornerRadiusTL="${fmt(n(attrs.rx))}"` : '';
      return `${pad}<Rectangle id="${id()}" x="${fmt(x)}" y="${fmt(y)}" width="${fmt(n(attrs.width))}" height="${fmt(n(attrs.height))}"${rx} />`;
    }
    default:
      throw new Error(`unsupported lucide node tag ${tag}`);
  }
}

function emitIcon(spec, base = 0) {
  nextId = spec.idBase;
  const pad = ' '.repeat(base);
  const nodes = loadIconNodes(spec.icon);
  const lines = [];
  lines.push(`${pad}<Node name="${spec.name}" id="${id()}" x="${fmt(spec.cx)}" y="${fmt(spec.cy)}" scaleX="${spec.scale}" scaleY="${spec.scale}">`);
  lines.push(`${pad}  <Shape name="${spec.icon}" id="${id()}">`);
  for (const [tag, attrs] of nodes) lines.push(emitNode(tag, attrs, base + 4));
  lines.push(`${pad}    <Stroke id="${id()}" thickness="2" cap="round" join="round">`);
  lines.push(`${pad}      <SolidColor id="${id()}" colorValue="${spec.color || ICON_COLOR}" />`);
  lines.push(`${pad}    </Stroke>`);
  lines.push(`${pad}  </Shape>`);
  lines.push(`${pad}</Node>`);
  return lines.join('\n');
}

// ---------- cli ----------

const args = process.argv.slice(2);
if (args.includes('--list')) {
  for (const s of ICONS) console.log(`${s.icon} -> ${s.name} @(${s.cx},${s.cy}) x${s.scale}`);
  process.exit(0);
}

const injectIdx = args.indexOf('--inject');
if (injectIdx >= 0) {
  const file = resolve(args[injectIdx + 1]);
  let src = readFileSync(file, 'utf8');
  // Each `<!-- @icon:Name -->` marker is replaced by a begin/end-wrapped block
  // re-indented to the marker's leading whitespace; reruns replace the region.
  src = src.replace(
    /^([ \t]*)<!-- @icon:(\w+) -->$/gm,
    (m, pad, name) => {
      const spec = ICONS.find((s) => s.name === name);
      if (!spec) throw new Error(`no icon spec for marker ${name}`);
      return `${pad}<!-- @icon:${name}:begin -->\n${emitIcon(spec, pad.length)}\n${pad}<!-- @icon:${name}:end -->`;
    },
  );
  src = src.replace(
    /^([ \t]*)<!-- @icon:(\w+):begin -->\n[\s\S]*?<!-- @icon:\2:end -->$/gm,
    (m, pad, name) => {
      const spec = ICONS.find((s) => s.name === name);
      if (!spec) throw new Error(`no icon spec for region ${name}`);
      return `${pad}<!-- @icon:${name}:begin -->\n${emitIcon(spec, pad.length)}\n${pad}<!-- @icon:${name}:end -->`;
    },
  );
  const missing = ICONS.filter((s) => !src.includes(`name="${s.name}"`));
  if (missing.length) console.warn('markers not found for: ' + missing.map((s) => s.name).join(', '));
  writeFileSync(file, src);
  console.log(`injected icons into ${file}`);
} else {
  writeFileSync(OUT, ICONS.map((s) => emitIcon(s, 0)).join('\n') + '\n');
  console.log(`wrote ${ICONS.length} icons to ${OUT}`);
}
