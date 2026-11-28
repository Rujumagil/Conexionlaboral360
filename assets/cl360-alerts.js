/* Local recruiting alerts. No candidate data or message content in OS notifications. */
(function(root){
"use strict";
const labels={calls:"Solicitudes de llamada por revisar",handoff:"Atención humana solicitada o sugerida",review:"Expedientes con datos por revisar",interviews:"Entrevistas próximas",overdue:"Seguimientos vencidos"};
function collect(contacts,tasks,actor,now=Date.now()){
 const events=[];
 const own=id=>!id||id===actor;
 const restricted=new Set(contacts.filter(x=>x.intake?.declined).map(x=>x.candidate_id).filter(Boolean));
 for(const x of contacts){
  if(!own(x.assigned_user_id)||["closed","archived"].includes(x.status)||!x.intake||x.intake.declined)continue;
  const key=x.id;
  if(x.intake.call_requested)events.push({type:"calls",key:"call:"+key,id:key});
  else if(x.andy?.human_requested||x.andy?.handoff_sent)events.push({type:"handoff",key:"handoff:"+key,id:key});
  else if(!x.candidate_id&&(x.intake.available_count>=3||x.intake.needs_review))events.push({type:"review",key:"review:"+key,id:key});
 }
 for(const f of tasks){
  if(f.status!=="pending"||!own(f.assigned_user_id)||restricted.has(f.candidate_id))continue;
  const due=Date.parse(f.due_at);if(!Number.isFinite(due))continue;
  if(due<now)events.push({type:"overdue",key:"overdue:"+f.id+":"+f.due_at,id:f.id});
  else if(due-now<=86400000&&/\bentrevista(s)?\b/i.test(f.title||""))events.push({type:"interviews",key:"interview:"+f.id+":"+f.due_at,id:f.id});
 }
 return events;
}
const memory=new Map(),inFlight=new Set();
const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value))),x=>x.toString(16).padStart(2,"0")).join("");
async function notify(actor,events,valid,scope){
 if(!actor||!events.length||!valid()||!root.Notification||root.Notification.permission!=="granted"||!root.crypto?.subtle||inFlight.has(actor))return;
 inFlight.add(actor);
 try{
 const run=async()=>{
  if(!valid())return;
  const store="cl360-smart-alerts-v1:"+await hash(actor),now=Date.now(),ttl=30*86400000;
  let seen=memory.get(store)||{};
  try{seen={...seen,...JSON.parse(localStorage.getItem(store)||"{}")};}catch{}
  seen=Object.fromEntries(Object.entries(seen).filter(([,time])=>Number.isFinite(time)&&now-time<ttl));
  const fresh=[];
  for(const e of events){const id=await hash(e.key);if(!seen[id])fresh.push({id,type:e.type});}
  if(!fresh.length||!valid())return;
  const counts={};for(const e of fresh)counts[e.type]=(counts[e.type]||0)+1;
  const body=Object.entries(counts).map(([type,n])=>n+" · "+labels[type]).join(" | ");
  const registration=await navigator.serviceWorker?.getRegistration(scope);
  if(!valid())return;
  if(registration)await registration.showNotification("Conexión Laboral 360",{body,tag:"cl360-operations",renotify:false,data:{cl360View:"seguimientos"}});
  else{const n=new root.Notification("Conexión Laboral 360",{body,tag:"cl360-operations"});n.onclick=()=>{if(valid()){root.focus();root.location.assign(new URL("../crm/seguimientos/",scope).href);}n.close();};}
  for(const e of fresh)seen[e.id]=now;
  memory.set(store,seen);
  try{localStorage.setItem(store,JSON.stringify(seen));}catch{}
 };
 if(navigator.locks?.request)await navigator.locks.request("cl360-smart-alerts:"+await hash(actor),run);else await run();
 }finally{inFlight.delete(actor);}
}
root.CL360Alerts={collect,notify,labels};
})(window);
