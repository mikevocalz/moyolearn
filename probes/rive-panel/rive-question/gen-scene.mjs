// gen-scene.mjs — emits scene.rml for the LearningQuestion artboard (1280x800).
// Run: node gen-scene.mjs > scene.rml
// Contract: view model `Question`, state machine `QuestionFlow`, phases 0-11.
// Same HMI language as BoardChrome: 0A0D12 face bound to uiOpacity, F00E1420
// unbound text bands, FFC168 amber, hairline E9F4FA-family strokes.

const A = [];
const push = (s) => A.push(s);
const LISTENERS = [];
const lpush = (s) => LISTENERS.push(s);

// ---------- ids ----------
let nid = 200;
const id = () => `0:${nid++}`;

const VM = "0:40";
const P = {};
{
  const strings = [
    "questionId","subjectLabel","skillLabel","progressLabel","localeLabel",
    "prompt","supportingText","interactionLabel",
    "choice0Label","choice1Label","choice2Label","choice3Label","choice4Label","choice5Label",
    "answerText","hintLabel","hintText","submitLabel","continueLabel","skipLabel",
    "listenLabel","feedbackTitle","feedbackBody","status",
  ];
  strings.forEach((n, i) => (P[n] = { id: `0:${100 + i}`, kind: "String" }));
  const numbers = [
    "interactionKind","choiceCount","questionNumber","questionTotal",
    "command","commandArg","commandSeq","revision","uiOpacity","phase","errorCode",
  ];
  numbers.forEach((n, i) => (P[n] = { id: `0:${130 + i}`, kind: "Number" }));
  const bools = [
    "choice0Visible","choice1Visible","choice2Visible","choice3Visible","choice4Visible","choice5Visible",
    "choice0Selected","choice1Selected","choice2Selected","choice3Selected","choice4Selected","choice5Selected",
    "answerValid","hintAvailable","hintVisible","loading","submitting","answered",
    "correct","incorrect","ungraded","disabled","grabbed","reducedMotion",
  ];
  bools.forEach((n, i) => (P[n] = { id: `0:${150 + i}`, kind: "Boolean" }));
}
const FX = "0:600"; // SM number input: 0 none, 1..6 hover choice, 101..106 down choice, 7..13 hover btn, 107..113 down btn

// ---------- palette ----------
const FACE = "FF0A0D12", BAND = "F00E1420", EDGE = "3DE9F4FA", HAIR = "2BE9F4FA";
const AMBER = "FFFFC168", TEXT_HI = "FFE9F4FA", TEXT_MID = "FF9FB4BE";
const TEXT_DIM = "FF5E7683", TEXT_FAINT = "FF3D5560";
const CORRECT = "FF5EEAD4", WRONG = "FFEC9787", YELLOW = "FFFFE14D", MANGO = "FFF4A629";

// ---------- helpers ----------
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const bind = (prop, key) => `<DataBindContext sourcePathIds="${VM}-${P[prop].id}" propertyKey="${key}" />`;
// bool prop -> numeric opacity needs ToNumber converter (0:63)
const bindOp = (prop) => `<DataBindContext sourcePathIds="${VM}-${P[prop].id}" propertyKey="18" converterId="0:63" />`;

function styleXml(fs, color, weight, ls = 0) {
  const sid = id();
  return {
    sid,
    xml: `<TextStylePaint id="${sid}" fontSize="${fs}"${ls ? ` letterSpacing="${ls}"` : ""} fontAssetId="0:30" familyName="Space Grotesk" styleName="SemiBold"><TextStyleAxis tag="2003265652" axisValue="${weight}" name="Weight" /><Fill><SolidColor colorValue="${color}" /></Fill></TextStylePaint>`,
  };
}

function textEl(o) {
  const { name, x, y, fs, color, weight = 600, ls = 0, str = "", prop, w, h, align, wrap = "noWrap", indent = "    " } = o;
  const st = styleXml(fs, color, weight, ls);
  const attrs = `${w ? ` width="${w}" sizingValue="fixed"` : ""}${h ? ` height="${h}"` : ""}${align ? ` alignValue="${align}"` : ""}`;
  push(`${indent}<Text name="${name}" x="${x}" y="${y}"${attrs} wrapValue="${wrap}">`);
  push(`${indent}  ${st.xml}`);
  if (prop) {
    push(`${indent}  <TextValueRun styleId="${st.sid}" text="${esc(str)}"><DataBindContext sourcePathIds="${VM}-${P[prop].id}" propertyKey="268" /></TextValueRun>`);
  } else {
    push(`${indent}  <TextValueRun styleId="${st.sid}" text="${esc(str)}" />`);
  }
  push(`${indent}</Text>`);
}

function rectShape(o) {
  const { name, x, y, w, h, fill, stroke, sw = 1, cr, opacity, shapeId, pre = "", indent = "    " } = o;
  push(`${indent}<Shape${shapeId ? ` id="${shapeId}"` : ""} name="${name}"${opacity !== undefined ? ` opacity="${opacity}"` : ""}>`);
  if (pre) push(`${indent}  ${pre}`);
  push(`${indent}  <Rectangle x="${x}" y="${y}" width="${w}" height="${h}"${cr ? ` cornerRadiusTL="${cr}"` : ""} />`);
  if (fill) push(`${indent}  <Fill><SolidColor colorValue="${fill}" /></Fill>`);
  if (stroke) push(`${indent}  <Stroke thickness="${sw}" cap="round" join="round"><SolidColor colorValue="${stroke}" /></Stroke>`);
  push(`${indent}</Shape>`);
}

function brackets(name, x0, y0, x1, y1, L, color, sw, indent = "    ") {
  const sets = [
    [[x0 + L, y0], [x0, y0], [x0, y0 + L]],
    [[x1 - L, y0], [x1, y0], [x1, y0 + L]],
    [[x0, y1 - L], [x0, y1], [x0 + L, y1]],
    [[x1, y1 - L], [x1, y1], [x1 - L, y1]],
  ];
  push(`${indent}<Shape name="${name}">`);
  for (const s of sets) {
    push(`${indent}  <PointsPath>`);
    for (const [vx, vy] of s) push(`${indent}    <StraightVertex x="${vx}" y="${vy}" />`);
    push(`${indent}  </PointsPath>`);
  }
  push(`${indent}  <Stroke thickness="${sw}" cap="round" join="round"><SolidColor colorValue="${color}" /></Stroke>`);
  push(`${indent}</Shape>`);
}

