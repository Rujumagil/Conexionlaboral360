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
  screened.source_channel==="whatsapp_manual"?"RESUMEN DE REGISTRO MANUAL · WHATSAPP":screened.source_channel==="facebook_messenger"?"RESUMEN DE PREENTREVISTA · MESSENGER":"RESUMEN DE PREENTREVISTA · ANDY",
  "Estado: Pendiente de revisión humana",
  "Candidato: "+(candidate.full_name||"Por confirmar"),
  "Teléfono: "+(candidate.phone||"Por confirmar"),
  "Vacante: "+(job?.title||candidate.job_slug||"Por confirmar"),
  "Área: "+(job?.area||candidate.area||"Por confirmar"),
  "Zona anunciada: "+(job?.location||"Por confirmar con Astrid"),
  "Turno anunciado: "+(job?.shift||"Por confirmar con Astrid"),
  "Turno declarado: "+(screened.declared_shift||"Por confirmar"),
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
function authScreen(show){if(show){$("manual-candidate-panel")?.remove();$("filter-candidate-source")?.remove();window.CL360Sound?.reset();operationsLoaded=false;operationsFilter="all";operationsScope="team";agendaFilter="all";agendaKind="all";agendaOwner="all";pipelineQuery="";pipelineJob="";pipelineScope="all";messengerContacts=[];threads=[];candidates=[];followups=[];$("andy-executive")?.remove();browserReminderEnabled=false;executiveAlertCounts={};executiveAlertOwner=null;previousReminderSignature="";$("crm-alerts-list")?.replaceChildren();}$("auth-screen").classList.toggle("hide",!show);$("dashboard").classList.toggle("hide",show);$("signout").classList.toggle("hide",show);}
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
  user=activeUser;staffRole=membership.role;canLoad=true;navigate(viewFromLocation(),null,true);void checkFlyAvailability();$("signed").textContent=activeUser.email||"";authScreen(false);await load();void pollExecutiveNotifications();
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
function whatsappManualPhone(value){
 const raw=String(value??"").trim();
 if(!/^[+0-9(). -]{10,30}$/.test(raw))return "";
 let digits=raw.replace(/\D/g,"");
 if(digits.length===13&&digits.startsWith("521"))digits=digits.slice(-10);
 else if(digits.length===12&&digits.startsWith("52"))digits=digits.slice(-10);
 return /^\d{10}$/.test(digits)?digits:"";
}
function manualCandidateSource(c){
 return c.screening_data?.source_channel==="whatsapp_manual"?"WhatsApp · Registro manual":({whatsapp:"WhatsApp",facebook:"Facebook",landing:"Página web",manual:"Manual",fly:"Andy"})[c.source]||"Sin origen";
}
function mountManualCandidate(){
 if(!$("manual-candidate-form")){
  const intro=document.querySelector?.("#view-candidatos .page-intro");
  if(!intro)return;
  const panel=document.createElement("section");panel.className="panel form-block";panel.id="manual-candidate-panel";
  panel.innerHTML='<div class="panel-head"><div><h2>Registro manual · WhatsApp</h2><p class="small">Agrega a quienes te escriben directamente. No se importan chats ni se envían mensajes automáticos.</p></div><button type="button" class="btn yellow" id="manual-candidate-toggle" aria-expanded="false">+ Registrar candidato</button></div><p id="manual-candidate-status" class="small" role="status" aria-live="polite"></p><form id="manual-candidate-form" class="hide">'+
   '<div class="job-form-grid"><div><label class="label" for="manual-name">Nombre completo *</label><input class="field" id="manual-name" required minlength="3" maxlength="120" autocomplete="off"></div>'+
   '<div><label class="label" for="manual-phone">WhatsApp (México) *</label><input class="field" id="manual-phone" type="tel" required maxlength="30" placeholder="33 1234 5678" autocomplete="off"></div>'+
   '<div><label class="label" for="manual-job">Vacante activa *</label><select class="field" id="manual-job" required><option value="">Selecciona una vacante</option></select></div>'+
   '<div><label class="label" for="manual-zone">Zona de interés</label><input class="field" id="manual-zone" maxlength="120"></div>'+
   '<div><label class="label" for="manual-due">Próximo seguimiento (opcional)</label><input type="datetime-local" class="field" id="manual-due"></div></div>'+
   '<label class="label" for="manual-experience">Experiencia declarada</label><textarea class="field" id="manual-experience" maxlength="1000"></textarea>'+
   '<label class="label" for="manual-note">Nota de seguimiento</label><textarea class="field" id="manual-note" maxlength="1300" placeholder="Resumen de lo acordado, sin documentos ni datos sensibles"></textarea>'+
   '<p><label><input type="checkbox" id="manual-contacted"> Ya respondí personalmente al candidato</label></p>'+
   '<p><label><input type="checkbox" id="manual-consent" required> Confirmo que la persona autorizó el registro de sus datos y conoce el <a href="../aviso-candidatos.html" target="_blank" rel="noopener noreferrer">aviso de privacidad</a>.</label></p>'+
   '<button class="btn yellow" id="manual-save" type="submit">Guardar candidato</button> <button class="btn ghost" id="manual-cancel" type="button">Cancelar</button><p id="manual-error" class="error" role="alert"></p></form>';
  intro.after(panel);
  const close=()=>{$("manual-candidate-form").reset();$("manual-candidate-form").classList.add("hide");$("manual-candidate-toggle").setAttribute("aria-expanded","false");$("manual-error").textContent="";};
  $("manual-candidate-toggle").addEventListener("click",()=>{
   const form=$("manual-candidate-form");
   if(!form.classList.contains("hide")){close();return;}
   $("manual-candidate-status").textContent="";form.classList.remove("hide");$("manual-candidate-toggle").setAttribute("aria-expanded","true");$("manual-name").focus();
  });
  $("manual-cancel").addEventListener("click",close);
  $("manual-candidate-form").addEventListener("submit",async event=>{
   event.preventDefault();
   const save=$("manual-save");
   if(!canLoad||!user||save.disabled)return;
   const actor=user.id,feedback=$("manual-error"),phone=whatsappManualPhone($("manual-phone").value),name=$("manual-name").value.trim(),job=$("manual-job").value,due=$("manual-due").value;
   feedback.textContent="";
   if(name.length<3||!phone||!jobs.some(j=>j.slug===job&&j.status==="active")||!$("manual-consent").checked){feedback.textContent="Verifica nombre, teléfono mexicano, vacante activa y autorización.";return;}
   const date=due?new Date(due):null;
   if(date&&(!Number.isFinite(date.getTime())||date.getTime()<=Date.now()||date.getTime()>Date.now()+90*86400000)){feedback.textContent="Elige un seguimiento futuro dentro de los próximos 90 días.";return;}
   save.disabled=true;
   try{
    const {data,error}=await db.rpc("cl360_register_whatsapp_candidate",{p_name:name,p_phone:phone,p_job_slug:job,p_zone:$("manual-zone").value.trim(),p_experience:$("manual-experience").value.trim(),p_note:$("manual-note").value.trim(),p_consent:true,p_contacted:$("manual-contacted").checked,p_due_at:date?date.toISOString():null});
    if(!canLoad||user?.id!==actor)return;
    if(error||!data?.candidate_id){feedback.textContent=error?.message==="job_not_active"?"La vacante ya no está activa. Actualiza el CRM.":"No se pudo guardar. Revisa los datos e inténtalo nuevamente.";return;}
    close();
    $("manual-candidate-status").textContent=data.already_exists?"Ya existe un expediente con ese teléfono y vacante. No se modificó.":"Candidato registrado desde WhatsApp.";
    await load();
    if(!canLoad||user?.id!==actor)return;
    if(candidates.some(c=>c.id===data.candidate_id)){openCandidate(data.candidate_id);return;}
    const result=await db.from("cl360_candidates").select("id,full_name,phone,job_slug,area,experience,screening_data,stage,source,campaign_attribution,consent_at,assigned_user_id,last_contact_at,next_followup_at,created_at,submission_count").eq("workspace_id",WS).eq("id",data.candidate_id).maybeSingle();
    if(canLoad&&user?.id===actor&&result.data&&!result.error){candidates.push(result.data);openCandidate(result.data.id);}
   }catch{if(canLoad&&user?.id===actor)feedback.textContent="No se pudo confirmar el registro. Reintenta; el servidor evita duplicados.";}
   finally{save.disabled=false;}
  });
  const controls=document.querySelector?.("#candidates-section .controls");
  if(controls){
   const source=document.createElement("select");source.id="filter-candidate-source";source.setAttribute("aria-label","Filtrar por origen o responsable");source.innerHTML='<option value="">Todos los candidatos</option><option value="whatsapp_manual">WhatsApp manual</option><option value="mine">Mis candidatos</option>';controls.append(source);source.addEventListener("change",renderCandidates);
  }
 }
 const select=$("manual-job");if(select){
  const previous=select.value;
  select.innerHTML='<option value="">Selecciona una vacante</option>'+jobs.filter(j=>j.status==="active").map(j=>'<option value="'+safe(j.slug)+'">'+safe(j.title)+'</option>').join("");
  if(jobs.some(j=>j.status==="active"&&j.slug===previous))select.value=previous;
 }
}

