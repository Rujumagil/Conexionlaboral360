import webpush from "npm:web-push@3.6.7";
import { createECDH } from "node:crypto";
import { Buffer } from "node:buffer";
function normalizeVapid(value:string,label:string){
 let s=value.trim().replace(new RegExp("^"+label+"\\s*:\\s*","i"),"").trim();
 if((s.startsWith('"')&&s.endsWith('"'))||(s.startsWith("'")&&s.endsWith("'")))s=s.slice(1,-1);
 s=s.replace(/\s/g,"");
 if(!/^[A-Za-z0-9+/_-]+={0,2}$/.test(s))throw Error("vapid_format");
 return s.replace(/=+$/,"").replace(/\+/g,"-").replace(/\//g,"_");
}
function validatedVapid(rawPub:string,rawPk:string){
 const pub=normalizeVapid(rawPub,"public key"),pk=normalizeVapid(rawPk,"private key");
 const p=Buffer.from(pub,"base64url"),k=Buffer.from(pk,"base64url");
 if(p.length!==65||p[0]!==4||k.length!==32||p.toString("base64url")!==pub||k.toString("base64url")!==pk)throw Error("vapid_format");
 const e=createECDH("prime256v1");e.setPrivateKey(k);
 if(!e.getPublicKey().equals(p))throw Error("vapid_pair_mismatch");
 return {pub,pk};
}

const ws="c7ab2a78-08e0-4a29-8a3b-fadaf244002f";
const labels:Record<string,string>={calls:"Solicitudes de llamada",handoff:"Atención humana",review:"Expedientes por revisar",interviews:"Entrevistas próximas",overdue:"Seguimientos vencidos"};
type Job={subscription_id:string;endpoint:string;p256dh:string;auth_key:string;batch_id:string;counts:Record<string,number>};
Deno.serve(async req=>{
 const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
 if(req.method!=="POST")return reply(405,{ok:false});
 const token=req.headers.get("X-CL360-Dispatch")||"";
 if(!/^[a-f0-9]{64}$/.test(token))return reply(403,{ok:false});
 const url=Deno.env.get("SUPABASE_URL"),secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),rawPub=Deno.env.get("CL360_VAPID_PUBLIC_KEY"),rawPk=Deno.env.get("CL360_VAPID_PRIVATE_KEY");
 if(!url||!secret||!rawPub||!rawPk)return reply(503,{ok:false,error:"configuration_missing"});
 let pub:string,pk:string;
 try{({pub,pk}=validatedVapid(rawPub,rawPk));}
 catch(e){const code=e instanceof Error&&e.message==="vapid_pair_mismatch"?"vapid_pair_mismatch":"vapid_format";console.warn("CL360 push configuration:",code);return reply(503,{ok:false,error:code});}
 const headers={apikey:secret,Authorization:"Bearer "+secret,"Content-Type":"application/json"};
 try{
  const response=await fetch(url+"/rest/v1/rpc/cl360_claim_push_batch",{method:"POST",headers,body:JSON.stringify({p_token:token})});
  if(!response.ok)return reply(response.status===403?403:503,{ok:false});
  const jobs:Job[]=await response.json();
  if(!Array.isArray(jobs))return reply(503,{ok:false});
  let accepted=0,failed=0,uncertain=0;
  await Promise.all(jobs.map(async job=>{
   let state="failed";
   try{
    const endpoint=new URL(job.endpoint),host=endpoint.hostname;
    const allowed=["fcm.googleapis.com","updates.push.services.mozilla.com","web.push.apple.com","wns2-par02p.notify.windows.com"].includes(host)||host.endsWith(".notify.windows.com");
    if(endpoint.protocol!=="https:"||endpoint.username||endpoint.password||endpoint.port||endpoint.hash||!allowed)throw Error("unsupported");
    const owned=url+"/rest/v1/cl360_push_subscriptions?id=eq."+job.subscription_id+"&workspace_id=eq."+ws+"&enabled=eq.true&select=id";
    const current=await fetch(owned,{headers});if(!current.ok||!(await current.json()).length)throw Error("disabled");
    const body=Object.entries(job.counts).filter(([k,n])=>Object.hasOwn(labels,k)&&Number.isInteger(n)&&n>0).map(([k,n])=>n+" · "+labels[k]).join(" | ");
    if(!body)throw Error("empty");
    state="uncertain";
    await webpush.sendNotification({endpoint:job.endpoint,keys:{p256dh:job.p256dh,auth:job.auth_key}},JSON.stringify({type:"operations",counts:job.counts}),{vapidDetails:{subject:"https://rujumagil.github.io/Conexionlaboral360/",publicKey:pub,privateKey:pk},TTL:900,timeout:10000});
    state="accepted";
   }catch(e:any){
    if([404,410].includes(e?.statusCode)){
     state="failed";
     await fetch(url+"/rest/v1/cl360_push_subscriptions?id=eq."+job.subscription_id+"&workspace_id=eq."+ws,{method:"PATCH",headers,body:JSON.stringify({enabled:false})}).catch(()=>{});
    }else if(Number.isInteger(e?.statusCode))state="failed";
   }
   const saved=await fetch(url+"/rest/v1/cl360_push_delivery?subscription_id=eq."+job.subscription_id+"&batch_id=eq."+job.batch_id+"&state=eq.claimed",{method:"PATCH",headers,body:JSON.stringify({state,completed_at:new Date().toISOString()})}).catch(()=>null);
   if(!saved?.ok||state==="uncertain")uncertain++;else if(state==="accepted")accepted++;else failed++;
  }));
  return reply(200,{ok:true,accepted,failed,uncertain});
 }catch{return reply(503,{ok:false});}
});
