(()=>{'use strict';
const URL="https://qwxydjotwhniahaovrff.supabase.co";
const KEY="sb_publishable_17NekbDHp_ssL_Pf-CnqPg_v0acxqn3";
const WS="c7ab2a78-08e0-4a29-8a3b-fadaf244002f";
const db=window.supabase?.createClient(URL,KEY,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:false}});
const $=(id)=>document.getElementById(id);
const safe=(x)=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=(date)=>date?new Date(date).toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short'}):"—";
function candidateReviewNotes(candidate){
 const notes=[];
 if(candidate.screening_data?.availability==="no")notes.push("El turno anunciado no coincide con su disponibilidad: explorar alternativas.");
 else if(candidate.screening_data?.availability==="consultar")notes.push("Necesita confirmar si puede cubrir el turno.");
 if(candidate.screening_data?.experience_level==="prefiero_comentarlo")notes.push("Prefiere conversar sobre su experiencia con Astrid.");
 return notes;
}
function candidateIntakeSummary(candidate){
 const screened=candidate.screening_data||{};
 const job=jobs.find(x=>x.slug===candidate.job_slug);
 const experienceLevels={si:"Con experiencia previa declarada",no:"Sin experiencia previa en puesto similar",prefiero_comentarlo:"Prefiere comentar la experiencia con Astrid"};
 const availability={si:"Indica que el turno le funciona",no:"Indica que el turno no le funciona",consultar:"Necesita revisar el turno"};
 const review=candidateReviewNotes(candidate);
 if(!job)review.push("Confirmar que la vacante y sus condiciones sigan disponibles.");
 if(!screened.preferred_zone)review.push("Zona preferida sin especificar.");
 review.push("Validar requisitos, sueldo, prestaciones y siguientes pasos con la persona reclutadora.");
 const fields=[
  "RESUMEN DE PREENTREVISTA · ANDY",
  "Estado: Pendiente de revisión humana",
  "Candidato: "+(candidate.full_name||"Por confirmar"),
  "Teléfono: "+(candidate.phone||"Por confirmar"),
  "Vacante: "+(job?.title||candidate.job_slug||"Por confirmar"),
  "Área: "+(job?.area||candidate.area||"Por confirmar"),
  "Zona anunciada: "+(job?.location||"Por confirmar con Astrid"),
  "Turno anunciado: "+(job?.shift||"Por confirmar con Astrid"),
  "Experiencia previa: "+(experienceLevels[screened.experience_level]||"Por confirmar"),
  "Experiencia compartida: "+(candidate.experience?.trim()||"Sin descripción"),
  "Disponibilidad: "+(availability[screened.availability]||"Por confirmar"),
  "Zona de interés: "+(screened.preferred_zone||"Sin preferencia informada"),
  "Registro: "+fmt(candidate.created_at),
  "",
  "PUNTOS PARA ASTRID",
  ...review.map(note=>"• "+note),
  "",
  "Importante: son datos proporcionados por el candidato y del catálogo vigente. No constituyen una evaluación de idoneidad ni una decisión de contratación."
 ];
 return fields.join("\n");
}
const stageNames={new:"Sin contactar",contacted:"Contactado",screening:"Filtrado",interview:"Entrevista",qualified:"Calificado",hired:"Contratado",rejected:"No seleccionado",archived:"Archivado"};
let user=null, staffRole=null, candidates=[], followups=[], jobs=[], selected=null, canLoad=false;
const working=(msg)=>{if($("detail"))$("detail").innerHTML='<p class="loading">'+safe(msg)+'</p>'};
function authScreen(show){$("auth-screen").classList.toggle("hide",!show);$("dashboard").classList.toggle("hide",show);$("signout").classList.toggle("hide",show);}
function err(error){alert(error?.message||"No se pudo completar la operación. Reintenta.");}
async function checkFlyAvailability(){
 try{
  const response=await fetch(URL+"/functions/v1/cl360-fly-chat",{headers:{apikey:KEY},cache:"no-store"});
  if(!response.ok)throw Error("unavailable");
  const health=await response.json();
  const live=health.ready===true;
  $("fly-health-badge").textContent=live?"Conversación activa":"Respuestas guiadas";
  $("fly-health-detail").textContent=live
    ?"La conversación contextual de Andy (Compás Fly) está disponible para preguntas abiertas autorizadas. El CRM conserva el control humano de entrevistas y seguimientos."
    :health.providerConfigured!==true
      ?"El backend Andy (Compás Fly) responde, pero todavía falta configurar la credencial privada GEMINI_API_KEY de Supabase. La preentrevista guiada sigue disponible."
      :"Gemini está configurado; falta habilitar el perfil supervisado Andy (Compás Fly) tras las pruebas. La preentrevista guiada continúa operativa.";
 }catch{
  $("fly-health-badge").textContent="Verificación pendiente";
  $("fly-health-detail").textContent="No se pudo comprobar el servidor de Fly. La preentrevista guiada sigue disponible.";
 }
}
async function checkAuth(){
  if(!db){$("login-error").textContent="No se pudo cargar la biblioteca de autenticación. Revisa tu conexión.";return;}
  const {data:{user:activeUser}}=await db.auth.getUser();
  if(!activeUser){authScreen(true);return;}
  const {data:membership,error}=await db.from("workspace_members").select("role,status").eq("workspace_id",WS).eq("user_id",activeUser.id).eq("status","active").maybeSingle();
  if(error||!membership||!["owner","admin","manager","sales","support"].includes(membership.role)){
    await db.auth.signOut();authScreen(true);$("login-error").textContent="Tu cuenta todavía no tiene acceso a este CRM.";return;
  }
  user=activeUser;staffRole=membership.role;canLoad=true;navigate(viewFromLocation(),null,true);void checkFlyAvailability();$("signed").textContent=activeUser.email||"";authScreen(false);await load();
}
async function load(){
 if(!canLoad)return;
 $("refresh").disabled=true;
 const [c,j,f]=await Promise.all([
  db.from("cl360_candidates").select("id,full_name,phone,job_slug,area,experience,screening_data,stage,source,consent_at,assigned_user_id,last_contact_at,next_followup_at,created_at,submission_count").eq("workspace_id",WS).order("created_at",{ascending:false}).limit(500),
  db.from("cl360_jobs").select("id,slug,title,area,location,shift,details,status").eq("workspace_id",WS).order("title"),
  db.from("cl360_followups").select("id,candidate_id,title,due_at,status,assigned_user_id").eq("workspace_id",WS).order("due_at").limit(500)
 ]);
 $("refresh").disabled=false;
 if(c.error){working("No se pudo cargar la lista.");err(c.error);return;}
 if(j.error||f.error){err(j.error||f.error);return;}
 candidates=c.data||[];jobs=j.data||[];followups=f.data||[];
 const fromLink=new URLSearchParams(location.search).get("candidato");
 if(fromLink&&candidates.some(x=>x.id===fromLink))selected=fromLink;
 const now=Date.now(), active=new Set(["contacted","screening","interview"]);
 $("m-total").textContent=candidates.length;
 $("m-new").textContent=candidates.filter(x=>x.stage==="new").length;
 $("m-active").textContent=candidates.filter(x=>active.has(x.stage)).length;
 $("m-qualified").textContent=candidates.filter(x=>x.stage==="qualified").length;
 $("m-overdue").textContent=followups.filter(x=>x.status==="pending"&&new Date(x.due_at).getTime()<now).length;
 $("last-updated").textContent="Actualizado "+new Date().toLocaleTimeString("es-MX");
 renderCandidates();renderFollowups();renderJobManagement();
 renderHome();renderPipeline();await loadConversations();
 if(selected){const still=candidates.find(x=>x.id===selected);if(still&&activeView==="candidatos")renderDetail(still);else if(!still){selected=null;$("detail").classList.add("hide");}}
}
function title(slug){return jobs.find(x=>x.slug===slug)?.title||slug||"Sin vacante";}
function renderJobManagement(){
 const manager=["owner","admin","manager"].includes(staffRole);
 $("new-job-form").classList.toggle("hide",!manager);
 const rows=jobs.map(j=>'<tr><td data-label="Vacante"><b>'+safe(j.title)+'</b><div class="small">'+safe(j.area)+'</div></td><td data-label="Ubicación">'+safe(j.location||"—")+'</td><td data-label="Estado"><span class="pill '+(j.status==="active"?"qualified":"")+'">'+safe(j.status==="active"?"Publicada":j.status==="paused"?"Pausada":"Cerrada")+'</span></td><td data-label="Acción">'+(manager?'<button type="button" class="mini-btn" data-job-toggle="'+safe(j.id)+'">'+(j.status==="active"?"Pausar":"Activar")+'</button>':"—")+'</td></tr>').join("");
 $("job-management-list").innerHTML=jobs.length?'<table class="jobs-table"><thead><tr><th>Vacante</th><th>Ubicación</th><th>Estado</th><th>Acción</th></tr></thead><tbody>'+rows+'</tbody></table>':'<p class="empty">Aún no hay vacantes registradas.</p>';
 document.querySelectorAll("[data-job-toggle]").forEach(btn=>btn.addEventListener("click",async()=>{
  if(!manager)return;
  const job=jobs.find(j=>j.id===btn.dataset.jobToggle);if(!job)return;
  const next=job.status==="active"?"paused":"active";
  if(next==="active"&&!confirm("¿Publicar esta vacante en la página pública?"))return;
  const {error}=await db.from("cl360_jobs").update({status:next}).eq("id",job.id).eq("workspace_id",WS);
  if(error)return err(error);await load();
 }));
}
$("new-job-form").addEventListener("submit",async(e)=>{
 e.preventDefault();$("job-error").textContent="";
 if(!["owner","admin","manager"].includes(staffRole))return;
 const title=$("job-title").value.trim(),area=$("job-area").value.trim(),location=$("job-location").value.trim(),shift=$("job-shift").value.trim();
 const slug=title.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,70);
 const details=$("job-details").value.split("\n").map(t=>t.trim()).filter(Boolean);
 if(slug.length<3||!area||!location||!shift){$("job-error").textContent="Completa todos los campos.";return;}
 const {error}=await db.from("cl360_jobs").insert({workspace_id:WS,slug,area,title,location,shift,details,status:"paused"});
 if(error){$("job-error").textContent="No se pudo guardar la vacante. Revisa si el nombre ya existe.";return;}
 e.target.reset();await load();
});
function renderCandidates(){
 const q=$("search").value.trim().toLocaleLowerCase("es-MX"), stage=$("filter-stage").value, turno=$("filter-turno").value;
 const matching=candidates.filter(x=>(!stage||x.stage===stage)&&(!turno||turno==="si"&&x.screening_data?.availability==="si"||turno==="revisar"&&["no","consultar"].includes(x.screening_data?.availability)||turno==="none"&&!x.screening_data?.availability)&&(!q||[x.full_name,x.phone,title(x.job_slug)].join(" ").toLocaleLowerCase("es-MX").includes(q)));
 $("result-count").textContent="("+matching.length+")";
 $("candidate-rows").innerHTML=matching.length?matching.map(x=>'<tr data-candidate="'+safe(x.id)+'" tabindex="0" role="button" aria-label="Abrir expediente de '+safe(x.full_name)+'"><td data-label="Candidato"><strong>'+safe(x.full_name)+'</strong><div class="small">'+safe(x.phone)+'</div></td><td data-label="Vacante">'+safe(title(x.job_slug))+'</td><td data-label="Etapa"><span class="pill '+safe(x.stage)+'">'+safe(stageNames[x.stage]||x.stage)+'</span></td><td data-label="Preentrevista"><span class="pill">'+safe(x.screening_data?.availability==="si"?"Turno disponible":["no","consultar"].includes(x.screening_data?.availability)?"Revisar turno":"Por confirmar")+'</span></td><td data-label="Registro">'+safe(fmt(x.created_at))+'</td></tr>').join(""):'<tr><td colspan="5" class="empty">'+(candidates.length?'No hay candidatos que coincidan con los filtros.':'Todavía no hay postulaciones. Los registros aparecerán aquí cuando una persona complete la preentrevista.')+'</td></tr>';
 document.querySelectorAll("[data-candidate]").forEach(row=>{
  const open=()=>{selected=row.dataset.candidate;renderDetail(candidates.find(x=>x.id===selected));if(window.matchMedia("(max-width: 820px)").matches){$("detail").scrollIntoView({behavior:"smooth",block:"start"});}};
  row.addEventListener("click",open);
  row.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();open();}});
 });
}
function renderFollowups(){
 const pending=followups.filter(f=>f.status==="pending").slice(0,20);
 $("followups").innerHTML=pending.length?pending.map(f=>'<div class="followup-row"><div><b>'+safe(f.title)+'</b><div class="small">'+safe(candidates.find(x=>x.id===f.candidate_id)?.full_name||"Candidato")+' · '+safe(fmt(f.due_at))+'</div></div><button class="mini-btn" data-done="'+safe(f.id)+'">Completar</button></div>').join(""):'<p class="empty">No hay seguimientos pendientes.</p>';
 document.querySelectorAll("[data-done]").forEach(btn=>btn.addEventListener("click",async()=>{
  const {error}=await db.from("cl360_followups").update({status:"done"}).eq("id",btn.dataset.done).eq("workspace_id",WS);
  if(error)return err(error);await load();
 }));
}
async function renderDetail(candidate){
 if(!candidate)return;
 $("detail").classList.remove("hide");
 $("detail").scrollIntoView({behavior:"smooth",block:"start"});
 const phone=String(candidate.phone).replace(/[^+0-9]/g,"");
 const dateOptions=Object.entries(stageNames).map(([v,t])=>'<option value="'+v+'" '+(candidate.stage===v?"selected":"")+'>'+safe(t)+'</option>').join("");
 $("detail").innerHTML='<h3>'+safe(candidate.full_name)+'</h3><p class="detail-sub">'+safe(title(candidate.job_slug))+' · '+safe(candidate.area)+' · Registrado '+safe(fmt(candidate.created_at))+'</p>'+
 '<div class="detail-actions"><a class="btn" target="_blank" rel="noopener noreferrer" href="https://wa.me/'+encodeURIComponent(phone.replace(/^\+/,""))+'">Abrir WhatsApp</a><a class="btn ghost" href="tel:'+encodeURIComponent(phone)+'">Llamar</a></div>'+
 '<label class="label">Teléfono</label><div>'+safe(candidate.phone)+'</div><label class="label">Experiencia declarada</label><div style="white-space:pre-wrap">'+safe(candidate.experience||"Sin información")+'</div>'+
 '<div class="section-divider"></div><b>Preentrevista inicial</b>'+
 '<div class="small" style="margin-top:8px">Datos declarados por el candidato. No representan una evaluación automática ni decisión de contratación.</div>'+
 '<label class="label">Experiencia previa</label><div>'+safe(({si:"Sí",no:"No",prefiero_comentarlo:"Prefiere comentarlo"})[candidate.screening_data?.experience_level]||"Por confirmar")+'</div>'+
 '<label class="label">Disponibilidad para turno</label><div>'+safe(({si:"Disponible",no:"No disponible",consultar:"Necesita consultar"})[candidate.screening_data?.availability]||"Por confirmar")+'</div>'+
 '<label class="label">Zona preferida</label><div>'+safe(candidate.screening_data?.preferred_zone||"Sin preferencia informada")+'</div>'+
 '<label class="label">Orientación de Andy</label><div class="small">'+safe(candidateReviewNotes(candidate).join(" ")||"Datos recibidos. Astrid revisará la postulación y decidirá la siguiente etapa.")+'</div>'+
 '<div class="section-divider"></div><h3>Resumen preparado por Andy</h3>'+
 '<div class="small" style="margin-bottom:8px">Síntesis del expediente basada en datos declarados. Solo para revisión del personal autorizado.</div>'+
 '<pre id="andy-intake-summary" style="font:inherit;white-space:pre-wrap;overflow-wrap:anywhere;padding:14px;border:1px solid #dce6f1;border-radius:12px;background:#f5f9fd;color:#16334d">'+safe(candidateIntakeSummary(candidate))+'</pre>'+
 '<button type="button" class="btn ghost" id="copy-andy-summary">Copiar resumen</button><span id="andy-summary-feedback" class="small" role="status" style="margin-left:10px"></span>'+
 '<label class="label" for="candidate-stage">Etapa del candidato</label><select id="candidate-stage" class="field">'+dateOptions+'</select>'+
 '<button class="btn yellow" style="margin-top:10px" id="save-stage">Guardar etapa</button><div class="section-divider"></div>'+
 '<label class="label" for="candidate-note">Nota de seguimiento</label><textarea id="candidate-note" class="field" maxlength="1500" placeholder="Resumen de conversación, disponibilidad o siguiente acción"></textarea>'+
 '<button class="btn" id="save-note" style="margin-top:8px">Agregar nota</button>'+
 '<div class="section-divider"></div><label class="label" for="followup-title">Próxima acción</label><input class="field" id="followup-title" maxlength="200" placeholder="Llamar para entrevista"><label class="label" for="followup-date">Fecha y hora</label><input type="datetime-local" class="field" id="followup-date"><button class="btn" id="save-followup" style="margin-top:8px">Programar seguimiento</button>'+
 '<div class="section-divider"></div><b>Historial</b><div id="events" class="timeline"><p class="small">Cargando historial…</p></div>';
 $("copy-andy-summary").addEventListener("click",async()=>{
  try{
   await navigator.clipboard.writeText(candidateIntakeSummary(candidate));
   $("andy-summary-feedback").textContent="Resumen copiado";
  }catch{
   $("andy-summary-feedback").textContent="No se pudo copiar. Selecciona el texto del resumen manualmente.";
  }
 });
 $("save-stage").addEventListener("click",async()=>{
  const stage=$("candidate-stage").value;
  const {error}=await db.rpc("cl360_set_stage",{p_candidate:candidate.id,p_stage:stage});
  if(error)return err(error);await load();
 });
 $("save-note").addEventListener("click",async()=>{
  const note=$("candidate-note").value.trim();
  if(!note)return;
  const {error}=await db.from("cl360_events").insert({workspace_id:WS,candidate_id:candidate.id,kind:"note",origin:"human",actor_user_id:user.id,note});
  if(error)return err(error);$("candidate-note").value="";await showEvents(candidate.id);
 });
 $("save-followup").addEventListener("click",async()=>{
  const title=$("followup-title").value.trim(),date=$("followup-date").value;
  if(title.length<3||!date)return alert("Indica la acción y su fecha.");
  const {error}=await db.from("cl360_followups").insert({workspace_id:WS,candidate_id:candidate.id,title,due_at:new Date(date).toISOString(),status:"pending",created_by:user.id});
  if(error)return err(error);await load();
 });
 await showEvents(candidate.id);
}
async function showEvents(id){
 const {data,error}=await db.from("cl360_events").select("id,kind,origin,note,created_at").eq("workspace_id",WS).eq("candidate_id",id).order("created_at",{ascending:false}).limit(40);
 const target=$("events");if(!target)return;
 target.innerHTML=error?'<p class="error">No se pudo cargar el historial.</p>':data?.length?data.map(e=>'<div class="event">'+safe(e.note||e.kind)+'<small>'+safe(fmt(e.created_at))+' · '+safe(e.origin)+'</small></div>').join(""):'<p class="small">Sin actividad registrada.</p>';
}
$("login-form").addEventListener("submit",async e=>{
 e.preventDefault();$("login-error").textContent="";
 if(!db)return;
 const {error}=await db.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});
 if(error){$("login-error").textContent="No fue posible iniciar sesión. Verifica correo y contraseña.";return;}await checkAuth();
});
$("signout").addEventListener("click",async()=>{await db?.auth.signOut();canLoad=false;user=null;staffRole=null;authScreen(true);});
$("search").addEventListener("input",renderCandidates);$("filter-stage").addEventListener("change",renderCandidates);$("filter-turno").addEventListener("change",renderCandidates);$("refresh").addEventListener("click",load);

