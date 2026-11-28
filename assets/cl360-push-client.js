/* Web Push registration: user gesture, per-device opt-in, authenticated endpoint. */
(function(root){
"use strict";
function decode(key){const s=key.replace(/-/g,"+").replace(/_/g,"/");return Uint8Array.from(atob(s+"=".repeat((4-s.length%4)%4)),x=>x.charCodeAt(0));}
async function marker(actor){
 if(!root.crypto?.subtle)return null;
 const hash=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(actor));
 return "cl360-push-active:"+Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,"0")).join("");
}
async function mark(actor,enabled){try{const k=await marker(actor);if(k){if(enabled)localStorage.setItem(k,"1");else localStorage.removeItem(k);}}catch{}}
function setup({db,url,key,scope,getActor,onStatus}){
 let busy=false;
 const endpoint=url+"/functions/v1/cl360-push";
 async function request(body,actor){
  const {data:{session},error}=await db.auth.getSession();
  if(error||!session||session.user.id!==actor||getActor()!==actor)throw Error("session_required");
  const res=await fetch(endpoint,{method:"POST",headers:{apikey:key,Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify(body),cache:"no-store"});
  const result=await res.json().catch(()=>null);
  if(!res.ok||!result?.ok)throw Error(result?.error||(res.status===401?"session_required":res.status===403?"push_forbidden":"push_http_"+res.status));
  return result;
 }
 async function registration(){
  if(!root.isSecureContext||!root.Notification||!root.PushManager||!navigator.serviceWorker)throw Error("unsupported");
  let reg=await navigator.serviceWorker.getRegistration(scope);
  if(!reg||reg.scope!==scope)reg=await navigator.serviceWorker.register(new URL("sw.js",scope).href,{scope});
  if(!reg.active){
   const worker=reg.installing||reg.waiting;
   if(worker)await new Promise(resolve=>{let timer;const done=()=>{clearTimeout(timer);worker.removeEventListener("statechange",check);resolve();};const check=()=>{if(["activated","redundant"].includes(worker.state))done();};timer=setTimeout(done,8000);worker.addEventListener("statechange",check);check();});
   reg=await navigator.serviceWorker.getRegistration(scope);
  }
  if(!reg?.active||!reg.pushManager||reg.scope!==scope)throw Error("worker_not_ready");
  return reg;
 }
 async function perform(action){
  if(busy)return;const actor=getActor();if(!actor)return;
  busy=true;
  onStatus(action==="enable"?"Registrando dispositivo…":action==="test"?"Enviando prueba…":"Desactivando push…");
  try{
   if(action==="enable"){
    // Request permission before asynchronous work to preserve the click gesture on iOS.
    if(!root.Notification||!root.PushManager)throw Error("unsupported");
    const permission=await Notification.requestPermission();
    if(permission!=="granted")throw Error("permission_denied");
    const config=await request({action:"config"},actor);
    const reg=await registration();
    let sub=await reg.pushManager.getSubscription(),created=false;
    if(!sub){sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decode(config.publicKey)});created=true;}
    try{await request({action:"register",subscription:sub.toJSON()},actor);}
    catch(e){if(created)await sub.unsubscribe().catch(()=>{});throw e;}
    await mark(actor,true);
    onStatus("Dispositivo registrado para avisos push. Usa Enviar prueba para verificar la recepción.");
   }else{
    const reg=await registration(),sub=await reg.pushManager.getSubscription();
    if(!sub)throw Error("device_not_registered");
    if(action==="test"){await request({action:"test",endpoint:sub.endpoint},actor);await mark(actor,true);onStatus("El proveedor aceptó el aviso de prueba. Comprueba si aparece en este dispositivo.");}
    else if(action==="disable"){await request({action:"disable",endpoint:sub.endpoint},actor);await mark(actor,false);await sub.unsubscribe();onStatus("Notificaciones push desactivadas en este dispositivo.");}
   }
  }catch(e){
   const labels={unsupported:"El navegador no admite Web Push. En iPhone instala primero la app en la pantalla de inicio.",worker_not_ready:"Abre o actualiza la aplicación instalada y vuelve a intentar.",permission_denied:"Permiso no concedido; revisa los ajustes de notificaciones.",vapid_missing:"El servidor aún no tiene configuradas las claves push.",vapid_format:"La clave push del servidor tiene un formato inválido. Revisa la configuración VAPID.",vapid_pair_mismatch:"Las claves pública y privada del servidor no pertenecen al mismo par.",device_not_registered:"Primero activa las notificaciones push.",retry_after_10_seconds:"Espera 10 segundos desde la activación antes de probar.",registration_failed:"No se pudo registrar el dispositivo. Si está asociado a otra cuenta, desactívalo con esa cuenta.",session_required:"Inicia sesión para gestionar este dispositivo.",push_forbidden:"El servidor no autorizó este usuario u origen. Confirma que usas el acceso oficial y tu cuenta de reclutamiento."};
   onStatus(labels[e.message]||"No se pudo completar la operación push ("+(e.message.startsWith("push_http_")?e.message:e.name||"error") +"). Revisa la conexión e inténtalo nuevamente.");
  }finally{busy=false;}
 }
 return {perform};
}
root.CL360Push={setup};
})(window);
