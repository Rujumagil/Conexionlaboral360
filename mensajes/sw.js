// Mensajes PWA: no se cachean expedientes, mensajes ni respuestas privadas.
self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",event=>event.waitUntil(self.clients.claim()));
self.addEventListener("fetch",event=>{
 if(event.request.method!=="GET")return;
 const url=new URL(event.request.url);
 if(url.origin!==self.location.origin)return;
 event.respondWith(fetch(event.request));
});

self.addEventListener("notificationclick",event=>{
 event.notification.close();
 if(event.notification.data?.cl360View!=="seguimientos")return;
 event.waitUntil((async()=>{
  const destination=new URL("../crm/seguimientos/",self.registration.scope);
  const clients=await self.clients.matchAll({type:"window",includeUncontrolled:true});
  const existing=clients.find(c=>c.url.startsWith(new URL("../crm/",self.registration.scope).href));
  if(existing){await existing.navigate(destination.href);await existing.focus();}
  else await self.clients.openWindow(destination.href);
 })());
});

self.addEventListener("push",event=>{
 let payload;try{payload=event.data?.json();}catch{return;}
 const types={candidate:{body:"Hay una nueva postulación. Revisa el CRM.",view:"candidatos"},waiting:{body:"Una conversación requiere atención. Revisa el CRM.",view:"conversaciones"},overdue:{body:"Hay seguimientos pendientes. Revisa el CRM.",view:"seguimientos"},test:{body:"Notificación de prueba de Conexión Laboral 360.",view:"inicio"}};
 const type=payload?.type;
 if(type==="operations"){
  const labels={calls:"Solicitudes de llamada",handoff:"Atención humana",review:"Expedientes por revisar",interviews:"Entrevistas próximas",overdue:"Seguimientos vencidos"};
  const counts=payload?.counts;
  const body=counts&&typeof counts==="object"?Object.entries(labels).filter(([k])=>Number.isInteger(counts[k])&&counts[k]>0&&counts[k]<=1000).map(([k,label])=>counts[k]+" · "+label).join(" | "):"";
  if(!body)return;
  event.waitUntil(self.registration.showNotification("Conexión Laboral 360",{body,tag:"cl360-operations",renotify:false,silent:false,data:{cl360View:"seguimientos"}}));return;
 }
 if(!Object.prototype.hasOwnProperty.call(types,type))return;
 const item=types[type];
 event.waitUntil(self.registration.showNotification("Conexión Laboral 360",{body:item.body,tag:"cl360-push-"+type,silent:false,data:{cl360View:"seguimientos"}}));
});
