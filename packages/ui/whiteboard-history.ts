/** Recognizes board history shortcuts; text fields keep their editing history. */
export function whiteboardHistoryAction(event: {
  key: string; metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean;
  target?: unknown;
}): 'undo' | 'redo' | null {
  const target = event.target !== null && typeof event.target === 'object'
    ? event.target as { tagName?: unknown; isContentEditable?: unknown } : null;
  if (target?.isContentEditable === true || (typeof target?.tagName === 'string' && /^(INPUT|TEXTAREA)$/i.test(target.tagName))) return null;
  if ((!event.metaKey && !event.ctrlKey) || event.altKey) return null;
  const key = event.key.toLowerCase();
  if (key === 'z') return event.shiftKey ? 'redo' : 'undo';
  return key === 'y' && event.ctrlKey ? 'redo' : null;
}

/** Routes a managed board shortcut before the editor can add an independent undo step. */
export function handleWhiteboardHistoryKey(
  event: Parameters<typeof whiteboardHistoryAction>[0] & { preventDefault(): void; stopImmediatePropagation(): void },
  history?: { undo(): void; redo(): void },
): boolean {
  if (!history) return false;
  const action = whiteboardHistoryAction(event);
  if (action === null) return false;
  event.preventDefault();
  event.stopImmediatePropagation();
  history[action]();
  return true;
}

/** Tracks gesture boundaries only; it never routes samples or edits the document. */
export function createWhiteboardGestureHistory(
  current: () => { beginGesture?(): void; endGesture?(): void } | undefined,
  afterEvent: (callback: () => void) => void = queueMicrotask,
) {
  let active: { pointerId: number; owner: NonNullable<ReturnType<typeof current>> } | null = null;
  let pendingEnd: (() => void) | null = null;
  const finishPending = () => { const finish = pendingEnd; pendingEnd = null; finish?.(); };
  return {
    begin(event: { pointerId: number; isPrimary?: boolean; button?: number }) {
      if (active || event.isPrimary === false || (event.button !== undefined && event.button !== 0)) return;
      finishPending();
      const owner = current();
      if (!owner) return;
      active = { pointerId: event.pointerId, owner };
      owner.beginGesture?.();
    },
    end(event: { pointerId: number }) {
      if (active === null || active.pointerId !== event.pointerId) return;
      const owner = active.owner;
      active = null;
      // The editor commits/cancels synchronously in this pointer event. Finish
      // history afterward, including a final diff emitted by pointerup.
      const finish = () => owner.endGesture?.();
      pendingEnd = finish;
      afterEvent(() => { if (pendingEnd === finish) finishPending(); });
    },
    dispose() { finishPending(); active?.owner.endGesture?.(); active = null; },
  };
}

/** Installs once in the embedded page. Host toggles managed history independently of input calibration. */
export const WHITEBOARD_HISTORY_SHIM = `(function(){
if(window.__moyoHistoryInstalled)return;
window.__moyoHistoryInstalled=true;
var pointer=null,pendingEnd=0,serial=0;
var post=function(action){window.ReactNativeWebView.postMessage(JSON.stringify({type:'moyo:gesture-history',action:action}));};
document.addEventListener('pointerdown',function(e){
if(!window.__moyoHistoryManaged||pointer!==null||e.isPrimary===false||(e.button!==undefined&&e.button!==0))return;
if(pendingEnd){pendingEnd=0;post('end');}
pointer=e.pointerId;post('begin');
},true);
var end=function(e){if(pointer===null||pointer!==e.pointerId)return;pointer=null;var token=++serial;pendingEnd=token;queueMicrotask(function(){if(pendingEnd===token){pendingEnd=0;post('end');}});};
document.addEventListener('pointerup',end,true);
document.addEventListener('pointercancel',end,true);
document.addEventListener('keydown',function(e){
if(!window.__moyoHistoryManaged)return;
var t=e.target;
if(t&&(t.isContentEditable||/^(INPUT|TEXTAREA)$/i.test(t.tagName||'')))return;
if((!e.metaKey&&!e.ctrlKey)||e.altKey)return;
var k=e.key.toLowerCase(),a=k==='z'?(e.shiftKey?'redo':'undo'):(k==='y'&&e.ctrlKey?'redo':null);
if(!a)return;
e.preventDefault();e.stopImmediatePropagation();
window.ReactNativeWebView.postMessage(JSON.stringify({type:'moyo:history-action',action:a}));
},true);
})();true;`;
