#!/usr/bin/env node
// Fills the non-icon `<!-- @... -->` markers in the BoardChrome scene.rml.
//
// Everything here is mechanical repetition driven by the layout contract in
// packages/ui/xr/board-chrome-layout.ts: 7 ink swatches + close on the inks
// row, a state machine layer per boolean-driven visual, one listener cluster
// per hit rect, and the BoardChrome view model. Generating keeps the hit
// rects, property ids and command codes traceable to that file instead of
// hand-copied.
//
//   node fill-scene.mjs            # rewrite markers in place
//   node fill-scene.mjs --check    # fail if scene.rml differs from generated
//
// SOT: probes/rive-panel/rive-board-chrome/scene.rml content blocks.
// Run AFTER convert.mjs --inject (or before; the markers are independent).

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCENE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../probes/rive-panel/rive-board-chrome/scene.rml',
);

const VM = '0:40';
// View model property ids — keep in step with the `viewmodel` block below.
const P = {
  tool: '0:100',
  ink: '0:101',
  canUndo: '0:102',
  canRedo: '0:103',
  asking: '0:104',
  hasMarks: '0:105',
  paletteOpen: '0:106',
  clearArmed: '0:107',
  grabbed: '0:108',
  reducedMotion: '0:109',
  status: '0:110',
  revision: '0:111',
  command: '0:112',
  commandSeq: '0:113',
  hoverPen: '0:120', downPen: '0:121',
  hoverHighlighter: '0:122', downHighlighter: '0:123',
  hoverEraser: '0:124', downEraser: '0:125',
  hoverInkWell: '0:126', downInkWell: '0:127',
  hoverUndo: '0:128', downUndo: '0:129',
  hoverRedo: '0:130', downRedo: '0:131',
  hoverClear: '0:132', downClear: '0:133',
  hoverAsk: '0:134', downAsk: '0:135',
  hoverClose: '0:150', downClose: '0:151',
  uiOpacity: '0:152',
};
for (let i = 0; i < 7; i++) {
  P[`hoverInk${i}`] = `0:${136 + i}`;
  P[`downInk${i}`] = `0:${143 + i}`;
}

const INK_COLORS = ['FF1A1A1A', 'FF2563EB', 'FFDC2626', 'FF16A34A', 'FFEAB308', 'FFF97316', 'FF7C3AED'];
const INK_NAMES = ['black', 'blue', 'red', 'green', 'yellow', 'orange', 'violet'];
// HUD palette: amber is the luminous accent, Moyo teal secondary, everything
// else hairline-on-near-black. Alpha-prefixed ARGB, no '#'.
const ACCENT = 'FFF5B02E';
const HOVER_FILL = '14F5B02E';
const DOWN_FILL = '33F5B02E';
const CELL_FILL = '0DFFFFFF';
const HAIRLINE = '26E9F4FA';
const LABEL = 'FF5E7683';
const LABEL_Y = 104;   // micro-label top inside every 44..132 cell
const LABEL_FS = 10;
const CELL_R = 6;      // chamfer-lite corner radius on cell surfaces
const NUM_KEY = '636'; // BindablePropertyNumber.propertyValue
const BOOL_KEY = '634'; // BindablePropertyBoolean.propertyValue
const NEXT_SEQ = '0:60';
const isIndex = (i) => `0:${61 + i}`;

const indent = (text, pad) =>
  text.split('\n').map((l) => (l.trim() ? pad + l : l)).join('\n');

// ---------- inks row swatches ----------

