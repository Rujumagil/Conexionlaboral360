const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.join(__dirname,"..");
const messages=fs.readFileSync(path.join(root,"mensajes/app.js"),"utf8");
const crm=fs.readFileSync(path.join(root,"crm/app.js"),"utf8");
const source=messages.match(/function extractMessengerDeclarations\(messages\)\{[\s\S]*?\n\}/)?.[0];
const extract=()=>{assert.ok(source);return vm.runInNewContext(source+";extractMessengerDeclarations;");};
test("both applications parse",()=>{new vm.Script(messages);new vm.Script(crm);});
test("only incoming declarations, Mexican telephone and shift",()=>{
 const r=extract()([{source:"candidate",body:"Mi teléfono es +52 1 33 1234 5678; puedo 24x48"},{source:"staff",body:"3339999999"}]);
 assert.equal(r.phone,"3312345678");assert.equal(r.shift,"24x48");
});
test("ambiguous declarations remain unconfirmed",()=>{
 const r=extract()([{source:"candidate",body:"3331234567, diurno"},{source:"candidate",body:"3337654321, nocturno"}]);
 assert.equal(r.phone,"");assert.equal(r.phoneAmbiguous,true);assert.equal(r.shift,"");assert.equal(r.shiftAmbiguous,true);
});
test("CRM reads the same Messenger projection and separates preliminary contacts",()=>{
 assert.match(crm,/db\.rpc\("cl360_messenger_pipeline"\)/);
 assert.match(messages,/db\.rpc\("cl360_messenger_pipeline"\)/);
 assert.match(crm,/!x\.candidate_id&&messengerState\(x\)!=="closed"/);
 assert.match(crm,/routeBase\)\.href/);
 assert.match(messages,/get\("conversation"\)/);
});
test("registration persists human-reviewed fields and checks consent",()=>{
 assert.match(messages,/cl360_messenger_candidate_register_v2/);
 assert.match(messages,/!permission\.checked\|\|!verified\.checked/);
 assert.match(messages,/p_shift_declared:declaredShift\.value\.trim\(\),p_availability:availability\.value,p_experience_level:experienceLevel\.value/);
});