function renderCandidates(){
 mountManualCandidate();
 const sourceFilter=$("filter-candidate-source")?.value||"";
 const q=$("search").value.trim().toLocaleLowerCase("es-MX"), stage=$("filter-stage").value, turno=$("filter-turno").value;
 const matching=candidates.filter(x=>(!sourceFilter||sourceFilter==="whatsapp_manual"&&x.screening_data?.source_channel==="whatsapp_manual"||sourceFilter==="mine"&&x.assigned_user_id===user?.id)&&(!stage||x.stage===stage)&&(!turno||turno==="si"&&x.screening_data?.availability==="si"||turno==="revisar"&&["no","consultar"].includes(x.screening_data?.availability)||turno==="none"&&!x.screening_data?.availability)&&(!q||[x.full_name,x.phone,title(x.job_slug)].join(" ").toLocaleLowerCase("es-MX").includes(q)));
 $("result-count").textContent="("+matching.length+")";
 $("candidate-rows").innerHTML=matching.length?matching.map(x=>'<tr data-candidate="'+safe(x.id)+'" tabindex="0" role="button" aria-label="Abrir expediente de '+safe(x.full_name)+'"><td data-label="Candidato"><strong>'+safe(x.full_name)+'</strong><div class="small">'+safe(x.phone)+' · '+safe(manualCandidateSource(x))+'</div></td><td data-label="Vacante">'+safe(title(x.job_slug))+'</td><td data-label="Etapa"><span class="pill '+safe(x.stage)+'">'+safe(stageNames[x.stage]||x.stage)+'</span></td><td data-label="Preentrevista"><span class="pill">'+safe(x.screening_data?.availability==="si"?"Turno disponible":["no","consultar"].includes(x.screening_data?.availability)?"Revisar turno":"Por confirmar")+'</span></td><td data-label="Registro">'+safe(fmt(x.created_at))+'</td></tr>').join(""):'<tr><td colspan="5" class="empty">'+(candidates.length?'No hay candidatos que coincidan con los filtros.':'Todavía no hay postulaciones. Los registros aparecerán aquí cuando una persona complete la preentrevista.')+'</td></tr>';
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
 const badge=$("crm-alerts-count"),list=$("crm-alerts-list");
 list.replaceChildren();
 const events=window.CL360Alerts?.collect(messengerContacts,followups,user?.id)||[];
 badge.hidden=!events.length;badge.textContent=String(events.length);
 if(messengerUnavailable||conversationsLoadError){const p=document.createElement("p");p.className="small";p.textContent="Consulta parcial: actualiza el CRM para revisar ambos canales.";list.append(p);}
 if(!events.length){const p=document.createElement("p");p.className="small";p.textContent="Sin alertas prioritarias detectadas en los registros cargados.";list.append(p);return;}
 for(const event of events.slice(0,30)){
  const contact=messengerContacts.find(x=>x.id===event.id),task=followups.find(x=>x.id===event.id);
  const c=task&&candidates.find(x=>x.id===task.candidate_id);
  const heading=window.CL360Alerts.labels[event.type];
  const detail=contact?(contact.display_name||"Contacto de Facebook"):task?((c?.full_name||"Candidato")+" · "+fmt(task.due_at)):"Caso por revisar";
  list.append(flyActionRow(heading,detail,()=>{if(contact)openMessenger(contact);else if(c)openCandidate(c.id);else navigate("seguimientos");$("crm-alerts-panel").classList.add("hide");},"Revisar"));
 }
 if(events.length>30)list.append(flyActionRow("Más alertas","Consulta todos los casos en el centro de seguimiento.",()=>navigate("seguimientos"),"Abrir centro"));
}
let executiveAlertRunning=false,executiveAlertOwner=null,executiveAlertCounts={};
async function pollExecutiveNotifications(){
 if(!canLoad||!user?.id||!["owner","admin","manager"].includes(staffRole)||executiveAlertRunning)return;
 executiveAlertRunning=true;const owner=user.id;
 const valid=()=>canLoad&&user?.id===owner;
 try{
 const count=async(table,field,value)=>{try{const result=await db.from(table).select("id",{count:"exact",head:true}).eq("workspace_id",WS).eq(field,value);return result.error?null:result.count;}catch{return null;}};
 const [waiting,fresh]=await Promise.all([count("cl360_conversations","status","waiting"),count("cl360_candidates","stage","new")]);
 if(!valid())return;if(executiveAlertOwner!==owner){executiveAlertOwner=owner;executiveAlertCounts={};}
 const list=$("crm-alerts-list");if(!list)return;
 list.querySelector("[data-executive-alerts]")?.remove();
 const section=document.createElement("div");section.dataset.executiveAlerts="true";
 const items=[[waiting,"Conversaciones en espera","conversaciones","waiting"],[fresh,"Candidatos nuevos","candidatos","fresh"]];
 for(const [n,label,target,key] of items){
 if(n==null){section.append(flyActionRow(label,"Datos no disponibles",()=>navigate(target),"Revisar"));continue;}
 if(n>0)section.append(flyActionRow(label+" · "+n,"Pendientes actuales",()=>{navigate(target);$("crm-alerts-panel").classList.add("hide");},"Abrir"));
 if(!valid())return;executiveAlertCounts[key]=n;
 }
 if(!valid())return;list.prepend(section);
 }finally{executiveAlertRunning=false;}
}
function maybeNotifyOverdue(){
 if(!browserReminderEnabled||!canLoad||!user?.id||!operationsLoaded||messengerUnavailable||conversationsLoadError)return;
 const actor=user.id;
 const events=window.CL360Alerts?.collect(messengerContacts,followups,actor)||[];
 void window.CL360Alerts?.notify(actor,events,()=>canLoad&&user?.id===actor&&browserReminderEnabled,routeBase.href).catch(()=>{$("crm-notification-status").textContent="No se pudo mostrar el aviso. Revisa las alertas dentro del CRM.";});
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
 if(activeView==="seguimientos"){renderFollowups();renderOperationsCenter();}
}
let supervisorMarketingVersion=0;
async function renderFlySupervisor(r){
 const review=$("fly-review-list");if(!review||!canLoad)return;
 const view=review.closest("[data-view]");if(!view)return;
 let panel=$("fly-supervisor");if(!panel){panel=document.createElement("section");panel.id="fly-supervisor";panel.className="panel";view.prepend(panel);}
 const version=++supervisorMarketingVersion;
 panel.replaceChildren();
 const heading=document.createElement("h2");heading.textContent="Fly Supervisor · Prioridades del equipo";panel.append(heading);
 const note=document.createElement("p");note.className="small";note.textContent="Coordinación por reglas sobre los registros disponibles del CRM. Astrid conserva el control de las decisiones y acciones.";panel.append(note);
 const items=document.createElement("div");panel.append(items);
 const add=(agent,detail,target)=>items.append(flyActionRow(agent,detail,()=>navigate(target),"Revisar"));
 if(r.overdue.length)add("P1 · Fly Operations",r.overdue.length+" seguimientos vencidos.","seguimientos");
 if(conversationsLoadError)add("P1 · Andy","Bandeja no disponible; actualiza antes de evaluar pendientes.","conversaciones");
 else {const waiting=threads.filter(t=>t.status==="waiting").length;const human=threads.filter(t=>t.status==="human").length;add(waiting?"P1 · Andy":"Andy",waiting+" conversaciones en espera; "+human+" tomadas por una persona (bandeja cargada).","conversaciones");}
 add(r.newCandidates.length?"P2 · Fly Recruitment":"Fly Recruitment",r.newCandidates.length+" expedientes nuevos sin contactar.","candidatos");
 add("P2 · Fly Operations",r.dueSoon.length+" seguimientos próximos en 24 horas.","seguimientos");
 const status=document.createElement("p");status.className="small";status.textContent="Fly Marketing: consultando sincronización…";items.append(status);
 try{const result=await db.from("evolution_meta_assigned_metrics").select("campaign_name,synced_at,spend,impressions,clicks").eq("workspace_id",WS);
 if(version!==supervisorMarketingVersion||!canLoad)return;
 status.remove();
 if(result.error||!result.data?.length)add("P2 · Fly Marketing","Estadísticas no disponibles; verifica sincronización y permisos.","marketing");
 else {const rows=result.data;const stale=rows.filter(x=>!Number.isFinite(Date.parse(x.synced_at))||Date.now()-Date.parse(x.synced_at)>3*3600000).length;const missing=rows.filter(x=>x.spend==null||x.impressions==null||x.clicks==null).length;add(stale||missing?"P2 · Fly Marketing":"Fly Marketing",rows.length+" campañas con resumen; "+stale+" desactualizadas y "+missing+" con métricas incompletas.","marketing");}
 add("Fly Reporting","Consulta y descarga el reporte diario en Marketing.","marketing");
 }catch{if(version===supervisorMarketingVersion&&canLoad)status.textContent="Fly Marketing: no fue posible consultar estadísticas.";}
}
let executiveBriefVersion=0;
async function refreshExecutiveBrief(){
 const panel=$("executive-brief");if(!panel||!canLoad||activeView!=="executive")return;
 const owner=user?.id,version=++executiveBriefVersion;
 const valid=()=>canLoad&&panel.isConnected&&user?.id===owner&&version===executiveBriefVersion;
 const content=panel.querySelector("[data-brief-content]");content.textContent="Consultando prioridades…";
 const count=async(table,filters)=>{try{let q=db.from(table).select("id",{count:"exact",head:true}).eq("workspace_id",WS);q=filters(q);const result=await q;return result.error?null:result.count;}catch{return null;}};
 const now=new Date(),date=now.toISOString();
 const [overdue,waiting,fresh,upcoming,ads]=await Promise.all([
 count("cl360_followups",q=>q.eq("status","pending").lt("due_at",date)),
 count("cl360_conversations",q=>q.eq("status","waiting")),
 count("cl360_candidates",q=>q.eq("stage","new")),
 count("cl360_followups",q=>q.eq("status","pending").gte("due_at",date).lte("due_at",new Date(now.getTime()+86400000).toISOString())),
 (async()=>{try{return await db.from("evolution_meta_assigned_metrics").select("synced_at,spend,impressions,clicks").eq("workspace_id",WS);}catch{return {error:true};}})()
 ]);
 if(!valid())return;
 content.replaceChildren();const dateLabel=document.createElement("p");dateLabel.className="small";dateLabel.textContent="Consultado: "+now.toLocaleString("es-MX",{timeZone:"America/Mexico_City"})+" · Diagnóstico por reglas, sin consumir cuota de Gemini.";content.append(dateLabel);
 const rows=[[overdue,"P1 · Seguimientos vencidos","Revisa primero las tareas atrasadas.","seguimientos"],[waiting,"P1 · Conversaciones en espera","Atiende las conversaciones pendientes de intervención humana.","conversaciones"],[fresh,"P2 · Candidatos nuevos","Revisa expedientes y organiza el primer contacto.","candidatos"],[upcoming,"P2 · Próximas 24 horas","Consulta la agenda de seguimientos.","seguimientos"]];
 let alerts=0,unknown=false;
 for(const [n,label,detail,target] of rows){if(n===null){unknown=true;content.append(flyActionRow(label,"Datos no disponibles. Verifica conexión y permisos.",()=>navigate(target),"Revisar"));}else if(n>0){alerts++;content.append(flyActionRow(label+" · "+n,detail,()=>navigate(target),"Abrir"));}}
 if(ads.error||!ads.data?.length){unknown=true;content.append(flyActionRow("P2 · Marketing","Estadísticas no disponibles. Revisa sincronización y permisos.",()=>navigate("marketing"),"Revisar"));}
 else{const stale=ads.data.filter(x=>!Number.isFinite(Date.parse(x.synced_at))||now.getTime()-Date.parse(x.synced_at)>10800000).length;const missing=ads.data.filter(x=>x.spend==null||x.impressions==null||x.clicks==null).length;if(stale||missing){alerts++;content.append(flyActionRow("P2 · Marketing",stale+" resúmenes desactualizados; "+missing+" con métricas incompletas. No evalúes el rendimiento hasta verificar los datos.",()=>navigate("marketing"),"Revisar"));}}
 if(!alerts&&!unknown)content.append(flyActionRow("Sin pendientes detectados","No se encontraron alertas en los indicadores consultados."));
}
async function refreshExecutiveGoals(){
 const panel=$("executive-goals");if(!panel||!canLoad||!["owner","admin","manager"].includes(staffRole))return;
 const owner=user?.id,valid=()=>canLoad&&panel.isConnected&&user?.id===owner;
 const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Mexico_City",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
 const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));const day=new Date(p.year+"-"+p.month+"-"+p.day+"T00:00:00Z");day.setUTCDate(day.getUTCDate()-((day.getUTCDay()+6)%7));const start=day.toISOString().slice(0,10);day.setUTCDate(day.getUTCDate()+7);const end=day.toISOString().slice(0,10);
 const from=start+"T00:00:00-06:00",until=end+"T00:00:00-06:00";
 panel.replaceChildren();const h=document.createElement("h3");h.textContent="Objetivos de la semana";panel.append(h);const note=document.createElement("p");note.className="small";note.textContent="Semana desde "+start+" hasta antes del "+end+" · Ciudad de México. Contactos: expedientes cuya última fecha de contacto corresponde a esta semana, no número de llamadas.";panel.append(note);
 const status=document.createElement("p");status.setAttribute("role","status");status.textContent="Consultando metas…";panel.append(status);
 try{
 const count=field=>db.from("cl360_candidates").select("id",{count:"exact",head:true}).eq("workspace_id",WS).gte(field,from).lt(field,until);
 const [goal,apps,contacts]=await Promise.all([db.from("cl360_weekly_goals").select("applications_target,contacts_target").eq("workspace_id",WS).eq("week_start",start).maybeSingle(),count("created_at"),count("last_contact_at")]);
 if(!valid())return;if(goal.error){status.textContent="No fue posible cargar metas. Verifica permisos.";return;}
 status.textContent=goal.data?"Metas registradas":"Configura las metas de esta semana.";
 const form=document.createElement("form");form.style.cssText="display:grid;gap:10px";
 const fields=[["Postulaciones nuevas",goal.data?.applications_target,apps],["Expedientes contactados",goal.data?.contacts_target,contacts]];
 const inputs=[];
 for(const [name,target,result] of fields){const label=document.createElement("label");label.textContent=name+" · avance: "+(result.error||result.count==null?"No disponible":result.count)+(target?" / "+target:"");const input=document.createElement("input");input.type="number";input.min="1";input.max="10000";input.step="1";input.required=true;input.className="field";input.value=target??"";input.placeholder="Meta semanal";label.append(input);form.append(label);inputs.push(input);if(target&&!result.error&&result.count!=null){const progress=document.createElement("progress");progress.max=target;progress.value=Math.min(target,result.count);progress.style.width="100%";progress.setAttribute("aria-label",name);form.append(progress);}}
 const save=document.createElement("button");save.type="submit";save.className="btn yellow";save.textContent="Guardar objetivos";form.append(save);panel.append(form);
 form.onsubmit=async e=>{e.preventDefault();if(!valid()||save.disabled)return;save.disabled=true;try{const result=await db.from("cl360_weekly_goals").upsert({workspace_id:WS,week_start:start,applications_target:Number(inputs[0].value),contacts_target:Number(inputs[1].value)},{onConflict:"workspace_id,week_start"});if(!valid())return;if(result.error){status.textContent="No se pudieron guardar los objetivos.";return;}await refreshExecutiveGoals();}catch{if(valid())status.textContent="Error al guardar objetivos.";}finally{save.disabled=false;}};
 }catch{if(valid())status.textContent="No se pudieron consultar los objetivos.";}
}
function mountExecutiveReports(){
 const panel=document.createElement("details");panel.id="executive-reports";panel.style.cssText="border:1px solid #dce6f1;border-radius:12px;padding:14px;margin:12px 0";
 const heading=document.createElement("summary");heading.textContent="Centro de reportes ejecutivos";heading.style.cssText="font-weight:700;cursor:pointer";panel.append(heading);
 const desc=document.createElement("p");desc.className="small";desc.textContent="Reportes bajo demanda con indicadores agregados del CRM. No consumen cuota de Gemini. Los periodos usan horario de Ciudad de México.";panel.append(desc);
 const select=document.createElement("select");select.className="field";select.setAttribute("aria-label","Tipo de reporte");
 for(const [value,label] of [["morning","Inicio del día"],["close","Cierre del día"],["week","Semana actual"],["month","Mes actual"]]){const o=document.createElement("option");o.value=value;o.textContent=label;select.append(o);}
 const controls=document.createElement("div");controls.style.cssText="display:flex;gap:8px;flex-wrap:wrap";const generate=document.createElement("button");generate.type="button";generate.className="btn yellow";generate.textContent="Generar reporte";const download=document.createElement("button");download.type="button";download.className="btn ghost";download.textContent="Descargar TXT";download.disabled=true;controls.append(select,generate,download);panel.append(controls);
 const output=document.createElement("div");output.setAttribute("role","status");output.style.cssText="margin-top:12px;white-space:pre-wrap;overflow-wrap:anywhere";panel.append(output);
 let saved="",filename="",version=0;
 select.onchange=()=>{version++;saved="";download.disabled=true;generate.disabled=false;output.textContent="Genera un reporte para el periodo seleccionado.";};
 download.onclick=()=>{if(!saved||!canLoad||!panel.isConnected)return;const href=window.URL.createObjectURL(new Blob([saved],{type:"text/plain;charset=utf-8"}));const a=document.createElement("a");a.href=href;a.download=filename;a.click();setTimeout(()=>window.URL.revokeObjectURL(href),1000);};
 generate.onclick=async()=>{
 if(!canLoad||!panel.isConnected||!["owner","admin","manager"].includes(staffRole))return;
 const owner=user?.id,run=++version,kind=select.value,valid=()=>canLoad&&panel.isConnected&&user?.id===owner&&run===version;
 generate.disabled=true;download.disabled=true;saved="";output.textContent="Consultando indicadores…";
 try{
 const now=new Date(),parts=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:"America/Mexico_City",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now).map(x=>[x.type,x.value]));
 const day=new Date(parts.year+"-"+parts.month+"-"+parts.day+"T00:00:00Z"),today=day.toISOString().slice(0,10),monday=new Date(day);monday.setUTCDate(day.getUTCDate()-((day.getUTCDay()+6)%7));const weekStart=monday.toISOString().slice(0,10);
 if(kind==="week")day.setTime(monday.getTime());if(kind==="month")day.setUTCDate(1);
 const start=day.toISOString().slice(0,10),from=start+"T00:00:00-06:00",until=now.toISOString();
 const count=async(table,filter)=>{try{const result=await filter(db.from(table).select("id",{count:"exact",head:true}).eq("workspace_id",WS));return result.error?null:result.count;}catch{return null;}};
 const period=(q,field)=>q.gte(field,from).lte(field,until);
 const [apps,contacts,tasks,overdue,waiting,fresh,goals,ads]=await Promise.all([
 count("cl360_candidates",q=>period(q,"created_at")),count("cl360_candidates",q=>period(q,"last_contact_at")),count("cl360_followups",q=>period(q,"created_at")),count("cl360_followups",q=>q.eq("status","pending").lt("due_at",until)),count("cl360_conversations",q=>q.eq("status","waiting")),count("cl360_candidates",q=>q.eq("stage","new")),
 Promise.resolve(db.from("cl360_weekly_goals").select("applications_target,contacts_target").eq("workspace_id",WS).eq("week_start",weekStart).maybeSingle()).catch(()=>({error:true})),
 Promise.resolve(db.from("evolution_meta_assigned_metrics").select("period_start,period_end,currency,spend,impressions,clicks,synced_at").eq("workspace_id",WS).limit(20)).catch(()=>({error:true}))
 ]);
 if(!valid())return;const v=n=>n==null?"No disponible":String(n);const lines=["CONEXIÓN LABORAL 360 · "+select.options[select.selectedIndex].textContent.toUpperCase(),"Generado: "+now.toLocaleString("es-MX",{timeZone:"America/Mexico_City"}),"Periodo operativo: "+start+" hasta el momento de consulta ("+today+").","", "RESULTADOS DEL PERIODO","Postulaciones nuevas: "+v(apps),"Expedientes cuya última fecha de contacto cae en el periodo: "+v(contacts),"Seguimientos creados: "+v(tasks),"","PENDIENTES ACTUALES (no históricos)","Seguimientos vencidos: "+v(overdue),"Conversaciones en espera: "+v(waiting),"Expedientes en etapa nueva: "+v(fresh)];
 if(kind==="week"){lines.push("","METAS SEMANALES");if(goals.error)lines.push("No disponibles");else if(!goals.data)lines.push("Sin metas configuradas");else for(const [label,actual,target] of [["Postulaciones",apps,goals.data.applications_target],["Contactos",contacts,goals.data.contacts_target]])lines.push(label+": "+v(actual)+" / "+target+(actual==null?"":" · "+Math.round(actual/target*100)+"% · faltan "+Math.max(0,target-actual)));}
 lines.push("","MARKETING · Periodos independientes del reporte operativo");if(ads.error||!ads.data?.length)lines.push("Datos no disponibles");else for(const a of ads.data)lines.push(a.period_start+" a "+a.period_end+" · inversión "+v(a.spend)+" "+(a.currency||"")+" · impresiones "+v(a.impressions)+" · clics "+v(a.clicks)+" · "+(!Number.isFinite(Date.parse(a.synced_at))||now.getTime()-Date.parse(a.synced_at)>10800000?"sincronización desactualizada":"sincronización reciente"));
 lines.push("","PRIORIDADES RECOMENDADAS (reglas Compás Fly)");if(overdue>0)lines.push("• Atender seguimientos vencidos.");if(waiting>0)lines.push("• Atender conversaciones en espera.");if(fresh>0)lines.push("• Organizar el primer contacto de expedientes nuevos.");if([overdue,waiting,fresh].some(x=>x==null))lines.push("• Verificar indicadores no disponibles.");if(overdue===0&&waiting===0&&fresh===0)lines.push("• Mantener seguimiento de la operación.");
 lines.push("","Notas: no se contabilizan entrevistas ni contrataciones del periodo sin fechas específicas. Contactos no equivale a número de llamadas. No se suman periodos publicitarios superpuestos. Este reporte no es un histórico inmutable.");
 saved=lines.join("\n");filename="CL360-"+kind+"-"+today+".txt";output.textContent=saved;download.disabled=false;
 }catch{if(valid())output.textContent="No fue posible generar el reporte.";}finally{if(valid())generate.disabled=false;}
 };
 return panel;
}
function mountAndyExecutive(){
 if(!canLoad)return;
 const view=$("view-executive");if(!view||$("andy-executive"))return;
 const panel=document.createElement("section");panel.className="panel";panel.id="andy-executive";
 const title=document.createElement("h2");title.textContent="Andy Executive · Asistente privado";panel.append(title);
 const intro=document.createElement("p");intro.className="small";intro.textContent="Asistente de solo lectura. Puedes activar Gemini para preguntas abiertas: se enviarán tus preguntas, contexto reciente e indicadores agregados. No incluyas nombres ni datos personales de candidatos.";panel.append(intro);
 const consent=document.createElement("input");consent.type="checkbox";consent.disabled=!["owner","admin","manager"].includes(staffRole);const consentLabel=document.createElement("label");consentLabel.style.cssText="display:flex;gap:8px;align-items:center;margin:12px 0";consentLabel.append(consent,document.createTextNode("Usar IA generativa (Gemini)"));panel.append(consentLabel);const mode=document.createElement("p");mode.className="small";mode.setAttribute("role","status");mode.textContent="Modo guiado";panel.append(mode);let executiveHistory=[];consent.onchange=()=>{executiveHistory=[];mode.textContent=consent.checked?"IA solicitada · pendiente de respuesta":"Modo guiado";};
 const log=document.createElement("div");log.setAttribute("role","log");log.setAttribute("aria-live","polite");log.style.cssText="height:clamp(280px,52vh,650px);overflow:auto;padding:16px;background:#f2f6fb;border-radius:12px";
 const bubble=(who,message)=>{const row=document.createElement("div");row.style.cssText="margin:10px 0;padding:12px;border-radius:14px;max-width:88%;overflow-wrap:anywhere;background:"+(who==="Tú"?"#e0ecfa;margin-left:auto":"white;margin-right:auto");const label=document.createElement("strong");label.textContent=who;const body=document.createElement("div");body.style.whiteSpace="pre-wrap";if(who==="Andy Executive · IA generativa"){const lines=String(message).split("\n");body.style.whiteSpace="normal";const inline=(node,value)=>{for(const part of value.split(/(\*\*[^*]+\*\*)/g)){if(part.startsWith("**")&&part.endsWith("**")){const b=document.createElement("strong");b.textContent=part.slice(2,-2);node.append(b);}else node.append(document.createTextNode(part));}};let list=null;for(const line of lines){const t=line.trim();if(!t){list=null;continue;}const bullet=t.match(/^[-*]\s+(.+)$/),number=t.match(/^\d+\.\s+(.+)$/);if(bullet||number){const tag=bullet?"UL":"OL";if(!list||list.tagName!==tag){list=document.createElement(tag.toLowerCase());list.style.cssText="padding-left:22px;margin:8px 0";body.append(list);}const li=document.createElement("li");inline(li,(bullet||number)[1]);list.append(li);}else{list=null;const h=t.match(/^#{1,4}\s+(.+)$/);const p=document.createElement(h?"h4":"div");p.style.margin="8px 0";inline(p,h?h[1]:t);body.append(p);}}}else body.textContent=message;row.append(label,body);log.append(row);while(log.children.length>20)log.firstChild.remove();log.scrollTop=log.scrollHeight;};
 bubble("Andy Executive","Hola. Puedo ayudarte a revisar tus prioridades, candidatos, conversaciones, publicidad y resultados de los últimos siete días.");
 const form=document.createElement("form");form.style.cssText="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap";
 const input=document.createElement("input");input.className="field";input.placeholder="Escribe tu pregunta a Andy Executive…";input.setAttribute("aria-label","Pregunta para Andy Executive");input.maxLength=500;input.required=true;input.style.flex="1 1 200px";
 const send=document.createElement("button");send.className="btn yellow";send.type="submit";send.textContent="Enviar";form.append(input,send);
 const shortcuts=document.createElement("div");shortcuts.style.cssText="display:flex;flex-wrap:wrap;gap:6px;margin:12px 0";
 let busy=false;
 const ask=async(question)=>{
 if(busy||!canLoad||!question.trim())return;busy=true;send.disabled=true;consent.disabled=true;const owner=user?.id;const valid=()=>canLoad&&panel.isConnected&&user?.id===owner;bubble("Tú",question);
 if(consent.checked){mode.textContent="Consultando IA…";try{const {data:{session}}=await db.auth.getSession();if(!valid())return;if(!session)throw Error("session");const response=await fetch(URL+"/functions/v1/cl360-andy-executive",{method:"POST",headers:{apikey:KEY,authorization:"Bearer "+session.access_token,"content-type":"application/json"},body:JSON.stringify({consent:true,message:question,history:executiveHistory.slice(-10)}),signal:AbortSignal.timeout(45000)});const result=await response.json();if(!valid())return;if(response.ok&&result.ai===true&&typeof result.reply==="string"&&result.reply.trim()){bubble("Andy Executive · IA generativa",result.reply);executiveHistory=[...executiveHistory,{role:"user",text:question},{role:"assistant",text:result.reply}].slice(-10);mode.textContent="Última respuesta: IA generativa";busy=false;send.disabled=false;consent.disabled=false;return;}mode.textContent=response.status===429?"Cuota agotada · respuesta guiada":"IA no disponible · respuesta guiada";}catch{if(!valid())return;mode.textContent="IA no disponible · respuesta guiada";}}else mode.textContent="Modo guiado";
 if(!valid())return;
 const q=question.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
 const now=Date.now(),r=flyInsightsAt(now);let answer="",target=null;
 const day=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Mexico_City",year:"numeric",month:"2-digit",day:"2-digit"});
 const today=followups.filter(f=>f.status==="pending"&&Date.parse(f.due_at)>=now&&day.format(new Date(f.due_at))===day.format(now)).length;
 try{
 if(/publicidad|campana|marketing|meta|anuncio|inversion/.test(q)){
 target="marketing";const result=await db.from("evolution_meta_assigned_metrics").select("campaign_name,period_start,period_end,spend,currency,impressions,clicks,synced_at").eq("workspace_id",WS);
 if(result.error||!result.data?.length)answer="No tengo estadísticas publicitarias disponibles. Revisa sincronización y permisos en Marketing.";
 else answer=result.data.map(x=>x.campaign_name+" · "+x.period_start+" a "+x.period_end+"\nInversión: "+(x.spend==null?"No disponible":x.spend+" "+(x.currency||""))+" · Impresiones: "+(x.impressions??"No disponible")+" · Clics: "+(x.clicks??"No disponible")+"\n"+(Date.now()-Date.parse(x.synced_at)>3*3600000?"Sincronización desactualizada; revisa Compás Evolution.":"Consulta el embudo en Marketing.")).join("\n\n");
 }else if(/semana|resultados|rendimiento/.test(q)){target="fly";answer="Últimos siete días: "+r.registered7+" postulaciones registradas. Actualmente hay "+r.activeCount+" candidatos en proceso y "+r.hiredCount+" contrataciones registradas en total (no necesariamente de esta semana).";}
 else if(/conversacion|mensaje|bandeja/.test(q)){target="conversaciones";answer=conversationsLoadError?"No puedo consultar la bandeja actualmente.":"En la bandeja cargada hay "+threads.filter(t=>t.status==="waiting").length+" conversaciones en espera y "+threads.filter(t=>t.status==="human").length+" tomadas por una persona.";}
 else if(/atrasad|vencid/.test(q)){target="seguimientos";answer="Hay "+r.overdue.length+" seguimientos vencidos. Revisa primero los más antiguos en la agenda.";}
 else if(/candidato|contactad|contacto/.test(q)){target="candidatos";answer="Hay "+r.newCandidates.length+" expedientes en etapa nueva. Revisa el primer contacto antes de cambiar su estado.";}
 else if(/pendiente|hoy|agenda|prioridad|seguimiento|entrevista/.test(q)){target="seguimientos";answer="Prioridades de hoy: "+r.overdue.length+" seguimientos vencidos, "+today+" tareas pendientes para el resto del día y "+r.newCandidates.length+" expedientes nuevos. Revisa primero los vencimientos y luego las conversaciones en espera.";}
 else answer="Todavía no puedo responder esa pregunta. Prueba con pendientes de hoy, candidatos sin contactar, conversaciones, publicidad o resultados de la semana.";
 if(!canLoad||!panel.isConnected)return;
 bubble("Andy Executive · respuesta guiada",answer+"\n\nDatos disponibles en el CRM; los conteos locales pueden estar limitados a los registros cargados.");
 if(target){const b=document.createElement("button");b.className="btn ghost";b.type="button";b.textContent="Abrir módulo relacionado";b.onclick=()=>navigate(target);log.lastChild.append(b);}
 }catch{if(canLoad&&panel.isConnected)bubble("Andy Executive","No pude consultar los datos. Intenta actualizar el CRM.");}finally{busy=false;send.disabled=false;consent.disabled=!["owner","admin","manager"].includes(staffRole);}
 };
 for(const question of ["¿Qué pendientes tengo hoy?","¿Qué candidatos no he contactado?","¿Hay conversaciones pendientes?","¿Cómo va mi publicidad?","¿Qué seguimientos están vencidos?","¿Qué resultados tuve esta semana?"]){const b=document.createElement("button");b.className="btn ghost";b.type="button";b.textContent=question;b.onclick=()=>void ask(question);shortcuts.append(b);}
 form.onsubmit=e=>{e.preventDefault();if(busy)return;const q=input.value.trim();if(q){input.value="";void ask(q);}};
 const clear=document.createElement("button");clear.type="button";clear.className="btn ghost";clear.textContent="Limpiar chat";clear.onclick=()=>{if(!busy){log.replaceChildren();executiveHistory=[];}};const brief=document.createElement("section");brief.id="executive-brief";brief.style.cssText="border:1px solid #dce6f1;border-radius:12px;padding:14px;margin:12px 0";const heading=document.createElement("h3");heading.textContent="Tu día con Andy · Prioridades";const content=document.createElement("div");content.dataset.briefContent="true";const refresh=document.createElement("button");refresh.type="button";refresh.className="btn ghost";refresh.textContent="Actualizar prioridades";refresh.onclick=()=>void refreshExecutiveBrief();brief.append(heading,content,refresh);const goals=document.createElement("section");goals.id="executive-goals";goals.style.cssText="border:1px solid #dce6f1;border-radius:12px;padding:14px;margin:12px 0";if(["owner","admin","manager"].includes(staffRole))panel.append(goals);if(["owner","admin","manager"].includes(staffRole))panel.append(mountExecutiveReports());panel.append(brief,log,form,shortcuts,clear);view.prepend(panel);
}
function renderFlyAgents(){
 if(!canLoad)return;
 const current=Date.now(),r=flyInsightsAt(current);
 if(activeView==="fly")void renderFlySupervisor(r);
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
let agendaFilter="all",agendaKind="all",agendaOwner="all";
function followupKind(title){const q=String(title||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();return /\bentrevistas?\b/.test(q)?"interview":/\b(llamar|llamada|llamadas|telefonica|telefonico|marcar)\b/.test(q)?"call":"other";}
function agendaMatches(f,kind,owner,actor){return (kind==="all"||followupKind(f.title)===kind)&&(owner==="all"||owner==="mine"&&f.assigned_user_id===actor||owner==="unassigned"&&!f.assigned_user_id);}
function validFutureFollowup(value,now=Date.now()){const ms=Date.parse(value);return Number.isFinite(ms)&&ms>now;}

function renderFollowups(){
 const panel=$("followups");if(!panel)return;
 const now=Date.now(),dayFormat=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Mexico_City",year:"numeric",month:"2-digit",day:"2-digit"});
 const day=dayFormat.format(now);
 const allPending=followups.filter(f=>f.status==="pending");
 const pending=allPending.filter(f=>agendaMatches(f,agendaKind,agendaOwner,user?.id)).sort((a,b)=>(Date.parse(a.due_at)||Infinity)-(Date.parse(b.due_at)||Infinity));
 const overdue=pending.filter(f=>Number.isFinite(Date.parse(f.due_at))&&Date.parse(f.due_at)<now);
 const today=pending.filter(f=>Date.parse(f.due_at)>=now&&dayFormat.format(new Date(f.due_at))===day);
 const future=pending.filter(f=>Date.parse(f.due_at)>=now&&dayFormat.format(new Date(f.due_at))!==day);
 const undated=pending.filter(f=>!Number.isFinite(Date.parse(f.due_at)));
 panel.replaceChildren();
 const heading=document.createElement("h3");heading.textContent="Agenda inteligente · Fly Operations";panel.append(heading);
 const intro=document.createElement("p");intro.className="small";intro.textContent="Prioridades según vencimiento registrado, hora de Ciudad de México. Incluye entrevistas cuando están programadas como seguimiento. Datos cargados del CRM.";panel.append(intro);
 const filters=document.createElement("div");filters.className="agenda-controls";
 const addFilter=(label,options,value,set)=>{const wrap=document.createElement("label");wrap.textContent=label;const select=document.createElement("select");select.className="field";select.setAttribute("aria-label",label);for(const [key,text] of options){const o=document.createElement("option");o.value=key;o.textContent=text;select.append(o);}select.value=value;select.onchange=()=>{set(select.value);renderFollowups();};wrap.append(select);filters.append(wrap);};
 addFilter("Tipo de actividad",[["all","Todas"],["call","Llamadas"],["interview","Entrevistas"],["other","Otros seguimientos"]],agendaKind,v=>{agendaKind=v;});
 addFilter("Responsable",[["all","Todo el equipo"],["mine","Mis tareas"],["unassigned","Sin asignar"]],agendaOwner,v=>{agendaOwner=v;});
 panel.append(filters);
 const groups=[["overdue","Vencidos",overdue],["today","Hoy · por atender",today],["future","Próximos días",future],["undated","Sin fecha válida",undated]];
 const summary=document.createElement("div");summary.className="fly-metric-grid";
 for(const [key,label,items] of groups){const b=document.createElement("button");b.type="button";b.className="fly-mini-metric";b.style.cssText="cursor:pointer;text-align:left;border:1px solid #dce6f1;background:white;"+(agendaFilter===key?"outline:2px solid #155486":"");b.setAttribute("aria-pressed",String(agendaFilter===key));const n=document.createElement("strong");n.textContent=String(items.length);const t=document.createElement("span");t.textContent=label;b.append(n,t);b.onclick=()=>{agendaFilter=agendaFilter===key?"all":key;renderFollowups();};summary.append(b);}panel.append(summary);
 const all=document.createElement("button");all.type="button";all.className="btn ghost";all.textContent="Mostrar todos";all.onclick=()=>{agendaFilter="all";renderFollowups();};panel.append(all);
 for(const [key,label,items] of groups){if(agendaFilter!=="all"&&agendaFilter!==key)continue;const h=document.createElement("h4");h.textContent=label+" · "+items.length;panel.append(h);
 if(!items.length){const p=document.createElement("p");p.className="small";p.textContent="Sin tareas en esta sección.";panel.append(p);continue;}
 for(const f of items){const c=candidates.find(x=>x.id===f.candidate_id);const row=flyActionRow(f.title,(c?.full_name||"Candidato")+" · "+(Number.isFinite(Date.parse(f.due_at))?new Date(f.due_at).toLocaleString("es-MX",{timeZone:"America/Mexico_City"}):"Fecha por revisar"),c?()=>openCandidate(c.id):null,"Expediente");
 const actions=document.createElement("div");actions.className="agenda-row-actions";
 const tag=document.createElement("span");tag.className="pill";tag.textContent=({call:"Llamada",interview:"Entrevista",other:"Seguimiento"})[followupKind(f.title)]+(f.assigned_user_id===user?.id?" · Mi tarea":!f.assigned_user_id?" · Sin asignar":" · Asignada");actions.append(tag);
 const feedback=document.createElement("p");feedback.className="small";feedback.setAttribute("role","status");
 const done=document.createElement("button");done.type="button";done.className="btn ghost";done.textContent="Completar";
 const move=document.createElement("button");move.type="button";move.className="btn ghost";move.textContent="Reprogramar";
 let busy=false;const actor=user?.id;
 async function updateTask(changes){
  if(busy||!canLoad||!actor||user?.id!==actor)return false;
  busy=true;done.disabled=true;move.disabled=true;
  try{let query=db.from("cl360_followups").update(changes).eq("id",f.id).eq("workspace_id",WS).eq("status","pending");
   if(f.due_at)query=query.eq("due_at",f.due_at);
   const {data,error}=await query.select("id");
   if(error||!Array.isArray(data)||data.length!==1){feedback.textContent="No se confirmó el cambio. Actualiza la agenda y revisa permisos.";return false;}
   await load();return true;
  }catch{feedback.textContent="No se confirmó el cambio. Actualiza la agenda antes de reintentar.";return false;}finally{busy=false;done.disabled=false;move.disabled=false;}
 }
 done.onclick=()=>{if(confirm("¿Confirmas que esta actividad se realizó? No se cambiará la etapa del candidato."))void updateTask({status:"done"});};
 move.onclick=()=>{if(busy||row.querySelector(".agenda-reschedule"))return;
  const form=document.createElement("form");form.className="agenda-reschedule";
  const label=document.createElement("label");label.textContent="Nueva fecha y hora (zona horaria de este dispositivo)";
  const input=document.createElement("input");input.type="datetime-local";input.className="field";input.required=true;
  const old=new Date(f.due_at);if(Number.isFinite(old.getTime()))input.value=new Date(old.getTime()-old.getTimezoneOffset()*60000).toISOString().slice(0,16);
  label.append(input);const save=document.createElement("button");save.type="submit";save.className="btn";save.textContent="Guardar nueva fecha";
  const cancel=document.createElement("button");cancel.type="button";cancel.className="btn ghost";cancel.textContent="Cancelar";cancel.onclick=()=>{if(!busy)form.remove();};
  form.append(label,save,cancel);form.onsubmit=async e=>{e.preventDefault();if(!validFutureFollowup(input.value)){feedback.textContent="Selecciona una fecha futura válida.";return;}save.disabled=true;await updateTask({due_at:new Date(input.value).toISOString()});save.disabled=false;};
  row.append(form);input.focus();
 };
 actions.append(move,done);row.append(actions,feedback);panel.append(row);}
 }
 const r=flyInsightsAt(now),unplanned=r.newCandidates.filter(c=>!allPending.some(f=>f.candidate_id===c.id));const h=document.createElement("h3");h.textContent="Candidatos nuevos sin seguimiento pendiente · "+unplanned.length;panel.append(h);
 for(const c of unplanned.slice(0,10))panel.append(flyActionRow(c.full_name,title(c.job_slug)+" · Primer contacto por revisar",()=>openCandidate(c.id),"Programar desde expediente"));
 if(unplanned.length>10)panel.append(flyActionRow("Más expedientes","Consulta los candidatos restantes.",()=>navigate("candidatos"),"Ver candidatos"));
 if(!unplanned.length){const p=document.createElement("p");p.className="small";p.textContent="Sin expedientes nuevos sin tarea pendiente entre los registros cargados.";panel.append(p);}
}
async function renderDetail(candidate){
 if(!candidate)return;
 $("detail").classList.remove("hide");
 $("detail").scrollIntoView({behavior:"smooth",block:"start"});
 const rawPhone=String(candidate.phone).replace(/[^+0-9]/g,"");
 const phone=/^[0-9]{10}$/.test(rawPhone)?"+52"+rawPhone:rawPhone;
 const dateOptions=Object.entries(stageNames).map(([v,t])=>'<option value="'+v+'" '+(candidate.stage===v?"selected":"")+'>'+safe(t)+'</option>').join("");
 $("detail").innerHTML='<h3>'+safe(candidate.full_name)+'</h3><p class="detail-sub">'+safe(title(candidate.job_slug))+' · '+safe(candidate.area)+' · Registrado '+safe(fmt(candidate.created_at))+'</p>'+
 '<div class="detail-actions"><a class="btn" target="_blank" rel="noopener noreferrer" href="https://wa.me/'+encodeURIComponent(phone.replace(/^\+/,""))+'">Abrir WhatsApp</a><a class="btn ghost" href="tel:'+encodeURIComponent(phone)+'">Llamar</a></div>'+
 '<label class="label">Teléfono</label><div>'+safe(candidate.phone)+'</div><label class="label">Experiencia declarada</label><div style="white-space:pre-wrap">'+safe(candidate.experience||"Sin información")+'</div>'+
 '<div class="section-divider"></div><b>Origen del registro</b><div>'+safe(manualCandidateSource(candidate))+'</div><div class="section-divider"></div><b>Origen publicitario</b>'+
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
 conversaciones:"Mensajes y atención humana",seguimientos:"Seguimientos",fly:"Andy · Compás Fly",executive:"Andy Executive",marketing:"Marketing y campañas",ajustes:"Configuración"
};

(()=>{const settings=$("view-ajustes");if(!settings)return;const nav=document.querySelector('[data-nav="fly"]');if(nav){const b=document.createElement("button");b.type="button";b.className="nav-item";b.dataset.nav="executive";b.innerHTML='<span class="nav-icon" aria-hidden="true">✦</span> Andy Executive';nav.after(b);}const view=document.createElement("section");view.id="view-executive";view.dataset.view="executive";view.className="app-view hide";settings.before(view);})();

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
  view.innerHTML='<div class="page-intro"><div><span class="tag">FLY MARKETING INTELLIGENCE</span><h2>Marketing y campañas</h2><p>Centro de control de captación, publicidad y reclutamiento.</p></div></div>'+
   '<section class="panel"><h2>Resumen ejecutivo de reclutamiento</h2><p id="marketing-executive" role="status" style="padding:12px;background:#f2f6fb;border-radius:10px"></p><p class="small">Datos de hasta 500 expedientes recientes del CRM. Periodo según fecha de registro original. No son estadísticas de clics ni de Meta Ads.</p><label class="label" for="marketing-period">Periodo</label><select id="marketing-period" class="field"><option value="30">Últimos 30 días</option><option value="7">Últimos 7 días</option><option value="all">Todos los expedientes cargados</option></select><div id="marketing-kpis" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:12px;margin-top:18px" aria-live="polite"></div></section>'+
   '<section class="panel"><h2>Resultados por campaña</h2><p class="small">Última atribución registrada en cada expediente; no representa conversiones verificadas por Meta.</p><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;text-align:left"><thead><tr><th scope="col">Canal</th><th scope="col">Campaña</th><th scope="col">Anuncio</th><th scope="col">Postulantes</th><th scope="col">Entrevista</th><th scope="col">Contratados</th></tr></thead><tbody id="marketing-rows"></tbody></table></div></section>'+
   '<section class="panel"><h2>Conexión con Meta Ads</h2><p id="marketing-meta-status" role="status">Verificando cuenta publicitaria…</p><p class="small">Conexión administrada por Compás Evolution. No se solicitan credenciales en este CRM.</p><div id="marketing-meta-metrics" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:12px"></div></section><section class="panel"><h2>Validación y próximos pasos</h2><p>La medición de visitas y chat es opcional. Las conversiones certificadas por Meta todavía no están integradas.</p><a class="btn ghost" href="../vacantes/guardias-de-seguridad/" target="_blank" rel="noopener noreferrer">Abrir landing de campaña ↗</a></section>';
  settings.before(view);$("marketing-period").addEventListener("change",renderMarketing);
 }
})();
let marketingMetaVersion=0;
// Explicit pilot mapping: the UTM alias is not a Meta campaign ID.
const marketingPilotAlias={"120248808734660436":"guardias_seguridad"};
async function marketingCandidateCount(r){
 const alias=marketingPilotAlias[r.external_campaign_id];
 if(!alias)return null;
 // Count distinct CRM records created in the corresponding Mexico City dates.
 const from=r.period_start+"T00:00:00-06:00";
 const end=new Date(r.period_end+"T00:00:00Z");end.setUTCDate(end.getUTCDate()+1);
 const until=end.toISOString().slice(0,10)+"T00:00:00-06:00";
 const result=await db.from("cl360_candidates").select("id",{count:"exact",head:true}).eq("workspace_id",WS).gte("created_at",from).lt("created_at",until).eq("campaign_attribution->>utm_source","meta").eq("campaign_attribution->>utm_medium","paid_social").eq("campaign_attribution->>utm_campaign",alias);
 return result.error?null:result.count;
}
function campaignUnitCost(spend,currency,count){
 if(spend==null||spend===""||typeof currency!=="string"||!currency.trim()||!Number.isFinite(Number(spend))||Number(spend)<0||!Number.isInteger(count)||count<=0)return null;
 return Number(spend)/count;
}
async function marketingOutcomeCounts(r){
 const alias=marketingPilotAlias[r.external_campaign_id];if(!alias)return null;
 const end=new Date(r.period_end+"T00:00:00Z");if(!Number.isFinite(end.getTime())||!/^\d{4}-\d{2}-\d{2}$/.test(r.period_start)||r.period_start>r.period_end)return null;
 end.setUTCDate(end.getUTCDate()+1);
 const from=r.period_start+"T00:00:00-06:00",until=end.toISOString().slice(0,10)+"T00:00:00-06:00";
 const count=async(stage)=>{
  try{const result=await db.from("cl360_candidates").select("id",{count:"exact",head:true}).eq("workspace_id",WS).gte("created_at",from).lt("created_at",until).eq("campaign_attribution->>utm_source","meta").eq("campaign_attribution->>utm_medium","paid_social").eq("campaign_attribution->>utm_campaign",alias).eq("stage",stage);
  return result.error||!Number.isInteger(result.count)?null:result.count;}catch{return null;}
 };
 const [interview,hired]=await Promise.all([count("interview"),count("hired")]);return {interview,hired};
}
function appendCampaignEconomics(card,r,registrations,outcomes){
 const section=document.createElement("section");section.className="campaign-economics";
 const h=document.createElement("h3");h.textContent="Eficiencia de inversión publicitaria";section.append(h);
 const intro=document.createElement("p");intro.className="small";intro.textContent="Costos orientativos para el periodo de inversión sincronizado. Las etapas del CRM corresponden al estado actual de expedientes registrados en esas fechas.";section.append(intro);
 const mapped=!!marketingPilotAlias[r.external_campaign_id];
 const rows=[["Clics (todos)",r.clicks==null?null:Number(r.clicks),true],["Conversaciones Messenger atribuidas",null,false],["Postulaciones atribuidas por UTM",mapped?registrations:null,mapped],["Expedientes actualmente en entrevista",mapped?outcomes?.interview??null:null,mapped],["Expedientes actualmente contratados",mapped?outcomes?.hired??null:null,mapped]];
 const table=document.createElement("table");table.className="campaign-cost-table";const head=document.createElement("thead");const hr=document.createElement("tr");for(const label of ["Resultado medido","Cantidad","Costo unitario"]){const th=document.createElement("th");th.scope="col";th.textContent=label;hr.append(th);}head.append(hr);table.append(head);const body=document.createElement("tbody");
 for(const [label,count,known] of rows){const tr=document.createElement("tr");const cost=known?campaignUnitCost(r.spend,r.currency,count):null;const formatted=cost===null?"—":cost.toLocaleString("es-MX",{minimumFractionDigits:2,maximumFractionDigits:2})+" "+r.currency;
  for(const [i,val] of [label,count==null?"No disponible":String(count),formatted].entries()){const cell=document.createElement(i===0?"th":"td");if(i===0)cell.scope="row";cell.textContent=val;tr.append(cell);}body.append(tr);
 }table.append(body);const wrap=document.createElement("div");wrap.className="campaign-cost-scroll";wrap.append(table);section.append(wrap);
 const warnings=[];
 if(r.spend==null)warnings.push("Inversión aún no disponible en la sincronización.");
 if(!mapped)warnings.push("Sin asociación comprobada de campaña a etiquetas UTM del CRM.");
 warnings.push("No hay un contador de conversaciones iniciadas en Meta ni atribución individual confirmada de Messenger en esta integración.");
 warnings.push("— significa que falta información o que no existe un resultado positivo para dividir el gasto. No es costo cero.");
 warnings.push("No equivale a costo histórico por entrevista realizada o contratación en el periodo; tampoco es ROI, porque no hay ingresos atribuidos.");
 const p=document.createElement("p");p.className="small";p.textContent=warnings.join(" ");section.append(p);card.append(section);
}
async function marketingFunnelCounts(r,channel){
 const alias=marketingPilotAlias[r.external_campaign_id];if(!alias)return null;
 const end=new Date(r.period_end+"T00:00:00Z");end.setUTCDate(end.getUTCDate()+1);
 const from=r.period_start+"T00:00:00-06:00",until=end.toISOString().slice(0,10)+"T00:00:00-06:00";
 const types=["landing_view","cta_click","chat_start"];
 const results=await Promise.all(types.map(type=>db.from("cl360_funnel_events").select("visit_id",{count:"exact",head:true}).eq("workspace_id",WS).eq("campaign",channel==="unattributed"?"unattributed":alias).eq("event_type",type).gte("created_at",from).lt("created_at",until)));
 return results.map(x=>x.error?null:x.count);
}
function appendMarketingFunnel(card,r,counts,candidatesCount,other){
 if(!counts)return;
 const section=document.createElement("section");section.style.cssText="margin-top:16px;border:1px solid #dce6f1;border-radius:12px;padding:16px";
 const title=document.createElement("h3");title.textContent="Embudo de reclutamiento · visitas autorizadas";section.append(title);
 const names=["Visitas","Clics en postularse","Interacciones con Andy","Postulaciones atribuidas"];
 const values=[...counts,candidatesCount],max=Math.max(1,...values.filter(x=>x!=null));
 names.forEach((name,i)=>{const row=document.createElement("div");row.style.cssText="margin:12px 0";const label=document.createElement("div");label.style.cssText="display:flex;justify-content:space-between;gap:8px";const a=document.createElement("span"),b=document.createElement("strong");a.textContent=name;b.textContent=values[i]==null?"—":String(values[i]);label.append(a,b);row.append(label);const track=document.createElement("div");track.style.cssText="height:10px;background:#e6edf5;border-radius:5px;overflow:hidden";const bar=document.createElement("div");bar.style.cssText="height:100%;background:#155486;border-radius:5px";bar.style.width=(values[i]==null?0:100*values[i]/max)+"%";track.append(bar);row.append(track);section.append(row);});
 if(other){const h=document.createElement("h4");h.textContent="Tráfico sin atribución a la campaña piloto";section.append(h);const grid=document.createElement("div");grid.style.cssText="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px";other.forEach((v,i)=>{const cell=document.createElement("div");cell.style.cssText="background:#f2f6fb;border-radius:8px;padding:10px";const label=document.createElement("small");label.textContent=names[i];const n=document.createElement("strong");n.style.display="block";n.textContent=v==null?"—":String(v);cell.append(label,n);grid.append(cell);});section.append(grid);}const cost=document.createElement("p");cost.textContent="Costo por interacción medida: "+(counts[2]>0&&r.spend!=null&&r.currency?(Number(r.spend)/counts[2]).toFixed(2)+" "+r.currency:"—");section.append(cost);
 const note=document.createElement("p");note.className="small";note.textContent="Conteos independientes por fecha y UTM, no una cohorte de personas. Las visitas e interacciones requieren consentimiento; las postulaciones usan su propia atribución. Los datos pueden no coincidir. — indica dato no disponible.";section.append(note);card.append(section);
}
function flyMarketingAdvice(r,counts,other){
 const advice=[];
 const age=Date.now()-new Date(r.synced_at).getTime();
 if(!Number.isFinite(age)||age>3*3600000)advice.push(["Actualización pendiente","Revisa la sincronización con Compás Evolution; el resumen no es reciente."]);
 if(r.spend==null||r.impressions==null||r.clicks==null){
  advice.push(["Sin datos suficientes","Meta todavía no ha devuelto todas las métricas. Verifica la entrega del anuncio antes de evaluar su rendimiento."]);
 }else{
  const spend=Number(r.spend),impressions=Number(r.impressions),clicks=Number(r.clicks);
  if(impressions===0)advice.push(["Sin impresiones registradas","Comprueba aprobación, fechas y entrega en Meta Ads."]);
  if(clicks>0&&Number.isFinite(spend))advice.push(["Costo por clic (todos)",(spend/clicks).toLocaleString("es-MX",{maximumFractionDigits:2,minimumFractionDigits:2})+" "+(r.currency||"")+" por clic registrado. No equivale a costo por visita ni por candidato."]);
  if(impressions>0&&clicks===0)advice.push(["Sin clics registrados","Revisa el anuncio y su llamada a la acción; no cambies el presupuesto basándote únicamente en esta cifra."]);
 }
 if(counts){const [visits,cta,chat]=counts;if(counts.some(v=>v==null))advice.push(["Medición no disponible","Comprueba permisos o conexión de eventos."]);else if(visits<20)advice.push(["Muestra inicial","Todavía hay pocas visitas autorizadas para evaluar rendimiento. Verifica primero la medición."]);else if(cta===0&&chat===0)advice.push(["Revisar entrada al chat","Existen visitas sin interacciones medidas; revisa la llamada a la acción y prueba Andy."]);else if(cta>=10&&chat===0)advice.push(["Revisar registro de Andy","Hay clics sin inicios de chat medidos. Comprueba el funcionamiento en móvil y la captura de eventos."]);}if(other&&other[0]>0&&other[2]===0)advice.push(["Validación de tráfico no atribuido","Hay visitas medidas sin inicio de chat registrado. Prueba una interacción con Andy."]);
 advice.push(["Medición de candidatos","El costo por registro atribuido es orientativo: usa etiquetas UTM y fecha de creación del expediente, no conversiones verificadas por Meta."]);
 return advice;
}
async function marketingDailyReport(r){
 const day=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Mexico_City",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
 const parts=Object.fromEntries(day.map(p=>[p.type,p.value]));
 const date=parts.year+"-"+parts.month+"-"+parts.day;
 const daily={...r,period_start:date,period_end:date};
 const [count,paid,other]=await Promise.all([marketingCandidateCount(daily),marketingFunnelCounts(daily),marketingFunnelCounts(daily,"unattributed")]);
 return {date,count,paid,other};
}
function appendDailyMarketingReport(card,r,daily,funnel,other){
 if(!daily.paid)return;
 const fmt=v=>v==null?"No disponible":String(v);
 const lines=["REPORTE DIARIO · FLY MARKETING","Fecha: "+daily.date+" (Ciudad de México)","Campaña: "+r.campaign_name,"","HOY · actividad registrada", "Visitas autorizadas (campaña): "+fmt(daily.paid[0]),"Clics en postularse: "+fmt(daily.paid[1]),"Interacciones con Andy: "+fmt(daily.paid[2]),"Postulaciones atribuidas: "+fmt(daily.count),"Visitas sin atribución al piloto: "+fmt(daily.other?.[0]),"Interacciones sin atribución al piloto: "+fmt(daily.other?.[2]),"","META ADS · periodo "+r.period_start+" a "+r.period_end,"Inversión del periodo: "+(r.spend==null?"No disponible":String(r.spend)+" "+(r.currency||"")),"Impresiones del periodo: "+fmt(r.impressions),"Clics del periodo: "+fmt(r.clicks),"Última sincronización: "+new Date(r.synced_at).toLocaleString("es-MX",{timeZone:"America/Mexico_City"}),"","ACCIONES RECOMENDADAS (diagnóstico del periodo)",...flyMarketingAdvice(r,funnel,other).map(([t,d])=>t+": "+d),"","Medición opcional; conteos independientes, no conversiones certificadas. Los datos del día pueden cambiar. No modifica campañas ni presupuestos."];
 const section=document.createElement("section");section.style.cssText="margin:16px 0;padding:16px;border:1px solid #dce6f1;border-radius:12px;background:#fff";
 const title=document.createElement("h3");title.textContent="Reporte diario de Astrid";section.append(title);
 const pre=document.createElement("div");pre.style.cssText="white-space:pre-wrap;font-size:.9rem;line-height:1.6;margin:12px 0";pre.textContent=lines.join("\n");section.append(pre);
 const button=document.createElement("button");button.type="button";button.className="btn ghost";button.textContent="Descargar reporte (.txt)";button.onclick=()=>{const url=URL.createObjectURL(new Blob([lines.join("\n")],{type:"text/plain;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="fly-marketing-"+daily.date+".txt";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};section.append(button);card.append(section);
}
function appendFlyMarketingAdvice(card,r,counts,other){
 const section=document.createElement("section");section.style.cssText="margin-top:16px;padding:14px;border-radius:12px;background:#f2f6fb";
 const heading=document.createElement("h3");heading.textContent="Fly Marketing · diagnóstico y acciones";section.append(heading);
 for(const [title,detail] of flyMarketingAdvice(r,counts,other)){
 const item=document.createElement("div");item.style.cssText="margin:10px 0";
 const label=document.createElement("strong");label.textContent=title;
 const text=document.createElement("p");text.className="small";text.textContent=detail;item.append(label,text);section.append(item);
 }
 const note=document.createElement("p");note.className="small";note.textContent="Diagnóstico por reglas, solo lectura. No modifica campañas ni presupuestos.";section.append(note);card.append(section);
}
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
 const [count,funnel,other,daily,outcomes]=await Promise.all([marketingCandidateCount(r),marketingFunnelCounts(r),marketingFunnelCounts(r,"unattributed"),marketingDailyReport(r),marketingOutcomeCounts(r)]);
 if(version!==marketingMetaVersion)return;
 const card=document.createElement("article");card.style.cssText="grid-column:1/-1;border:1px solid #dce6f1;border-radius:12px;padding:16px";
 const title=document.createElement("h3");title.textContent=r.campaign_name;card.append(title);
 const meta=document.createElement("p");meta.className="small";meta.textContent=r.period_start+" a "+r.period_end+" · Actualizado: "+new Date(r.synced_at).toLocaleString("es-MX");card.append(meta);
 const money=r.spend==null?"—":Number(r.spend).toLocaleString("es-MX",{minimumFractionDigits:2,maximumFractionDigits:2})+" "+(r.currency||"moneda sin confirmar");
 const fmt=v=>v==null?"—":Number(v).toLocaleString("es-MX");
 const values=[["Inversión real",money],["Impresiones",fmt(r.impressions)],["Clics (todos)",fmt(r.clicks)],["CTR (todos)",r.clicks!=null&&Number(r.impressions)>0?(100*Number(r.clicks)/Number(r.impressions)).toFixed(2)+"%":"—"]];
 values.push(["Registros atribuidos por UTM",fmt(count)],["Costo por registro atribuido",count>0&&r.spend!=null&&r.currency?(Number(r.spend)/count).toLocaleString("es-MX",{minimumFractionDigits:2,maximumFractionDigits:2})+" "+r.currency:"—"]);
 const grid=document.createElement("div");grid.style.cssText="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px";
 for(const [label,value] of values){const cell=document.createElement("div");const l=document.createElement("div");l.className="small";l.textContent=label;const v=document.createElement("strong");v.textContent=value;v.style.cssText="font-size:1.4rem;display:block";cell.append(l,v);grid.append(cell);}
 card.append(grid);appendCampaignEconomics(card,r,count,outcomes);appendMarketingFunnel(card,r,funnel,count,other);appendFlyMarketingAdvice(card,r,funnel,other);appendDailyMarketingReport(card,r,daily,funnel,other);panel.append(card);
 }
 }catch{if(version===marketingMetaVersion)status.textContent="No fue posible consultar las estadísticas asignadas. Consulta con Compás Evolution.";}
}
function recruitmentConversion(external,people,tasks){
 const chats=[...new Map(external.filter(x=>x&&x.id).map(x=>[x.id,x])).values()];
 const linked=chats.filter(x=>x.candidate_id);
 const ids=new Set(linked.map(x=>x.candidate_id));
 const unique=[...new Map(people.filter(c=>c&&ids.has(c.id)).map(c=>[c.id,c])).values()];
 const interviewIds=new Set(tasks.filter(t=>t.status==="pending"&&/\bentrevistas?\b/i.test(t.title||"")&&ids.has(t.candidate_id)).map(t=>t.candidate_id));
 const responded=chats.filter(x=>Number(x.andy?.sent_count)>0).length;
 const hired=unique.filter(c=>c.stage==="hired").length;
 return {contacts:chats.length,responded,linked:linked.length,linkedIds:ids.size,loaded:unique.length,missing:ids.size-unique.length,
  withEvidence:chats.filter(x=>!x.intake?.declined&&Number(x.intake?.available_count)>0).length,
  awaitingHuman:chats.filter(x=>!["closed","archived"].includes(x.status)&&!x.intake?.declined&&(x.intake?.call_requested||x.andy?.human_requested||x.andy?.handoff_sent||x.assigned_user_id)).length,
  interviewPending:unique.filter(c=>interviewIds.has(c.id)).length,interviewStage:unique.filter(c=>c.stage==="interview").length,hired};
}
function renderRecruitmentConversion(){
 const anchor=$("marketing-kpis");if(!anchor)return;
 let panel=$("recruitment-conversion");
 if(!panel){panel=document.createElement("section");panel.id="recruitment-conversion";panel.className="panel recruitment-conversion";anchor.closest("section").after(panel);}
 panel.replaceChildren();
 const h=document.createElement("h2");h.textContent="Conversión de Messenger a contratación";panel.append(h);
 const desc=document.createElement("p");desc.className="small";desc.textContent="Vista acumulada de las conversaciones y expedientes cargados, independiente del filtro de periodo y de las campañas Meta. Una conversación no equivale necesariamente a una persona única.";panel.append(desc);
 if(!operationsLoaded||messengerUnavailable){const p=document.createElement("p");p.setAttribute("role","status");p.textContent=operationsLoaded?"Messenger no disponible. Actualiza el CRM para consultar la conversión.":"Consultando conversaciones…";panel.append(p);return;}
 const r=recruitmentConversion(messengerContacts,candidates,followups);
 const ratio=(n,d)=>d?new Intl.NumberFormat("es-MX",{style:"percent",maximumFractionDigits:1}).format(n/d):"Sin base";
 const grid=document.createElement("div");grid.className="fly-metric-grid conversion-rates";
 for(const [label,value,detail] of [["Conversaciones con respuesta de Andy",ratio(r.responded,r.contacts),r.responded+" / "+r.contacts+" conversaciones"],["Conversaciones vinculadas a expediente",ratio(r.linked,r.contacts),r.linked+" / "+r.contacts+" conversaciones"],["Expedientes vinculados en etapa Contratado",r.missing?"No disponible":ratio(r.hired,r.loaded),r.missing?"Faltan expedientes vinculados en la consulta":r.hired+" / "+r.loaded+" expedientes únicos"]]){
  const card=document.createElement("div");card.className="fly-mini-metric";const n=document.createElement("strong");n.textContent=value;const l=document.createElement("span");l.textContent=label;const d=document.createElement("span");d.className="small";d.textContent=detail;card.append(n,l,d);grid.append(card);
 }panel.append(grid);
 const section=(label,rows,denominator)=>{
  const box=document.createElement("div");box.className="conversion-section";const title=document.createElement("h3");title.textContent=label;box.append(title);
  for(const [caption,n] of rows){const row=document.createElement("div");row.className="conversion-row";const head=document.createElement("div");head.className="conversion-row-head";const name=document.createElement("span");name.textContent=caption;const count=document.createElement("strong");count.textContent=String(n);head.append(name,count);const bar=document.createElement("progress");bar.max=Math.max(1,denominator);bar.value=n;bar.setAttribute("aria-label",caption+": "+n+" de "+denominator);row.append(head,bar);box.append(row);}panel.append(box);
 };
 section("Captación y atención · conversaciones", [["Contactos recibidos (conversaciones)",r.contacts],["Con respuesta automática enviada",r.responded],["Con datos declarados para revisar",r.withEvidence],["Vinculadas a expediente",r.linked],["Atención humana por revisar",r.awaitingHuman]],r.contacts);
 section("Resultados · expedientes vinculados únicos", [["Expedientes únicos cargados",r.loaded],["Con entrevista pendiente programada",r.interviewPending],["Actualmente en etapa Entrevista",r.interviewStage],["Actualmente en etapa Contratado",r.hired]],r.loaded);
 const note=document.createElement("p");note.className="small";note.textContent="Los indicadores son independientes; no prueban una secuencia histórica ni atribuyen contrataciones a Andy. Entrevistas pendientes se identifican por el título de tareas registradas. Hasta 300 conversaciones, 500 expedientes y 500 tareas cargadas."+(r.missing?" Faltan "+r.missing+" expedientes vinculados en esta consulta.":"");panel.append(note);
 const actions=document.createElement("div");actions.className="conversion-actions";for(const [label,view] of [["Abrir Pipeline","pipeline"],["Revisar agenda","seguimientos"]]){const button=document.createElement("button");button.type="button";button.className="btn ghost";button.textContent=label;button.onclick=()=>navigate(view);actions.append(button);}panel.append(actions);
}
function renderMarketing(){
 renderRecruitmentConversion();
 const panel=$("marketing-kpis"),body=$("marketing-rows");if(!panel||!body)return;
 const period=$("marketing-period").value;
 const cutoff=period==="all"?0:Date.now()-Number(period)*86400000;
 const data=candidates.filter(c=>new Date(c.created_at).getTime()>=cutoff);
 const attributed=c=>{const a=c.campaign_attribution;return a&&typeof a==="object"&&Object.keys(a).length>0;};
 const counts=[["Postulantes",data.length],["Con origen registrado",data.filter(attributed).length],["En entrevista",data.filter(c=>c.stage==="interview").length],["Contratados",data.filter(c=>c.stage==="hired").length]];
 const summary=$("marketing-executive");if(summary)summary.textContent="En el periodo seleccionado: "+data.length+" postulantes, "+data.filter(attributed).length+" con origen registrado y "+data.filter(c=>c.stage==="hired").length+" contratados. Consulta la inversión y la atribución publicitaria en el panel de Meta.";panel.replaceChildren();
 for(const [name,value] of counts){const card=document.createElement("div");card.style.cssText="border:1px solid #dce6f1;border-radius:12px;padding:15px";const label=document.createElement("div");label.className="small";label.textContent=name;const n=document.createElement("strong");n.style.cssText="font-size:1.8rem;display:block;color:#092645";n.textContent=String(value);card.append(label,n);panel.append(card);}
 const groups=new Map();
 for(const c of data){const a=c.campaign_attribution||{};const parts=[a.utm_source||"Sin atribución",a.utm_campaign||a.campana||"—",a.utm_content||"—"];const key=JSON.stringify(parts);if(!groups.has(key))groups.set(key,{parts,total:0,interview:0,hired:0});const group=groups.get(key);group.total++;if(c.stage==="interview")group.interview++;if(c.stage==="hired")group.hired++;}
 body.replaceChildren();
 for(const g of [...groups.values()].sort((a,b)=>b.total-a.total)){const tr=document.createElement("tr");for(const value of [...g.parts,g.total,g.interview,g.hired]){const td=document.createElement("td");td.style.cssText="padding:10px 8px;border-top:1px solid #e0e8f0";td.textContent=String(value);tr.append(td);}body.append(tr);}
 if(!groups.size){const tr=document.createElement("tr"),td=document.createElement("td");td.colSpan=6;td.textContent="No hay postulaciones en este periodo.";tr.append(td);body.append(tr);}
}

let activeView="inicio",threads=[],messages=[],activeConversationId=null,conversationsLoadError=false;
const routeBase=new window.URL("./",document.baseURI);
$("crm-sound-test")?.addEventListener("click",async()=>{
 try{await window.CL360Sound.test();$("crm-sound-status").textContent="Sonido activado. Debes escuchar dos tonos; sonará en nuevos mensajes mientras el CRM esté visible.";}
 catch(e){$("crm-sound-status").textContent="No se pudo reproducir. Revisa volumen y permisos de audio: "+e.message;}
});
const pushClient=window.CL360Push?.setup({db,url:URL,key:KEY,scope:routeBase.href,getActor:()=>canLoad?user?.id:null,onStatus:message=>{$("crm-push-status").textContent=message;}});
for(const [id,action] of [["crm-push-enable","enable"],["crm-push-test","test"],["crm-push-disable","disable"]]){
 $(id)?.addEventListener("click",()=>pushClient?.perform(action));
}

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
 if(view==="seguimientos"){renderOperationsCenter();renderFollowups();}
 if(view==="conversaciones")renderInbox();
 if(view==="inicio"){renderHome();renderFlyAgents();}
 if(view==="fly")renderFlyAgents();
 if(view==="executive"){mountAndyExecutive();void refreshExecutiveBrief();void refreshExecutiveGoals();}
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
$("global-refresh").addEventListener("click",async()=>{await load();await loadConversations();if(activeView==="executive")void refreshExecutiveBrief();});
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
 browserReminderEnabled=true;$("crm-notification-status").textContent="Avisos inteligentes activados mientras la app esté abierta. No son push con la app cerrada.";
 previousReminderSignature="";executiveAlertCounts={};maybeNotifyOverdue();void pollExecutiveNotifications();
});

$("inbox-filter").addEventListener("change",renderInbox);
$("settings-signout").addEventListener("click",()=> $("signout").click());
function renderHome(){
 renderOperationsCenter();
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
let messengerContacts=[],messengerUnavailable=false,operationsLoaded=false,operationsFilter="all",operationsScope="team";
function buildOperationsGroups(external,internal,people,tasks,now,scope,actor){
 const owned=id=>scope!=="mine"||!id||id===actor;
 const contactOpen=x=>!["closed","archived"].includes(x.status);
 const linked=new Set(external.map(x=>x.candidate_id).filter(Boolean));
 const restricted=new Set(external.filter(x=>x.intake?.declined).map(x=>x.candidate_id).filter(Boolean));
 const person=id=>people.find(c=>c.id===id);
 const contactRow=(x,reason)=>({kind:"messenger",id:x.id,label:x.display_name||"Contacto de Facebook",description:reason,when:x.last_message_at,assigned:x.assigned_user_id});
 const groups=[
  {key:"calls",label:"Solicitudes de llamada",items:[]},
  {key:"handoff",label:"Atención humana",items:[]},
  {key:"review",label:"Expedientes por revisar",items:[]},
  {key:"incomplete",label:"Datos por completar",items:[]},
  {key:"chats",label:"Conversaciones pendientes",items:[]},
  {key:"interviews",label:"Entrevistas programadas",items:[]},
  {key:"overdue",label:"Seguimientos vencidos",items:[]},
  {key:"privacy",label:"Revisar no contacto",items:[]},
  {key:"unplanned",label:"Postulaciones sin seguimiento",items:[]}
 ];
 const add=(key,row)=>groups.find(g=>g.key===key).items.push(row);
 for(const x of external.filter(contactOpen).filter(x=>owned(x.assigned_user_id))){
  if(x.intake?.declined){add("privacy",contactRow(x,"Revisar la solicitud antes de cualquier contacto"));continue;}
  if(x.intake?.call_requested){add("calls",contactRow(x,"Solicitud de llamada detectada · revisar si ya se atendió"));continue;}
  if(x.andy?.human_requested||x.andy?.handoff_sent){add("handoff",contactRow(x,x.andy?.human_requested?"Solicitó atención humana · verificar si ya fue atendida":"Andy derivó el chat · revisar motivo y respuesta"));continue;}
  const count=Number(x.intake?.available_count)||0,total=Number(x.intake?.field_count)||5;
  if(x.intake?.needs_review||(!x.candidate_id&&count>=3)){
   add("review",contactRow(x,x.intake?.needs_review?"Respuestas distintas · confirmar":count+"/"+total+" datos declarados · revisar postulación"));continue;
  }
  if(!x.candidate_id&&count>0&&count<3){add("incomplete",contactRow(x,count+"/"+total+" datos declarados · continuar entrevista sin inferir respuestas"));continue;}
  if(!x.assigned_user_id)add("chats",contactRow(x,"Messenger · conversación sin asignar"));
 }
 for(const t of internal){
  if(t.status!=="waiting"||!owned(t.handler_id)||restricted.has(t.candidate_id)||(linked.has(t.candidate_id)&&!t.live_chat_enabled))continue;
  const c=person(t.candidate_id);if(!c)continue;
  add("chats",{kind:"internal",id:t.id,label:c.full_name,description:"Chat interno · pendiente de atención",when:t.last_message_at});
 }
 const pending=tasks.filter(f=>f.status==="pending");
 for(const f of pending.filter(f=>owned(f.assigned_user_id))){
  const c=person(f.candidate_id);
  const due=Date.parse(f.due_at);
  const row={kind:"task",id:f.id,candidateId:f.candidate_id,label:f.title||"Seguimiento",description:(c?.full_name||"Candidato")+" · "+(restricted.has(f.candidate_id)?"Revisar solicitud de no contacto":"Actividad registrada"),when:f.due_at};
  if(Number.isFinite(due)&&due<now)add("overdue",row);
  else if(Number.isFinite(due)&&/\bentrevista(s)?\b/i.test(f.title||""))add("interviews",row);
 }
 for(const c of people){
  if(c.stage==="new"&&owned(c.assigned_user_id)&&!restricted.has(c.id)&&!pending.some(f=>f.candidate_id===c.id))add("unplanned",{kind:"candidate",id:c.id,label:c.full_name,description:(c.last_contact_at?"Postulación nueva · revisar contacto anterior y programar seguimiento":"Postulación nueva · sin contacto registrado; programar seguimiento")+(c.screening_data?.availability==="si"?" · indica que puede cubrir el turno":c.screening_data?.availability==="no"?" · revisar otro turno":""),when:c.created_at});
 }
 for(const g of groups)g.items.sort((a,b)=>(Date.parse(a.when)||Infinity)-(Date.parse(b.when)||Infinity));
 return groups;
}
function operationsPriority(groups,limit=6){
 const order=["overdue","calls","handoff","interviews","review","unplanned","incomplete","chats"];
 const map=new Map(groups.map(g=>[g.key,g]));
 return order.flatMap(key=>(map.get(key)?.items||[]).filter(row=>!row.description.includes("Revisar solicitud de no contacto")).map(row=>({row,key,label:map.get(key).label}))).slice(0,limit);
}
function operationsAndyMetrics(external,scope,actor){
 const rows=external.filter(x=>scope!=="mine"||!x.assigned_user_id||x.assigned_user_id===actor);
 return [
 ["Conversaciones cargadas",rows.length],
 ["Conversaciones con respuesta de Andy",rows.filter(x=>Number(x.andy?.sent_count)>0).length],
 ["Respuestas de Andy enviadas",rows.reduce((sum,x)=>sum+Math.max(0,Number(x.andy?.sent_count)||0),0)],
 ["Derivaciones registradas por Andy",rows.filter(x=>x.andy?.handoff_sent===true).length],
 ["Solicitudes de llamada detectadas",rows.filter(x=>x.intake?.call_requested&&!x.intake?.declined).length],
 ["Conversaciones con expediente vinculado",rows.filter(x=>x.candidate_id).length]
 ];
}
function renderOperationsCenter(){
 const panels=[$("home-operations"),$("operations-center")].filter(Boolean);
 if(!panels.length)return;
 const groups=buildOperationsGroups(messengerContacts,threads,candidates,followups,Date.now(),operationsScope,user?.id);
 for(const panel of panels){
  panel.replaceChildren();
  if(!operationsLoaded){const p=document.createElement("p");p.className="small";p.textContent="Consultando conversaciones y seguimientos…";panel.append(p);continue;}
  const compact=panel.id==="home-operations";
  const controls=document.createElement("div");controls.className="operations-toolbar";
  const label=document.createElement("label");label.textContent="Responsable: ";
  const scope=document.createElement("select");scope.setAttribute("aria-label","Filtrar por responsable");
  for(const [v,t] of [["team","Todo el equipo"],["mine","Mis casos y sin asignar"]]){const option=document.createElement("option");option.value=v;option.textContent=t;scope.append(option);}
  scope.value=operationsScope;scope.onchange=()=>{operationsScope=scope.value;renderOperationsCenter();};label.append(scope);controls.append(label);
  if(!compact){const all=document.createElement("button");all.type="button";all.className="btn ghost";all.textContent="Mostrar todo";all.onclick=()=>{operationsFilter="all";renderOperationsCenter();};controls.append(all);}
  panel.append(controls);
  if(messengerUnavailable||conversationsLoadError){const warning=document.createElement("p");warning.className="small";warning.textContent="Consulta parcial: no se pudo leer uno de los canales. Actualiza el CRM; los recuentos pueden estar incompletos.";panel.append(warning);}
  const summary=document.createElement("div");summary.className="operations-metrics";
  for(const g of groups){const b=document.createElement("button");b.type="button";b.className="fly-mini-metric operations-metric";b.setAttribute("aria-pressed",String(!compact&&operationsFilter===g.key));const n=document.createElement("strong");n.textContent=String(g.items.length);const l=document.createElement("span");l.textContent=g.label;b.append(n,l);b.onclick=()=>{operationsFilter=g.key;if(compact)navigate("seguimientos");renderOperationsCenter();};summary.append(b);}
  panel.append(summary);
  if(compact||operationsFilter==="all"){
   const priorities=document.createElement("section");priorities.className="operations-priorities";
   const title=document.createElement("h3");title.textContent="Atender primero · hasta 6 pendientes";priorities.append(title);
   const items=operationsPriority(groups);
   if(!items.length){const p=document.createElement("p");p.className="small";p.textContent=messengerUnavailable||conversationsLoadError?"Consulta incompleta; actualiza antes de dar por terminados los pendientes.":"Sin pendientes prioritarios en los registros cargados.";priorities.append(p);}
   for(const item of items)priorities.append(flyActionRow(item.row.label,item.label+" · "+item.row.description+" · "+fmt(item.row.when),()=>{
    operationsFilter=item.key;if(compact)navigate("seguimientos");renderOperationsCenter();
   },"Ver pendientes"));
   panel.append(priorities);
  }
  if(compact)continue;
  const metrics=document.createElement("section");metrics.className="operations-andy";
  const mh=document.createElement("h3");mh.textContent="Actividad registrada de Andy";metrics.append(mh);
  const expl=document.createElement("p");expl.className="small";expl.textContent=messengerUnavailable?"Messenger no disponible; no se pueden calcular indicadores.":"Historial de las conversaciones cargadas; no representa un periodo ni una tasa de contratación. Las respuestas de Andy no acreditan datos del candidato.";metrics.append(expl);
  if(!messengerUnavailable){const grid=document.createElement("div");grid.className="operations-metrics";for(const [label,value] of operationsAndyMetrics(messengerContacts,operationsScope,user?.id)){const cell=document.createElement("div");cell.className="fly-mini-metric";const n=document.createElement("strong");n.textContent=String(value);const l=document.createElement("span");l.textContent=label;cell.append(n,l);grid.append(cell);}metrics.append(grid);}
  panel.append(metrics);
  const note=document.createElement("p");note.className="small";note.textContent="Las solicitudes y los datos detectados requieren revisión humana. Las entrevistas se identifican por las tareas registradas; los vencimientos tienen prioridad. No se generan citas ni llamadas automáticamente.";panel.append(note);
  for(const g of groups){
   if(operationsFilter!=="all"&&operationsFilter!==g.key)continue;
   const h=document.createElement("h3");h.className="operations-group-title";h.textContent=g.label+" · "+g.items.length;panel.append(h);
   if(!g.items.length){const p=document.createElement("p");p.className="small";p.textContent="Sin casos registrados en esta sección.";panel.append(p);continue;}
   for(const row of g.items){
    const action=()=>{
     if(row.kind==="messenger"){const x=messengerContacts.find(c=>c.id===row.id);if(x)openMessenger(x);}
     else if(row.kind==="internal"){navigate("conversaciones");void openConversation(row.id);}
     else if(row.kind==="candidate")openCandidate(row.id);
     else if(row.candidateId&&candidates.some(c=>c.id===row.candidateId))openCandidate(row.candidateId);
     else {agendaFilter="all";renderFollowups();$("followups")?.scrollIntoView({behavior:"smooth",block:"start"});}
    };
    panel.append(flyActionRow(row.label,row.description+" · "+fmt(row.when),action,row.kind==="messenger"||row.kind==="internal"?"Abrir chat":"Abrir expediente"));
   }
  }
 }
}

function messengerState(x){return ["closed","archived"].includes(x.status)?"closed":x.assigned_user_id?"human":"waiting";}
function openMessenger(x){location.href=new window.URL("../mensajes/?conversation="+encodeURIComponent(x.id),routeBase).href;}
function messengerCard(x,compact=false){
 const b=document.createElement("button");b.type="button";b.className=compact?"inbox-item":"pipeline-card";
 const name=document.createElement("b");name.textContent=x.display_name||"Contacto de Facebook";
 const channel=document.createElement("span");channel.className="small";channel.textContent="Facebook Messenger · "+(x.candidate_id?"Expediente vinculado":"Contacto preliminar");
 const date=document.createElement("span");date.className="small";date.textContent=fmt(x.last_message_at);
 const state=document.createElement("span");state.className="pill";state.textContent=conversationLabel(messengerState(x));
 b.append(name,channel,date,state);
 if(x.andy){const progress=document.createElement("span");progress.className="small";progress.textContent=x.andy.human_requested||x.andy.handoff_sent?"Andy derivó a revisión humana":x.andy.sent_count?"Andy · "+x.andy.sent_count+" respuestas enviadas":"Sin respuestas automáticas registradas";b.append(progress);}
 if(x.intake){const intake=document.createElement("span");intake.className="small";intake.textContent=x.intake.declined?"Revisar solicitud de no continuar":x.intake.call_requested?"Solicitó llamada · revisar":x.intake.needs_review?"Datos en conflicto · revisar":(x.intake.available_count||0)+"/"+(x.intake.field_count||5)+" datos declarados por revisar";b.append(intake);}
 if(compact&&x.last_message_preview){const preview=document.createElement("span");preview.className="small";preview.textContent=String(x.last_message_preview).slice(0,150);b.append(preview);}
 b.addEventListener("click",()=>openMessenger(x));return b;
}
const pipelineStages=["new","contacted","screening","interview","qualified","hired","rejected","archived"];
let pipelineQuery="",pipelineJob="",pipelineScope="all";
function preliminaryPipelineStage(x){
 if(x.intake?.declined)return "privacy";
 if(x.intake?.call_requested||x.andy?.human_requested||x.andy?.handoff_sent||x.assigned_user_id)return "human";
 if(x.intake?.needs_review||Number(x.intake?.available_count)>=3)return "review";
 if(Number(x.intake?.available_count)>0||Number(x.andy?.sent_count)>0)return "intake";
 return "fresh";
}
function pipelineMatches(name,job,query,filter){
 const normalize=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
 return (!filter||(filter==="__unassigned__"?!job:job===filter))&&(!query||normalize(name).includes(normalize(query.trim())));
}
function renderPipeline(){
 const board=$("pipeline-board");if(!board)return;
 const priorScroll=Object.fromEntries(Array.from(board.querySelectorAll("[data-pipeline-lane]"),el=>[el.dataset.pipelineLane,el.scrollLeft]));
 const priorColumnScroll=Object.fromEntries(Array.from(board.querySelectorAll("[data-pipeline-column]"),el=>[el.dataset.pipelineColumn,el.scrollTop]));
 board.replaceChildren();board.classList.add("pipeline-v2");
 let toolbar=$("pipeline-toolbar-v2");
 if(!toolbar){
  toolbar=document.createElement("div");toolbar.id="pipeline-toolbar-v2";toolbar.className="pipeline-toolbar-v2";
  const search=document.createElement("input");search.type="search";search.className="field";search.placeholder="Buscar por nombre";search.setAttribute("aria-label","Buscar en el Pipeline");search.id="pipeline-query-v2";
  search.oninput=()=>{pipelineQuery=search.value;renderPipeline();};
  const vacancy=document.createElement("select");vacancy.className="field";vacancy.id="pipeline-job-v2";vacancy.setAttribute("aria-label","Filtrar por vacante");vacancy.onchange=()=>{pipelineJob=vacancy.value;renderPipeline();};
  const scope=document.createElement("select");scope.className="field";scope.id="pipeline-scope-v2";scope.setAttribute("aria-label","Tipo de registro");
  for(const [value,label] of [["all","Todos los registros"],["messenger","Solo contactos Messenger"],["formal","Solo postulaciones"]]){const o=document.createElement("option");o.value=value;o.textContent=label;scope.append(o);}
  scope.onchange=()=>{pipelineScope=scope.value;renderPipeline();};
  const reset=document.createElement("button");reset.type="button";reset.className="btn ghost";reset.textContent="Limpiar filtros";reset.onclick=()=>{pipelineQuery="";pipelineJob="";pipelineScope="all";search.value="";scope.value="all";renderPipeline();};
  toolbar.append(search,vacancy,scope,reset);board.before(toolbar);
 }
 const vacancy=$("pipeline-job-v2");vacancy.replaceChildren();
 const pending=messengerContacts.filter(x=>!x.candidate_id&&messengerState(x)!=="closed");
 const jobIds=new Set([...jobs.map(j=>j.slug),...candidates.map(c=>c.job_slug),...pending.map(x=>x.andy?.job_slug)].filter(Boolean));
 for(const [value,label] of [["","Todas las vacantes"],["__unassigned__","Sin vacante confirmada"],...Array.from(jobIds).map(id=>[id,title(id)])]){const o=document.createElement("option");o.value=value;o.textContent=label;vacancy.append(o);}
 if(pipelineJob&&!Array.from(vacancy.options).some(o=>o.value===pipelineJob))pipelineJob="";
 vacancy.value=pipelineJob;$("pipeline-query-v2").value=pipelineQuery;$("pipeline-scope-v2").value=pipelineScope;
 const preliminary=pending.filter(x=>pipelineMatches(x.display_name||"Contacto de Facebook",x.andy?.job_slug,pipelineQuery,pipelineJob));
 const formal=candidates.filter(c=>pipelineMatches(c.full_name,c.job_slug,pipelineQuery,pipelineJob));
 const lane=(key,label,description,count)=>{
  const section=document.createElement("section");section.className="pipeline-lane";
  const head=document.createElement("div");head.className="pipeline-lane-head";
  const h=document.createElement("h3");h.textContent=label+" · "+count;const p=document.createElement("p");p.className="small";p.textContent=description;head.append(h,p);
  const row=document.createElement("div");row.className="pipeline-board pipeline-lane-board";row.dataset.pipelineLane=key;row.setAttribute("aria-label",label);section.append(head,row);board.append(section);return row;
 };
 const column=(row,key,label,items,card,unknown=false)=>{
  const col=document.createElement("section");col.className="pipeline-column";col.dataset.pipelineStage=key;
  const head=document.createElement("div");head.className="pipeline-column-header";
  const h=document.createElement("b");h.textContent=label;const n=document.createElement("span");n.textContent=unknown?"—":String(items.length);head.append(h,n);
  const list=document.createElement("div");list.className="pipeline-column-list";list.dataset.pipelineColumn=key;list.tabIndex=0;list.setAttribute("aria-label",label);
  if(!items.length){const p=document.createElement("p");p.className="pipeline-empty";p.textContent=unknown?"Consulta no disponible":"Sin registros";list.append(p);}
  items.forEach(x=>list.append(card(x)));col.append(head,list);row.append(col);list.scrollTop=priorColumnScroll[key]||0;
 };
 if(pipelineScope!=="formal"){
  const row=lane("messenger","Contactos Messenger","Contactos preliminares; no son postulaciones confirmadas. Los grupos describen atención, no idoneidad laboral.",messengerUnavailable?"—":preliminary.length);
  for(const [key,label] of [["fresh","Nuevos contactos"],["intake","Preentrevista en curso"],["review","Expedientes por revisar"],["human","Atención humana"],["privacy","No contacto · revisión"]]){
   column(row,"m-"+key,label,preliminary.filter(x=>preliminaryPipelineStage(x)===key),x=>{
    const card=messengerCard(x);card.classList.add("pipeline-compact-card");
    if(x.intake&&!x.intake.declined){const total=Math.max(1,Number(x.intake.field_count)||5),n=Math.min(total,Math.max(0,Number(x.intake.available_count)||0));const progress=document.createElement("progress");progress.className="pipeline-evidence";progress.max=total;progress.value=n;progress.setAttribute("aria-label","Datos declarados: "+n+" de "+total);card.append(progress);}
    if(x.andy?.job_slug){const job=document.createElement("span");job.className="small";job.textContent="Vacante: "+title(x.andy.job_slug);card.append(job);}
    return card;
   },messengerUnavailable);
  }
  row.scrollLeft=priorScroll.messenger||0;
 }
 if(pipelineScope!=="messenger"){
  const row=lane("formal","Postulaciones confirmadas","Etapas registradas por el equipo. Abre el expediente para modificar su etapa; no hay descartes automáticos.",formal.length);
  pipelineStages.forEach(stage=>column(row,"c-"+stage,stageNames[stage]||stage,formal.filter(c=>c.stage===stage),c=>{
   const b=document.createElement("button");b.type="button";b.className="pipeline-card pipeline-compact-card";
   const name=document.createElement("b");name.textContent=c.full_name;
   const job=document.createElement("span");job.className="small";job.textContent=title(c.job_slug);
   const when=document.createElement("span");when.className="small";when.textContent="Registrado: "+fmt(c.created_at);
   const tag=document.createElement("span");tag.className="pill";tag.textContent=c.screening_data?.availability==="si"?"Turno declarado compatible":c.screening_data?.availability==="no"?"Revisión de horario":"Disponibilidad por confirmar";
   b.append(name,job,when,tag);b.addEventListener("click",()=>openCandidate(c.id));return b;
  }));row.scrollLeft=priorScroll.formal||0;
 }
}
function waContact(phone){const digits=String(phone||"").replace(/\D/g,"");return digits.length===10?"52"+digits:digits;}
function conversationLabel(s){return({waiting:"Pendiente",bot:"Asistente virtual",human:"Tomada por humano",closed:"Cerrada"})[s]||s;}
function conversationCandidate(t){return candidates.find(c=>c.id===t.candidate_id);}
async function loadConversations(){
 if(!canLoad)return;
 const actor=user?.id;
 const [internal,external]=await Promise.all([
  db.from("cl360_conversations").select("id,candidate_id,status,handler_id,taken_at,last_message_at,created_at,live_chat_enabled").eq("workspace_id",WS).order("last_message_at",{ascending:false}).limit(300),
  db.rpc("cl360_messenger_pipeline")
 ]);
 if(!canLoad||user?.id!==actor)return;
 conversationsLoadError=!!internal.error||!Array.isArray(internal.data);threads=conversationsLoadError?[]:internal.data;
 messengerUnavailable=!!external.error||!Array.isArray(external.data);messengerContacts=messengerUnavailable?[]:external.data;operationsLoaded=true;
 if(!messengerUnavailable)window.CL360Sound?.observe(messengerContacts,actor);
 const linked=new Set(messengerContacts.map(x=>x.candidate_id).filter(Boolean));
 $("nav-inbox-count").textContent=threads.filter(t=>t.status==="waiting"&&(!linked.has(t.candidate_id)||t.live_chat_enabled)).length+messengerContacts.filter(x=>messengerState(x)==="waiting").length;
 renderHome();renderInbox();renderFlyAgents();renderPipeline();if(activeView==="marketing")renderRecruitmentConversion();renderCrmAlerts();maybeNotifyOverdue();
}
function renderInbox(){
 const list=$("inbox-threads");
 const filter=$("inbox-filter").value;
 const linked=new Set(messengerContacts.map(x=>x.candidate_id).filter(Boolean));
 const matched=threads.filter(t=>(filter==="all"||t.status===filter)&&(!linked.has(t.candidate_id)||t.live_chat_enabled));
 const external=messengerContacts.filter(x=>filter==="all"||messengerState(x)===filter);
 list.replaceChildren();
 if(conversationsLoadError||messengerUnavailable){const warning=document.createElement("p");warning.className="empty";warning.textContent="No pudimos cargar uno de los canales. Intenta actualizar.";list.append(warning);}
 if(!matched.length&&!external.length&&!conversationsLoadError&&!messengerUnavailable){list.innerHTML='<p class="empty">No hay conversaciones en esta sección todavía.</p>';return;}
 external.forEach(x=>list.append(messengerCard(x,true)));
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
alertTimer=window.setInterval(async()=>{if(!canLoad||document.hidden)return;await pollDueTasks();await loadConversations();await pollExecutiveNotifications();},60000);
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&canLoad){void pollDueTasks();void loadConversations();}});
checkAuth().catch(error=>{$("login-error").textContent="Error de conexión. Actualiza la página.";console.error(error?.message||"Error");});
})();