// A centred micro-label — Foundation-style small caps riding under a control.
// Fixed-width box + centre align so it stays put under the cell's midpoint.
// `sid` ids the style paint — a run without styleId renders nothing.
// Space Grotesk ships wght 300..700, default 300 — every label needs an
// explicit TextStyleAxis or it renders hairline in the headset.
const WGHT = '2003265652'; // 'wght' packed big-endian
function microLabel(text, x, w, y = LABEL_Y, fs = LABEL_FS, color = LABEL, align = 'center', sid = 0) {
  return `<Text name="label ${text}" x="${x}" y="${y}" width="${w}" sizingValue="fixed" alignValue="${align}" wrapValue="noWrap">
  <TextStylePaint id="0:${sid}" fontSize="${fs}" letterSpacing="1.8" fontAssetId="0:30" familyName="Space Grotesk" styleName="SemiBold">
    <TextStyleAxis tag="${WGHT}" axisValue="600" name="Weight" />
    <Fill>
      <SolidColor colorValue="${color}" />
    </Fill>
  </TextStylePaint>
  <TextValueRun styleId="0:${sid}" text="${text}" />
</Text>`;
}
// Id budget for generated micro-labels: 0:640..0:669 (hand-authored labels
// use 0:601..0:615, spine paints 0:625..0:626, icons start at 0:700).
let labelSid = 640;
const label = (text, x, w, y = LABEL_Y, fs = LABEL_FS, color = LABEL, align = 'center') =>
  microLabel(text, x, w, y, fs, color, align, labelSid++);

// Swatch content only — the hit/bg rectangles live in the InksHits node so the
// Palette layer can slide the whole row's hit area off-artboard with one key.
// Swatch i sits at x = 124 + i*124 (w=104 h=88), centre cx = 176 + i*124.
function swatches() {
  const out = [];
  for (let i = 0; i < 7; i++) {
    const rx = 124 + i * 124;
    const cx = rx + 52;
    const b = 270 + i * 5;
    out.push(`<Node name="Ink${i}">
  <Shape id="0:${b + 4}" name="Ink${i} down" x="${cx}" y="88" opacity="0">
    <DataBindContext sourcePathIds="${VM}-${P[`downInk${i}`]}" propertyKey="18" />
    <Rectangle width="104" height="88" cornerRadiusTL="${CELL_R}" />
    <Fill>
      <SolidColor colorValue="${DOWN_FILL}" />
    </Fill>
  </Shape>
  <Shape id="0:${b + 3}" name="Ink${i} hover" x="${cx}" y="88" opacity="0">
    <DataBindContext sourcePathIds="${VM}-${P[`hoverInk${i}`]}" propertyKey="18" />
    <Rectangle width="104" height="88" cornerRadiusTL="${CELL_R}" />
    <Fill>
      <SolidColor colorValue="${HOVER_FILL}" />
    </Fill>
  </Shape>
${indent(label(`0${i + 1}`, rx, 104), '  ')}
  <Shape id="0:${b + 2}" name="Ink${i} ring" x="${cx}" y="72" opacity="0">
    <DataBindContext sourcePathIds="${VM}-${P.ink}" propertyKey="18" converterId="${isIndex(i)}" />
    <Rectangle width="50" height="50" cornerRadiusTL="10" />
    <Stroke thickness="2.5" cap="round" join="round">
      <SolidColor colorValue="${ACCENT}" />
    </Stroke>
  </Shape>
  <Shape id="0:${b + 1}" name="Ink${i} swatch" x="${cx}" y="72">
    <Rectangle width="36" height="36" cornerRadiusTL="7" />
    <Fill>
      <SolidColor colorValue="${INK_COLORS[i]}" />
    </Fill>
    <Stroke thickness="1">
      <SolidColor colorValue="40E9F4FA" />
    </Stroke>
  </Shape>
</Node>`);
  }
  return out.join('\n');
}

// All hit/bg rectangles for the inks row: swatch i sits at x = 124 + i*124
// (w=104 h=88) and close at x=992 (w=132). Grouped so one keyed x moves the
// whole row's hit areas off-artboard when the palette is closed.
function inksHits() {
  const hits = [];
  for (let i = 0; i < 7; i++) {
    const cx = 124 + i * 124 + 52;
    hits.push(`  <Shape id="0:${270 + i * 5}" name="Ink${i} hit" x="${cx}" y="88">
    <Rectangle width="104" height="88" cornerRadiusTL="${CELL_R}" />
    <Fill>
      <SolidColor colorValue="${CELL_FILL}" />
    </Fill>
  </Shape>`);
  }
  hits.push(`  <Shape id="0:305" name="Close hit" x="1058" y="88">
    <Rectangle width="132" height="88" cornerRadiusTL="${CELL_R}" />
    <Fill>
      <SolidColor colorValue="${CELL_FILL}" />
    </Fill>
  </Shape>`);
  return `<Node name="InksHits" id="0:266">\n${hits.join('\n')}\n</Node>`;
}

