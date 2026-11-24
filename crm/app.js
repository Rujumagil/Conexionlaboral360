(()=>{'use strict';
const URL="https://qwxydjotwhniahaovrff.supabase.co";
const KEY="sb_publishable_17NekbDHp_ssL_Pf-CnqPg_v0acxqn3";
const WS="c7ab2a78-08e0-4a29-8a3b-fadaf244002f";
const db=window.supabase?.createClient(URL,KEY,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:false}});
const $=(id)=>document.getElementById(id);
let deferredInstallPrompt=null;
window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();deferredInstallPrompt=event;});
window.addEventListener("appinstalled",()=>{$("install-crm-status").textContent="App instalada";deferredInstallPrompt=null;});
async function setupCrmInstall(){
 if("serviceWorker" in navigator&&location.protocol==="https:"){
  try{await navigator.serviceWorker.register(new window.URL("sw.js",document.baseURI).href,{scope:new window.URL("./",document.baseURI).pathname});}
  catch(error){console.warn("La instalación offline no está disponible:",error?.name||"error");}
 }
 const button=$("install-crm");
 button?.addEventListener("click",async()=>{
  if(window.matchMedia("(display-mode: standalone)").matches){$("install-crm-status").textContent="Ya tienes abierta la app instalada";return;}
  if(deferredInstallPrompt){
   const prompt=deferredInstallPrompt;deferredInstallPrompt=null;
   await prompt.prompt();
   const selection=await prompt.userChoice;
   $("install-crm-status").textContent=selection?.outcome==="accepted"?"Instalación solicitada":"Puedes instalar desde el menú del navegador";
  }else{
   $("install-crm-status").textContent=/iPhone|iPad|iPod/i.test(navigator.userAgent)?
    "En Safari: Compartir → Agregar a pantalla de inicio":
    "En Chrome: menú ⋮ → Instalar aplicación o Agregar a pantalla principal";
  }
 });
}

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
  db.from("cl360_candidates").select("id,full_name,phone,job_slug,area,experience,screening_data,stage,source,campaign_attribution,consent_at,assigned_user_id,last_contact_at,next_followup_at,created_at,submission_count").eq("workspace_id",WS).order("created_at",{ascending:false}).limit(500),
  db.from("cl360_jobs").select("id,slug,title,area,location,shift,details,status").eq("workspace_id",WS).order("title"),
  db.from("cl360_followups").select("id,candidate_id,title,due_at,status,assigned_user_id,created_at,updated_at").eq("workspace_id",WS).order("due_at").limit(500)
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
 $("m-qualified").textContent=candidates.filter(x=>x.screening_data&&typeof x.screening_data==="object"&&Object.keys(x.screening_data).length>0).length;
 $("m-overdue").textContent=followups.filter(x=>x.status==="pending"&&new Date(x.due_at).getTime()<now).length;
 $("last-updated").textContent="Actualizado "+new Date().toLocaleTimeString("es-MX");
 renderCandidates();renderFollowups();renderJobManagement();renderFlyAgents();
 renderHome();renderPipeline();renderMarketing();if(activeView==="marketing")void loadMarketingMeta();renderCrmAlerts();maybeNotifyOverdue();await loadConversations();
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

