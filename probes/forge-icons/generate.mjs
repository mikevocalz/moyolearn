import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getGlyph, iconStroke } from '@nitro-forge/icons';
import { parseSvgPath, riveVertex } from './svg-path.mjs';

export const SOURCE_COMMIT = '3c79e3d4c2dbd0c42d7fdccea40eb0a7162b6c48';
export const GLYPHS = ['pen', 'highlighter', 'eraser', 'undo', 'redo'];
const GLYPH_SHA256 = 'dccbeff73d794054148b2f1c71a86a3487e8ca1ea317b3472fe8ff1409cc39af';
const base = dirname(fileURLToPath(import.meta.url));
const glyphFile = fileURLToPath(import.meta.resolve('@nitro-forge/icons')).replace(/index\.js$/, 'glyphs.js');
if (createHash('sha256').update(readFileSync(glyphFile)).digest('hex') !== GLYPH_SHA256) throw new Error('Forge glyph source changed; review and pin before regenerating');
const escape = (value) => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
const number = (value) => typeof value === 'number' ? Number(value.toFixed(10)) : value;

/** Build five independent 24-unit artboards from the pinned original glyph tuples. */
export function generateScene() {
  let serial = 0;
  const id = () => `0:${++serial}`;
  const tag = (type, attributes = {}, children = '') => {
    const attrs = { ...attributes, id: attributes.id ?? id() };
    return `<${type} ${Object.entries(attrs).map(([key, value]) => `${key}="${escape(number(value))}"`).join(' ')}>${children}</${type}>`;
  };
  const vm = id(), instance = id(), selected = id(), reduced = id(), color = id(), surface = id(), opacity = id();
  const bind = (property, key) => tag('DataBindContext', { sourcePathIds: `${vm}-${property}`, propertyKey: key });
  const condition = (property, value) => tag('TransitionViewModelCondition', { opValue: 'equal' },
    tag('TransitionPropertyViewModelComparator', {}, tag('BindablePropertyBoolean', {}, bind(property, 634))) +
    tag('TransitionValueBooleanComparator', { value }));
  const paint = (mode, closed) => {
    const fill = mode === 'fill' || (mode === 'knockout' && closed);
    return tag(fill ? 'Fill' : 'Stroke', fill ? { fillRule: 'evenOdd' } : {
      thickness: iconStroke.width, cap: 'round', join: 'round',
    }, tag('SolidColor', { colorValue: mode === 'knockout' ? 'FFFFFFFF' : 'FF18202D' },
      bind(mode === 'knockout' ? surface : color, 37)));
  };
  const draw = (name, variant) => [...getGlyph(name, variant)].reverse().map(([svg, mode], index) => {
    const paths = parseSvgPath(svg);
    const geometry = paths.map((path) => tag('PointsPath', { isClosed: path.closed },
      path.vertices.map((vertex) => { const { tag: type, ...attrs } = riveVertex(vertex); return tag(type, attrs); }).join(''))).join('');
    return tag('Shape', { name: `${name}-${variant}-${index}` }, geometry + paint(mode, /[zZ]\s*$/.test(svg)));
  }).join('');
  const artboards = [], assets = [];
  for (const [index, name] of GLYPHS.entries()) {
    const artboard = id(), style = id(), machine = id(), outline = id(), filled = id();
    const idleAnimation = id(), selectedAnimation = id(), idleState = id(), selectedState = id();
    const transition = (to, value, reduce) => tag('StateTransition', { stateToId: to, duration: reduce ? 0 : 140, enableEarlyExit: true },
      (reduce ? '' : tag('CubicEaseInterpolator', { x1: 0.23, y1: 1, x2: 0.32, y2: 1 })) +
      condition(selected, value) + condition(reduced, reduce));
    const stateMachine = tag('StateMachine', { id: machine, name: 'ForgeIconStates' },
      tag('StateMachineLayer', { name: 'Selection' },
        tag('AnyState', { x: 300, y: -180 }) + tag('ExitState', { x: 600, y: -180 }) +
        tag('EntryState', { x: 0, y: 0 }, tag('StateTransition', { stateToId: idleState })) +
        tag('AnimationState', { id: idleState, x: 240, y: 0, animationId: idleAnimation },
          transition(selectedState, true, true) + transition(selectedState, true, false)) +
        tag('AnimationState', { id: selectedState, x: 500, y: 0, animationId: selectedAnimation },
          transition(idleState, false, true) + transition(idleState, false, false))));
    const animation = (animationId, label, selectedValue) => tag('LinearAnimation', { id: animationId, name: label, duration: 1, fps: 60 },
      [[outline, 1 - selectedValue], [filled, selectedValue]].map(([object, value]) =>
        tag('KeyedObject', { objectId: object }, tag('KeyedProperty', { propertyKey: 18 }, tag('KeyFrameDouble', { frame: 0, value })))).join(''));
    artboards.push(tag('Artboard', { id: artboard, name: `Forge${name[0].toUpperCase()}${name.slice(1)}`,
      x: index * 48, y: 0, width: 24, height: 24, clip: true, isComponent: true,
      styleId: style, defaultStateMachineId: machine, viewModelId: vm, viewModelInstanceId: instance },
      tag('LayoutComponentStyle', { id: style }) + tag('Node', { name: 'Presentation' }, bind(opacity, 18) +
        tag('Node', { id: filled, name: 'Filled', opacity: 0 }, draw(name, 'filled')) +
        tag('Node', { id: outline, name: 'Outline', opacity: 1 }, draw(name, 'outline'))) +
      stateMachine + animation(idleAnimation, 'Outline', 0) + animation(selectedAnimation, 'Filled', 1)));
    assets.push(tag('ComponentAsset', { artboardId: artboard, name: `Forge ${name}` }));
  }
  const model = tag('ViewModel', { id: vm, name: 'ForgeIcon', defaultInstanceId: instance },
    tag('ViewModelPropertyBoolean', { id: selected, name: 'selected' }) +
    tag('ViewModelPropertyBoolean', { id: reduced, name: 'reducedMotion' }) +
    tag('ViewModelPropertyColor', { id: color, name: 'color' }) +
    tag('ViewModelPropertyColor', { id: surface, name: 'surfaceColor' }) +
    tag('ViewModelPropertyNumber', { id: opacity, name: 'opacity' }) +
    tag('ViewModelInstance', { id: instance, name: 'Default', exports: true },
      tag('ViewModelInstanceBoolean', { viewModelPropertyId: selected, propertyValue: false }) +
      tag('ViewModelInstanceBoolean', { viewModelPropertyId: reduced, propertyValue: false }) +
      tag('ViewModelInstanceColor', { viewModelPropertyId: color, propertyValue: 'FF18202D' }) +
      tag('ViewModelInstanceColor', { viewModelPropertyId: surface, propertyValue: 'FFFFFFFF' }) +
      tag('ViewModelInstanceNumber', { viewModelPropertyId: opacity, propertyValue: 1 })));
  return `<Rive version="1" kind="fragment">\n${[...artboards, ...assets, model].join('\n')}\n</Rive>\n`.replaceAll('><', '>\n<');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) writeFileSync(join(base, 'scene.rml'), generateScene());