// Tools-row hit/bg rectangles in one node for the same reason as inksHits —
// the Palette animations slide whichever row is hidden 3000 units right so its
// listeners cannot fire (opacity does not gate hit-testing).
// cx/w come straight from TOOL_ROW in board-chrome-layout.ts.
const TOOL_HITS = [
  ['pen', '0:211', 176, 104],
  ['highlighter', '0:215', 292, 104],
  ['eraser', '0:219', 408, 104],
  ['inkWell', '0:223', 528, 96],
  ['undo', '0:234', 648, 104],
  ['redo', '0:238', 764, 104],
  ['clear', '0:242', 888, 104],
  ['askNatalie', '0:247', 1042, 164],
];

function toolsHits() {
  const hits = TOOL_HITS.map(([name, id, cx, w]) => `  <Shape id="${id}" name="${name[0].toUpperCase() + name.slice(1)} hit" x="${cx}" y="88">
    <Rectangle width="${w}" height="88" cornerRadiusTL="${CELL_R}" />
    <Fill>
      <SolidColor colorValue="${name === 'askNatalie' ? '14F5B02E' : CELL_FILL}" />
    </Fill>
  </Shape>`);
  return `<Node name="ToolsHits" id="0:255">\n${hits.join('\n')}\n</Node>`;
}

// ---------- chrome decoration ----------

