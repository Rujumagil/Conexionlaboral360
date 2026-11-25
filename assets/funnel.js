(()=> {
 const key="cl360-funnel-visit-v1";
 const q=new URLSearchParams(location.search);
 const landing=location.pathname.includes("/vacantes/guardias-de-seguridad/");
 if(!landing&&q.get("campana")!=="guardias-de-seguridad")return;
 const campaign=q.get("utm_source")==="meta"&&q.get("utm_medium")==="paid_social"&&q.get("utm_campaign")==="guardias_seguridad"?"guardias_seguridad":"unattributed";
 let state=null;
 try{state=JSON.parse(sessionStorage.getItem(key)||"null");}catch{}
 if(!state||state.campaign!==campaign||Date.now()-state.at>30*60*1000)state=null;
 const save=()=>{try{sessionStorage.setItem(key,JSON.stringify(state))}catch{}};
 const sent=new Set();
 function send(event){
  if(state?.consent!==true||sent.has(event))return;
  sent.add(event);
  fetch("https://qwxydjotwhniahaovrff.supabase.co/functions/v1/cl360-funnel-event",{method:"POST",headers:{"content-type":"application/json",apikey:"sb_publishable_17NekbDHp_ssL_Pf-CnqPg_v0acxqn3"},body:JSON.stringify({consent:true,event,campaign,visitId:state.id}),keepalive:true}).then(r=>{if(!r.ok)sent.delete(event)}).catch(()=>sent.delete(event));
 }
 function refresh(){try{const v=JSON.parse(sessionStorage.getItem(key)||"null");if(v?.campaign===campaign&&Date.now()-v.at<=30*60*1000)state=v;}catch{}}
 if(landing){
 const box=document.createElement("aside");box.style.cssText="max-width:920px;margin:16px auto;padding:16px;border:1px solid #dfe8f0;border-radius:12px;background:white;color:#092645";
 const p=document.createElement("p");p.textContent="Medición opcional: podemos contar tu visita, clic e inicio de chat mediante un identificador aleatorio durante esta visita. No guardamos tus mensajes ni datos de contacto para esta medición. Conservamos los eventos 90 días. Puedes postularte sin aceptar.";
 const yes=document.createElement("button"),no=document.createElement("button");yes.type=no.type="button";yes.textContent="Aceptar medición";no.textContent="Continuar sin medición";for(const b of [yes,no])b.style.cssText="margin:4px;padding:9px 12px;border:1px solid #092645;border-radius:8px;background:white;color:#092645;cursor:pointer";
 function choose(consent){state={consent,campaign,id:consent?crypto.randomUUID():null,at:Date.now()};save();sent.clear();box.hidden=true;if(consent)send("landing_view");}
 yes.onclick=()=>choose(true);no.onclick=()=>choose(false);box.append(p,yes,no);document.querySelector(".hero")?.after(box);
 if(state){box.hidden=true;send("landing_view");}
 const change=document.createElement("button");change.type="button";change.textContent="Preferencias de medición";change.style.cssText="background:none;color:inherit;border:0;text-decoration:underline;cursor:pointer";change.onclick=()=>{box.hidden=false;box.scrollIntoView({block:"center"});};document.querySelector(".footer-inner")?.append(change);
 document.addEventListener("click",e=>{const a=e.target.closest?.("a[href]");if(a&&(a.getAttribute("href")==="#andy"||a.href.includes("/asistente/")))send("cta_click");},true);
 }else{
 window.addEventListener("storage",refresh);
 document.addEventListener("click",e=>{if(e.isTrusted&&e.target.closest?.("#controls button,[data-faq]")){refresh();send("chat_start");}},true);
 document.addEventListener("submit",e=>{if(e.target.id==="question-form"&&document.getElementById("candidate-question")?.value.trim()){refresh();send("chat_start");}},true);
 }
})();