/* App navigation, pipeline and internal conversations */
const appViews={
 inicio:"Centro de operaciones",vacantes:"Vacantes",candidatos:"Candidatos",pipeline:"Pipeline de reclutamiento",
 conversaciones:"Centro de conversaciones",seguimientos:"Seguimientos",fly:"Andy · Compás Fly",ajustes:"Configuración"
};
let activeView="inicio",threads=[],messages=[],activeConversationId=null,conversationsLoadError=false;
const routeBase=new window.URL("./",document.baseURI);
function viewFromLocation(){
 const prefix=routeBase.pathname;
 const remainder=location.pathname.startsWith(prefix)?location.pathname.slice(prefix.length).replace(/^\/+|\/+$/g,""):"";
 return appViews[remainder]?remainder:"inicio";
}
const initialRoute=viewFromLocation();
function urlForView(view,candidateId){
 const href=view==="inicio"?"./":view+"/";
 const u=new window.URL(href,routeBase);
 if(candidateId)u.searchParams.set("candidato",candidateId);
 return u;
}
function navigate(view,candidateId=null,fromHistory=false){
 if(!appViews[view])view="inicio";
 if(!canLoad)return;
 if(candidateId&&candidates.some(c=>c.id===candidateId))selected=candidateId;
 if(!fromHistory){
  const url=urlForView(view,candidateId);
  if(location.pathname!==url.pathname||location.search!==url.search)history.pushState({crmView:view},"",url.href);
 }
 activeView=view;
 document.querySelectorAll("[data-view]").forEach(el=>el.classList.toggle("hide",el.dataset.view!==view));
 document.querySelectorAll("[data-nav]").forEach(btn=>{
  const active=btn.dataset.nav===view;
  btn.classList.toggle("active",active);
  btn.setAttribute("aria-current",active?"page":"false");
 });
 $("view-title").textContent=appViews[view];
 if(view!=="candidatos")$("detail").classList.add("hide");
 if(view==="candidatos"&&selected){const c=candidates.find(x=>x.id===selected);if(c)renderDetail(c);}
 if(view==="pipeline")renderPipeline();
 if(view==="conversaciones")renderInbox();
 if(view==="inicio")renderHome();
 if(view==="ajustes")$("settings-user").textContent=(user?.email||"Cuenta autorizada")+" · "+(staffRole||"");
 document.title=appViews[view]+" · Conexión Laboral 360";
 window.scrollTo({top:0,behavior:"auto"});
}
document.querySelectorAll("[data-nav]").forEach(btn=>{
 btn.addEventListener("click",()=>navigate(btn.dataset.nav));
 btn.setAttribute("title","Abrir "+(appViews[btn.dataset.nav]||"módulo"));
});
document.querySelectorAll("[data-go]").forEach(btn=>btn.addEventListener("click",()=>navigate(btn.dataset.go)));
window.addEventListener("popstate",()=>{
 if(!canLoad)return;
 const candidateId=new URLSearchParams(location.search).get("candidato");
 if(candidateId&&candidates.some(c=>c.id===candidateId))selected=candidateId;
 navigate(viewFromLocation(),candidateId,true);
});
$("global-refresh").addEventListener("click",async()=>{await load();await loadConversations();});
$("job-add-shortcut").addEventListener("click",()=>{
 if(!["owner","admin","manager"].includes(staffRole))return err({message:"Tu perfil no tiene permiso para administrar vacantes."});
 $("new-job-form").classList.remove("hide");
 $("new-job-form").scrollIntoView({behavior:"smooth",block:"start"});
 $("job-title").focus({preventScroll:true});
});
$("conversation-refresh").addEventListener("click",loadConversations);
$("inbox-filter").addEventListener("change",renderInbox);
$("settings-signout").addEventListener("click",()=> $("signout").click());
function renderHome(){
 $("kpi-open-jobs").textContent=jobs.filter(j=>j.status==="active").length;
 $("kpi-waiting").textContent=threads.filter(t=>t.status==="waiting").length;
 $("kpi-human").textContent=threads.filter(t=>t.status==="human").length;
 $("kpi-hired").textContent=candidates.filter(c=>c.stage==="hired").length;
 $("home-open-jobs").textContent=jobs.filter(j=>j.status==="active").length;
 $("home-waiting").textContent=threads.filter(t=>t.status==="waiting").length;
 $("home-human").textContent=threads.filter(t=>t.status==="human").length;
 const pending=followups.filter(f=>f.status==="pending").slice(0,5);
 $("home-followups").innerHTML=pending.length?pending.map(f=>'<div class="followup-row"><div><b>'+safe(f.title)+'</b><div class="small">'+safe(candidates.find(c=>c.id===f.candidate_id)?.full_name||"Candidato")+' · '+safe(fmt(f.due_at))+'</div></div><button class="mini-btn" data-open-candidate="'+safe(f.candidate_id)+'">Abrir</button></div>').join(""):'<p class="empty">No hay tareas pendientes. Aquí aparecerán los próximos contactos programados.</p>';
 document.querySelectorAll("[data-open-candidate]").forEach(btn=>btn.addEventListener("click",()=>openCandidate(btn.dataset.openCandidate)));
}
function openCandidate(id){
 const c=candidates.find(x=>x.id===id);
 if(!c)return;
 selected=id;
 navigate("candidatos");
 renderDetail(c);
 $("detail").scrollIntoView({behavior:"smooth",block:"start"});
}
const pipelineStages=["new","contacted","screening","interview","qualified","hired","rejected","archived"];
function renderPipeline(){
 const board=$("pipeline-board");
 board.replaceChildren();
 pipelineStages.forEach(stage=>{
  const col=document.createElement("section");col.className="pipeline-column";
  const header=document.createElement("div");header.className="pipeline-column-header";
  const name=document.createElement("b");name.textContent=stageNames[stage]||stage;
  const count=document.createElement("span");const items=candidates.filter(c=>c.stage===stage);count.textContent=items.length;
  header.append(name,count);col.append(header);
  if(!items.length){const empty=document.createElement("p");empty.className="pipeline-empty";empty.textContent="Sin candidatos";col.append(empty);}
  items.forEach(c=>{
   const b=document.createElement("button");b.type="button";b.className="pipeline-card";
   const name=document.createElement("b");name.textContent=c.full_name;
   const job=document.createElement("span");job.className="small";job.textContent=title(c.job_slug);
   const when=document.createElement("span");when.className="small";when.textContent="Registrado: "+fmt(c.created_at);
   const tag=document.createElement("span");tag.className="pill";
   tag.textContent=c.screening_data?.availability==="si"?"Turno declarado compatible":c.screening_data?.availability==="no"?"Revisión de horario": "Disponibilidad por confirmar";
   b.append(name,job,when,tag);b.addEventListener("click",()=>openCandidate(c.id));col.append(b);
  });
  board.append(col);
 });
}
function conversationLabel(s){return({waiting:"Pendiente",bot:"Asistente virtual",human:"Tomada por humano",closed:"Cerrada"})[s]||s;}
function conversationCandidate(t){return candidates.find(c=>c.id===t.candidate_id);}
async function loadConversations(){
 if(!canLoad)return;
 const {data,error}=await db.from("cl360_conversations")
  .select("id,candidate_id,status,handler_id,taken_at,last_message_at,created_at")
  .eq("workspace_id",WS).order("last_message_at",{ascending:false}).limit(300);
 if(error){conversationsLoadError=true;console.error("No se pudo consultar la bandeja.");return;}
 conversationsLoadError=false;threads=data||[];
 $("nav-inbox-count").textContent=threads.filter(t=>t.status==="waiting").length;
 renderHome();renderInbox();
}
function renderInbox(){
 const list=$("inbox-threads");
 const filter=$("inbox-filter").value;
 const matched=threads.filter(t=>filter==="all"||t.status===filter);
 list.replaceChildren();
 if(conversationsLoadError){list.innerHTML='<p class="empty">No pudimos cargar la bandeja. Intenta actualizar.</p>';return;}
 if(!matched.length){list.innerHTML='<p class="empty">No hay conversaciones en esta sección todavía.</p>';return;}
 matched.forEach(t=>{
  const c=conversationCandidate(t);
  const button=document.createElement("button");button.type="button";
  button.className="inbox-item"+(activeConversationId===t.id?" active":"");
  const heading=document.createElement("div");heading.className="inbox-name";
  const name=document.createElement("span");name.textContent=c?.full_name||"Candidato";
  const when=document.createElement("small");when.className="small";when.textContent=fmt(t.last_message_at);
  heading.append(name,when);
  const job=document.createElement("span");job.className="small";job.textContent=c?title(c.job_slug):"Postulación";
  const state=document.createElement("span");state.className="pill";state.textContent=conversationLabel(t.status);
  button.append(heading,job,state);
  button.addEventListener("click",()=>openConversation(t.id));
  list.append(button);
 });
}
async function openConversation(id){
 activeConversationId=id;
 renderInbox();
 const current=threads.find(t=>t.id===id);
 if(!current)return;
 const c=conversationCandidate(current);
 const panel=$("chat-pane");
 panel.innerHTML='<div class="loading">Cargando historial interno…</div>';
 const {data,error}=await db.from("cl360_chat_messages")
  .select("id,source,visibility,body,sender_id,created_at")
  .eq("workspace_id",WS).eq("conversation_id",id).order("created_at",{ascending:true}).limit(150);
 if(activeConversationId!==id)return;
 if(error){panel.innerHTML='<p class="empty">No pudimos consultar el historial. Vuelve a intentar.</p>';return;}
 messages=data||[];
 const header=document.createElement("div");header.className="chat-header";
 const info=document.createElement("div");
 const name=document.createElement("h3");name.textContent=c?.full_name||"Candidato";
 const subtitle=document.createElement("p");subtitle.className="small";
 subtitle.textContent=(c?title(c.job_slug)+" · "+c.phone:"Postulación")+" · "+conversationLabel(current.status);
 info.append(name,subtitle);
 const actions=document.createElement("div");actions.className="chat-actions";
 const take=(txt,action,variant="ghost")=>{
  const btn=document.createElement("button");btn.className="btn "+variant;btn.type="button";btn.textContent=txt;
  btn.addEventListener("click",()=>changeConversationStatus(id,action));actions.append(btn);
 };
 if(current.status==="human"&&current.handler_id===user?.id)take("Dejar pendiente","release","ghost");
 if(current.status!=="human"&&current.status!=="closed")take("Tomar conversación","take","yellow");
 if(current.status==="closed")take("Reabrir","reopen","ghost");
 if(current.status!=="closed")take("Cerrar caso","close","ghost");
 if(c?.phone){
  const wa=document.createElement("a");wa.className="btn yellow";
  wa.target="_blank";wa.rel="noopener noreferrer";
  wa.href="https://wa.me/"+c.phone.replace(/[^0-9]/g,"")+"?text="+encodeURIComponent("Hola, soy del equipo de Conexión Laboral 360. Revisamos tu postulación para "+title(c.job_slug)+" y nos gustaría continuar tu proceso.");
  wa.textContent="WhatsApp ↗";actions.append(wa);
 }
 header.append(info,actions);
 const timeline=document.createElement("div");timeline.className="chat-timeline";timeline.id="internal-timeline";
 if(!messages.length)timeline.innerHTML='<p class="empty">Aún no hay notas ni mensajes de seguimiento registrados.</p>';
 else messages.forEach(m=>{
  const box=document.createElement("div");box.className="message "+m.source;
  const label=document.createElement("b");label.textContent=m.source==="staff"?"Nota del equipo":m.source==="candidate"?"Candidato":m.source==="fly"?"Andy":"Sistema";
  const body=document.createElement("div");body.textContent=m.body;
  const date=document.createElement("small");date.textContent=fmt(m.created_at);
  box.append(label,body,date);timeline.append(box);
 });
 const mini=document.createElement("div");mini.className="candidate-mini";
 const summary=document.createElement("div");const label=document.createElement("strong");label.textContent="Expediente";
 const desc=document.createElement("span");desc.textContent=" "+(c?.screening_data?.preferred_zone||"Zona por confirmar");
 summary.append(label,desc);
 const open=document.createElement("button");open.type="button";open.className="mini-btn";open.textContent="Ver candidato →";
 open.addEventListener("click",()=>{if(c)openCandidate(c.id);});
 mini.append(summary,open);
 const form=document.createElement("form");form.className="message-form";
 const field=document.createElement("textarea");field.className="field";field.maxLength=1500;field.required=true;field.placeholder="Escribe una nota interna de seguimiento. No se envía al candidato.";field.setAttribute("aria-label","Nota interna");
 const footer=document.createElement("div");footer.className="chat-actions";
 const add=document.createElement("button");add.className="btn";add.type="submit";add.textContent="Guardar nota interna";
 const hint=document.createElement("span");hint.className="small";hint.textContent="Visible solo para el equipo del CRM";
 footer.append(add,hint);form.append(field,footer);
 form.addEventListener("submit",async(e)=>{
  e.preventDefault();
  const body=field.value.trim();if(!body)return;
  add.disabled=true;
  const {error}=await db.from("cl360_chat_messages").insert({workspace_id:WS,conversation_id:id,source:"staff",visibility:"internal",sender_id:user.id,body});
  add.disabled=false;if(error)return err(error);
  field.value="";await openConversation(id);
 });
 panel.replaceChildren(header,timeline,mini,form);
 timeline.scrollTop=timeline.scrollHeight;
}
async function changeConversationStatus(id,action){
 const {error}=await db.rpc("cl360_take_conversation",{p_conversation:id,p_action:action});
 if(error){err(error);return;}
 await loadConversations();
 await openConversation(id);
}

checkAuth().catch(error=>{$("login-error").textContent="Error de conexión. Actualiza la página.";console.error(error?.message||"Error");});
})();
