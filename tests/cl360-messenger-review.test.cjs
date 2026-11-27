const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const js = fs.readFileSync(path.join(root, "mensajes/app.js"), "utf8");
const sql = fs.readFileSync(path.join(root, "docs/cl360-messenger-human-registration.sql"), "utf8");

test("El expediente preliminar distingue preguntas y respuestas declaradas", () => {
  const source = js.match(/function extractIntakeEvidence\(messages\)\{[\s\S]*?\n\}/)?.[0];
  assert.ok(source, "Existe extractor de evidencia");
  const extract = vm.runInNewContext("(" + source + ")");
  const evidence = extract([
    {source:"staff",body:"¿Con quién tengo el gusto?"},
    {source:"candidate",body:"María Ejemplo"},
    {source:"staff",body:"¿Por qué colonia o zona vives?"},
    {source:"candidate",body:"Zapopan"},
    {source:"staff",body:"¿Tienes experiencia trabajando en seguridad privada?"},
    {source:"candidate",body:"He trabajado dos años"},
  ]);
  assert.equal(evidence.get("Nombre declarado"),"María Ejemplo");
  assert.equal(evidence.get("Zona declarada"),"Zapopan");
  assert.equal(evidence.get("Experiencia declarada"),"He trabajado dos años");
});

test("No convierte preguntas, enlaces ni teléfonos en respuestas verificadas", () => {
  const source = js.match(/function extractIntakeEvidence\(messages\)\{[\s\S]*?\n\}/)?.[0];
  const extract = vm.runInNewContext("(" + source + ")");
  const evidence = extract([
    {source:"staff",body:"¿Con quién tengo el gusto?"},
    {source:"candidate",body:"https://example.invalid/registro"},
    {source:"staff",body:"¿Por qué colonia o zona vives?"},
    {source:"candidate",body:"3312345678"},
    {source:"candidate",body:"Ya les escribí"},
  ]);
  assert.equal(evidence.size,0);
});

test("El alta requiere autorización humana y no registra al abrir la conversación", () => {
  assert.match(sql,/p_consent is distinct from true or p_review_confirm is distinct from true/);
  assert.match(js,/const permission=check\(/);
  assert.match(js,/const verified=check\(/);
  assert.match(js,/save\.onclick=async\(\)=>\{/);
  assert.match(sql,/conversation_owner is distinct from actor/);
  assert.match(sql,/for update;/i);
});

test("Alta atómica: registro, vínculo, seguimiento y evento auditado", () => {
  for(const table of ["cl360_candidates","cl360_messenger_candidate_links","cl360_followups","cl360_events"]){
    assert.match(sql,new RegExp("insert into public\\."+table+"\\("));
  }
  assert.match(sql,/already_linked',true/);
  assert.match(sql,/candidate_already_exists_use_manual_link/);
  assert.match(sql,/assignee_not_available/);
  assert.match(sql,/grant execute on function public\.cl360_messenger_candidate_register/);
  assert.doesNotMatch(sql,/create\s+trigger|http_post|pg_net|send_email/i);
});

test("Selector limitado a personal activo del workspace", () => {
  assert.match(sql,/m\.workspace_id=ws and m\.status='active'/);
  assert.match(sql,/role::text in \('owner','admin','manager','sales','support'\)/);
  assert.match(js,/appendCandidateRegistration\(wrap,t\)/);
});

test("El expediente renderiza las tres etiquetas completas y sus respuestas", () => {
  const source = js.match(/function extractIntakeEvidence\(messages\)\{[\s\S]*?\n\}/)?.[0];
  const render = js.match(/function appendIntakeReview\(panel,messages\)\{[\s\S]*?\n\}/)?.[0];
  const element = () => ({children:[],textContent:"",append(...items){this.children.push(...items);}});
  const document = {createElement:element};
  const panel = element();
  vm.runInNewContext(source+"\n"+render+"\nappendIntakeReview(panel,messages)",{document,panel,messages:[
    {source:"staff",body:"¿Con quién tengo el gusto?"},{source:"candidate",body:"María Ejemplo"},
    {source:"staff",body:"¿Por qué colonia o zona vives?"},{source:"candidate",body:"Zapopan"},
    {source:"staff",body:"¿Tienes experiencia trabajando en seguridad privada?"},{source:"candidate",body:"Dos años"}
  ]});
  assert.deepEqual(panel.children[0].children.slice(2,5).map(row=>row.children.map(c=>c.textContent)),[
    ["Nombre declarado","María Ejemplo"],["Zona declarada","Zapopan"],["Experiencia declarada","Dos años"]
  ]);
});
