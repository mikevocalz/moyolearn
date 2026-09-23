/** OOXML extraction keeps document order and marks content that needs source review.
 * No network relationships are fetched. Equations retain their original XML.
 * SOT-KEYWORDS: homework docx ooxml paragraphs tables equations source evidence
 */
import { DOMParser, XMLSerializer, onErrorStopParsing } from '@xmldom/xmldom';
import type { Node } from '@xmldom/xmldom';
import { strFromU8, unzipSync } from 'fflate';

const WORD = ['http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'http://purl.oclc.org/ooxml/wordprocessingml/main'];
const MATH = ['http://schemas.openxmlformats.org/officeDocument/2006/math', 'http://purl.oclc.org/ooxml/officeDocument/math'];
const MAX_XML_BYTES = 8 * 1024 * 1024;

function parse(xml: string) {
  // OOXML has no need for DTDs; reject them before entity processing.
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('Document declarations are unsupported');
  return new DOMParser({ onError: onErrorStopParsing }).parseFromString(xml, 'application/xml');
}
function children(node: Node): Node[] {
  return Array.from({ length: node.childNodes.length }, (_, index) => node.childNodes.item(index)).filter((item): item is Node => item !== null);
}
function word(node: Node, name: string) { return WORD.includes(node.namespaceURI ?? '') && node.localName === name; }
function math(node: Node, name: string) { return MATH.includes(node.namespaceURI ?? '') && node.localName === name; }
function mathText(node: Node, depth = 0): string {
  if (depth > 128) throw new Error('Document nesting limit exceeded');
  const nodes = children(node);
  const part = (name: string) => nodes.filter((n) => math(n, name)).map((n) => mathText(n, depth + 1)).join('');
  if (math(node, 't')) return node.textContent ?? '';
  if (math(node, 'f')) return `(${part('num')})/(${part('den')})`;
  if (math(node, 'sSup')) return `(${part('e')})^(${part('sup')})`;
  if (math(node, 'sSub')) return `(${part('e')})_(${part('sub')})`;
  if (math(node, 'sSubSup')) return `(${part('e')})_(${part('sub')})^(${part('sup')})`;
  if (math(node, 'rad')) return `root(${part('deg') || '2'}, ${part('e')})`;
  if (node.localName?.endsWith('Pr')) return '';
  if (['oMath', 'oMathPara', 'r', 'num', 'den', 'e', 'sup', 'sub', 'deg'].some((name) => math(node, name))) {
    return nodes.map((n) => mathText(n, depth + 1)).join('');
  }
  return node.nodeType === 1 ? '[Equation structure requires source review]' : '';
}

export function readDocx(bytes: Uint8Array) {
  if (bytes.length > 32 * 1024 * 1024) throw new Error('Document exceeds size limit');
  const part = (name: string) => unzipSync(bytes, { filter: (entry) => {
    if (entry.name !== name) return false;
    if (entry.originalSize > MAX_XML_BYTES) throw new Error('Document part exceeds size limit');
    return true;
  } })[name];
  let path = 'word/document.xml';
  const relationships = part('_rels/.rels');
  if (relationships) {
    const rels = parse(strFromU8(relationships)).getElementsByTagNameNS('*', 'Relationship');
    for (let index = 0; index < rels.length; index++) {
      const rel = rels.item(index);
      if (!rel?.getAttribute('Type')?.endsWith('/officeDocument')) continue;
      if (rel.getAttribute('TargetMode') === 'External') throw new Error('External document is unsupported');
      path = (rel.getAttribute('Target') ?? '').replace(/^\//, '');
      if (path.split('/').includes('..')) throw new Error('Invalid document part');
    }
  }
  const source = part(path);
  if (!source) return { text: '', reason: 'unsupported' as const, equations: [] as { text: string; sourceXml: string }[] };
  const root = parse(strFromU8(source)).documentElement;
  if (!root || !word(root, 'document')) throw new Error('Not a Word document');
  const equations: { text: string; sourceXml: string }[] = [];
  const serialize = new XMLSerializer();
  function render(node: Node, depth = 0): string {
    if (depth > 128) throw new Error('Document nesting limit exceeded');
    if (word(node, 't')) return node.textContent ?? '';
    if (math(node, 'oMath') || math(node, 'oMathPara')) {
      const text = mathText(node);
      equations.push({ text, sourceXml: serialize.serializeToString(node) });
      return text;
    }
    if (word(node, 'tab')) return '\t';
    if (word(node, 'br') || word(node, 'cr')) return '\n';
    if (word(node, 'drawing') || word(node, 'pict') || word(node, 'object') || word(node, 'altChunk')) return '[Embedded content requires source review]';
    if (word(node, 'del')) return '[Tracked deletion requires source review]';
    if (word(node, 'sym') || word(node, 'footnoteReference') || word(node, 'endnoteReference')) return '[Referenced content requires source review]';
    if (word(node, 'instrText') || word(node, 'fldSimple')) return '[Document field requires source review]';
    if (word(node, 'pPr')) {
      return children(node).some((n) => word(n, 'numPr')) ? '[List numbering requires source review] ' : '';
    }
    if (node.localName?.endsWith('Pr')) return '';
    const content = children(node).map((n) => render(n, depth + 1)).join('');
    if (word(node, 'ins')) return '[Tracked insertion requires source review: ' + content + ']';
    if (word(node, 'tc')) return content.replace(/\n$/, '') + '\t';
    if (word(node, 'tr')) return content.replace(/\t$/, '') + '\n';
    if (word(node, 'p')) return content + '\n';
    return content;
  }
  const text = render(root).replace(/\n$/, '');
  return { text, reason: text.trim() ? 'ok' as const : 'empty' as const, equations };
}