function arcSegs(r, a0, a1, stepDeg = 6, indent = "          ") {
  push(`${indent}<PointsPath>`);
  for (let a = a0; a <= a1 + 0.01; a += stepDeg) {
    const rad = (Math.min(a, a1) * Math.PI) / 180;
    push(`${indent}  <StraightVertex x="${(r * Math.cos(rad)).toFixed(2)}" y="${(r * Math.sin(rad)).toFixed(2)}" />`);
  }
  push(`${indent}</PointsPath>`);
}

function octVerts(w, h, c) {
  return [[c, 0], [w - c, 0], [w, c], [w, h - c], [w - c, h], [c, h], [0, h - c], [0, c]];
}
function octPath(w, h, c, indent = "      ") {
  push(`${indent}<PointsPath isClosed="true">`);
  for (const [vx, vy] of octVerts(w, h, c)) push(`${indent}  <StraightVertex x="${vx}" y="${vy}" />`);
  push(`${indent}</PointsPath>`);
}

// ---------- geometry ----------
const W = 1280, H = 800, CHAM = 20;
const WIN = { x: 40, y: 80, x1: 800, y1: 740 }; // hole
const CX = { x: 820, x1: 1240, w: 420 };        // choices column
const ROW = { y0: 80, h: 84, pitch: 92 };
const FOOT = 746;                               // footer band top
const FB = 648;                                 // feedback zone top

// ---------- keyed/bound object ids ----------
const ID = {};
for (const k of ["loader","orbital","ringA","ringB","pulse","triad","skeleton","choices","feedback","accC","accI","accU","errChip","hintCard","answerChip","grabbed","veil","hintDim","retryTicks"]) ID[k] = id();
const visId = [], rowId = [], hovIds = [], downIds = [], hitIds = [];
for (let i = 0; i < 6; i++) { visId.push(id()); rowId.push(id()); hovIds.push(id()); downIds.push(id()); hitIds.push(id()); }
const btnHov = [], btnDown = [], btnHit = [];
for (let i = 0; i < 7; i++) { btnHov.push(id()); btnDown.push(id()); btnHit.push(id()); }
const animId = {}, stateId = {};
const STATE_NAMES = ["EntranceLoading","Entering","Idle","Selecting","Submitting","FeedbackCorrect","FeedbackIncorrect","FeedbackUngraded","Exiting","LoadingNext","EnteringNext","Error"];
const RM_STATES = new Set(["EntranceLoading","Entering","Submitting","Exiting","LoadingNext","EnteringNext"]);
for (const n of STATE_NAMES) { animId[n] = id(); stateId[n] = id(); }
for (const n of STATE_NAMES) if (RM_STATES.has(n)) { animId[n + "RM"] = id(); stateId[n + "RM"] = id(); }
const FX_STATES = [{ k: "fxIdle", v: 0 }];
for (let i = 1; i <= 13; i++) FX_STATES.push({ k: `fxHov${i}`, v: i });
for (let i = 1; i <= 13; i++) FX_STATES.push({ k: `fxDown${i}`, v: 100 + i });
const fxAnimId = {}, fxStateId = {};
for (const s of FX_STATES) { fxAnimId[s.k] = id(); fxStateId[s.k] = id(); }

// ================= ARTBOARD =================
push(`<Rive version="1" kind="fragment">`);
push(`  <Artboard name="LearningQuestion" id="0:2" width="${W}" height="${H}" clip="true" styleId="0:5" defaultStateMachineId="0:7" viewModelId="${VM}" viewModelInstanceId="0:41">`);
push(`    <LayoutComponentStyle id="0:5" />`);

// ---------- topmost: grabbed overlay ----------
push(`    <Node id="${ID.grabbed}" opacity="0" name="Grabbed">`);
push(`      ${bindOp("grabbed")}`);
textEl({ name: "Grab status", x: 540, y: 18, w: 200, align: "center", fs: 11, color: AMBER, ls: 2.5, str: "MOVING PANEL", indent: "      " });
brackets("Grab corners", 14, 14, 1266, 786, 34, AMBER, 3, "      ");
push(`    </Node>`);

// ---------- feedback strip (right col, above footer) ----------
push(`    <Node id="${ID.feedback}" opacity="0" name="Feedback">`);
rectShape({ name: "Fb rule", x: 1030, y: FB - 8, w: 420, h: 1, fill: HAIR, indent: "      " });
textEl({ name: "Fb tag", x: CX.x, y: FB + 2, fs: 9.5, color: TEXT_FAINT, ls: 2, str: "RESULT", indent: "      " });
rectShape({ name: "Acc correct", x: CX.x + 2, y: FB + 34, w: 4, h: 44, fill: CORRECT, shapeId: ID.accC, opacity: 0, indent: "      " });
rectShape({ name: "Acc incorrect", x: CX.x + 2, y: FB + 34, w: 4, h: 44, fill: WRONG, shapeId: ID.accI, opacity: 0, indent: "      " });
rectShape({ name: "Acc ungraded", x: CX.x + 2, y: FB + 34, w: 4, h: 44, fill: AMBER, shapeId: ID.accU, opacity: 0, indent: "      " });
textEl({ name: "Fb title", x: CX.x + 18, y: FB + 24, w: 400, fs: 16, color: TEXT_HI, weight: 700, ls: 0.5, prop: "feedbackTitle", indent: "      " });
textEl({ name: "Fb body", x: CX.x + 18, y: FB + 50, w: 392, fs: 12, color: TEXT_MID, prop: "feedbackBody", wrap: "wrap", indent: "      " });
push(`    </Node>`);

