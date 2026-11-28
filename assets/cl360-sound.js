/* Short original two-tone chime; audio is unlocked only by a real user action. */
(function(root){
"use strict";
let context=null,enabled=false,actor=null,baseline=null;
function play(){
 if(!context||context.state!=="running")return false;
 const now=context.currentTime;
 for(const [offset,frequency] of [[0,880],[.15,1174.66]]){
  const oscillator=context.createOscillator(),gain=context.createGain(),t=now+offset;
  oscillator.type="sine";oscillator.frequency.value=frequency;
  gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(.16,t+.018);gain.gain.exponentialRampToValueAtTime(.001,t+.17);
  oscillator.connect(gain);gain.connect(context.destination);oscillator.start(t);oscillator.stop(t+.18);
 }
 return true;
}
async function test(){
 const Audio=root.AudioContext||root.webkitAudioContext;
 if(!Audio)throw Error("Audio no compatible");
 if(!context||context.state==="closed")context=new Audio();
 await context.resume();
 if(!play())throw Error("El navegador bloqueó el audio");
 enabled=true;return true;
}
function observe(rows,user){
 if(!user)return;
 if(actor!==user){actor=user;baseline=null;enabled=false;}
 const next=new Map(rows.filter(x=>x.last_incoming_id).map(x=>[x.id,x.last_incoming_id]));
 const fresh=baseline!==null&&rows.some(x=>x.last_incoming_id&&baseline.get(x.id)!==x.last_incoming_id&&!["closed","archived"].includes(x.status)&&(!x.assigned_user_id||x.assigned_user_id===user));
 baseline=next;
 if(fresh&&enabled&&root.document.visibilityState==="visible")play();
}
function reset(){actor=null;baseline=null;enabled=false;}
root.CL360Sound={test,observe,reset};
})(window);
