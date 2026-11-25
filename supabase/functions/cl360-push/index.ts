import webpush from "npm:web-push@3.6.7";
const ws="c7ab2a78-08e0-4a29-8a3b-fadaf244002f";
const origins=["https://rujumagil.github.io","https://conexionlaboral360.app","https://conexionlaboral360.proyectocompas-info.workers.dev"];
Deno.serve(async req=>{
 const origin=req.headers.get("origin")||"";
 const headers={"access-control-allow-origin":origins.includes(origin)?origin:origins[0],"access-control-allow-headers":"authorization,apikey,content-type,x-client-info","access-control-allow-methods":"POST,OPTIONS","content-type":"application/json","cache-control":"no-store","vary":"Origin"};
 const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
 if(!origins.includes(origin))return reply(403,{ok:false});
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(req.method!=="POST")return reply(405,{ok:false});
 try{
 const url=Deno.env.get("SUPABASE_URL")!,key=Deno.env.get("SUPABASE_ANON_KEY")!,secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 const auth=req.headers.get("authorization")||"";if(!auth.startsWith("Bearer "))return reply(401,{ok:false});
 const u=await fetch(url+"/auth/v1/user",{headers:{apikey:key,authorization:auth}});if(!u.ok)return reply(401,{ok:false});
 const user=await u.json();if(user.is_anonymous||!/^[a-f0-9-]{36}$/i.test(user.id||""))return reply(403,{ok:false});
 const priv={apikey:secret,authorization:"Bearer "+secret,"content-type":"application/json"};
 const m=await fetch(url+"/rest/v1/workspace_members?select=role&workspace_id=eq."+ws+"&user_id=eq."+user.id+"&status=eq.active",{headers:priv});
 if(!m.ok||!(await m.json()).some((x:any)=>["owner","admin","manager"].includes(x.role)))return reply(403,{ok:false});
 const raw=await req.text();if(raw.length>6000)return reply(413,{ok:false});const data=JSON.parse(raw);
 const pub=Deno.env.get("CL360_VAPID_PUBLIC_KEY"),pk=Deno.env.get("CL360_VAPID_PRIVATE_KEY");
 if(!pub||!pk)return reply(503,{ok:false,error:"vapid_missing"});
 if(data.action==="config")return reply(200,{ok:true,publicKey:pub});
 const endpoint=data.subscription?.endpoint??data.endpoint;
 if(typeof endpoint!=="string"||endpoint.length>2048)return reply(400,{ok:false});
 const parsed=new URL(endpoint);
 const host=parsed.hostname;
 if(parsed.protocol!=="https:"||parsed.username||parsed.password||parsed.port||parsed.hash||!(["fcm.googleapis.com","updates.push.services.mozilla.com","web.push.apple.com","wns2-par02p.notify.windows.com"].includes(host)||host.endsWith(".notify.windows.com")))return reply(400,{ok:false,error:"unsupported_push_endpoint"});
 const table=url+"/rest/v1/cl360_push_subscriptions";
 const owned=table+"?workspace_id=eq."+ws+"&user_id=eq."+user.id+"&endpoint=eq."+encodeURIComponent(endpoint);
 if(data.action==="disable"){const r=await fetch(owned,{method:"DELETE",headers:priv});return reply(r.ok?200:503,{ok:r.ok});}
 if(data.action==="register"){
 const k=data.subscription?.keys;
 if(!/^[A-Za-z0-9_-]{87}$/.test(k?.p256dh||"")||!/^[A-Za-z0-9_-]{22}$/.test(k?.auth||""))return reply(400,{ok:false,error:"invalid_keys"});
 const existing=await fetch(owned+"&select=id",{headers:priv});if(!existing.ok)return reply(503,{ok:false});
 const rows=await existing.json();
 const body={p256dh:k.p256dh,auth_key:k.auth,enabled:true,updated_at:new Date().toISOString()};
 const r=await fetch(rows.length?owned:table,{method:rows.length?"PATCH":"POST",headers:priv,body:JSON.stringify(rows.length?body:{...body,workspace_id:ws,user_id:user.id,endpoint})});
 return reply(r.ok?200:409,{ok:r.ok,error:r.ok?undefined:"registration_failed"});
 }
 if(data.action==="test"){
 const r=await fetch(owned+"&enabled=eq.true&select=id,endpoint,p256dh,auth_key,updated_at",{headers:priv});if(!r.ok)return reply(503,{ok:false});const row=(await r.json())[0];if(!row)return reply(404,{ok:false,error:"device_not_registered"});
 const last=Date.parse(row.updated_at);if(Date.now()-last<10000)return reply(429,{ok:false,error:"retry_after_10_seconds"});
 const claim=await fetch(owned+"&updated_at=eq."+encodeURIComponent(row.updated_at),{method:"PATCH",headers:{...priv,Prefer:"return=representation"},body:JSON.stringify({updated_at:new Date().toISOString()})});if(!claim.ok||!(await claim.json()).length)return reply(429,{ok:false});
 try{await webpush.sendNotification({endpoint:row.endpoint,keys:{p256dh:row.p256dh,auth:row.auth_key}},JSON.stringify({type:"test"}),{vapidDetails:{subject:"https://rujumagil.github.io/Conexionlaboral360/",publicKey:pub,privateKey:pk},TTL:120,timeout:10000});return reply(200,{ok:true,accepted:true});}catch(e:any){if([404,410].includes(e?.statusCode))await fetch(owned,{method:"DELETE",headers:priv});return reply(502,{ok:false,error:"push_provider_"+(Number(e?.statusCode)||0)});}
 }
 return reply(400,{ok:false});
 }catch{return reply(503,{ok:false,error:"push_unavailable"});}
});
