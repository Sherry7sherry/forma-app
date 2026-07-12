export type TestFlow='assessment'|'session'
export interface TransitionState { flow:TestFlow; phase:string; ended:boolean }
export type TransitionCommand=
  |{type:'retry-phase'|'camera-unavailable'|'calibration-passed'|'start-exercising'|'complete-movement'|'continue-pending-persistence';reason:string}
  |{type:'supply-actual-repetitions';reason:string;count:number}
export type TransitionDecision={ok:true;next:TransitionState;event:{eventType:'synthetic_transition';data:{priorState:TransitionState;nextState:TransitionState;reason:string;command:TransitionCommand}}}|{ok:false;reason:string}
const LEGAL:Record<string,Record<string,string>>={
  assessment:{'setup:retry-phase':'setup','capture:retry-phase':'capture','capture:camera-unavailable':'completed','capture:complete-movement':'completed'},
  session:{'calibrating:retry-phase':'calibrating','calibrating:calibration-passed':'calibrating-ready','calibrating-ready:start-exercising':'exercising','exercising:supply-actual-repetitions':'exercising','exercising:complete-movement':'completed','persistence-failed:continue-pending-persistence':'completed'},
}
export function decideTransition(state:TransitionState,command:TransitionCommand):TransitionDecision {
  if(state.ended)return{ok:false,reason:'attempt-ended'}
  if(command.type==='supply-actual-repetitions'&&(!Number.isInteger(command.count)||command.count<0||command.count>999))return{ok:false,reason:'invalid-count'}
  const phase=LEGAL[state.flow]?.[`${state.phase}:${command.type}`]; if(!phase)return{ok:false,reason:'illegal-transition'}
  const next={...state,phase,ended:phase==='completed'}
  return{ok:true,next,event:{eventType:'synthetic_transition',data:{priorState:state,nextState:next,reason:command.reason,command}}}
}