// The HUD texture layer: rail separators, scanlines, viewport ticks, gutter
// furniture and the bound ink meter. All hairlines — nothing inside the
// content window (112,140,1024,640) except ticks riding its border edge.
function deco() {
  const parts = [];

  // Rail separators in the gaps between tool cells plus row end-caps.
  const seps = [118, 234, 350, 470, 586, 706, 826, 950, 1130]
    .map((x) => `    <Rectangle x="${x}" y="88" width="1" height="68" />`)
    .join('\n');
  parts.push(`<Shape name="Rail separators">
${seps}
  <Fill>
    <SolidColor colorValue="${HAIRLINE}" />
  </Fill>
</Shape>`);

  // Scanlines: 1px rows across the toolbar band, and in both gutters.
  const scan = [];
  for (let y = 46; y <= 130; y += 9.4) {
    scan.push(`    <Rectangle x="624" y="${Math.round(y * 10) / 10}" width="1244" height="1" />`);
  }
  for (let y = 180; y <= 740; y += 40) {
    scan.push(`    <Rectangle x="56" y="${y}" width="96" height="1" />`);
    scan.push(`    <Rectangle x="1192" y="${y}" width="96" height="1" />`);
  }
  parts.push(`<Shape name="Scanlines">
${scan.join('\n')}
  <Fill>
    <SolidColor colorValue="0AE9F4FA" />
  </Fill>
</Shape>`);

  // Viewport ticks riding the window's border: top edge + both sides + bottom.
  const ticks = [];
  for (let x = 176; x <= 1088; x += 64) {
    ticks.push(`    <Rectangle x="${x}" y="137" width="1.5" height="7" />`);
    ticks.push(`    <Rectangle x="${x}" y="776" width="1.5" height="7" />`);
  }
  for (let y = 220; y <= 700; y += 80) {
    ticks.push(`    <Rectangle x="108" y="${y}" width="7" height="1.5" />`);
    ticks.push(`    <Rectangle x="1133" y="${y}" width="7" height="1.5" />`);
  }
  parts.push(`<Shape name="Viewport ticks">
${ticks.join('\n')}
  <Fill>
    <SolidColor colorValue="3DE9F4FA" />
  </Fill>
</Shape>`);

  // Left gutter: tick column on the window edge + rotated spine label +
  // corner coordinate readouts.
  const gticks = [];
  for (let y = 200; y <= 740; y += 40) {
    gticks.push(`    <Rectangle x="104" y="${y}" width="7" height="1.2" />`);
  }
  parts.push(`<Shape name="Gutter ticks">
${gticks.join('\n')}
  <Fill>
    <SolidColor colorValue="${HAIRLINE}" />
  </Fill>
</Shape>`);

  const leftSpine = `<Node name="Left spine" x="46" y="470" rotation="-1.570796">
  <Text x="-80" y="-7">
    <TextStylePaint id="0:625" fontSize="13" letterSpacing="4" fontAssetId="0:30" familyName="Space Grotesk" styleName="SemiBold">
      <TextStyleAxis tag="${WGHT}" axisValue="600" name="Weight" />
      <Fill>
        <SolidColor colorValue="FF4E6673" />
      </Fill>
    </TextStylePaint>
    <TextValueRun styleId="0:625" text="MOYO // BOARD" />
  </Text>
</Node>
<Node name="Right spine" x="1202" y="450" rotation="1.570796">
  <Text x="-70" y="-7">
    <TextStylePaint id="0:626" fontSize="13" letterSpacing="4" fontAssetId="0:30" familyName="Space Grotesk" styleName="SemiBold">
      <TextStyleAxis tag="${WGHT}" axisValue="600" name="Weight" />
      <Fill>
        <SolidColor colorValue="FF4E6673" />
      </Fill>
    </TextStylePaint>
    <TextValueRun styleId="0:626" text="INK CHANNEL" />
  </Text>
</Node>`;
  parts.push(leftSpine);

  // Right-gutter ink meter: seven segments, each in its ink colour at 25%;
  // the segment matching `ink` glows at full alpha via the Is-index binds.
  const segs = [];
  for (let i = 0; i < 7; i++) {
    const y = 320 + i * 30;
    segs.push(`  <Shape name="InkMeter${i} glow" x="1186" y="${y + 9}" opacity="0">
    <DataBindContext sourcePathIds="${VM}-${P.ink}" propertyKey="18" converterId="${isIndex(i)}" />
    <Rectangle width="12" height="18" cornerRadiusTL="3" />
    <Fill>
      <SolidColor colorValue="${INK_COLORS[i]}" />
    </Fill>
  </Shape>
  <Shape name="InkMeter${i} base" x="1186" y="${y + 9}">
    <Rectangle width="12" height="18" cornerRadiusTL="3" />
    <Fill>
      <SolidColor colorValue="40${INK_COLORS[i].slice(2)}" />
    </Fill>
  </Shape>`);
  }
  parts.push(`<Node name="InkMeter">\n${segs.join('\n')}\n</Node>`);

  // Corner coordinate readouts — text-as-texture, deliberately faint.
  parts.push(label('112·140', 16, 80, 148, 8, 'FF3D5560', 'left'));
  parts.push(label('112·780', 16, 80, 758, 8, 'FF3D5560', 'left'));
  parts.push(label('1136·140', 1150, 82, 148, 8, 'FF3D5560', 'right'));
  parts.push(label('1136·780', 1150, 82, 758, 8, 'FF3D5560', 'right'));
  parts.push(label('CAM·01 // LIVE', 16, 96, 170, 8.5, 'FF3D5560', 'left'));
  parts.push(label('QDRAW · 1024×640', 1136, 96, 170, 8.5, 'FF3D5560', 'right'));

  return parts.join('\n');
}

// ---------- state machine layers ----------

