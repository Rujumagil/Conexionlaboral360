// Canal directo de mensajes de candidatos, asociado a postulación consentida.
// El token UUID de sesión nunca se usa como identidad de un candidato distinto.
const ALLOWED_ORIGINS=new Set(["https://rujumagil.github.io","https://conexionlaboral360.app","https://conexionlaboral360.proyectocompas-info.workers.dev"]);
const WS="c7ab2a78-08e0-4a29-8a3b-fadaf244002f";
Deno.serve(async(request:Request)=>{
 const origin=request.headers.get("origin")||"";
 const headers={"Access-Control-Allow-Origin":ALLOWED_ORIGINS.has(origin)?origin:"https://conexionlaboral360.app",
  "Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"content-type, apikey, authorization, x-client-info",
  "Vary":"Origin","Cache-Control":"no-store","Content-Type":"application/json; charset=utf-8"};
 const output=(status:number,body:Record<string,unknown>)=>new Response(JSON.stringify(body),{status,headers});
 if(!ALLOWED_ORIGINS.has(origin))return output(403,{ok:false,error:"origen_no_permitido"});
 if(request.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(request.method!=="POST")return output(405,{ok:false,error:"metodo_no_permitido"});
 if(!request.headers.get("content-type")?.startsWith("application/json"))return output(415,{ok:false,error:"tipo_de_contenido_no_admitido"});
 const base=Deno.env.get("SUPABASE_URL");
 const secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||Deno.env.get("SUPABASE_SECRET_KEY");
 if(!base||!secret)return output(503,{ok:false,error:"servicio_no_disponible"});
 let body:Record<string,unknown>;
 try{const raw=await request.text();if(raw.length>3000)return output(413,{ok:false,error:"mensaje_demasiado_largo"});
 body=JSON.parse(raw);if(!body||typeof body!=="object"||Array.isArray(body))throw Error("bad");}
 catch{return output(400,{ok:false,error:"solicitud_invalida"});}
 const token=typeof body.sessionId==="string"?body.sessionId.trim():"";
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token))
  return output(400,{ok:false,error:"sesion_invalida"});
 const action=body.action==="poll"?"poll":body.action==="send"?"send":null;
 if(!action)return output(400,{ok:false,error:"accion_invalida"});
 const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(secret.slice(-24)+"|"+token));
 const hash=Array.from(new Uint8Array(bytes)).map(n=>n.toString(16).padStart(2,"0")).join("");
 const requestHeaders={apikey:secret,authorization:"Bearer "+secret,"content-type":"application/json"};
 try{
  const lookup=await fetch(base+"/rest/v1/cl360_conversations?select=id,status,candidate_id,live_chat_enabled&workspace_id=eq."+WS+"&fly_session_hash=eq."+hash+"&limit=1",
   {headers:requestHeaders,signal:AbortSignal.timeout(6500),cache:"no-store"});
  if(!lookup.ok)return output(503,{ok:false,error:"consulta_no_disponible"});
  const conversations=await lookup.json();
  const conversation=Array.isArray(conversations)?conversations[0]:null;
  if(!conversation)return output(404,{ok:false,error:"conversacion_no_vinculada"});
  if(conversation.live_chat_enabled!==true)return output(403,{ok:false,error:"chat_no_autorizado"});
  const candidateResponse=await fetch(base+"/rest/v1/cl360_candidates?select=id,consent_at,last_submitted_at&id=eq."+conversation.candidate_id+"&workspace_id=eq."+WS+"&limit=1",
   {headers:requestHeaders,signal:AbortSignal.timeout(6500),cache:"no-store"});
  if(!candidateResponse.ok)return output(503,{ok:false,error:"consulta_no_disponible"});
  const people=await candidateResponse.json(),person=Array.isArray(people)?people[0]:null;
  if(!person?.consent_at||!person.last_submitted_at||Date.now()-new Date(person.last_submitted_at).getTime()>30*86400000)
   return output(403,{ok:false,error:"sesion_caducada"});
  if(action==="send"){
   const text=typeof body.message==="string"?body.message.trim():"";
   if(text.length<1||text.length>1000)return output(400,{ok:false,error:"mensaje_invalido"});
   const sent=await fetch(base+"/rest/v1/rpc/cl360_candidate_send_inapp",
    {method:"POST",headers:requestHeaders,body:JSON.stringify({p_session_hash:hash,p_body:text}),signal:AbortSignal.timeout(6500)});
   if(!sent.ok){
    const result=await sent.json().catch(()=>({}));const detail=String(result?.message||"");
    if(detail.includes("message_rate_limited"))return output(429,{ok:false,error:"demasiados_mensajes"});
    if(detail.includes("conversation_closed"))return output(409,{ok:false,error:"conversacion_cerrada"});
    return output(503,{ok:false,error:"no_se_pudo_enviar"});
   }
  }
  const saved=await fetch(base+"/rest/v1/cl360_chat_messages?select=id,source,visibility,body,created_at&conversation_id=eq."+conversation.id+"&workspace_id=eq."+WS+"&order=created_at.asc&limit=150",
   {headers:requestHeaders,signal:AbortSignal.timeout(6500),cache:"no-store"});
  if(!saved.ok)return output(503,{ok:false,error:"historial_no_disponible"});
  const rows=await saved.json();
  const messages=(Array.isArray(rows)?rows:[]).filter((m:Record<string,unknown>)=>
   (m.source==="candidate"||m.source==="fly")||(m.source==="staff"&&m.visibility==="candidate"))
   .map((m:Record<string,unknown>)=>({id:m.id,source:m.source,body:m.body,created_at:m.created_at}));
  return output(200,{ok:true,status:conversation.status,messages});
 }catch{return output(503,{ok:false,error:"servicio_temporalmente_no_disponible"});}
});