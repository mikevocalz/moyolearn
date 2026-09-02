// TS resolution anchor — bundlers load the .native/.web forks.
//
// MUST be .tsx, matching the forks' extension. Metro resolves in the order
// .android.ts | .native.ts | .ts | .android.tsx | .native.tsx | .tsx — so a
// `.ts` anchor beside `.tsx` forks wins on native and silently ships the WEB
// build (pointer events, no gesture) to the device.
//
// The forks skip the reference gate, so the board's citation lives on this
// anchor — both forks draw the same board over the same store.
// Mobbin: mobbin.com/screens/f5036961-b128-458f-a143-ac2f6abc8d0d (HoneyBook — pipeline as equal-width stage columns, cards dragged between lanes as the one state mutation) ·
// mobbin.com/screens/bf398cdb-a689-4cad-95b1-3e4f919f7ae6 (Trello — board and table are two views over one dataset; the board never owns state the table can't see) ·
// mobbin.com/screens/69990ffa-9153-4bf1-bb53-87317f9e040f (Plane — inline card creation happens inside the lane, not in a detached modal, keeping the board the single editing surface). Structure only.
export { StageBoard } from './StageBoard.web';
