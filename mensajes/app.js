(()=>{
"use strict";
const URL="https://qwxydjotwhniahaovrff.supabase.co",KEY="sb_publishable_17NekbDHp_ssL_Pf-CnqPg_v0acxqn3",WS="c7ab2a78-08e0-4a29-8a3b-fadaf244002f";
const db=window.supabase?.createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
const $=id=>document.getElementById(id);
const fmt=s=>s?new Date(s).toLocaleString("es-MX",{dateStyle:"short",timeStyle:"short"}):"—";
const statusNames={waiting:"Pendiente",bot:"Andy",human:"Atención humana",closed:"Cerrada"};
let user=null,threads=[],candidates=[],jobs=[],previews=[],activeId=null,loading=false,installPrompt=null,refreshTimer=null,messengerReadError=false;
const candidate=id=>candidates.find(c=>c.id===id);
const job=slug=>jobs.find(j=>j.slug===slug)?.title||slug||"Postulación";
const phone=p=>{const digits=String(p||"").replace(/\D/g,"");return digits.length===10?"52"+digits:digits;};
function showApp(on){$("signin").classList.toggle("hidden",on);$("app").classList.toggle("hidden",!on);}
function setActiveChat(open){
 $("conversation-section").classList.toggle("no-active-chat",!open);
 $("chat-welcome").setAttribute("aria-hidden",open?"true":"false");
}
function resizeReply(){
 const field=$("reply");
 field.style.height="auto";
 field.style.height=Math.min(field.scrollHeight,120)+"px";
}
async function authenticate(){
 if(!db){$("signin-error").textContent="No se pudo iniciar el servicio de acceso.";return;}
 const {data:{user:current},error}=await db.auth.getUser();
 if(error||!current){showApp(false);return;}
 const {data:member,error:membershipError}=await db.from("workspace_members").select("role,status").eq("workspace_id",WS).eq("user_id",current.id).eq("status","active").maybeSingle();
 if(membershipError||!member||!["owner","admin","manager","sales","support"].includes(member.role)){
  showApp(false);$("signin-error").textContent="Esta cuenta no tiene permiso para consultar estos mensajes.";return;
 }
 user=current;showApp(true);await refresh();
 if(refreshTimer)clearInterval(refreshTimer);
 refreshTimer=setInterval(()=>{if(document.visibilityState==="visible")refresh(true);},30000);
}
async function refresh(silent=false){
 if(!user||loading)return;
 loading=true;$("refresh").disabled=true;
 if(!silent)$("count").textContent="Actualizando conversaciones…";
 const [t,c,j,m,fb]=await Promise.all([
  db.from("cl360_conversations").select("id,candidate_id,status,handler_id,last_message_at,fly_session_hash,live_chat_enabled").eq("workspace_id",WS).order("last_message_at",{ascending:false}).limit(300),
  db.from("cl360_candidates").select("id,full_name,phone,job_slug,stage").eq("workspace_id",WS).limit(500),
  db.from("cl360_jobs").select("slug,title,status").eq("workspace_id",WS).limit(100),
  db.from("cl360_chat_messages").select("conversation_id,source,visibility,body,created_at").eq("workspace_id",WS).order("created_at",{ascending:false}).limit(500),
  db.rpc("cl360_messenger_inbox")
 ]);
 loading=false;$("refresh").disabled=false;
 if(t.error||c.error||j.error){$("count").textContent="Error al cargar. Pulsa ↻ para reintentar.";return;}
 messengerReadError=!!fb.error;
 threads=t.data||[];candidates=c.data||[];jobs=j.data||[];previews=m.error?[]:(m.data||[]);
 for(const x of fb.data||[]){
  const id="messenger:"+x.id;
  threads.push({id,externalId:x.id,channel:"messenger",candidate_id:id,status:["closed","archived"].includes(x.status)?"closed":x.assigned_user_id?"human":"waiting",handler_id:x.assigned_user_id,last_message_at:x.last_message_at});
  candidates.push({id,full_name:x.display_name||"Contacto de Facebook",job_slug:"Facebook Messenger"});
  if(x.last_message_preview)previews.push({conversation_id:id,source:"candidate",visibility:"candidate",body:x.last_message_preview});
 }
 renderThreads();
 if(activeId&&threads.some(x=>x.id===activeId))await openConversation(activeId,false,true);
 else if(activeId){activeId=null;setActiveChat(false);$("conversation-section").classList.add("hidden-mobile");$("inbox-section").classList.remove("hidden-mobile");}
}
function setFilter(value){
 if(!["all","waiting","human","bot","closed"].includes(value))return;
 $("filter").value=value;
 document.querySelectorAll("[data-filter]").forEach(b=>{
  const active=b.dataset.filter===value;b.classList.toggle("active",active);b.setAttribute("aria-pressed",String(active));
 });
 document.querySelectorAll("[data-tab]").forEach(b=>b.classList.toggle("active",b.dataset.tab===value));
 renderThreads();
}
function renderThreads(){
 const q=$("search").value.trim().toLocaleLowerCase("es-MX"),digits=q.replace(/\D/g,""),filter=$("filter").value;
 const filtered=threads.filter(t=>{
  const c=candidate(t.candidate_id);
  const allowed=filter==="all"||filter==="human"?(filter==="all"||(t.status==="human"&&t.handler_id===user?.id)):t.status===filter;
  return allowed&&(!q||String(c?.full_name||"").toLocaleLowerCase("es-MX").includes(q)||job(c?.job_slug).toLocaleLowerCase("es-MX").includes(q)||(digits.length>=3&&String(c?.phone||"").replace(/\D/g,"").includes(digits)));
 }).sort((a,b)=>{const priority=t=>t.status==="waiting"?0:t.status==="human"&&t.handler_id===user?.id?1:t.status==="bot"?2:t.status==="human"?3:4;return priority(a)-priority(b)||new Date(b.last_message_at||0)-new Date(a.last_message_at||0);});
 $("count").textContent=filtered.length+" "+(filtered.length===1?"conversación":"conversaciones")+(messengerReadError?" · Messenger no disponible":"");
 const waiting=threads.filter(t=>t.status==="waiting").length;
 const counts={all:threads.length,waiting,human:threads.filter(t=>t.status==="human"&&t.handler_id===user?.id).length,bot:threads.filter(t=>t.status==="bot").length,closed:threads.filter(t=>t.status==="closed").length};
 document.querySelectorAll("[data-filter]").forEach(button=>{const type=button.dataset.filter;const name={all:"Todos",waiting:"Pendientes",human:"Mis chats",bot:"Andy",closed:"Cerrados"}[type];if(name)button.textContent=name+" ("+counts[type]+")";});
 $("inbox-badge").hidden=!waiting;$("inbox-badge").textContent=String(waiting);
 $("inbox-subtitle").textContent=waiting?waiting+" pendiente"+(waiting===1?"":"s")+" de atención":"Atención a candidatos";
 const list=$("thread-list");list.replaceChildren();
 if(!filtered.length){
  const p=document.createElement("p");p.className="empty";
  p.textContent=q?"No hay candidatos con esa búsqueda.":filter==="all"?"Aún no hay conversaciones vinculadas a postulaciones.":"No hay conversaciones en esta sección.";list.append(p);
 }
 filtered.forEach(t=>{
  const c=candidate(t.candidate_id),button=document.createElement("button");button.type="button";
  button.className="thread"+(activeId===t.id?" selected":"");
  button.setAttribute("aria-label","Abrir conversación con "+(c?.full_name||"candidato"));
  const avatar=document.createElement("span");avatar.className="avatar";avatar.textContent=(c?.full_name||"C").trim().charAt(0).toUpperCase();
  const info=document.createElement("div");info.className="thread-info";
  const line=document.createElement("div");line.className="thread-line";
  const name=document.createElement("strong");name.textContent=c?.full_name||"Candidato";
  const date=document.createElement("small");date.textContent=fmt(t.last_message_at);line.append(name,date);
  const desc=document.createElement("div");desc.className="small";desc.textContent=job(c?.job_slug);
  info.append(line,desc);
  const last=previews.find(m=>m.conversation_id===t.id&&
   (m.source==="candidate"||m.source==="fly"||(m.source==="staff"&&m.visibility==="candidate")));
  if(last){
   const preview=document.createElement("span");preview.className="thread-preview";
   const who=document.createElement("span");who.className="preview-author";who.textContent=t.channel==="messenger"?"Messenger: ":last.source==="candidate"?"Candidato: ":last.source==="fly"?"Andy: ":"Astrid: ";
   preview.append(who,document.createTextNode(last.body||""));info.append(preview);
  }
  const state=document.createElement("span");state.className="state "+t.status;state.textContent=statusNames[t.status]||t.status;info.append(state);
  button.append(avatar,info);button.addEventListener("click",()=>openConversation(t.id));list.append(button);
 });
}
let messengerSending=false;
function messengerKey(t){return "cl360-send-pending:"+user?.id+":"+t.externalId;}
function messengerPending(t){try{return sessionStorage.getItem(messengerKey(t));}catch{return "unavailable";}}
async function sendFacebook(t,body){
 if(messengerSending||messengerPending(t)||t.status==="closed"||(t.handler_id&&t.handler_id!==user?.id)||body.length>2000)return;
 const key=messengerKey(t),requestId=crypto.randomUUID(),sender=user?.id;
 messengerSending=true;
 try{
  const {data:{session},error}=await db.auth.getSession();
  if(error||!session||session.user.id!==sender){if(activeId===t.id)$("reply-hint").textContent="Inicia sesión nuevamente.";return;}
  sessionStorage.setItem(key,requestId);
  updateComposer();
  const response=await fetch("https://app.proyectocompas.app/api/integrations/meta/messenger/cl360-send",{method:"POST",headers:{Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify({conversationId:t.externalId,requestId,body}),redirect:"error"});
  const result=await response.json().catch(()=>null);
  if(response.ok&&result?.ok===true){
   sessionStorage.removeItem(key);
   if(activeId===t.id&&user?.id===sender&&$("reply").value.trim()===body){$("reply").value="";resizeReply();}
   await refresh(true);
   if(activeId===t.id&&user?.id===sender)$("reply-hint").textContent=result.code==="SENT_HISTORY_PENDING"?"Meta confirmó el envío; historial pendiente de sincronizar.":"Mensaje enviado a Facebook.";
  }else if(["ORIGIN","SESSION","ROLE","INPUT","WORKSPACE","CONVERSATION","ASSIGNED","PAGE","WINDOW_CLOSED","RECIPIENT","CONFIG"].includes(result?.code)){
   sessionStorage.removeItem(key);
   if(activeId===t.id)$("reply-hint").textContent=result.code==="WINDOW_CLOSED"?"La ventana de 24 horas está cerrada.":"Envío no autorizado: "+result.code;
  }
 }catch{/* Uncertain delivery: keep the attempt blocked; never retry automatically. */}
 finally{messengerSending=false;const hint=$("reply-hint").textContent;updateComposer();if(activeId===t.id&&!messengerPending(t)&&hint)$("reply-hint").textContent=hint;}
}
function updateComposer(){
 const t=threads.find(x=>x.id===activeId),c=t&&candidate(t.candidate_id);
 if(t?.channel==="messenger"){
  const blocked=t.status==="closed"||(t.handler_id&&t.handler_id!==user?.id);
  const pending=messengerPending(t);
  $("reply").disabled=!!blocked||!!pending||messengerSending;
  $("copy").disabled=true;$("send-inapp").disabled=!!blocked||!!pending||messengerSending||!$("reply").value.trim();
  const wa=$("send-whatsapp");wa.hidden=true;$("copy").hidden=true;wa.removeAttribute("href");wa.classList.add("disabled-link");wa.setAttribute("aria-disabled","true");
  $("channel-state").textContent="· Facebook Messenger";$("reply-hint").textContent=blocked?"Conversación cerrada o asignada a otra persona.":pending?"Envío sin confirmar. Verifica en Meta antes de repetirlo.":messengerSending?"Enviando a Messenger…":"La respuesta se enviará a Facebook Messenger.";return;
 }
 const owner=t?.status==="human"&&t.handler_id===user?.id;
 const direct=!!owner&&!!t.fly_session_hash&&t.live_chat_enabled===true;
 const whatsApp=!!owner&&!!c?.phone;
 const reply=$("reply").value.trim(),wa=$("send-whatsapp");
 $("reply").disabled=!(direct||whatsApp);
 $("copy").disabled=!(direct||whatsApp)||!reply;
 $("send-inapp").disabled=!direct||!reply;
 wa.hidden=false;$("copy").hidden=false;wa.removeAttribute("href");wa.classList.add("disabled-link");wa.setAttribute("aria-disabled","true");
 if(whatsApp&&reply){wa.href="https://wa.me/"+phone(c.phone)+"?text="+encodeURIComponent(reply);wa.classList.remove("disabled-link");wa.setAttribute("aria-disabled","false");}
 $("channel-state").textContent=!owner?"· Esperando toma humana":direct?"· Chat interno habilitado":whatsApp?"· Solo WhatsApp":"· Sin canal activo";
 $("reply-hint").textContent=!owner?"Toma primero el control de la conversación.":
  !direct&&whatsApp?"Esta postulación no tiene chat interno vinculado. Puedes responder por WhatsApp.":
  direct?"Enviar aquí entrega la respuesta al chat vinculado del candidato. WhatsApp abre otra aplicación y debes pulsar Enviar allí.":"No hay un canal de respuesta habilitado.";
}
async function openConversation(id,changeLayout=true,preserveDraft=false){
 const t=threads.find(x=>x.id===id);if(!t)return;
 const draft=preserveDraft?$("reply").value:"";
 const oldScroll=preserveDraft?$("timeline").scrollTop:0;
 const oldHeight=preserveDraft?$("timeline").scrollHeight:0;
 activeId=id;setActiveChat(true);renderThreads();
 if(changeLayout){$("context-panel").classList.add("hidden");$("info-toggle").setAttribute("aria-expanded","false");}
 const c=candidate(t.candidate_id);
 $("chat-avatar").textContent=(c?.full_name||"C").charAt(0).toUpperCase();
 $("person").textContent=c?.full_name||"Candidato";
 $("meta").textContent=job(c?.job_slug)+(c?.phone?" · "+c.phone:"");
 $("state").textContent=statusNames[t.status]||t.status;
 $("timeline").textContent="Cargando historial…";
 $("reply").value=draft;resizeReply();updateComposer();
 if(changeLayout){$("conversation-section").classList.remove("hidden-mobile");$("inbox-section").classList.add("hidden-mobile");}
 const response=t.channel==="messenger"?await db.rpc("cl360_messenger_inbox",{p_conversation:t.externalId}):await db.from("cl360_chat_messages").select("id,source,visibility,body,created_at").eq("workspace_id",WS).eq("conversation_id",id).order("created_at",{ascending:true}).limit(150);
 const error=response.error;
 const data=t.channel==="messenger"?(response.data||[]).map(m=>({...m,source:m.direction==="incoming"?"candidate":"staff",visibility:"candidate",body:m.body||"["+ (m.message_type||"Mensaje") +"]"})):response.data;
 if(activeId!==id)return;
 const timeline=$("timeline");timeline.replaceChildren();
 if(error||!data?.length){const p=document.createElement("p");p.className="conversation-empty";p.textContent=error?"No se pudo consultar el historial.":"Todavía no hay mensajes guardados en este expediente.";timeline.append(p);}
 else if(!data.some(m=>m.source!=="system")){
  const p=document.createElement("p");p.className="conversation-empty";
  p.textContent="Este expediente solo contiene eventos del sistema. Consulta el resumen en ⓘ o utiliza WhatsApp para continuar. El historial que no se guardó anteriormente no puede recuperarse.";
  timeline.append(p);
 }
 else data.forEach(m=>{
  if(m.source==="system")return;
  const bubble=document.createElement("div");bubble.className="bubble "+(m.source==="fly"?"andy":m.source==="candidate"?"candidate":m.source==="staff"?"staff":"system");
  if(m.source==="staff"&&m.visibility==="internal")bubble.classList.add("internal-note");
  const author=document.createElement("b");author.textContent=({fly:"Andy",candidate:"Candidato",staff:m.visibility==="candidate"?(t.channel==="messenger"?"Página · "+({sent:"Enviado",delivered:"Entregado",read:"Leído",failed:"Fallido"}[m.status]||m.status||""):"Astrid · enviado en el chat"):"Nota interna",system:"Sistema"})[m.source]||"Mensaje";
  const text=document.createElement("p");text.textContent=m.body;
  const date=document.createElement("small");date.textContent=fmt(m.created_at);
  bubble.append(author,text,date);timeline.append(bubble);
 });
 if(preserveDraft&&oldHeight>0&&oldHeight-oldScroll>timeline.clientHeight+75)timeline.scrollTop=oldScroll;
 else timeline.scrollTop=timeline.scrollHeight;
 renderActions(t);
 renderContext(t,data||[]);
}
function renderContext(t,messages){
 const panel=$("context-details");panel.replaceChildren();
 const c=candidate(t.candidate_id);
 const rows=[["Nombre",c?.full_name||"No informado"],["Vacante",job(c?.job_slug)],
  ["Teléfono",c?.phone||"Sin teléfono"],["Estado",statusNames[t.status]||t.status],
  ["Chat interno",t.live_chat_enabled?"Autorizado":"No habilitado en este expediente"]];
 for(const [label,value] of rows){
  const row=document.createElement("div");row.className="context-row";
  const name=document.createElement("small");name.textContent=label;
  const content=document.createElement("strong");content.textContent=value;
  row.append(name,content);panel.append(row);
 }
 const system=messages.filter(m=>m.source==="system");
 if(system.length){
  const detail=document.createElement("details");detail.className="context-system";
  const summary=document.createElement("summary");summary.textContent="Preentrevista y eventos ("+system.length+")";
  detail.append(summary);
  for(const m of system){const entry=document.createElement("article");entry.textContent=m.body;detail.append(entry);}
  panel.append(detail);
 }
}
let andyDraftBusy=false;
function appendAndyMemoryControls(wrap,t){
 if(t.status==="closed"||(t.handler_id&&t.handler_id!==user?.id))return;
 const b=document.createElement("button");b.type="button";b.className="subtle";b.textContent="Memoria de Andy";
 b.onclick=async()=>{
  if(activeId!==t.id||!user||b.disabled)return;
  const actor=user.id;b.disabled=true;
  try{
   const {data:mem,error}=await db.rpc("cl360_messenger_memory",{p_conversation:t.externalId});
   if(error||!mem||activeId!==t.id||user?.id!==actor)return;
   const dialog=document.createElement("dialog");dialog.style.cssText="max-width:min(440px,92vw);width:100%;padding:20px;border:1px solid #cbd5e1;border-radius:14px;color:inherit;background:var(--surface,#fff)";
   const heading=document.createElement("h2");heading.textContent="Memoria de Andy";dialog.append(heading);
   const intro=document.createElement("p");intro.textContent="Marca únicamente los datos confirmados durante la conversación.";dialog.append(intro);
   const check=(label,checked)=>{const row=document.createElement("label");row.style.cssText="display:flex;gap:8px;margin:12px 0;align-items:center";const input=document.createElement("input");input.type="checkbox";input.checked=!!checked;row.append(input,document.createTextNode(label));dialog.append(row);return input;};
   const name=check("Nombre confirmado",mem.name_confirmed);
   const jobLabel=document.createElement("label");jobLabel.textContent="Vacante de interés";jobLabel.style.display="block";
   const jobSelect=document.createElement("select");jobSelect.style.cssText="display:block;width:100%;margin:8px 0";jobLabel.append(jobSelect);
   const none=document.createElement("option");none.value="";none.textContent="Sin confirmar";jobSelect.append(none);
   for(const job of jobs.filter(j=>j.status==="active")){const o=document.createElement("option");o.value=job.slug;o.textContent=job.title;jobSelect.append(o);}
   jobSelect.value=mem.job_slug||"";dialog.append(jobLabel);
   const shift=check("Turno conversado",mem.shift_discussed&&!!jobSelect.value);
   jobSelect.onchange=()=>{shift.checked=false;shift.disabled=!jobSelect.value;};shift.disabled=!jobSelect.value;
   const human=check("Solicita atención humana",mem.human_requested);
   const hint=document.createElement("p");hint.setAttribute("role","status");dialog.append(hint);
   const buttons=document.createElement("div");buttons.style.cssText="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap";
   const cancel=document.createElement("button");cancel.type="button";cancel.textContent="Cancelar";cancel.className="subtle";cancel.onclick=()=>dialog.close();
   const save=document.createElement("button");save.type="button";save.textContent="Guardar memoria";save.className="subtle";
   save.onclick=async()=>{
    if(activeId!==t.id||user?.id!==actor){dialog.close();return;}
    save.disabled=true;hint.textContent="Guardando…";
    const {error}=await db.rpc("cl360_messenger_memory",{p_conversation:t.externalId,p_patch:{revision:mem.revision,name_confirmed:name.checked,job_slug:jobSelect.value,shift_discussed:shift.checked,human_requested:human.checked}});
    if(error){hint.textContent="No se guardó. Cierra y vuelve a abrir la memoria para revisar la información actual.";save.disabled=false;return;}
    dialog.close();if(activeId===t.id&&user?.id===actor)$("reply-hint").textContent="Memoria actualizada. Andy utilizará el siguiente tema confirmado.";
   };
   buttons.append(cancel,save);dialog.append(buttons);dialog.addEventListener("close",()=>dialog.remove(),{once:true});document.body.append(dialog);dialog.showModal();
  }catch{if(activeId===t.id)$("reply-hint").textContent="No se pudo consultar la memoria.";}
  finally{b.disabled=false;}
 };
 wrap.append(b);
}
function appendAndyDraftControls(wrap,t){
 if(t.status==="closed"||(t.handler_id&&t.handler_id!==user?.id))return;
 const topics={auto:"Siguiente paso según memoria",greeting:"Saludo y nombre",vacancies:"Vacantes disponibles",schedule:"Turnos y disponibilidad",experience:"Experiencia laboral",handoff:"Derivar a Astrid"};
 const select=document.createElement("select");select.setAttribute("aria-label","Tema de respuesta de Andy");
 for(const [value,label] of Object.entries(topics)){const option=document.createElement("option");option.value=value;option.textContent=label;select.append(option);}
 const button=document.createElement("button");button.type="button";button.className="subtle";button.textContent=andyDraftBusy?"Preparando borrador…":"Sugerir con Andy";button.disabled=andyDraftBusy||!!messengerPending(t)||messengerSending;
 button.onclick=async()=>{
  if(andyDraftBusy||messengerPending(t)||messengerSending||activeId!==t.id)return;
  const initial=$("reply").value,actor=user?.id;
  if(initial.trim()&&!confirm("¿Quieres reemplazar el borrador actual por una sugerencia de Andy?"))return;
  andyDraftBusy=true;button.disabled=true;button.textContent="Preparando borrador…";
  try{
   const {data:{session},error}=await db.auth.getSession();
   if(error||!session||session.user.id!==actor)throw Error("SESSION");
   const {data:mem,error:memoryError}=await db.rpc("cl360_messenger_memory",{p_conversation:t.externalId});
   if(memoryError||!mem)throw Error("MEMORY");
   if(activeId!==t.id||user?.id!==actor)return;
   const topic=select.value==="auto"?mem.next_topic:select.value;
   if(!["greeting","vacancies","schedule","experience","handoff"].includes(topic))throw Error("TOPIC");
   const response=await fetch(URL+"/functions/v1/cl360-messenger-draft",{method:"POST",headers:{apikey:KEY,Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify({conversationId:t.externalId,topic,jobSlug:mem.job_slug||""})});
   const result=await response.json().catch(()=>null);
   if(!response.ok||result?.ok!==true||typeof result.draft!=="string")throw Error(result?.code||"UNAVAILABLE");
   if(activeId!==t.id||user?.id!==actor||$("reply").value!==initial||messengerPending(t)||messengerSending)return;
   const current=threads.find(x=>x.id===t.id);
   if(!current||current.status==="closed"||(current.handler_id&&current.handler_id!==actor))return;
   $("reply").value=result.draft;resizeReply();updateComposer();$("reply-hint").textContent="Borrador de Andy. Revisa y edita antes de enviar; aún no se ha enviado.";
  }catch{if(activeId===t.id&&user?.id===actor)$("reply-hint").textContent="Andy no pudo preparar la sugerencia. Puedes escribir una respuesta manual.";}
  finally{andyDraftBusy=false;button.disabled=false;button.textContent="Sugerir con Andy";if(activeId===t.id&&user?.id===actor){const hint=$("reply-hint").textContent;const current=threads.find(x=>x.id===t.id);if(current)renderActions(current);$("reply-hint").textContent=hint;}}
 };
 wrap.append(select,button);
}
function renderActions(t){
 const wrap=$("human-controls");wrap.replaceChildren();
 if(t.channel==="messenger"){const info=document.createElement("span");info.className="control-note";info.textContent=t.status==="closed"?"Conversación cerrada.":t.handler_id===user?.id?"Atención humana · Tienes el control.":t.handler_id?"Atención humana · Asignada a otro integrante.":"Andy supervisado · Solo borradores.";wrap.append(info);
 if(t.status!=="closed"&&(!t.handler_id||t.handler_id===user?.id)){
  const b=document.createElement("button");b.type="button";b.className="subtle";b.textContent=t.handler_id?"Volver a Andy supervisado":"Tomar control humano";b.disabled=messengerSending||andyDraftBusy;
  b.onclick=async()=>{if(b.disabled||activeId!==t.id||messengerSending||andyDraftBusy)return;b.disabled=true;const {error}=await db.rpc("cl360_messenger_control",{p_conversation:t.externalId,p_action:t.handler_id?"release":"take"});if(error){alert("No se pudo cambiar la atención. Actualiza la conversación.");b.disabled=false;return;}await refresh(true);};
  wrap.append(b);
  const auto=document.createElement("button");auto.type="button";auto.className="subtle";auto.disabled=true;auto.textContent="Andy automático · Próximamente";wrap.append(auto);
 }
 appendAndyMemoryControls(wrap,t);
 if(!t.handler_id)appendAndyDraftControls(wrap,t);if(messengerPending(t)&&messengerPending(t)!=="unavailable"){const b=document.createElement("button");b.type="button";b.className="subtle";b.textContent="Verifiqué en Meta";b.onclick=()=>{if(messengerSending)return;if(confirm("Confirma que revisaste el historial en Meta. Esto desbloquea un nuevo envío, no reenvía el anterior.")){sessionStorage.removeItem(messengerKey(t));updateComposer();renderActions(t);}};wrap.append(b);}updateComposer();return;}
 const c=candidate(t.candidate_id),mine=t.status==="human"&&t.handler_id===user?.id;
 const info=document.createElement("span");info.className="control-note";
 info.textContent=mine?"Tienes el control. Andy no responderá a esta conversación vinculada.":t.status==="human"?"El caso está asignado a otra persona.":t.status==="closed"?"Este caso está cerrado.":"Puedes tomar este caso para intervenir.";
 wrap.append(info);
 const make=(label,action)=>{
  const b=document.createElement("button");b.type="button";b.className="subtle";b.textContent=label;
  b.addEventListener("click",async()=>{b.disabled=true;const {error}=await db.rpc("cl360_take_conversation",{p_conversation:t.id,p_action:action});if(error){b.disabled=false;alert("No se pudo actualizar el caso: "+error.message);return;}await refresh();});
  wrap.append(b);
 };
 if(t.status==="waiting"||t.status==="bot")make("Tomar conversación","take");
 if(mine)make("Dejar pendiente","release");
 if(t.status==="closed")make("Reabrir","reopen");
 if(t.status!=="closed"&&(t.status!=="human"||mine))make("Cerrar caso","close");
 if(c?.phone){const a=document.createElement("a");a.className="subtle";a.href="https://wa.me/"+phone(c.phone);a.target="_blank";a.rel="noopener noreferrer";a.textContent="WhatsApp ↗";wrap.append(a);}
 updateComposer();
}
$("signin-form").addEventListener("submit",async event=>{
 event.preventDefault();if(!db)return;
 const button=event.currentTarget.querySelector('button[type="submit"]');button.disabled=true;$("signin-error").textContent="";
 const {error}=await db.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});
 button.disabled=false;$("password").value="";
 if(error){$("signin-error").textContent="Correo o contraseña incorrectos.";return;}await authenticate();
});
$("signout").addEventListener("click",async()=>{if(refreshTimer){clearInterval(refreshTimer);refreshTimer=null;}await db?.auth.signOut();user=null;activeId=null;threads=[];setActiveChat(false);showApp(false);$("app-menu").classList.add("hidden");});
$("refresh").addEventListener("click",refresh);
$("filter").addEventListener("change",()=>setFilter($("filter").value));
document.querySelectorAll("[data-filter]").forEach(btn=>btn.addEventListener("click",()=>setFilter(btn.dataset.filter)));
document.querySelectorAll("[data-tab]").forEach(btn=>btn.addEventListener("click",()=>setFilter(btn.dataset.tab)));
$("menu-toggle").addEventListener("click",()=>{
 const open=$("app-menu").classList.toggle("hidden")===false;
 $("menu-toggle").setAttribute("aria-expanded",String(open));
});
$("menu-refresh").addEventListener("click",()=>{$("app-menu").classList.add("hidden");refresh();});
$("install-menu").addEventListener("click",()=>{$("app-menu").classList.add("hidden");$("install").click();});
document.addEventListener("pointerdown",event=>{if(!event.target.closest(".header-actions")&&!event.target.closest("#app-menu")){$("app-menu").classList.add("hidden");$("menu-toggle").setAttribute("aria-expanded","false");}});
document.addEventListener("keydown",event=>{if(event.key==="Escape"){$("app-menu").classList.add("hidden");$("context-panel").classList.add("hidden");$("info-toggle").setAttribute("aria-expanded","false");}});
$("info-toggle").addEventListener("click",()=>{
 const isOpen=!$("context-panel").classList.toggle("hidden");
 $("info-toggle").setAttribute("aria-expanded",String(isOpen));
});
$("info-close").addEventListener("click",()=>{
 $("context-panel").classList.add("hidden");
 $("info-toggle").setAttribute("aria-expanded","false");
});
$("search").addEventListener("input",renderThreads);
$("back").addEventListener("click",()=>{
 $("context-panel").classList.add("hidden");
 $("info-toggle").setAttribute("aria-expanded","false");
 $("conversation-section").classList.add("hidden-mobile");$("inbox-section").classList.remove("hidden-mobile");
});
$("reply").addEventListener("input",()=>{resizeReply();updateComposer();});
$("reply").addEventListener("keydown",event=>{
 if(event.key==="Enter"&&!event.shiftKey&&!event.isComposing&&!$("send-inapp").disabled){
  event.preventDefault();$("send-inapp").click();
 }
});
$("send-inapp").addEventListener("click",async()=>{
 const t=threads.find(x=>x.id===activeId),body=$("reply").value.trim();
 if(t?.channel==="messenger"){if(body)await sendFacebook(t,body);return;}
 if(!t||t.status!=="human"||t.handler_id!==user?.id||!t.fly_session_hash||t.live_chat_enabled!==true||!body)return;
 const button=$("send-inapp");button.disabled=true;
 const {error}=await db.rpc("cl360_staff_send_candidate_message",{p_conversation:t.id,p_body:body});
 if(error){$("reply-hint").textContent=error.message?.includes("candidate_channel")?"La sesión del candidato está caducada o no vinculada; utiliza WhatsApp.":"No pude enviar el mensaje. Intenta nuevamente.";button.disabled=false;return;}
 $("reply").value="";resizeReply();
 await refresh();
 $("reply-hint").textContent="Mensaje enviado al chat vinculado. Se mostrará cuando el candidato abra o mantenga activo el chat.";
});
$("copy").addEventListener("click",async()=>{try{await navigator.clipboard.writeText($("reply").value.trim());$("reply-hint").textContent="Texto copiado. Aún no se ha enviado.";}catch{$("reply-hint").textContent="Selecciona el texto para copiarlo manualmente."; }});
window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();installPrompt=event;});
window.addEventListener("appinstalled",()=>{$("install-hint").textContent="Mensajes instalado";installPrompt=null;});
$("install").addEventListener("click",async()=>{
 if(window.matchMedia("(display-mode: standalone)").matches){$("install-hint").textContent="Ya estás usando la aplicación instalada.";return;}
 if(installPrompt){const prompt=installPrompt;installPrompt=null;await prompt.prompt();const result=await prompt.userChoice;$("install-hint").textContent=result?.outcome==="accepted"?"Instalación solicitada":"Puedes instalar desde el navegador";}
 else $("install-hint").textContent=/iPhone|iPad/i.test(navigator.userAgent)?"En Safari: Compartir → Agregar a pantalla de inicio":"En Chrome: ⋮ → Instalar aplicación o Agregar a pantalla principal";
});
if("serviceWorker" in navigator&&location.protocol==="https:")navigator.serviceWorker.register("./sw.js",{scope:"./"}).catch(()=>{});
authenticate().catch(()=>{$("signin-error").textContent="No se pudo verificar el acceso.";});
})();