// ---------- hint card (bool-bound) ----------
push(`    <Node id="${ID.hintCard}" opacity="0" name="Hint card">`);
push(`      ${bindOp("hintVisible")}`);
rectShape({ name: "Hint frame", x: 1030, y: 698, w: 420, h: 88, fill: "F20E1420", stroke: "66FFC168", sw: 1, cr: 4, indent: "      " });
textEl({ name: "Hint tag", x: CX.x + 14, y: 662, fs: 9.5, color: AMBER, ls: 2.5, str: "HINT", indent: "      " });
textEl({ name: "Hint text", x: CX.x + 14, y: 682, w: 392, fs: 12, color: TEXT_MID, prop: "hintText", wrap: "wrap", indent: "      " });
push(`    </Node>`);

// ---------- answer chip (bool-bound) ----------
push(`    <Node id="${ID.answerChip}" opacity="0" name="Answer chip">`);
push(`      ${bindOp("answerValid")}`);
textEl({ name: "Ans tag", x: CX.x, y: 630, fs: 9.5, color: TEXT_FAINT, ls: 2, str: "ANSWER", indent: "      " });
textEl({ name: "Ans text", x: CX.x + 70, y: 626, w: 350, fs: 12, color: TEXT_HI, prop: "answerText", indent: "      " });
push(`    </Node>`);

// ---------- error chip ----------
push(`    <Node id="${ID.errChip}" opacity="0" name="Error chip">`);
rectShape({ name: "Err frame", x: 1030, y: 698, w: 420, h: 88, fill: "F21A1210", stroke: "99EC9787", sw: 1, cr: 4, indent: "      " });
textEl({ name: "Err tag", x: CX.x + 14, y: 662, fs: 9.5, color: WRONG, ls: 2.5, str: "FAULT", indent: "      " });
textEl({ name: "Err text", x: CX.x + 14, y: 682, w: 300, fs: 12, color: TEXT_MID, prop: "status", indent: "      " });
{
  const st = styleXml(12, WRONG, 700);
  push(`      <Text name="Err code" x="1140" y="682" width="86" sizingValue="fixed" alignValue="right" wrapValue="noWrap">`);
  push(`        ${st.xml}`);
  push(`        <TextValueRun styleId="${st.sid}" text="0"><DataBindContext sourcePathIds="${VM}-${P.errorCode.id}" propertyKey="268" converterId="0:61" /></TextValueRun>`);
  push(`      </Text>`);
}
push(`    </Node>`);

// ---------- entrance loader (window center 420,410) ----------
push(`    <Node id="${ID.loader}" opacity="0" name="Loader" x="420" y="410">`);
push(`      <Shape name="Track"><Ellipse x="0" y="0" width="176" height="176" /><Stroke thickness="1.2" cap="round" join="round"><SolidColor colorValue="22E9F4FA" /></Stroke></Shape>`);
push(`      <Shape name="Track ticks">`);
for (const a of [0, 90, 180, 270]) {
  const rad = (a * Math.PI) / 180;
  push(`        <PointsPath><StraightVertex x="${(100 * Math.cos(rad)).toFixed(2)}" y="${(100 * Math.sin(rad)).toFixed(2)}" /><StraightVertex x="${(108 * Math.cos(rad)).toFixed(2)}" y="${(108 * Math.sin(rad)).toFixed(2)}" /></PointsPath>`);
}
push(`        <Stroke thickness="2" cap="round" join="round"><SolidColor colorValue="55E9F4FA" /></Stroke>`);
push(`      </Shape>`);
push(`      <Node id="${ID.orbital}" name="Orbital">`);
push(`        <Node id="${ID.ringA}" name="Ring A"><Shape name="Arc A">`);
arcSegs(88, -60, 60);
arcSegs(88, 165, 195);
push(`          <Stroke thickness="3" cap="round" join="round"><SolidColor colorValue="${YELLOW}" /></Stroke>`);
push(`        </Shape></Node>`);
push(`        <Node id="${ID.ringB}" name="Ring B"><Shape name="Arc B">`);
arcSegs(74, 90, 150);
arcSegs(74, 255, 315);
push(`          <Stroke thickness="2" cap="round" join="round"><SolidColor colorValue="${MANGO}" /></Stroke>`);
push(`        </Shape></Node>`);
push(`        <Node id="${ID.pulse}" name="Pulse" rotation="45"><Shape name="Pulse diamond"><Rectangle x="0" y="0" width="12" height="12" /><Fill><SolidColor colorValue="${YELLOW}" /></Fill></Shape></Node>`);
push(`      </Node>`);
push(`      <Node id="${ID.triad}" name="Triad" opacity="0">`);
for (const a of [0, 120, 240]) {
  const rad = (a * Math.PI) / 180;
  push(`        <Shape name="Dot ${a}"><Ellipse x="${(34 * Math.cos(rad)).toFixed(2)}" y="${(34 * Math.sin(rad)).toFixed(2)}" width="8" height="8" /><Fill><SolidColor colorValue="${AMBER}" /></Fill></Shape>`);
}
push(`        <Shape name="Triad track"><Ellipse x="0" y="0" width="68" height="68" /><Stroke thickness="1" cap="round" join="round"><SolidColor colorValue="33FFC168" /></Stroke></Shape>`);
push(`      </Node>`);
push(`      <Node id="${ID.retryTicks}" name="Retry ticks" opacity="0">`);
push(`        ${bindOp("submitting")}`);
push(`        <Shape name="Retry arcs">`);
arcSegs(62, 20, 62);
arcSegs(62, 200, 262);
push(`          <Stroke thickness="2.5" cap="round" join="round"><SolidColor colorValue="${AMBER}" /></Stroke>`);
push(`        </Shape>`);
push(`        <Shape name="Red tick">`);
arcSegs(62, -8, 8, 4);
push(`          <Stroke thickness="3.5" cap="round" join="round"><SolidColor colorValue="${WRONG}" /></Stroke>`);
push(`        </Shape>`);
push(`      </Node>`);
textEl({ name: "Loader tag", x: -80, y: 112, w: 160, align: "center", fs: 9.5, color: TEXT_DIM, ls: 2.5, str: "CONTENT // SYNC", indent: "      " });
push(`    </Node>`);

