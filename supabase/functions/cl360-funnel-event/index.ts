import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
const origin="https://rujumagil.github.io";
const headers={"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Headers":"apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
const reply=(status:number,ok:boolean)=>new Response(JSON.stringify({ok}),{status,headers});
const ws="c7ab2a78-08e0-4a29-8a3b-fadaf244002f";
Deno.serve(async req=>{
 if(req.headers.get("origin")!==origin)return reply(403,false);
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(req.method!=="POST")return reply(405,false);
 try{
 const body=await req.text();
 if(body.length>512)return reply(413,false);
 const data=JSON.parse(body);
 if(!data||data.consent!==true||!["landing_view","cta_click","chat_start"].includes(data.event)||!["guardias_seguridad","unattributed"].includes(data.campaign)||typeof data.visitId!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.visitId))return reply(400,false);
 const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
 const quota=await db.rpc("cl360_funnel_take_quota");
 if(quota.error)return reply(503,false);
 if(quota.data!==true)return reply(429,false);
 const {error}=await db.from("cl360_funnel_events").insert({workspace_id:ws,visit_id:data.visitId,event_type:data.event,campaign:data.campaign});
 if(error&&error.code!=="23505")return reply(503,false);
 return reply(200,true);
 }catch{return reply(400,false)}
});