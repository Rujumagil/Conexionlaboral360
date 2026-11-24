(()=>{
"use strict";
const URL="https://qwxydjotwhniahaovrff.supabase.co",KEY="sb_publishable_17NekbDHp_ssL_Pf-CnqPg_v0acxqn3",WS="c7ab2a78-08e0-4a29-8a3b-fadaf244002f";
const db=window.supabase?.createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
const $=id=>document.getElementById(id);
const fmt=s=>s?new Date(s).toLocaleString("es-MX",{dateStyle:"short",timeStyle:"short"}):"—";
const statusNames={waiting:"Pendiente",bot:"Andy",human:"Atención humana",closed:"Cerrada"};
let user=null,threads=[],candidates=[],jobs=[],activeId=null,loading=false,installPrompt=null;
const candidate=id=>candidates.find(c=>c.id===id);
const job=slug=>jobs.find(j=>j.slug===slug)?.title||slug||"Postulación";
const phone=p=>{const digits=String(p||"").replace(/\D/g,"");return digits.length===10?"52"+digits:digits;};
function showApp(on){$("signin").classList.toggle("hidden",on);$("app").classList.toggle("hidden",!on);}
async function authenticate(){
 if(!db){$("signin-error").textContent="No se pudo iniciar el servicio de acceso.";return;}
 const {data:{user:current},error}=await db.auth.getUser();
 if(error||!current){showApp(false);return;}
 const {data:member,error:membershipError}=await db.from("workspace_members").select("role,status").eq("workspace_id",WS).eq("user_id",current.id).eq("status","active").maybeSingle();
 if(membershipError||!member||!["owner","admin","manager","sales","support"].includes(member.role)){
  showApp(false);$("signin-error").textContent="Esta cuenta no tiene permiso para consultar estos mensajes.";return;
 }
 user=current;showApp(true);await refresh();
}
async function refresh(){
 if(!user||loading)return;
 loading=true;$("refresh").disabled=true;$("count").textContent="Actualizando conversaciones…";
 const [t,c,j]=await Promise.all([
  db.from("cl360_conversations").select("id,candidate_id,status,handler_id,last_message_at,fly_session_hash,live_chat_enabled").eq("workspace_id",WS).order("last_message_at",{ascending:false}).limit(300),
  db.from("cl360_candidates").select("id,full_name,phone,job_slug,stage").eq("workspace_id",WS).limit(500),
  db.from("cl360_jobs").select("slug,title").eq("workspace_id",WS).limit(100)
 ]);
 loading=false;$("refresh").disabled=false;
 if(t.error||c.error||j.error){$("count").textContent="Error al cargar. Pulsa ↻ para reintentar.";return;}
 threads=t.data||[];candidates=c.data||[];jobs=j.data||[];
 renderThreads();
 if(activeId&&threads.some(x=>x.id===activeId))await openConversation(activeId,false);
}
function renderThreads(){
 const q=$("search").value.trim().toLowerCase(),filter=$("filter").value;
 const filtered=threads.filter(t=>{
  const c=candidate(t.candidate_id);
  return (filter==="all"||t.status===filter)&&(!q||String(c?.full_name||"").toLowerCase().includes(q)||job(c?.job_slug).toLowerCase().includes(q));
 });
 $("count").textContent=filtered.length+" conversaciones";
 const list=$("thread-list");list.replaceChildren();
 if(!filtered.length){const p=document.createElement("p");p.className="empty";p.textContent="No hay mensajes en este filtro. Solo aparecen conversaciones vinculadas a postulaciones.";list.append(p);}
 filtered.forEach(t=>{
  const c=candidate(t.candidate_id),button=document.createElement("button");button.type="button";button.className="thread"+(activeId===t.id?" selected":"");
  const avatar=document.createElement("span");avatar.className="avatar";avatar.textContent=(c?.full_name||"C").charAt(0).toUpperCase();
  const info=document.createElement("div");info.className="thread-info";
  const line=document.createElement("div");line.className="thread-line";
  const name=document.createElement("strong");name.textContent=c?.full_name||"Candidato";
  const date=document.createElement("small");date.textContent=fmt(t.last_message_at);line.append(name,date);
  const description=document.createElement("div");description.className="small";description.textContent=job(c?.job_slug);
  const state=document.createElement("span");state.className="state "+t.status;state.textContent=statusNames[t.status]||t.status;
  info.append(line,description,state);button.append(avatar,info);button.addEventListener("click",()=>openConversation(t.id));list.append(button);
 });
}
function updateComposer(){
 const t=threads.find(x=>x.id===activeId),c=t&&candidate(t.candidate_id);
 const owner=t?.status==="human"&&t.handler_id===user?.id;
 const direct=!!owner&&!!t.fly_session_hash&&t.live_chat_enabled===true;
 const whatsApp=!!owner&&!!c?.phone;
 const reply=$("reply").value.trim(),wa=$("send-whatsapp");
 $("reply").disabled=!(direct||whatsApp);
 $("copy").disabled=!(direct||whatsApp)||!reply;
 $("send-inapp").disabled=!direct||!reply;
 wa.removeAttribute("href");wa.classList.add("disabled-link");wa.setAttribute("aria-disabled","true");
 if(whatsApp&&reply){wa.href="https://wa.me/"+phone(c.phone)+"?text="+encodeURIComponent(reply);wa.classList.remove("disabled-link");wa.setAttribute("aria-disabled","false");}
 $("reply-hint").textContent=!owner?"Toma primero el control de la conversación.":
  !direct&&whatsApp?"Esta postulación no tiene chat interno vinculado. Puedes responder por WhatsApp.":
  direct?"Enviar aquí entrega la respuesta al chat vinculado del candidato. WhatsApp abre otra aplicación y debes pulsar Enviar allí.":"No hay un canal de respuesta habilitado.";
}
async function openConversation(id,changeLayout=true){
 const t=threads.find(x=>x.id===id);if(!t)return;
 activeId=id;renderThreads();
 const c=candidate(t.candidate_id);
 $("person").textContent=c?.full_name||"Candidato";
 $("meta").textContent=job(c?.job_slug)+(c?.phone?" · "+c.phone:"");
 $("state").textContent=statusNames[t.status]||t.status;
 $("timeline").textContent="Cargando historial…";
 $("reply").value="";updateComposer();
 if(changeLayout){$("conversation-section").classList.remove("hidden-mobile");$("inbox-section").classList.add("hidden-mobile");}
 const {data,error}=await db.from("cl360_chat_messages").select("id,source,visibility,body,created_at").eq("workspace_id",WS).eq("conversation_id",id).order("created_at",{ascending:true}).limit(150);
 if(activeId!==id)return;
 const timeline=$("timeline");timeline.replaceChildren();
 if(error||!data?.length){const p=document.createElement("p");p.className="empty";p.textContent=error?"No se pudo consultar el historial.":"Todavía no hay mensajes guardados en este expediente.";timeline.append(p);}
 else data.forEach(m=>{
  const bubble=document.createElement("div");bubble.className="bubble "+(m.source==="fly"?"andy":m.source==="candidate"?"candidate":m.source==="staff"?"staff":"system");
  const author=document.createElement("b");author.textContent=({fly:"Andy",candidate:"Candidato",staff:m.visibility==="candidate"?"Astrid · enviado en el chat":"Nota interna",system:"Sistema"})[m.source]||"Mensaje";
  const text=document.createElement("p");text.textContent=m.body;
  const date=document.createElement("small");date.textContent=fmt(m.created_at);
  bubble.append(author,text,date);timeline.append(bubble);
 });
 timeline.scrollTop=timeline.scrollHeight;renderActions(t);
}
function renderActions(t){
 const wrap=$("human-controls");wrap.replaceChildren();
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
$("signout").addEventListener("click",async()=>{await db?.auth.signOut();user=null;activeId=null;threads=[];showApp(false);});
$("refresh").addEventListener("click",refresh);
$("filter").addEventListener("change",renderThreads);
$("search").addEventListener("input",renderThreads);
$("back").addEventListener("click",()=>{$("conversation-section").classList.add("hidden-mobile");$("inbox-section").classList.remove("hidden-mobile");});
$("reply").addEventListener("input",updateComposer);
$("send-inapp").addEventListener("click",async()=>{
 const t=threads.find(x=>x.id===activeId),body=$("reply").value.trim();
 if(!t||t.status!=="human"||t.handler_id!==user?.id||!t.fly_session_hash||t.live_chat_enabled!==true||!body)return;
 const button=$("send-inapp");button.disabled=true;
 const {error}=await db.rpc("cl360_staff_send_candidate_message",{p_conversation:t.id,p_body:body});
 if(error){$("reply-hint").textContent=error.message?.includes("candidate_channel")?"La sesión del candidato está caducada o no vinculada; utiliza WhatsApp.":"No pude enviar el mensaje. Intenta nuevamente.";button.disabled=false;return;}
 $("reply").value="";
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