// ---------- skeleton placeholders (inside window) ----------
push(`    <Node id="${ID.skeleton}" opacity="0" name="Skeleton">`);
rectShape({ name: "Sk title", x: 320, y: 162, w: 480, h: 24, fill: "1AFFFFFF", cr: 3, indent: "      " });
rectShape({ name: "Sk line 1", x: 400, y: 208, w: 640, h: 10, fill: "14FFFFFF", cr: 2, indent: "      " });
rectShape({ name: "Sk line 2", x: 360, y: 230, w: 560, h: 10, fill: "14FFFFFF", cr: 2, indent: "      " });
rectShape({ name: "Sk line 3", x: 290, y: 252, w: 420, h: 10, fill: "14FFFFFF", cr: 2, indent: "      " });
for (let i = 0; i < 3; i++) rectShape({ name: `Sk pill ${i}`, x: 700, y: 132 + i * 48, w: 120, h: 32, fill: "0FFFFFFF", cr: 16, indent: "      " });
push(`    </Node>`);

// ---------- choices column ----------
push(`    <Node id="${ID.choices}" name="Choices">`);
textEl({ name: "Interaction tag", x: CX.x, y: 64, fs: 10, color: TEXT_DIM, ls: 2.5, prop: "interactionLabel", indent: "      " });
textEl({ name: "Max tag", x: 1140, y: 64, w: 100, align: "right", fs: 9.5, color: TEXT_FAINT, ls: 2, str: "MAX·06", indent: "      " });
for (let i = 0; i < 6; i++) {
  const cy = ROW.y0 + i * ROW.pitch + ROW.h / 2;
  push(`      <Node id="${visId[i]}" name="ChoiceVis ${i}">`);
  push(`        ${bindOp(`choice${i}Visible`)}`);
  push(`        <Node id="${rowId[i]}" name="Choice ${i}">`);
  rectShape({ name: `Sel ${i}`, x: 826, y: cy, w: 4, h: 56, fill: AMBER, opacity: 0, pre: bindOp(`choice${i}Selected`), indent: "          " });
  textEl({ name: `Idx ${i}`, x: 844, y: cy - 9, fs: 11, color: TEXT_DIM, ls: 1.5, str: `0${i + 1}`, indent: "          " });
  textEl({ name: `Label ${i}`, x: 884, y: cy - 11, w: 336, fs: 15, color: TEXT_HI, weight: 700, ls: 0.5, prop: `choice${i}Label`, indent: "          " });
  rectShape({ name: `Cell ${i}`, x: 1030, y: cy, w: 420, h: 84, fill: "F2101820", stroke: "38E9F4FA", sw: 1, cr: 6, indent: "          " });
  rectShape({ name: `Hov ${i}`, x: 1030, y: cy, w: 420, h: 84, fill: "12FFFFFF", cr: 6, opacity: 0, shapeId: hovIds[i], indent: "          " });
  rectShape({ name: `Down ${i}`, x: 1030, y: cy, w: 420, h: 84, fill: "26FFC168", cr: 6, opacity: 0, shapeId: downIds[i], indent: "          " });
  rectShape({ name: `Hit ${i}`, x: 1030, y: cy, w: 420, h: 84, fill: "0DFFFFFF", cr: 6, shapeId: hitIds[i], indent: "          " });
  push(`        </Node>`);
  push(`      </Node>`);
}
push(`    </Node>`);

// ---------- footer buttons + veil ----------
const BTNS = [
  { name: "LISTEN", cmd: 6, prop: "listenLabel", cx: 102, w: 108 },
  { name: "HINT", cmd: 5, prop: "hintLabel", cx: 222, w: 108 },
  { name: "BOARD", cmd: 7, str: "BOARD", cx: 342, w: 108 },
  { name: "RETRY", cmd: 8, str: "RETRY", cx: 462, w: 108 },
  { name: "SKIP", cmd: 9, prop: "skipLabel", cx: 872, w: 108 },
  { name: "SUBMIT", cmd: 3, prop: "submitLabel", cx: 1013, w: 150, primary: true },
  { name: "NEXT", cmd: 4, prop: "continueLabel", cx: 1170, w: 140 },
];
push(`    <Node id="${ID.veil}" name="Disabled veil" opacity="0">`);
push(`      ${bindOp("disabled")}`);
rectShape({ name: "Veil", x: 640, y: 773, w: 1280, h: 54, fill: "A60A0D12", indent: "      " });
push(`    </Node>`);
textEl({ name: "Panel tag", x: 604, y: 765, fs: 9.5, color: TEXT_FAINT, ls: 2, str: "XR PANEL // LRN-01" });
for (let i = 0; i < BTNS.length; i++) {
  const b = BTNS[i];
  textEl({ name: `Btn label ${b.name}`, x: b.cx - b.w / 2, y: 764, w: b.w, align: "center", fs: 11.5, color: b.primary ? "FF0A0D12" : TEXT_HI, weight: 700, ls: 2, prop: b.prop, str: b.str });
  if (b.name === "HINT") {
    rectShape({ name: "HintDim", x: b.cx, y: 773, w: b.w, h: 34, fill: "990A0D12", cr: 4, opacity: 0, shapeId: ID.hintDim, pre: `<DataBindContext sourcePathIds="${VM}-${P.hintAvailable.id}" propertyKey="18" converterId="0:64" />`, indent: "    " });
  }
  if (b.primary) {
    rectShape({ name: `Btn frame ${b.name}`, x: b.cx, y: 773, w: b.w, h: 34, fill: AMBER, cr: 4 });
  } else if (b.name === "NEXT") {
    rectShape({ name: `Btn frame ${b.name}`, x: b.cx, y: 773, w: b.w, h: 34, fill: "1FFFC168", stroke: "99FFC168", sw: 1, cr: 4 });
  } else {
    rectShape({ name: `Btn frame ${b.name}`, x: b.cx, y: 773, w: b.w, h: 34, fill: "1A101820", stroke: "55E9F4FA", sw: 1, cr: 4 });
  }
  rectShape({ name: `Btn hov ${b.name}`, x: b.cx, y: 773, w: b.w, h: 34, fill: "12FFFFFF", cr: 4, opacity: 0, shapeId: btnHov[i] });
  rectShape({ name: `Btn down ${b.name}`, x: b.cx, y: 773, w: b.w, h: 34, fill: "2EFFC168", cr: 4, opacity: 0, shapeId: btnDown[i] });
  rectShape({ name: `Btn hit ${b.name}`, x: b.cx, y: 773, w: b.w, h: 34, fill: "0DFFFFFF", cr: 4, shapeId: btnHit[i] });
}

