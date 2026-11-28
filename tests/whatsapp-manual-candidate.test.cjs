const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const app=fs.readFileSync("crm/app.js","utf8"),sql=fs.readFileSync("docs/cl360-whatsapp-manual-candidate.sql","utf8");
test("Teléfonos mexicanos",()=>{
 const fn=app.match(/function whatsappManualPhone\(value\)\{[\s\S]*?\n\}/)[0];
 const normalize=vm.runInNewContext(fn+";whatsappManualPhone");
 for(const value of ["3312345678","+52 33 1234 5678","+5213312345678","(33) 1234-5678"])assert.equal(normalize(value),"3312345678");
 for(const value of ["+1 2125550100","123","abc3312345678","33123456789"])assert.equal(normalize(value),"");
});
test("RPC autorizada, sin duplicación ni atribución inventada",()=>{
 assert.match(app,/db\.rpc\("cl360_register_whatsapp_candidate"/);
 assert.match(app,/manual-consent/);
 assert.match(sql,/auth\.uid\(\)/);
 assert.match(sql,/m\.workspace_id=ws/);
 assert.match(sql,/p_consent is distinct from true/i);
 assert.match(sql,/j\.status='active'/);
 assert.match(sql,/revoke all on function[\s\S]*from public,anon,authenticated/i);
 assert.match(sql,/on conflict\(workspace_id,phone,job_slug\) do nothing/i);
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.match(sql,/'whatsapp_manual'/);
 assert.match(sql,/already_exists/);
 assert.doesNotMatch(sql,/campaign_attribution|cl360_messenger_candidate_links/);
});