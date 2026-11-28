const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.join(__dirname,"..");
const messages=fs.readFileSync(path.join(root,"mensajes/app.js"),"utf8");
const crm=fs.readFileSync(path.join(root,"crm/app.js"),"utf8");
test("both applications parse",()=>{new vm.Script(messages);new vm.Script(crm);});
test("live evidence leaves conflicting fields blank and is not an eligibility score",()=>{
 const snippets=["extractIntakeEvidence","extractMessengerDeclarations","appendIntakeReview"].map(n=>messages.match(new RegExp("function "+n+"\\([^\\n]*\\)\\{[\\s\\S]*?\\n\\}"))?.[0]);
 assert.ok(snippets.every(Boolean));
 const element=()=>({children:[],textContent:"",append(...x){this.children.push(...x);}});
 const panel=element();
 const document={createElement:element};
 const live={fields:{name:{value:"Persona Ejemplo"},phone:{value:"0000000000"},shift:{value:"24x48"}},conflicts:{phone:true},call_requested:true};
 vm.runInNewContext(snippets.join("\n")+";appendIntakeReview(panel,[],live)",{panel,document,live});
 const rows=panel.children[0].children;
 assert.match(rows[0].textContent,/2\/5/);
 const values=rows.filter(x=>x.children.length===2).map(x=>x.children.map(y=>y.textContent));
 assert.ok(values.some(x=>x[0]==="Teléfono sugerido"&&x[1]==="Varios números; confirmar"));
 assert.ok(values.some(x=>x[0]==="Nombre declarado"&&x[1]==="Persona Ejemplo"));
});
test("registration requires confirmation and uses latest live intake",()=>{
 assert.match(messages,/db\.rpc\("cl360_messenger_live_intake"/);
 assert.match(messages,/!review\.conflicts\?\.\[key\]/);
 assert.match(messages,/!permission\.checked\|\|!verified\.checked/);
 assert.match(crm,/datos declarados por revisar/);
});
test("server intake distinguishes negated shifts and respects no-contact declarations",()=>{
 const sql=fs.readFileSync(path.join(root,"docs/cl360-messenger-live-intake.sql"),"utf8");
 assert.ok(sql.includes("no (puedo|quiero|prefiero|busco|acepto)"));
 assert.ok(sql.includes("contactes|contacten|llames|llamen"));
 assert.ok(sql.includes("if declined then return jsonb_build_object('fields','{}'::jsonb"));
 assert.ok(sql.includes("not in ('sent','delivered','read')"));
});
