const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const {webcrypto}=require("node:crypto");
const root=path.join(__dirname,"..");
const code=fs.readFileSync(path.join(root,"assets/cl360-alerts.js"),"utf8");
function fixture(storage=new Map()){
 const notifications=[];
 const window={Notification:{permission:"granted"},crypto:webcrypto};
 const context={window,crypto:webcrypto,TextEncoder,URL,navigator:{serviceWorker:{getRegistration:async()=>({showNotification:async(title,options)=>notifications.push({title,options})})}},localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)}};
 vm.runInNewContext(code,context);
 return {api:window.CL360Alerts,notifications,storage};
}
const now=Date.parse("2026-11-28T13:00:00Z");
test("alerts classify cases, exclude opt-outs and other assignees, and do not repeat a chat in one batch",()=>{
 const {api}=fixture();
 const contacts=[{id:"call",status:"open",intake:{call_requested:true,available_count:5}},{id:"review",status:"open",intake:{available_count:3}},{id:"handoff",status:"open",intake:{},andy:{human_requested:true}},{id:"optout",candidate_id:"p",status:"open",intake:{declined:true,call_requested:true}},{id:"other",assigned_user_id:"other",status:"open",intake:{call_requested:true}}];
 const tasks=[{id:"old",status:"pending",due_at:"2026-11-27T13:00:00Z",title:"Seguimiento"},{id:"next",status:"pending",due_at:"2026-11-28T14:00:00Z",title:"Entrevista"},{id:"blocked",candidate_id:"p",status:"pending",due_at:"2026-11-27T13:00:00Z",title:"Llamada"}];
 assert.deepEqual(Array.from(api.collect(contacts,tasks,"me",now),e=>e.type),["calls","review","handoff","overdue","interviews"]);
});
test("notifications are generic and deduplicated across app instances sharing origin",async()=>{
 const one=fixture(),two=fixture(one.storage);
 const events=[{type:"calls",id:"contact-private-id",key:"call:contact-private-id"}];
 await one.api.notify("actor",events,()=>true,"https://example.invalid/crm/");
 await two.api.notify("actor",events,()=>true,"https://example.invalid/mensajes/");
 assert.equal(one.notifications.length,1);assert.equal(two.notifications.length,0);
 assert.match(one.notifications[0].options.body,/Solicitudes de llamada/);
 assert.doesNotMatch(JSON.stringify(one.notifications),/contact-private-id/);
 assert.doesNotMatch(JSON.stringify(Array.from(one.storage.entries())),/contact-private-id|actor/);
});
test("both apps load the shared engine; notification routing is installed",()=>{
 for(const p of ["crm","mensajes"]){
  assert.match(fs.readFileSync(path.join(root,p,"index.html"),"utf8"),/cl360-alerts\.js/);
  new vm.Script(fs.readFileSync(path.join(root,p,"app.js"),"utf8"));
  assert.match(fs.readFileSync(path.join(root,p,"sw.js"),"utf8"),/notificationclick/);
 }
});