// One transition: dest, duration, and (prop, equals) condition pairs. `bool`
// conditions compare against the literal `true` with opValue equal/notEqual —
// mirroring the Lesson scene's reducedMotion-gated pairs.
function transition(dest, duration, conds) {
  const body = conds
    .map(([prop, eq]) => {
      const op = eq ? 'equal' : 'notEqual';
      return `    <TransitionViewModelCondition opValue="${op}">
      <TransitionPropertyViewModelComparator>
        <BindablePropertyBoolean>
          <DataBindContext sourcePathIds="${VM}-${P[prop]}" propertyKey="${BOOL_KEY}" />
        </BindablePropertyBoolean>
      </TransitionPropertyViewModelComparator>
      <TransitionValueBooleanComparator value="true" />
    </TransitionViewModelCondition>`;
    })
    .join('\n');
  return `  <StateTransition stateToId="${dest}" duration="${duration}">\n${body}\n  </StateTransition>`;
}

// A boolean-driven two-state layer (off anim a, on anim b) gated by `prop`,
// with the reducedMotion duration split the Lesson state machine uses.
function boolLayer(name, prop, sOff, sOn, x) {
  const pos = (n) => `x="${x}" y="${n * 160}"`;
  return `<StateMachineLayer name="${name}">
  <EntryState ${pos(0)}>
    <StateTransition stateToId="${sOff}" />
  </EntryState>
  <AnyState ${pos(-1)} />
  <ExitState ${pos(1)} />
  <AnimationState id="${sOff}" animationId="${ANIM[name][0]}" ${pos(2)}>
${transition(sOn, 120, [[prop, true], ['reducedMotion', false]])}
${transition(sOn, 0, [[prop, true], ['reducedMotion', true]])}
  </AnimationState>
  <AnimationState id="${sOn}" animationId="${ANIM[name][1]}" ${pos(3)}>
${transition(sOff, 120, [[prop, false], ['reducedMotion', false]])}
${transition(sOff, 0, [[prop, false], ['reducedMotion', true]])}
  </AnimationState>
</StateMachineLayer>`;
}

const ANIM = {
  Palette: ['0:330', '0:331'],
  UndoEnabled: ['0:332', '0:333'],
  RedoEnabled: ['0:334', '0:335'],
  ClearEnabled: ['0:336', '0:337'],
  ClearArmed: ['0:338', '0:339'],
  AskBusy: ['0:340', '0:341'],
  Grabbed: ['0:342', '0:343'],
};

function layers() {
  return [
    boolLayer('Palette', 'paletteOpen', '0:400', '0:401', 0),
    boolLayer('UndoEnabled', 'canUndo', '0:402', '0:403', 1),
    boolLayer('RedoEnabled', 'canRedo', '0:404', '0:405', 2),
    boolLayer('ClearEnabled', 'hasMarks', '0:406', '0:407', 3),
    boolLayer('ClearArmed', 'clearArmed', '0:408', '0:409', 4),
    boolLayer('AskBusy', 'asking', '0:410', '0:411', 5),
    boolLayer('Grabbed', 'grabbed', '0:412', '0:413', 6),
  ].join('\n');
}

// ---------- listeners ----------

// enter/exit/down/up write the per-control hover/down numbers; click writes
// `command` and bumps `commandSeq` through the Next seq converter — the same
// shape as Lesson's revision write.
function listenersFor(target, name, hoverProp, downProp, command, seqReadId) {
  const write = (prop, value) =>
    `    <ListenerViewModelChange>
      <BindablePropertyNumber propertyValue="${value}">
        <DataBindContext sourcePathIds="${VM}-${prop}" propertyKey="${NUM_KEY}" direction="true" />
      </BindablePropertyNumber>
    </ListenerViewModelChange>`;
  return `  <StateMachineListenerSingle targetId="${target}" listenerTypeValue="enter" name="enter ${name}">
${write(hoverProp, 1)}
  </StateMachineListenerSingle>
  <StateMachineListenerSingle targetId="${target}" listenerTypeValue="exit" name="exit ${name}">
${write(hoverProp, 0)}
${write(downProp, 0)}
  </StateMachineListenerSingle>
  <StateMachineListenerSingle targetId="${target}" listenerTypeValue="down" name="down ${name}">
${write(downProp, 1)}
  </StateMachineListenerSingle>
  <StateMachineListenerSingle targetId="${target}" listenerTypeValue="up" name="up ${name}">
${write(downProp, 0)}
  </StateMachineListenerSingle>
  <StateMachineListenerSingle targetId="${target}" listenerTypeValue="click" name="command ${name}">
${write(P.command, command)}
    <ListenerViewModelChange fromViewModelProperty="true" fromDataBindId="${seqReadId}">
      <BindablePropertyNumber>
        <DataBindContext sourcePathIds="${VM}-${P.commandSeq}" propertyKey="${NUM_KEY}" id="${seqReadId}" converterId="${NEXT_SEQ}" />
        <DataBindContext sourcePathIds="${VM}-${P.commandSeq}" propertyKey="${NUM_KEY}" direction="true" />
      </BindablePropertyNumber>
    </ListenerViewModelChange>
  </StateMachineListenerSingle>`;
}