function flyInsightsAt(now=Date.now()){
 const validDue=f=>Number.isFinite(new Date(f.due_at).getTime());
 const pending=followups.filter(f=>f.status==="pending"&&validDue(f));
 const overdue=pending.filter(f=>new Date(f.due_at).getTime()<now).sort((a,b)=>new Date(a.due_at)-new Date(b.due_at));
 const dueSoon=pending.filter(f=>new Date(f.due_at).getTime()>=now&&new Date(f.due_at).getTime()<=now+86400000).sort((a,b)=>new Date(a.due_at)-new Date(b.due_at));
 const newCandidates=candidates.filter(c=>c.stage==="new").sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
 const within=days=>candidates.filter(c=>{const created=new Date(c.created_at).getTime();return Number.isFinite(created)&&created>=now-days*86400000&&created<=now;}).length;
 return {overdue,dueSoon,newCandidates,pendingCount:followups.filter(f=>f.status==="pending").length,doneCount:followups.filter(f=>f.status==="done").length,
  registered7:within(7),registered30:within(30),hiredCount:candidates.filter(c=>c.stage==="hired").length,
  activeCount:candidates.filter(c=>["contacted","screening","interview"].includes(c.stage)).length};
}
function flyActionRow(heading,description,action,label){
 const row=document.createElement("div");row.className="fly-action-row";
 const info=document.createElement("div");
 const name=document.createElement("strong");name.textContent=heading;
 const detail=document.createElement("div");detail.className="small";detail.textContent=description;
 info.append(name,detail);row.append(info);
 if(action){const button=document.createElement("button");button.type="button";button.className="btn ghost";button.textContent=label;button.addEventListener("click",action);row.append(button);}
 return row;
}
// Métricas históricas derivadas exclusivamente de fechas registradas en el CRM.
function historicalStats(days,now=Date.now(),people=candidates,tasks=followups){
 const range=Number(days),start=now-range*86400000;
 const windowed=people.filter(c=>{const d=Date.parse(c.created_at);return Number.isFinite(d)&&d>=start&&d<=now;});
 const contacts=people.filter(c=>{const d=Date.parse(c.last_contact_at);return Number.isFinite(d)&&d>=start&&d<=now;});
 const created=tasks.filter(t=>{const d=Date.parse(t.created_at);return Number.isFinite(d)&&d>=start&&d<=now;});
 const completed=tasks.filter(t=>t.status==="done"&&Date.parse(t.updated_at)>=start&&Date.parse(t.updated_at)<=now);
 const count=range===7?7:range===30?5:13;
 const step=range*86400000/count;
 const buckets=Array.from({length:count},(_,i)=>{
  const from=start+i*step,to=i===count-1?now:start+(i+1)*step;
  const n=windowed.filter(c=>{const d=Date.parse(c.created_at);return d>=from&&(i===count-1?d<=to:d<to);}).length;
  const label=new Date(from).toLocaleDateString("es-MX",{day:"numeric",month:"short"});
  return {label,count:n};
 });
 return {range,registrations:windowed.length,contacts:contacts.length,tasksCreated:created.length,
  currentlyDone:completed.length,buckets};
}
function renderHistory(){
 const select=$("fly-history-period"),summary=$("fly-history-summary"),chart=$("fly-history-chart");
 if(!select||!summary||!chart)return;
 const n=historicalStats(Number(select.value));summary.replaceChildren();chart.replaceChildren();
 const stats=[
  ["Postulaciones recibidas",n.registrations],
  ["Candidatos con contacto registrado",n.contacts],
  ["Tareas creadas",n.tasksCreated],
  ["Tareas marcadas como completadas",n.currentlyDone]
 ];
 for(const [label,value] of stats){
  const block=document.createElement("div");block.className="historical-stat";
  const digit=document.createElement("strong");digit.textContent=String(value);
  const caption=document.createElement("span");caption.textContent=label;
  block.append(digit,caption);summary.append(block);
 }
 const max=Math.max(1,...n.buckets.map(b=>b.count));
 for(const b of n.buckets){
  const item=document.createElement("div");item.className="historical-bar-item";
  const count=document.createElement("span");count.textContent=String(b.count);
  const bar=document.createElement("div");bar.className="historical-bar";
  bar.style.height=Math.max(3,Math.round(110*b.count/max))+"px";
  bar.setAttribute("title",b.count+" postulaciones desde "+b.label);
  const label=document.createElement("small");label.textContent=b.label;
  item.append(count,bar,label);chart.append(item);
 }
 const foot=document.createElement("p");foot.className="small historical-foot";
 foot.textContent="Actividad histórica del CRM. Los contactos se basan en la última fecha registrada por candidato; las tareas completadas usan su última actualización. No representa llamadas de WhatsApp ni tiempos exactos de contratación. Máximo 500 candidatos y 500 tareas cargadas.";
 chart.after(foot);const previous=chart.parentElement.querySelectorAll(".historical-foot");
 for(const element of [...previous].slice(0,-1))element.remove();
}
let browserReminderEnabled=false,alertTimer=null,previousReminderSignature="";
function alertItems(now=Date.now(),tasks=followups){
 return tasks.filter(t=>t.status==="pending"&&Number.isFinite(Date.parse(t.due_at))&&Date.parse(t.due_at)<now)
  .sort((a,b)=>Date.parse(a.due_at)-Date.parse(b.due_at));
}
function renderCrmAlerts(){
 const overdue=alertItems();
 const badge=$("crm-alerts-count"),list=$("crm-alerts-list");
 badge.hidden=!overdue.length;badge.textContent=String(overdue.length);
 list.replaceChildren();
 if(!overdue.length){const p=document.createElement("p");p.className="small";p.textContent="Sin seguimientos vencidos registrados.";list.append(p);return;}
 for(const f of overdue.slice(0,10)){
  const c=candidates.find(x=>x.id===f.candidate_id);
  const row=document.createElement("div");row.className="alert-task";
  const info=document.createElement("div");const title=document.createElement("strong");title.textContent=f.title;
  const time=document.createElement("small");time.textContent=(c?.full_name||"Candidato")+" · "+fmt(f.due_at);
  info.append(title,time);const button=document.createElement("button");button.className="btn ghost";button.type="button";button.textContent="Revisar";
  button.addEventListener("click",()=>{if(c)openCandidate(c.id);else navigate("seguimientos");$("crm-alerts-panel").classList.add("hide");});
  row.append(info,button);list.append(row);
 }
 if(overdue.length>10){const note=document.createElement("p");note.className="small";note.textContent="Hay "+(overdue.length-10)+" vencimientos adicionales. Revisa la agenda.";list.append(note);}
}
function maybeNotifyOverdue(){
 if(!browserReminderEnabled||!canLoad||!window.Notification||Notification.permission!=="granted")return;
 const items=alertItems().filter(t=>!t.assigned_user_id||t.assigned_user_id===user?.id);
 if(!items.length){previousReminderSignature="";return;}
 const signature=items.map(t=>t.id+":"+t.due_at).sort().join("|");
 if(signature===previousReminderSignature)return;
 previousReminderSignature=signature;
 try{const notification=new Notification("Conexión Laboral 360 · Seguimientos",{body:items.length+" tarea(s) vencida(s) requieren revisión en el CRM.",tag:"cl360-overdue",renotify:false});
  notification.onclick=()=>{window.focus();$("crm-alerts-panel").classList.remove("hide");notification.close();};
 }catch{ $("crm-notification-status").textContent="Tu navegador bloqueó el aviso. Los pendientes siguen visibles en el CRM."; }
}
async function pollDueTasks(){
 if(!canLoad||document.hidden)return;
 const {data,error}=await db.from("cl360_followups").select("id,candidate_id,title,due_at,status,assigned_user_id,created_at,updated_at")
  .eq("workspace_id",WS).eq("status","pending").order("due_at").limit(500);
 if(error)return;
 followups=[...followups.filter(t=>t.status!=="pending"),...(data||[])];
 renderCrmAlerts();maybeNotifyOverdue();
 if(activeView==="inicio"){if(!document.querySelector(".priority-quick-form")){renderFlyAgents();renderHome();}$("m-overdue").textContent=alertItems().length;}
 if(activeView==="fly")renderFlyAgents();
 if(activeView==="seguimientos")renderFollowups();
}
function renderFlyAgents(){
 if(!canLoad)return;
 const current=Date.now(),r=flyInsightsAt(current);
 const review=$("fly-review-list"),tasks=$("fly-followup-list"),performance=$("fly-performance"),home=$("fly-home-alerts");
 if(!review||!tasks||!performance||!home)return;
 $("fly-review-count").textContent=r.newCandidates.length+" por revisar";
 review.replaceChildren();
 if(!r.newCandidates.length)review.append(flyActionRow("Sin registros nuevos pendientes","Astrid puede consultar el historial de candidatos."));
 r.newCandidates.slice(0,10).forEach(c=>{
  const notes=candidateReviewNotes(c);
  const detail=title(c.job_slug)+" · "+fmt(c.created_at)+(notes.length?" · "+notes.join(" "):" · Validar requisitos y siguiente paso.");
  review.append(flyActionRow(c.full_name,detail,()=>openCandidate(c.id),"Ver expediente"));
 });
 if(r.newCandidates.length>10)review.append(flyActionRow("Más registros pendientes","Hay "+(r.newCandidates.length-10)+" expedientes adicionales.",()=>navigate("candidatos"),"Ver todos"));
 $("fly-followup-count").textContent=r.overdue.length+" vencidos";
 tasks.replaceChildren();
 if(!r.overdue.length&&!r.dueSoon.length)tasks.append(flyActionRow("Sin vencimientos detectados","No se encontraron tareas vencidas ni programadas para las próximas 24 horas."));
 r.overdue.slice(0,8).forEach(f=>{
  const c=candidates.find(x=>x.id===f.candidate_id);
  tasks.append(flyActionRow("Vencido: "+f.title,(c?.full_name||"Candidato")+" · Debió atenderse "+fmt(f.due_at),()=>c?openCandidate(c.id):navigate("seguimientos"),"Abrir"));
 });
 r.dueSoon.slice(0,6).forEach(f=>{
  const c=candidates.find(x=>x.id===f.candidate_id);
  tasks.append(flyActionRow("Próximo: "+f.title,(c?.full_name||"Candidato")+" · Programado "+fmt(f.due_at),()=>c?openCandidate(c.id):navigate("seguimientos"),"Abrir"));
 });
 if(r.overdue.length>8||r.dueSoon.length>6)tasks.append(flyActionRow("Más tareas","Consulta la agenda para revisar todos los seguimientos.",()=>navigate("seguimientos"),"Ver agenda"));
 performance.replaceChildren();
 const metrics=[
  ["Postulaciones · últimos 7 días",r.registered7],
  ["Postulaciones · últimos 30 días",r.registered30],
  ["Expedientes sin contactar",r.newCandidates.length],
  ["Candidatos en proceso",r.activeCount],
  ["Contrataciones registradas · total actual",r.hiredCount],
  ["Tareas pendientes · total",r.pendingCount],
  ["Seguimientos vencidos",r.overdue.length],
  ["Seguimientos completados · total registrado",r.doneCount]
 ];
 const grid=document.createElement("div");grid.className="fly-metric-grid";
 metrics.forEach(([label,value])=>{
  const item=document.createElement("div");item.className="fly-mini-metric";
  const number=document.createElement("strong");number.textContent=String(value);
  const caption=document.createElement("span");caption.textContent=label;
  item.append(number,caption);grid.append(item);
 });
 performance.append(grid);
 const disclaimer=document.createElement("p");disclaimer.className="small";
 disclaimer.textContent="Indicadores calculados sobre los registros cargados del CRM (hasta 500 candidatos y 500 tareas). No mide llamadas, mensajes externos ni la fecha real de contratación.";
 performance.append(disclaimer);
 renderHistory();
 home.replaceChildren();
 const heading=document.createElement("p");heading.className="priority-intro";
 heading.textContent="Las postulaciones sin contactar y las tareas con fecha vencida son asuntos diferentes. Puedes abrir el expediente o programar una acción desde aquí.";
 home.append(heading);
 const priorityItems=[
  ...r.overdue.slice(0,5).map(f=>({kind:"overdue",candidate:candidates.find(c=>c.id===f.candidate_id),task:f})),
  ...r.dueSoon.slice(0,3).map(f=>({kind:"soon",candidate:candidates.find(c=>c.id===f.candidate_id),task:f})),
  ...r.newCandidates.filter(c=>!followups.some(f=>f.candidate_id===c.id&&f.status==="pending")).slice(0,6).map(c=>({kind:"new",candidate:c}))
 ];
 if(!priorityItems.length){
  const empty=document.createElement("div");empty.className="priority-empty";
  const message=document.createElement("strong");message.textContent="Sin acciones inmediatas detectadas";
  const text=document.createElement("p");text.textContent="No hay seguimientos vencidos, próximos en 24 horas ni expedientes nuevos sin una tarea pendiente.";
  empty.append(message,text);home.append(empty);
 }
 for(const item of priorityItems){
  const row=document.createElement("div");row.className="priority-item "+item.kind;
  const icon=document.createElement("span");icon.className="priority-icon";icon.textContent=item.kind==="overdue"?"!":item.kind==="soon"?"◷":"♙";
  const info=document.createElement("div");info.className="priority-copy";
  const name=document.createElement("strong");name.textContent=item.candidate?.full_name||"Candidato sin datos cargados";
  const detail=document.createElement("p");
  detail.textContent=item.kind==="new"?title(item.candidate.job_slug)+" · Falta primer contacto":
    (item.task.title||"Seguimiento")+" · "+fmt(item.task.due_at);
  const label=document.createElement("span");label.className="priority-label";
  label.textContent=item.kind==="new"?"Sin contactar":item.kind==="overdue"?"Seguimiento vencido":"Próximas 24 horas";
  info.append(name,detail,label);
  const actions=document.createElement("div");actions.className="priority-actions";
  if(item.candidate){
   const open=document.createElement("button");open.type="button";open.className="btn ghost";
   open.textContent="Expediente";open.addEventListener("click",()=>openCandidate(item.candidate.id));actions.append(open);
   const schedule=document.createElement("button");schedule.type="button";schedule.className="btn";
   schedule.textContent="Programar";schedule.addEventListener("click",()=>showQuickFollowup(row,item.candidate));actions.append(schedule);
  }else{
   const open=document.createElement("button");open.type="button";open.className="btn ghost";
   open.textContent="Ver agenda";open.addEventListener("click",()=>navigate("seguimientos"));actions.append(open);
  }
  row.append(icon,info,actions);home.append(row);
 }
 if(r.newCandidates.length>6||r.overdue.length>5||r.dueSoon.length>3){
  const all=document.createElement("button");all.className="btn ghost";all.textContent="Ver todos los pendientes";all.addEventListener("click",()=>navigate("fly"));home.append(all);
 }
 $("fly-agents-updated").textContent="Actualizado "+new Date(current).toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"});
}
function showQuickFollowup(row,candidate){
 document.querySelectorAll(".priority-quick-form").forEach(x=>x.remove());
 const form=document.createElement("form");form.className="priority-quick-form";
 const top=document.createElement("strong");top.textContent="Programar siguiente contacto · "+candidate.full_name;
 const actions=document.createElement("div");actions.className="priority-form-fields";
 const label=document.createElement("label");label.textContent="Acción";
 const titleInput=document.createElement("input");titleInput.type="text";titleInput.maxLength=200;titleInput.required=true;
 titleInput.placeholder="Ej. Llamar para confirmar disponibilidad";titleInput.setAttribute("aria-label","Acción de seguimiento");
 label.append(titleInput);
 const dateLabel=document.createElement("label");dateLabel.textContent="Fecha y hora";
 const when=document.createElement("input");when.type="datetime-local";when.required=true;
 const now=new Date();const localNow=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,16);
 when.min=localNow;when.setAttribute("aria-label","Fecha y hora del seguimiento");
 dateLabel.append(when);
 const controls=document.createElement("div");controls.className="priority-form-actions";
 const save=document.createElement("button");save.type="submit";save.className="btn yellow";save.textContent="Guardar tarea";
 const cancel=document.createElement("button");cancel.type="button";cancel.className="btn ghost";cancel.textContent="Cancelar";cancel.addEventListener("click",()=>form.remove());
 const feedback=document.createElement("p");feedback.className="small";feedback.setAttribute("role","status");
 controls.append(save,cancel);actions.append(label,dateLabel,controls);form.append(top,actions,feedback);
 form.addEventListener("submit",async event=>{
  event.preventDefault();const task=titleInput.value.trim(),date=new Date(when.value);
  if(task.length<3||!Number.isFinite(date.getTime())||date.getTime()<=Date.now()){
   feedback.textContent="Escribe una acción válida y selecciona una fecha futura.";return;
  }
  save.disabled=true;feedback.textContent="Guardando seguimiento…";
  const {error}=await db.from("cl360_followups").insert({
   workspace_id:WS,candidate_id:candidate.id,title:task,due_at:date.toISOString(),
   status:"pending",created_by:user.id,assigned_user_id:user.id
  });
  if(error){save.disabled=false;feedback.textContent="No se pudo programar la tarea. Verifica tus permisos e inténtalo otra vez.";return;}
  await load();
 });
 row.append(form);titleInput.focus();
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
 '<div class="section-divider"></div><b>Origen publicitario</b>'+
 '<label class="label">Canal</label><div>'+safe(candidate.campaign_attribution?.utm_source||"Sin atribución registrada")+'</div>'+
 '<label class="label">Campaña</label><div>'+safe(candidate.campaign_attribution?.utm_campaign||candidate.campaign_attribution?.campana||"—")+'</div>'+
 '<label class="label">Anuncio</label><div>'+safe(candidate.campaign_attribution?.utm_content||"—")+'</div>'+
 '<label class="label">Medio</label><div>'+safe(candidate.campaign_attribution?.utm_medium||"—")+'</div>'+
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
 conversaciones:"Mensajes y atención humana",seguimientos:"Seguimientos",fly:"Andy · Compás Fly",marketing:"Marketing y campañas",ajustes:"Configuración"
};

