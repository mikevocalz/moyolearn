import { useEffect } from 'react';
import { useStore } from 'zustand';
import { AppState } from 'react-native';
import { Text } from '@acme/ui';
import { View } from '@acme/ui/primitives';
import type { MuseMotionController } from './muse-motion';

export function MuseMotionStatus({controller}:{controller:MuseMotionController}) {
  const state=useStore(controller.state,(s)=>s);
  useEffect(()=>{const timer=setInterval(controller.tick,250);return()=>{clearInterval(timer);controller.disarm();};},[controller]);
  useEffect(()=>{const listener=AppState.addEventListener('change',(next)=>{if(next!=='active')controller.disarm();});return()=>listener.remove();},[controller]);
  return <Text variant="caption" numberOfLines={1} testID="muse-motion-status">Tilt cursor · {state.phase==='live'?'LIVE':state.phase==='unavailable'?'CAPTURE ENDED':state.phase.toUpperCase()} · {state.reason} · samples {state.samples} · down/move/up/cancel {state.pointerDown}/{state.pointerMove}/{state.pointerUp}/{state.pointerCancel}</Text>;
}
export function MuseMotionCursor({controller,width,height}:{controller:MuseMotionController;width:number;height:number}) {
  const cursor=useStore(controller.state,(s)=>s.cursor),enabled=useStore(controller.state,(s)=>s.enabled),drawing=useStore(controller.state,(s)=>s.drawing),phase=useStore(controller.state,(s)=>s.phase);
  if(!enabled||!cursor||phase!=='live')return null;
  // LearningCanvas is the first Whiteboard child, with border-2 and no padding.
  // The calibrated client size excludes that border and excludes the toolbar.
  return <View pointerEvents="none" style={{position:'absolute',left:2,top:2,width,height,overflow:'hidden'}}>
    <View testID="muse-motion-cursor" style={{position:'absolute',left:cursor.u*width-6,top:cursor.v*height-6,width:12,height:12,borderRadius:6,borderWidth:2,borderColor:drawing?'#e04b3f':'#276bd8',backgroundColor:'white'}} />
  </View>;
}