function listeners() {
  const specs = [
    ['0:211', 'pen', 'hoverPen', 'downPen', 1],
    ['0:215', 'highlighter', 'hoverHighlighter', 'downHighlighter', 2],
    ['0:219', 'eraser', 'hoverEraser', 'downEraser', 3],
    ['0:223', 'inkWell', 'hoverInkWell', 'downInkWell', 4],
    ['0:234', 'undo', 'hoverUndo', 'downUndo', 5],
    ['0:238', 'redo', 'hoverRedo', 'downRedo', 6],
    ['0:242', 'clear', 'hoverClear', 'downClear', 7],
    ['0:247', 'askNatalie', 'hoverAsk', 'downAsk', 8],
    ...Array.from({ length: 7 }, (_, i) => [
      `0:${270 + i * 5}`, `ink${i}`, `hoverInk${i}`, `downInk${i}`, 10 + i,
    ]),
    ['0:305', 'closePalette', 'hoverClose', 'downClose', 17],
  ];
  return specs
    .map(([t, n, h, d, c], i) => listenersFor(t, n, P[h], P[d], c, `0:${500 + i}`))
    .join('\n');
}

// ---------- converters ----------

// `Is index i` converts the bound number into 1 when it equals i else 0:
// 1 - min(1, sqrt((input - i)^2)). Formula tokens are infix; operationType
// 1 is subtract, functionType 0/5/6 are min/sqrt/pow (raw ints, no names).
function converters() {
  const out = [];
  for (let i = 0; i < 7; i++) {
    out.push(`<DataConverterFormula name="Is index ${i}" id="${isIndex(i)}">
  <FormulaTokenValue operationValue="1" />
  <FormulaTokenOperation operationType="1" />
  <FormulaTokenFunction functionType="0" />
  <FormulaTokenValue operationValue="1" />
  <FormulaTokenArgumentSeparator />
  <FormulaTokenFunction functionType="5" />
  <FormulaTokenFunction functionType="6" />
  <FormulaTokenParenthesisOpen />
  <FormulaTokenInput />
  <FormulaTokenOperation operationType="1" />
  <FormulaTokenValue operationValue="${i}" />
  <FormulaTokenParenthesisClose />
  <FormulaTokenArgumentSeparator />
  <FormulaTokenValue operationValue="2" />
  <FormulaTokenParenthesisClose />
  <FormulaTokenParenthesisClose />
  <FormulaTokenParenthesisClose />
</DataConverterFormula>`);
  }
  return out.join('\n');
}

// ---------- view model ----------

