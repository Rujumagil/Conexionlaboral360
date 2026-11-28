const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const crm=fs.readFileSync(path.join(__dirname,"../crm/app.js"),"utf8");
const helpers=["followupKind","agendaMatches","validFutureFollowup"].map(n=>crm.match(new RegExp("function "+n+"\\([^\\n]+\\)\\{[^\\n]+\\}"))[0]).join("\n");
const [kind,matches,valid]=vm.runInNewContext(helpers+";[followupKind,agendaMatches,validFutureFollowup]");
test("agenda categories and assignment filters",()=>{assert.equal(kind("Entrevista inicial"),"interview");assert.equal(kind("Llamada de seguimiento"),"call");assert.equal(kind("Revisión"),"other");assert.ok(matches({title:"Llamada",assigned_user_id:"u"},"call","mine","u"));assert.ok(!matches({title:"Llamada",assigned_user_id:"v"},"call","mine","u"));assert.ok(matches({title:"Entrevista"},"interview","unassigned","u"));});
test("reschedule requires a future valid date",()=>{assert.ok(valid("2026-11-29T12:00:00Z",Date.parse("2026-11-28T12:00:00Z")));assert.ok(!valid("invalid",0));assert.ok(!valid("2026-11-27T12:00:00Z",Date.parse("2026-11-28T12:00:00Z")));});