// ---------- header texts ----------
rectShape({ name: "Subject chip", x: 118, y: 34, w: 140, h: 32, fill: "1FFFC168", stroke: "66FFC168", sw: 1, cr: 3 });
textEl({ name: "Subject", x: 48, y: 22, w: 140, align: "center", fs: 12, color: TEXT_HI, weight: 700, ls: 3, prop: "subjectLabel" });
rectShape({ name: "Subject underline", x: 118, y: 52, w: 56, h: 2, fill: AMBER });
textEl({ name: "Skill", x: 200, y: 31, fs: 10, color: TEXT_DIM, ls: 2, prop: "skillLabel" });
textEl({ name: "Zone tag", x: 580, y: 40, w: 120, align: "center", fs: 10, color: TEXT_FAINT, ls: 2.5, str: "Q-PANEL // LRN" });
textEl({ name: "Status tag", x: 760, y: 24, fs: 9, color: TEXT_FAINT, ls: 2.5, str: "STATUS" });
textEl({ name: "Status", x: 760, y: 40, fs: 11, color: TEXT_MID, ls: 1.5, prop: "status" });
textEl({ name: "Progress", x: 980, y: 36, w: 130, align: "right", fs: 12, color: TEXT_HI, weight: 700, ls: 1, prop: "progressLabel" });
rectShape({ name: "Locale chip", x: 1185, y: 36, w: 100, h: 26, fill: "14101820", stroke: "40E9F4FA", sw: 1, cr: 3 });
textEl({ name: "Locale", x: 1135, y: 43, w: 100, align: "center", fs: 10, color: TEXT_MID, ls: 2, prop: "localeLabel" });

// ---------- window deco ----------
textEl({ name: "Cam tag", x: 48, y: 66, fs: 9.5, color: TEXT_DIM, ls: 2, str: "CAM·02 // CONTENT" });
textEl({ name: "Win dims", x: 680, y: 66, w: 120, align: "right", fs: 9.5, color: TEXT_FAINT, ls: 1.5, str: "760×660" });
brackets("Window brackets", WIN.x, WIN.y, WIN.x1, WIN.y1, 26, AMBER, 2);
brackets("Panel brackets", 8, 8, 1272, 792, 40, "B3FFC168", 2.5);

// ---------- spine / micro labels ----------
push(`    <Text name="Spine L" x="16" y="410" rotation="-90"><TextStylePaint id="${id()}" fontSize="10" letterSpacing="3" fontAssetId="0:30" familyName="Space Grotesk" styleName="SemiBold"><TextStyleAxis tag="2003265652" axisValue="600" name="Weight" /><Fill><SolidColor colorValue="${TEXT_FAINT}" /></Fill></TextStylePaint><TextValueRun text="MOYO // LEARN" /></Text>`);
push(`    <Text name="Spine R" x="1264" y="390" rotation="90"><TextStylePaint id="${id()}" fontSize="10" letterSpacing="3" fontAssetId="0:30" familyName="Space Grotesk" styleName="SemiBold"><TextStyleAxis tag="2003265652" axisValue="600" name="Weight" /><Fill><SolidColor colorValue="${TEXT_FAINT}" /></Fill></TextStylePaint><TextValueRun text="QUESTION" /></Text>`);

// ---------- bands (unbound, near-opaque) ----------
push(`    <Shape name="Footer band"><PointsPath isClosed="true"><StraightVertex x="0" y="${FOOT}" /><StraightVertex x="${W}" y="${FOOT}" /><StraightVertex x="${W}" y="780" /><StraightVertex x="1260" y="800" /><StraightVertex x="20" y="800" /><StraightVertex x="0" y="780" /></PointsPath><Fill><SolidColor colorValue="${BAND}" /></Fill></Shape>`);
push(`    <Shape name="Header band"><PointsPath isClosed="true"><StraightVertex x="20" y="0" /><StraightVertex x="1260" y="0" /><StraightVertex x="1280" y="20" /><StraightVertex x="1280" y="64" /><StraightVertex x="0" y="64" /><StraightVertex x="0" y="20" /></PointsPath><Fill><SolidColor colorValue="${BAND}" /></Fill></Shape>`);
rectShape({ name: "Header rule", x: 640, y: 64, w: 1280, h: 1, fill: HAIR });

// ---------- panel edge + face ----------
push(`    <Shape name="Panel edge">`);
octPath(W, H, CHAM, "      ");
push(`      <Stroke thickness="1" cap="round" join="round"><SolidColor colorValue="${EDGE}" /></Stroke>`);
push(`    </Shape>`);
push(`    <Shape name="Panel face">`);
push(`      ${bind("uiOpacity", 18)}`);
octPath(W, H, CHAM, "      ");
push(`      <Rectangle x="420" y="410" width="760" height="660" />`);
push(`      <Fill fillRule="evenOdd"><SolidColor colorValue="${FACE}" /></Fill>`);
push(`    </Shape>`);

// ================= ANIMATIONS =================
// pose helper: keyed object -> [{key, frames:[[f,v],..], interp}]
function keyed(objId, key, frames, interp = "cubic") {
  const inAttr = interp === "linear" ? ` interpolationType="linear"` : interp === "cubic" ? ` interpolationType="cubic"` : "";
  let s = `      <KeyedObject objectId="${objId}"><KeyedProperty propertyKey="${key}">`;
  for (const [f, v] of frames) s += `<KeyFrameDouble frame="${f}" value="${v}"${inAttr} />`;
  return s + `</KeyedProperty></KeyedObject>`;
}
const OP = 18, ROT = 15, XX = 13, SC = 16;

