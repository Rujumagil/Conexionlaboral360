// Andy Executive: private, aggregate-only assistant. Disabled until quota and authorization are deployed.
Deno.serve(async (req: Request) => {
 const origin=req.headers.get("origin")||"";
 const allowed=["https://rujumagil.github.io","https://conexionlaboral360.app","https://conexionlaboral360.proyectocompas-info.workers.dev"];
 const cors={"access-control-allow-origin":allowed.includes(origin)?origin:allowed[0],"access-control-allow-methods":"POST,OPTIONS","access-control-allow-headers":"authorization,apikey,content-type,x-client-info","vary":"Origin","cache-control":"no-store"};
 const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{...cors,"content-type":"application/json"}});
 if(!allowed.includes(origin))return reply(403,{ok:false});
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="POST")return reply(405,{ok:false});
 const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_ANON_KEY"),secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 const auth=req.headers.get("authorization")||"";
 if(!url||!key||!secret||!auth.startsWith("Bearer "))return reply(401,{ok:false});
 const ws="c7ab2a78-08e0-4a29-8a3b-fadaf244002f";
 try{
 const headers={apikey:key,authorization:auth};
 const u=await fetch(url+"/auth/v1/user",{headers,signal:AbortSignal.timeout(6000)});
 if(!u.ok)return reply(401,{ok:false});
 const user=await u.json();
 if(user.is_anonymous||!/^[0-9a-f-]{36}$/i.test(user.id||""))return reply(403,{ok:false});
 const m=await fetch(url+"/rest/v1/workspace_members?select=role,status&workspace_id=eq."+ws+"&user_id=eq."+user.id+"&status=eq.active",{headers,signal:AbortSignal.timeout(6000)});
 if(!m.ok)return reply(403,{ok:false});
 const members=await m.json();
 if(!members.some((x:{role:string})=>["owner","admin","manager"].includes(x.role)))return reply(403,{ok:false});
 // Fail closed until the server-side quota RPC and explicit provider activation are available.
 return reply(503,{ok:false,error:"executive_pending_activation"});
 }catch{return reply(503,{ok:false,error:"executive_unavailable"});}
});