const VM_PROPS = [
  ['ViewModelPropertyNumber', 'tool'],
  ['ViewModelPropertyNumber', 'ink'],
  ['ViewModelPropertyBoolean', 'canUndo'],
  ['ViewModelPropertyBoolean', 'canRedo'],
  ['ViewModelPropertyBoolean', 'asking'],
  ['ViewModelPropertyBoolean', 'hasMarks'],
  ['ViewModelPropertyBoolean', 'paletteOpen'],
  ['ViewModelPropertyBoolean', 'clearArmed'],
  ['ViewModelPropertyBoolean', 'grabbed'],
  ['ViewModelPropertyBoolean', 'reducedMotion'],
  ['ViewModelPropertyString', 'status'],
  ['ViewModelPropertyNumber', 'revision'],
  ['ViewModelPropertyNumber', 'command'],
  ['ViewModelPropertyNumber', 'commandSeq'],
  ...['Pen', 'Highlighter', 'Eraser', 'InkWell', 'Undo', 'Redo', 'Clear', 'Ask']
    .flatMap((n) => [
      ['ViewModelPropertyNumber', `hover${n}`],
      ['ViewModelPropertyNumber', `down${n}`],
    ]),
  ...Array.from({ length: 7 }, (_, i) => ['ViewModelPropertyNumber', `hoverInk${i}`]),
  ...Array.from({ length: 7 }, (_, i) => ['ViewModelPropertyNumber', `downInk${i}`]),
  ['ViewModelPropertyNumber', 'hoverClose'],
  ['ViewModelPropertyNumber', 'downClose'],
  ['ViewModelPropertyNumber', 'uiOpacity'],
];

const propId = (name) => {
  const v = P[name];
  if (!v) throw new Error(`no id for property ${name}`);
  return v;
};

function viewModel() {
  const props = VM_PROPS.map(([t, n]) => `  <${t} name="${n}" id="${propId(n)}" />`).join('\n');
  const values = VM_PROPS.map(([t, n]) => {
    const inst = t.replace('ViewModelProperty', 'ViewModelInstance');
    const v = n === 'status' ? 'Ready' : n === 'uiOpacity' ? '1' : t === 'ViewModelPropertyBoolean' ? 'false' : '0';
    return `    <${inst} viewModelPropertyId="${propId(n)}" propertyValue="${v}" />`;
  }).join('\n');
  return `<ViewModel name="BoardChrome" id="${VM}" defaultInstanceId="0:41">
${props}
  <ViewModelInstance id="0:41" name="Default" exports="true">
${values}
  </ViewModelInstance>
</ViewModel>`;
}

// ---------- fill ----------

const BLOCKS = {
  '@inkswatches': () => indent(swatches(), '      '),
  '@inkshits': () => indent(inksHits(), '      '),
  '@toolshits': () => indent(toolsHits(), '      '),
  '@deco': () => indent(deco(), '    '),
  '@layers': () => indent(layers(), '      '),
  '@listeners': () => indent(listeners(), '      '),
  '@converters': () => indent(converters(), '  '),
  '@viewmodel': () => indent(viewModel(), '  '),
};

const src = readFileSync(SCENE, 'utf8');
let out = src;
for (const [marker, gen] of Object.entries(BLOCKS)) {
  // First run replaces the bare `<!-- @x -->` marker; later runs replace the
  // generated region between `@x:begin`/`@x:end` so regeneration is idempotent.
  const bare = new RegExp(`([ \\t]*)<!-- ${marker} -->\\n?`);
  const region = new RegExp(
    `([ \\t]*)<!-- ${marker}:begin -->\\n[\\s\\S]*?<!-- ${marker}:end -->\\n?`,
  );
  if (region.test(out)) {
    out = out.replace(region, (m, pad) => `${pad}<!-- ${marker}:begin -->\n${gen()}\n${pad}<!-- ${marker}:end -->\n`);
  } else if (bare.test(out)) {
    out = out.replace(bare, (m, pad) => `${pad}<!-- ${marker}:begin -->\n${gen()}\n${pad}<!-- ${marker}:end -->\n`);
  } else {
    throw new Error(`missing marker ${marker}`);
  }
}
if (process.argv.includes('--check')) {
  if (out !== src) { console.error('scene.rml differs from generated output'); process.exit(1); }
  console.log('scene.rml is up to date');
} else {
  writeFileSync(SCENE, out);
  console.log(`filled ${Object.keys(BLOCKS).length} markers in ${SCENE}`);
}
