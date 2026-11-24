// Conexión Laboral 360 — public application intake. No client-supplied tenant, role or stage.
const ALLOWED_ORIGINS=new Set(["https://rujumagil.github.io","https://conexionlaboral360.app","https://conexionlaboral360.proyectocompas-info.workers.dev"]);
Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin") || "";
  const cors = { "Access-Control-Allow-Origin":ALLOWED_ORIGINS.has(origin)?origin:"https://rujumagil.github.io", "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin" };
  const response=(status:number,data:Record<string,unknown>)=>new Response(JSON.stringify(data),{status,headers:{...cors,"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
  if (!ALLOWED_ORIGINS.has(origin)) return response(403, { ok: false, error: "origen_no_permitido" });
  if (request.method === "OPTIONS") return new Response(null, {status: 204, headers: cors});
  if (request.method !== "POST") return response(405, { ok: false, error: "metodo_no_permitido" });
  if (!request.headers.get("content-type")?.startsWith("application/json")) return response(415, { ok: false, error: "formato_invalido" });
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY");
  if (!url || !serviceKey) return response(503, { ok: false, error: "servicio_no_configurado" });
  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 5000) return response(413, { ok: false, error: "datos_demasiado_grandes" });
    body = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw Error("bad json");
  } catch { return response(400, { ok: false, error: "datos_invalidos" }); }
  // Honeypot: bots which fill the hidden field are discarded without writing PII.
  if (typeof body.website === "string" && body.website.trim()) return response(201, { ok:true });
  const name = String(body.name ?? "").trim().replace(/\s+/g, " ");
  const phone = String(body.phone ?? "").replace(/[^+0-9]/g, "");
  const job = String(body.job ?? "");
  const experience = String(body.experience ?? "").trim();
  // El historial generado por Fly solo se vincula con consentimiento y un UUID de sesión.
  // No se acepta una transcripción proporcionada por el cliente: se usa el registro del servidor.
  const flyConsent = body.flyConsent === true;
  const flySessionId = typeof body.flySessionId==="string" ? body.flySessionId.trim() : "";
  if(flyConsent && !/^[a-f0-9-]{36}$/i.test(flySessionId))
    return response(400,{ok:false,error:"sesion_de_agente_invalida"});
  const screening = (body.screening && typeof body.screening === "object" && !Array.isArray(body.screening)) ? body.screening as Record<string, unknown> : null;
  const levels = ["si", "no", "prefiero_comentarlo"];
  const availabilityValues = ["si", "no", "consultar"];
  if (!screening || !levels.includes(String(screening.experience_level || "")) ||
      !availabilityValues.includes(String(screening.availability || "")) ||
      String(screening.preferred_zone ?? "").length > 120) {
    return response(400, { ok: false, error: "preentrevista_incompleta" });
  }
  const verifiedScreening = {
    experience_level: String(screening.experience_level),
    availability: String(screening.availability),
    preferred_zone: String(screening.preferred_zone ?? "").trim()
  };
  if (body.consent !== true || name.length < 3 || name.length > 120 ||
    !/^\+?[0-9]{10,15}$/.test(phone) || !/^[a-z0-9-]{3,80}$/.test(job) ||
    experience.length < 2 || experience.length > 1000) return response(400, { ok:false, error:"verifica_los_campos_y_el_consentimiento" });
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || forwarded || "unknown";
  const fingerprintBytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(serviceKey.slice(-24) + "|" + ip));
  const fingerprint = Array.from(new Uint8Array(fingerprintBytes)).map(n => n.toString(16).padStart(2, "0")).join("");
  let upstream: Response;
  try {
    upstream = await fetch(url + "/rest/v1/rpc/cl360_submit_screened_application", {
      method: "POST",
      headers: { "apikey": serviceKey, "authorization": "Bearer " + serviceKey, "content-type": "application/json", "prefer": "return=representation" },
      body: JSON.stringify({ p_name:name, p_phone:phone, p_job_slug:job, p_experience:experience, p_screening:verifiedScreening, p_consent:true, p_fingerprint:fingerprint })
    });
  } catch { return response(503, {ok:false,error:"servicio_temporalmente_no_disponible"}); }
  if (!upstream.ok) {
    const err = await upstream.json().catch(() => ({}));
    const message = String(err?.message || "");
    if (message.includes("rate_limited")) return response(429, {ok:false,error:"limite_de_intentos"});
    if (message.includes("job_not_available")) return response(400, {ok:false,error:"vacante_no_disponible"});
    if (message.includes("invalid_screening")) return response(400, {ok:false,error:"preentrevista_incompleta"});
    if (message.includes("invalid_application")) return response(400, {ok:false,error:"datos_invalidos"});
    return response(503, {ok:false,error:"no_se_pudo_registrar"});
  }
  let flyHistoryLinked = false;
  let flyHistoryCount = 0;
  if(flyConsent && flySessionId){
    try{
      const candidateId = await upstream.json();
      if(typeof candidateId==="string"&&/^[a-f0-9-]{36}$/i.test(candidateId)){
        const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(serviceKey.slice(-24)+"|"+flySessionId));
        const sessionHash=Array.from(new Uint8Array(bytes)).map(n=>n.toString(16).padStart(2,"0")).join("");
        const joined=await fetch(url+"/rest/v1/rpc/cl360_fly_attach_session",{
          method:"POST",
          headers:{"apikey":serviceKey,"authorization":"Bearer "+serviceKey,"content-type":"application/json"},
          body:JSON.stringify({p_candidate_id:candidateId,p_session_hash:sessionHash}),
          signal:AbortSignal.timeout(7000)
        });
        if(joined.ok){
          const count=await joined.json();
          flyHistoryLinked=Number.isInteger(count)&&count>0;
          flyHistoryCount=Number.isInteger(count)?count:0;
        }else console.error("cl360_fly_attach_failed",{code:joined.status});
      }
    }catch(error){console.error("cl360_fly_attach_unavailable",{kind:error instanceof Error?error.name:"unknown"});}
  }
  return response(201, {ok:true,flyHistoryLinked,flyHistoryCount});
});
