import { createStore } from 'zustand/vanilla';
import { createMuseTelemetryController, decodeMuseControls } from './muse-telemetry.ts';
import { createTiltReference, projectGravityTilt, type TiltAcceleration, type TiltReference } from './muse-tilt.ts';

export interface MotionPointer {phase:'begin'|'move'|'end'|'cancel';x:number;y:number;pressure?:number}
export interface MotionSurface {identity:object;width:number;height:number;injectPointer(sample:MotionPointer):void}
interface MotionState {
  enabled:boolean;phase:'off'|'armed'|'live'|'unavailable';reason:string;
  cursor:{u:number;v:number}|null;drawing:boolean;needsTipRelease:boolean;
  samples:number;cursorChanges:number;pointerDown:number;pointerMove:number;pointerUp:number;pointerCancel:number;
}

/** Measured first acceleration group only; no translation/yaw/pose integration. */
export function readMuseAcceleration(hex:string):TiltAcceleration|null {
  if (!/^[0-9a-f]{130}$/i.test(hex)) return null;
  const signed=(offset:number)=>{
    const lo=Number.parseInt(hex.slice(offset*2,offset*2+2),16),hi=Number.parseInt(hex.slice(offset*2+2,offset*2+4),16);
    const raw=lo|(hi<<8);return raw>=32768?raw-65536:raw;
  };
  return [signed(5),signed(7),signed(9)];
}

/** DEV gravity-tilt cursor driving the existing engine's real pointer seam. */
export function createMuseMotionController(getSurface:()=>MotionSurface|null, now:()=>number=Date.now) {
  const state=createStore<MotionState>(()=>({enabled:false,phase:'off',reason:'Tilt cursor off',cursor:null,drawing:false,needsTipRelease:true,samples:0,cursorChanges:0,pointerDown:0,pointerMove:0,pointerUp:0,pointerCancel:0}));
  // Reuse the finite source/nonce/time validator rather than introducing a weaker input path.
  const gate=createMuseTelemetryController(now);
  let sessionId:string|null=null,reference:TiltReference|null=null,lastAcceleration:TiltAcceleration|null=null;
  let lastRound=false,lastMeasuredAt=0,lastGaps=0,lastSequence=-1,active:MotionSurface|null=null;
  const send=(phase:MotionPointer['phase'],surface:MotionSurface,cursor:{u:number;v:number},pressure?:number)=>{
    surface.injectPointer({phase,x:cursor.u*surface.width,y:cursor.v*surface.height,...(pressure===undefined?{}:{pressure})});
    const key=phase==='begin'?'pointerDown':phase==='move'?'pointerMove':phase==='end'?'pointerUp':'pointerCancel';
    state.setState({[key]:state.getState()[key]+1});
  };
  const cancel=()=>{
    const cursor=state.getState().cursor;
    if(active&&cursor) {try{send('cancel',active,cursor);}finally{active=null;state.setState({drawing:false,needsTipRelease:true});}}
  };
  const stop=(reason:string)=>{
    try{cancel();}catch{/* The prior engine may already have been destroyed. */}
    gate.stop();state.setState({phase:state.getState().enabled?'unavailable':'off',reason,drawing:false,needsTipRelease:true});
  };
  const recenter=()=>{
    if(!lastAcceleration||now()-lastMeasuredAt>3000)return false;
    const next=createTiltReference(lastAcceleration);if(!next)return false;
    cancel();reference=next;state.setState({cursor:{u:0.5,v:0.5},needsTipRelease:true,reason:'Recentered; release tip before drawing'});return true;
  };
  return {
    kind:'muse-motion-controller' as const,state,
    canStart(){return state.getState().enabled&&getSurface()!==null&&state.getState().phase!=='live';},
    arm(){if(state.getState().phase==='live'||!getSurface())return false;state.setState({enabled:true,phase:'armed',reason:'Gravity tilt mode; waiting for fresh capture',needsTipRelease:true});return true;},
    disarm(){stop('Tilt cursor off');state.setState({enabled:false,phase:'off'});},
    recenter,
    startSession(input:unknown){
      if(!state.getState().enabled||!getSurface()||!gate.startSession(input))return false;
      sessionId=gate.state.getState().sessionId;reference=null;lastAcceleration=null;lastRound=false;lastGaps=0;lastSequence=-1;
      state.setState({phase:'live',reason:'Hold still to center, then release tip',cursor:null,drawing:false,needsTipRelease:true,samples:0,cursorChanges:0,pointerDown:0,pointerMove:0,pointerUp:0,pointerCancel:0});return true;
    },
    ingestCapture(input:unknown){
      if(!state.getState().enabled||!gate.ingestCapture(input)) {if(gate.state.getState().phase==='unavailable')stop('Capture unavailable; last cursor retained');return false;}
      const samples=(input as {samples:readonly {sequence:number;rawHex:string;wallTimeMs:number}[]}).samples;
      try {
        const gaps=gate.state.getState().missingSequences;
        if(gaps>lastGaps){cancel();state.setState({needsTipRelease:true,reason:'Input gap; release tip before drawing'});}lastGaps=gaps;
        for(const sample of samples){
          if(sample.sequence>lastSequence+1){cancel();state.setState({needsTipRelease:true,reason:'Input gap; release tip before drawing'});}lastSequence=sample.sequence;
          const surface=getSurface(),acceleration=readMuseAcceleration(sample.rawHex),controls=decodeMuseControls(sample.rawHex);
          state.setState({samples:state.getState().samples+1});
          if(!surface||!acceleration||!controls){stop('Board surface unavailable');return false;}
          if(active&&(active.identity!==surface.identity||active.width!==surface.width||active.height!==surface.height)){stop('Board surface changed; enable again');return false;}
          lastAcceleration=acceleration;lastMeasuredAt=sample.wallTimeMs;
          if(!reference)reference=createTiltReference(acceleration);
          if(controls.roundHeld&&!lastRound)recenter();lastRound=controls.roundHeld;
          const cursor=reference?projectGravityTilt(reference,acceleration):null;
          if(!cursor){cancel();state.setState({reason:'Motion rejected; hold still and release tip',needsTipRelease:true});continue;}
          const before=state.getState().cursor;
          state.setState({cursor,cursorChanges:state.getState().cursorChanges+(!before||before.u!==cursor.u||before.v!==cursor.v?1:0)});
          if(state.getState().needsTipRelease){if(controls.tip===0)state.setState({needsTipRelease:false,reason:'Tilt to aim; tip draws; round recenters'});continue;}
          const pressure=controls.tipForce/100; // Measured declared logical range, not calibrated newtons.
          if(controls.tip>0){
            if(!active){active=surface;send('begin',surface,cursor,pressure);state.setState({drawing:true});}
            else send('move',active,cursor,pressure);
          }else if(active){send('end',active,cursor,pressure);active=null;state.setState({drawing:false});}
        }
        if(gate.state.getState().phase==='completed')stop('Capture completed; last cursor retained');
        return true;
      } catch {stop('Board input interrupted');return false;}
    },
    finishSession(id:string){if(id!==sessionId)return false;gate.finishSession(id);stop('Capture completed; last cursor retained');return true;},
    tick(){gate.tick();if(gate.state.getState().phase==='unavailable'&&state.getState().phase==='live')stop('Capture expired or stale; last cursor retained');},
    stop,
  };
}
export type MuseMotionController=ReturnType<typeof createMuseMotionController>;