// standard visibility pose shared by all states
function pose(o = {}) {
  const { loader = 0, orbital = 1, triad = 0, skel = 0, fb = 0, accC = 0, accI = 0, accU = 0, err = 0, chOp = 1, chX = 0, rows = 1 } = o;
  const lines = [
    keyed(ID.loader, OP, [[0, loader]]),
    keyed(ID.orbital, OP, [[0, orbital]]),
    keyed(ID.triad, OP, [[0, triad]]),
    keyed(ID.skeleton, OP, [[0, skel]]),
    keyed(ID.feedback, OP, [[0, fb]]),
    keyed(ID.accC, OP, [[0, accC]]),
    keyed(ID.accI, OP, [[0, accI]]),
    keyed(ID.accU, OP, [[0, accU]]),
    keyed(ID.errChip, OP, [[0, err]]),
    keyed(ID.choices, OP, [[0, chOp]]),
    keyed(ID.choices, XX, [[0, chX]]),
  ];
  for (let i = 0; i < 6; i++) {
    lines.push(keyed(rowId[i], OP, [[0, rows]]));
    lines.push(keyed(rowId[i], XX, [[0, 0]]));
  }
  return lines.join("\n");
}

function anim(name, duration, loop, body) {
  push(`    <LinearAnimation id="${animId[name]}" name="${name}" duration="${duration}" fps="60"${loop ? ` loopValue="${loop}"` : ""}>`);
  push(body);
  push(`    </LinearAnimation>`);
}

// EntranceLoading: orbital spins, pulse breathes, skeleton + hidden choices
anim("EntranceLoading", 120, "loop", [
  pose({ loader: 1, skel: 1, chOp: 0, rows: 0 }),
  keyed(ID.ringA, ROT, [[0, 0], [120, 360]], "linear"),
  keyed(ID.ringB, ROT, [[0, 0], [120, -540]], "linear"),
  keyed(ID.pulse, SC, [[0, 1], [30, 1.25], [60, 1], [90, 1.25], [120, 1]]),
  keyed(ID.pulse, OP, [[0, 0.55], [30, 1], [60, 0.55], [90, 1], [120, 0.55]]),
].join("\n"));

// RM entrance: static arc pose, no rotation
anim("EntranceLoadingRM", 9, "", [
  pose({ loader: 1, skel: 1, chOp: 0, rows: 0 }),
  keyed(ID.ringA, ROT, [[0, 40]]),
  keyed(ID.ringB, ROT, [[0, -80]]),
].join("\n"));

// Entering: staggered row slide-in
{
  const lines = [pose({ loader: 0, skel: 0, chOp: 1 })];
  for (let i = 0; i < 6; i++) {
    lines.push(keyed(rowId[i], OP, [[i * 4, 0], [i * 4 + 18, 1]]));
    lines.push(keyed(rowId[i], XX, [[i * 4, 16], [i * 4 + 18, 0]]));
  }
  anim("Entering", 44, "", lines.join("\n"));
  const rm = [pose({ chOp: 1 })];
  for (let i = 0; i < 6; i++) rm.push(keyed(rowId[i], OP, [[0, 0], [9, 1]]));
  anim("EnteringRM", 9, "", rm.join("\n"));
}
anim("Idle", 1, "", pose());
anim("Selecting", 1, "", pose());
// Submitting: ring contracts (orbital fades/scales down), triad rotates
anim("Submitting", 72, "loop", [
  pose({ loader: 1, orbital: 0.15, triad: 1 }),
  keyed(ID.orbital, SC, [[0, 0.6], [72, 0.6]], "linear"),
  keyed(ID.triad, ROT, [[0, 0], [72, 360]], "linear"),
].join("\n"));
anim("SubmittingRM", 9, "", [
  pose({ loader: 1, orbital: 0.15, triad: 1 }),
].join("\n"));
// feedback states: accent pulses once then holds
for (const [n, acc] of [["FeedbackCorrect", "accC"], ["FeedbackIncorrect", "accI"], ["FeedbackUngraded", "accU"]]) {
  anim(n, 20, "", [
    pose({ fb: 1, [acc]: 1 }),
    keyed(ID.feedback, OP, [[0, 0], [8, 1]]),
    keyed(ID[acc], OP, [[0, 0], [6, 1], [12, 0.5], [18, 1]]),
  ].join("\n"));
}
// Exiting: content slides subtly left + fades
anim("Exiting", 22, "", [
  pose({ chOp: 0, chX: -16 }),
  keyed(ID.choices, OP, [[0, 1], [22, 0]]),
  keyed(ID.choices, XX, [[0, 0], [22, -16]]),
].join("\n"));
anim("ExitingRM", 9, "", [
  pose({ chOp: 0 }),
  keyed(ID.choices, OP, [[0, 1], [9, 0]]),
].join("\n"));
// LoadingNext: same ring, shorter resolve sweep
anim("LoadingNext", 60, "loop", [
  pose({ loader: 1, skel: 1, chOp: 0, rows: 0 }),
  keyed(ID.ringA, ROT, [[0, 0], [60, 360]], "linear"),
  keyed(ID.ringB, ROT, [[0, 0], [60, -180]], "linear"),
  keyed(ID.pulse, OP, [[0, 1], [30, 0.5], [60, 1]]),
].join("\n"));
anim("LoadingNextRM", 9, "", [
  pose({ loader: 1, skel: 1, chOp: 0, rows: 0 }),
  keyed(ID.ringA, ROT, [[0, 120]]),
].join("\n"));
// EnteringNext: same stagger as Entering
{
  const lines = [pose({ chOp: 1 })];
  for (let i = 0; i < 6; i++) {
    lines.push(keyed(rowId[i], OP, [[i * 4, 0], [i * 4 + 18, 1]]));
    lines.push(keyed(rowId[i], XX, [[i * 4, 16], [i * 4 + 18, 0]]));
  }
  anim("EnteringNext", 44, "", lines.join("\n"));
  const rm = [pose({ chOp: 1 })];
  for (let i = 0; i < 6; i++) rm.push(keyed(rowId[i], OP, [[0, 0], [9, 1]]));
  anim("EnteringNextRM", 9, "", rm.join("\n"));
}
anim("Error", 16, "", [
  pose({ err: 1 }),
  keyed(ID.errChip, OP, [[0, 0], [10, 1]]),
].join("\n"));

