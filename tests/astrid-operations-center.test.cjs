const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.join(__dirname,"..");
const crm=fs.readFileSync(path.join(root,"crm/app.js"),"utf8");
const html=fs.readFileSync(path.join(root,"crm/index.html"),"utf8");
const source=crm.match(/function buildOperationsGroups\([^\n]+\)\{[\s\S]*?\n\}/)?.[0];
const build=()=>{assert.ok(source);return vm.runInNewContext(source+";buildOperationsGroups;");};
const now=Date.parse("2026-11-28T13:00:00Z"),future="2026-11-29T13:00:00Z",past="2026-11-27T13:00:00Z";
test("dashboard and agenda mount the operations center",()=>{new vm.Script(crm);assert.match(html,/id="home-operations"/);assert.match(html,/id="operations-center"/);});
test("calls, review, no-contact and waiting are distinct; closed and other assignees excluded",()=>{
 const external=[{id:"call",status:"open",intake:{call_requested:true,available_count:4}},{id:"review",status:"open",intake:{available_count:3}},{id:"privacy",status:"open",candidate_id:"p",intake:{declined:true,call_requested:true}},{id:"other",status:"open",assigned_user_id:"other",intake:{available_count:2}},{id:"closed",status:"closed",intake:{call_requested:true}},{id:"wait",status:"open"}];
 const people=[{id:"p",full_name:"P",stage:"new"},{id:"n",full_name:"N",stage:"new"},{id:"k",full_name:"K",stage:"interview"}];
 const internal=[{id:"dup",candidate_id:"p",status:"waiting"},{id:"inside",candidate_id:"k",status:"waiting"}];
 const tasks=[{id:"old",candidate_id:"k",title:"Entrevista",status:"pending",due_at:past},{id:"future",candidate_id:"k",title:"Entrevista",status:"pending",due_at:future},{id:"done",candidate_id:"n",title:"Entrevista",status:"done",due_at:past}];
 const groups=build()(external,internal,people,tasks,now,"mine","me");
 const result=Object.fromEntries(Array.from(groups,g=>[g.key,Array.from(g.items,i=>i.id)]));
 assert.deepEqual(result,{calls:["call"],review:["review"],chats:["wait","inside"],interviews:["future"],overdue:["old"],privacy:["privacy"],unplanned:["n"]});
});
test("team sees other assignees but linked internal placeholders are deduplicated",()=>{
 const groups=build()([{id:"m",status:"open",assigned_user_id:"other",candidate_id:"p",intake:{call_requested:true}}],[{id:"i",candidate_id:"p",status:"waiting"}],[{id:"p",stage:"contacted"}],[],now,"team","me");
 assert.equal(groups.find(g=>g.key==="calls").items.length,1);
 assert.equal(groups.find(g=>g.key==="chats").items.length,0);
});