/* Marketing: métricas de expedientes cargados, sin simulaciones ni píxel. */
(()=>{
 const sidebar=document.querySelector('.nav-item[data-nav="ajustes"]');
 if(sidebar&&!document.querySelector('[data-nav="marketing"]')){
  const button=document.createElement("button");button.type="button";button.className="nav-item";button.dataset.nav="marketing";
  button.innerHTML='<span class="nav-icon" aria-hidden="true">▥</span> Marketing y campañas';sidebar.before(button);
 }
 const actions=document.querySelector("#view-ajustes .settings-actions");
 if(actions){const b=document.createElement("button");b.type="button";b.className="btn ghost";b.dataset.go="marketing";b.textContent="▥ Marketing y campañas";actions.append(b);}
 const settings=$("view-ajustes");
 if(settings){
  const view=document.createElement("section");view.className="app-view hide";view.dataset.view="marketing";view.id="view-marketing";
  view.innerHTML='<div class="page-intro"><div><span class="tag">CAPTACIÓN Y PUBLICIDAD</span><h2>Marketing y campañas</h2><p>Conoce el origen de las postulaciones y su etapa actual.</p></div></div>'+
   '<section class="panel"><h2>Rendimiento de reclutamiento</h2><p class="small">Datos de hasta 500 expedientes recientes del CRM. Periodo según fecha de registro original. No son estadísticas de clics ni de Meta Ads.</p><label class="label" for="marketing-period">Periodo</label><select id="marketing-period" class="field"><option value="30">Últimos 30 días</option><option value="7">Últimos 7 días</option><option value="all">Todos los expedientes cargados</option></select><div id="marketing-kpis" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:12px;margin-top:18px" aria-live="polite"></div></section>'+
   '<section class="panel"><h2>Resultados por campaña</h2><p class="small">Última atribución registrada en cada expediente; no representa conversiones verificadas por Meta.</p><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;text-align:left"><thead><tr><th scope="col">Canal</th><th scope="col">Campaña</th><th scope="col">Anuncio</th><th scope="col">Postulantes</th><th scope="col">Entrevista</th><th scope="col">Contratados</th></tr></thead><tbody id="marketing-rows"></tbody></table></div></section>'+
   '<section class="panel"><h2>Conexión con Meta Ads</h2><p id="marketing-meta-status" role="status">Verificando cuenta publicitaria…</p><p class="small">Conexión administrada por Compás Evolution. No se solicitan credenciales en este CRM.</p><div id="marketing-meta-metrics" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:12px"></div></section><section class="panel"><h2>Métricas publicitarias pendientes</h2><p>Visitas a la landing, conversaciones iniciadas sin postulación, costo por candidato y conversiones de Meta Ads requieren medición adicional. No se muestran valores ficticios.</p><a class="btn ghost" href="../vacantes/guardias-de-seguridad/?utm_source=facebook&amp;utm_medium=paid_social&amp;utm_campaign=guardias_seguridad&amp;utm_content=anuncio_01" target="_blank" rel="noopener noreferrer">Abrir landing de campaña ↗</a></section>';
  settings.before(view);$("marketing-period").addEventListener("change",renderMarketing);
 }
})();
let marketingMetaVersion=0;
async function loadMarketingMeta(){
 const status=$("marketing-meta-status"),panel=$("marketing-meta-metrics");if(!status||!panel||!canLoad)return;
 const version=++marketingMetaVersion;
 panel.replaceChildren();status.textContent="Consultando estadísticas asignadas…";
 try{
 const result=await db.from("evolution_meta_assigned_metrics").select("external_campaign_id,campaign_name,period_start,period_end,currency,spend,impressions,clicks,synced_at").eq("workspace_id",WS).order("campaign_name");
 if(version!==marketingMetaVersion)return;
 if(result.error)throw result.error;
 const rows=result.data||[];
 if(!rows.length){status.textContent="No hay estadísticas disponibles para esta sesión. Compás Evolution debe sincronizar las campañas asignadas; si persiste, verifica los permisos.";return;}
 status.textContent="Estadísticas de Meta Ads · resumen de siete días por campaña. El periodo de postulaciones se controla por separado.";
 for(const r of rows){
 const card=document.createElement("article");card.style.cssText="grid-column:1/-1;border:1px solid #dce6f1;border-radius:12px;padding:16px";
 const title=document.createElement("h3");title.textContent=r.campaign_name;card.append(title);
 const meta=document.createElement("p");meta.className="small";meta.textContent=r.period_start+" a "+r.period_end+" · Actualizado: "+new Date(r.synced_at).toLocaleString("es-MX");card.append(meta);
 const money=r.spend==null?"—":Number(r.spend).toLocaleString("es-MX",{minimumFractionDigits:2,maximumFractionDigits:2})+" "+(r.currency||"moneda sin confirmar");
 const fmt=v=>v==null?"—":Number(v).toLocaleString("es-MX");
 const values=[["Inversión real",money],["Impresiones",fmt(r.impressions)],["Clics (todos)",fmt(r.clicks)],["CTR (todos)",r.clicks!=null&&Number(r.impressions)>0?(100*Number(r.clicks)/Number(r.impressions)).toFixed(2)+"%":"—"]];
 const grid=document.createElement("div");grid.style.cssText="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px";
 for(const [label,value] of values){const cell=document.createElement("div");const l=document.createElement("div");l.className="small";l.textContent=label;const v=document.createElement("strong");v.textContent=value;v.style.cssText="font-size:1.4rem;display:block";cell.append(l,v);grid.append(cell);}
 card.append(grid);panel.append(card);
 }
 }catch{if(version===marketingMetaVersion)status.textContent="No fue posible consultar las estadísticas asignadas. Consulta con Compás Evolution.";}
}
function renderMarketing(){
 const panel=$("marketing-kpis"),body=$("marketing-rows");if(!panel||!body)return;
 const period=$("marketing-period").value;
 const cutoff=period==="all"?0:Date.now()-Number(period)*86400000;
 const data=candidates.filter(c=>new Date(c.created_at).getTime()>=cutoff);
 const attributed=c=>{const a=c.campaign_attribution;return a&&typeof a==="object"&&Object.keys(a).length>0;};
 const counts=[["Postulantes",data.length],["Con origen registrado",data.filter(attributed).length],["En entrevista",data.filter(c=>c.stage==="interview").length],["Contratados",data.filter(c=>c.stage==="hired").length]];
 panel.replaceChildren();
 for(const [name,value] of counts){const card=document.createElement("div");card.style.cssText="border:1px solid #dce6f1;border-radius:12px;padding:15px";const label=document.createElement("div");label.className="small";label.textContent=name;const n=document.createElement("strong");n.style.cssText="font-size:1.8rem;display:block;color:#092645";n.textContent=String(value);card.append(label,n);panel.append(card);}
 const groups=new Map();
 for(const c of data){const a=c.campaign_attribution||{};const parts=[a.utm_source||"Sin atribución",a.utm_campaign||a.campana||"—",a.utm_content||"—"];const key=JSON.stringify(parts);if(!groups.has(key))groups.set(key,{parts,total:0,interview:0,hired:0});const group=groups.get(key);group.total++;if(c.stage==="interview")group.interview++;if(c.stage==="hired")group.hired++;}
 body.replaceChildren();
 for(const g of [...groups.values()].sort((a,b)=>b.total-a.total)){const tr=document.createElement("tr");for(const value of [...g.parts,g.total,g.interview,g.hired]){const td=document.createElement("td");td.style.cssText="padding:10px 8px;border-top:1px solid #e0e8f0";td.textContent=String(value);tr.append(td);}body.append(tr);}
 if(!groups.size){const tr=document.createElement("tr"),td=document.createElement("td");td.colSpan=6;td.textContent="No hay postulaciones en este periodo.";tr.append(td);body.append(tr);}
}

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
 if(view==="inicio"){renderHome();renderFlyAgents();}
 if(view==="fly")renderFlyAgents();
 if(view==="marketing"){renderMarketing();void loadMarketingMeta();}
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
$("fly-agents-refresh").addEventListener("click",load);
$("fly-history-period").addEventListener("change",renderHistory);
$("crm-alerts-toggle").addEventListener("click",()=>{
 const panel=$("crm-alerts-panel"),open=panel.classList.toggle("hide")===false;
 $("crm-alerts-toggle").setAttribute("aria-expanded",String(open));if(open)renderCrmAlerts();
});
$("crm-alerts-close").addEventListener("click",()=>{$("crm-alerts-panel").classList.add("hide");$("crm-alerts-toggle").setAttribute("aria-expanded","false");});
$("crm-enable-notifications").addEventListener("click",async()=>{
 if(!("Notification" in window)){ $("crm-notification-status").textContent="Este navegador no admite avisos del sistema.";return;}
 if(!window.isSecureContext){$("crm-notification-status").textContent="Se requiere HTTPS para activar avisos.";return;}
 const permission=await Notification.requestPermission();
 if(permission!=="granted"){$("crm-notification-status").textContent="No se concedió permiso. Las alertas siguen disponibles en el CRM.";return;}
 browserReminderEnabled=true;$("crm-notification-status").textContent="Avisos activados mientras la app esté abierta. No se envían con la app cerrada.";
 previousReminderSignature="";maybeNotifyOverdue();
});

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
 const pending=followups.filter(f=>f.status==="pending")
  .sort((a,b)=>new Date(a.due_at).getTime()-new Date(b.due_at).getTime()).slice(0,5);
 const box=$("home-followups");box.replaceChildren();
 if(!pending.length){
  const text=document.createElement("p");text.className="home-empty";
  text.textContent="Todavía no hay tareas programadas. Puedes crear una desde las prioridades de atención o desde un expediente.";
  box.append(text);
 }else{
  pending.forEach(f=>{
   const row=document.createElement("div");row.className="followup-row";
   const info=document.createElement("div");
   const title=document.createElement("b");title.textContent=f.title;
   const caption=document.createElement("div");caption.className="small";
   const c=candidates.find(x=>x.id===f.candidate_id);
   caption.textContent=(c?.full_name||"Candidato")+" · "+fmt(f.due_at);
   const overdue=new Date(f.due_at).getTime()<Date.now();
   if(overdue){const warning=document.createElement("span");warning.className="priority-label";warning.textContent="Vencida";info.append(warning);}
   info.append(title,caption);row.append(info);
   const open=document.createElement("button");open.type="button";open.className="mini-btn";open.textContent="Ver";
   open.addEventListener("click",()=>c?openCandidate(c.id):navigate("seguimientos"));
   row.append(open);box.append(row);
  });
 }
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
function waContact(phone){const digits=String(phone||"").replace(/\D/g,"");return digits.length===10?"52"+digits:digits;}
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
 renderHome();renderInbox();renderFlyAgents();
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
  wa.href="https://wa.me/"+waContact(c.phone)+"?text="+encodeURIComponent("Hola, soy del equipo de Conexión Laboral 360. Revisamos tu postulación para "+title(c.job_slug)+" y nos gustaría continuar tu proceso.");
  wa.textContent="Pasar a WhatsApp ↗";actions.append(wa);
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
 const handoff=document.createElement("section");handoff.className="wa-handoff";
 const htitle=document.createElement("strong");htitle.textContent="Responder personalmente";
 handoff.append(htitle);
 const note=document.createElement("p");note.className="small";
 const isOwner=current.status==="human"&&current.handler_id===user?.id;
 if(current.status==="human"&&!isOwner)note.textContent="Este caso está tomado por otra persona del equipo.";
 else if(!isOwner)note.textContent="Primero pulsa «Tomar conversación» para detener las respuestas de Andy en esta conversación vinculada.";
 else if(!c?.phone)note.textContent="No hay teléfono registrado para abrir el chat de WhatsApp.";
 else note.textContent="Escribe una respuesta, abre WhatsApp y pulsa Enviar allí. El CRM no envía mensajes automáticamente y no puede confirmar su entrega.";
 handoff.append(note);
 if(isOwner&&c?.phone){
  const area=document.createElement("textarea");area.className="field";area.rows=3;area.maxLength=1000;
  area.placeholder="Hola, soy Astrid de Conexión Laboral 360…";
  area.setAttribute("aria-label","Respuesta para enviar por WhatsApp");
  const waLink=document.createElement("a");waLink.className="btn yellow";waLink.textContent="Abrir respuesta en WhatsApp ↗";waLink.target="_blank";waLink.rel="noopener noreferrer";
  waLink.setAttribute("aria-disabled","true");waLink.classList.add("disabled-link");
  const copy=document.createElement("button");copy.type="button";copy.className="btn ghost";copy.textContent="Copiar respuesta";copy.disabled=true;
  const buttons=document.createElement("div");buttons.className="chat-actions";buttons.append(waLink,copy);
  const status=document.createElement("small");status.className="small";status.setAttribute("role","status");
  const sync=()=>{
   const value=area.value.trim();
   copy.disabled=!value;
   if(value){waLink.href="https://wa.me/"+waContact(c.phone)+"?text="+encodeURIComponent(value);waLink.classList.remove("disabled-link");waLink.setAttribute("aria-disabled","false");}
   else{waLink.removeAttribute("href");waLink.classList.add("disabled-link");waLink.setAttribute("aria-disabled","true");}
  };
  area.addEventListener("input",sync);
  copy.addEventListener("click",async()=>{
   try{await navigator.clipboard.writeText(area.value.trim());status.textContent="Respuesta copiada (todavía no enviada).";}
   catch{status.textContent="No se pudo copiar; selecciona el texto manualmente.";}
  });
  handoff.append(area,buttons,status);
 }
 panel.replaceChildren(header,timeline,mini,handoff,form);
 timeline.scrollTop=timeline.scrollHeight;
}
async function changeConversationStatus(id,action){
 const {error}=await db.rpc("cl360_take_conversation",{p_conversation:id,p_action:action});
 if(error){err(error);return;}
 await loadConversations();
 await openConversation(id);
}

setupCrmInstall();
alertTimer=window.setInterval(pollDueTasks,60000);
document.addEventListener("visibilitychange",()=>{if(!document.hidden)pollDueTasks();});
checkAuth().catch(error=>{$("login-error").textContent="Error de conexión. Actualiza la página.";console.error(error?.message||"Error");});
})();