// FX animations: one pose anim per fx state
for (const s of FX_STATES) {
  const targets = [];
  if (s.v >= 1 && s.v <= 6) targets.push(keyed(hovIds[s.v - 1], OP, [[0, 1]]));
  else if (s.v >= 7 && s.v <= 13) targets.push(keyed(btnHov[s.v - 7], OP, [[0, 1]]));
  else if (s.v >= 101 && s.v <= 106) targets.push(keyed(downIds[s.v - 101], OP, [[0, 1]]));
  else if (s.v >= 107 && s.v <= 113) targets.push(keyed(btnDown[s.v - 107], OP, [[0, 1]]));
  push(`    <LinearAnimation id="${fxAnimId[s.k]}" name="${s.k}" duration="1" fps="60">`);
  if (targets.length) push(targets.join("\n"));
  push(`    </LinearAnimation>`);
}

// ================= STATE MACHINE =================
push(`    <StateMachine name="QuestionFlow" id="0:7">`);
push(`      <StateMachineNumber id="${FX}" name="fx" />`);
push(`      <StateMachineLayer name="Flow">`);
push(`        <EntryState x="0" y="0"><StateTransition stateToId="${stateId.EntranceLoading}" /></EntryState>`);
// AnyState: for each phase, RM transition first then normal
push(`        <AnyState x="0" y="-140">`);
const phaseDur = { 0: 150, 1: 300, 2: 200, 3: 200, 4: 200, 5: 220, 6: 220, 7: 220, 8: 380, 9: 150, 10: 300, 11: 200 };
const targetFor = (n, rm) => (rm && RM_STATES.has(n) ? n + "RM" : n);
for (let ph = 0; ph <= 11; ph++) {
  const n = STATE_NAMES[ph];
  for (const rm of [true, false]) {
    const dur = rm ? 150 : phaseDur[ph];
    push(`          <StateTransition stateToId="${stateId[targetFor(n, rm)]}" duration="${dur}">`);
    push(`            <TransitionViewModelCondition opValue="equal"><TransitionPropertyViewModelComparator><BindablePropertyNumber><DataBindContext sourcePathIds="${VM}-${P.phase.id}" propertyKey="636" /></BindablePropertyNumber></TransitionPropertyViewModelComparator><TransitionValueNumberComparator value="${ph}" /></TransitionViewModelCondition>`);
    if (rm) {
      push(`            <TransitionViewModelCondition opValue="equal"><TransitionPropertyViewModelComparator><BindablePropertyBoolean><DataBindContext sourcePathIds="${VM}-${P.reducedMotion.id}" propertyKey="634" /></BindablePropertyBoolean></TransitionPropertyViewModelComparator><TransitionValueBooleanComparator value="true" /></TransitionViewModelCondition>`);
    }
    push(`          </StateTransition>`);
  }
}
push(`        </AnyState>`);
push(`        <ExitState x="0" y="140" />`);
{
  const all = [...STATE_NAMES, ...[...RM_STATES].map((s) => s + "RM")];
  all.forEach((n, i) => {
    push(`        <AnimationState id="${stateId[n]}" animationId="${animId[n]}" x="${(i % 6) * 220 + 100}" y="${Math.floor(i / 6) * 140 + 160}" />`);
  });
}
// listeners: choices
for (let i = 0; i < 6; i++) {
  const fxIdx = i + 1;
  lpush(`        <StateMachineListenerSingle targetId="${hitIds[i]}" listenerTypeValue="down" name="down choice${i}">`);
  lpush(`          <ListenerViewModelChange><BindablePropertyNumber propertyValue="${i}"><DataBindContext sourcePathIds="${VM}-${P.commandArg.id}" propertyKey="636" direction="true" /></BindablePropertyNumber></ListenerViewModelChange>`);
  lpush(`          <ListenerViewModelChange><BindablePropertyNumber propertyValue="2"><DataBindContext sourcePathIds="${VM}-${P.command.id}" propertyKey="636" direction="true" /></BindablePropertyNumber></ListenerViewModelChange>`);
  const db = id();
  lpush(`          <ListenerViewModelChange fromViewModelProperty="true" fromDataBindId="${db}"><BindablePropertyNumber><DataBindContext sourcePathIds="${VM}-${P.commandSeq.id}" propertyKey="636" id="${db}" converterId="0:60" /><DataBindContext sourcePathIds="${VM}-${P.commandSeq.id}" propertyKey="636" direction="true" /></BindablePropertyNumber></ListenerViewModelChange>`);
  lpush(`          <ListenerNumberChange inputId="${FX}" value="${100 + fxIdx}" />`);
  lpush(`        </StateMachineListenerSingle>`);
  lpush(`        <StateMachineListenerSingle targetId="${hitIds[i]}" listenerTypeValue="up" name="up choice${i}"><ListenerNumberChange inputId="${FX}" value="${fxIdx}" /></StateMachineListenerSingle>`);
  lpush(`        <StateMachineListenerSingle targetId="${hitIds[i]}" listenerTypeValue="enter" name="enter choice${i}"><ListenerNumberChange inputId="${FX}" value="${fxIdx}" /></StateMachineListenerSingle>`);
  lpush(`        <StateMachineListenerSingle targetId="${hitIds[i]}" listenerTypeValue="exit" name="exit choice${i}"><ListenerNumberChange inputId="${FX}" value="0" /></StateMachineListenerSingle>`);
}
// listeners: footer buttons
for (let i = 0; i < BTNS.length; i++) {
  const b = BTNS[i], fxIdx = i + 7;
  lpush(`        <StateMachineListenerSingle targetId="${btnHit[i]}" listenerTypeValue="down" name="down btn ${b.name}">`);
  lpush(`          <ListenerViewModelChange><BindablePropertyNumber propertyValue="${b.cmd}"><DataBindContext sourcePathIds="${VM}-${P.command.id}" propertyKey="636" direction="true" /></BindablePropertyNumber></ListenerViewModelChange>`);
  const db = id();
  lpush(`          <ListenerViewModelChange fromViewModelProperty="true" fromDataBindId="${db}"><BindablePropertyNumber><DataBindContext sourcePathIds="${VM}-${P.commandSeq.id}" propertyKey="636" id="${db}" converterId="0:60" /><DataBindContext sourcePathIds="${VM}-${P.commandSeq.id}" propertyKey="636" direction="true" /></BindablePropertyNumber></ListenerViewModelChange>`);
  lpush(`          <ListenerNumberChange inputId="${FX}" value="${100 + fxIdx}" />`);
  lpush(`        </StateMachineListenerSingle>`);
  lpush(`        <StateMachineListenerSingle targetId="${btnHit[i]}" listenerTypeValue="up" name="up btn ${b.name}"><ListenerNumberChange inputId="${FX}" value="${fxIdx}" /></StateMachineListenerSingle>`);
  lpush(`        <StateMachineListenerSingle targetId="${btnHit[i]}" listenerTypeValue="enter" name="enter btn ${b.name}"><ListenerNumberChange inputId="${FX}" value="${fxIdx}" /></StateMachineListenerSingle>`);
  lpush(`        <StateMachineListenerSingle targetId="${btnHit[i]}" listenerTypeValue="exit" name="exit btn ${b.name}"><ListenerNumberChange inputId="${FX}" value="0" /></StateMachineListenerSingle>`);
}
push(`      </StateMachineLayer>`);
// FX layer
push(`      <StateMachineLayer name="FX">`);
push(`        <EntryState x="0" y="0"><StateTransition stateToId="${fxStateId.fxIdle}" /></EntryState>`);
push(`        <AnyState x="0" y="-140">`);
for (const s of FX_STATES) {
  push(`          <StateTransition stateToId="${fxStateId[s.k]}" duration="90"><TransitionNumberCondition inputId="${FX}" opValue="equal" value="${s.v}" /></StateTransition>`);
}
push(`        </AnyState>`);
push(`        <ExitState x="0" y="140" />`);
FX_STATES.forEach((s, i) => {
  push(`        <AnimationState id="${fxStateId[s.k]}" animationId="${fxAnimId[s.k]}" x="${(i % 9) * 160 + 60}" y="${Math.floor(i / 9) * 120 + 160}" />`);
})
push(`      </StateMachineLayer>`);
for (const l of LISTENERS) push(l);
push(`    </StateMachine>`);
push(`  </Artboard>`);

// ================= ROOTS =================
push(`  <FontAsset id="0:30" file="SpaceGrotesk-Variable.ttf" name="Space Grotesk" />`);
push(`  <DataConverterOperationValue id="0:60" name="Next seq" operationType="0" operationValue="1" />`);
push(`  <DataConverterToString id="0:61" name="To string" />`);
push(`  <DataConverterBooleanNegate id="0:62" name="Not" />`);
push(`  <DataConverterToNumber id="0:63" name="Bool to number" />`);
push(`  <DataConverterGroup id="0:64" name="Not to number"><DataConverterGroupItem converterId="0:62" /><DataConverterGroupItem converterId="0:63" /></DataConverterGroup>`);
push(`  <ViewModel name="Question" id="${VM}" defaultInstanceId="0:41">`);
for (const name of Object.keys(P)) {
  const p = P[name];
  push(`    <ViewModelProperty${p.kind} name="${name}" id="${p.id}" />`);
}
push(`    <ViewModelInstance id="0:41" name="Default" exports="true">`);
const defaults = {
  questionId: "q-frac-01", subjectLabel: "MATH", skillLabel: "FRACTIONS · VISUAL MODELS",
  progressLabel: "Q 03 / 10", localeLabel: "EN·US", prompt: "…", supportingText: "",
  interactionLabel: "SELECT ONE ANSWER",
  choice0Label: "1/2", choice1Label: "1/3", choice2Label: "2/4", choice3Label: "1/6",
  choice4Label: "", choice5Label: "", answerText: "", hintLabel: "HINT",
  hintText: "Compare the pieces, not the numbers.", submitLabel: "SUBMIT",
  continueLabel: "NEXT", skipLabel: "SKIP", listenLabel: "LISTEN",
  feedbackTitle: "", feedbackBody: "", status: "READY",
  interactionKind: 0, choiceCount: 4, questionNumber: 3, questionTotal: 10,
  command: 0, commandArg: 0, commandSeq: 0, revision: 0, uiOpacity: 1, phase: 0, errorCode: 0,
  choice0Visible: true, choice1Visible: true, choice2Visible: true, choice3Visible: true,
  choice4Visible: false, choice5Visible: false,
  choice0Selected: false, choice1Selected: false, choice2Selected: false,
  choice3Selected: false, choice4Selected: false, choice5Selected: false,
  answerValid: false, hintAvailable: true, hintVisible: false, loading: false,
  submitting: false, answered: false, correct: false, incorrect: false, ungraded: false,
  disabled: false, grabbed: false, reducedMotion: false,
};
for (const name of Object.keys(P)) {
  const p = P[name];
  const v = defaults[name];
  const lit = p.kind === "String" ? `"${esc(String(v))}"` : p.kind === "Number" ? `${v}` : `${v}`;
  push(`      <ViewModelInstance${p.kind} viewModelPropertyId="${p.id}" propertyValue=${JSON.stringify(String(v))} />`);
}
push(`    </ViewModelInstance>`);
push(`  </ViewModel>`);
push(`</Rive>`);

console.log(A.join("\n"));
