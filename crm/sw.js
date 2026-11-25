// Service worker CRM. Por privacidad no almacena HTML autenticado, respuestas de API ni expedientes.
const CACHE_SCOPE="cl360-crm-v1";
self.addEventListener("install",event=>{self.skipWaiting();});
self.addEventListener("activate",event=>{event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith("cl360-crm-"))await caches.delete(name);await self.clients.claim();})());});
self.addEventListener("fetch",event=>{
 const req=event.request;
 if(req.method!=="GET"||new URL(req.url).origin!==self.location.origin)return;
 // Todas las páginas y recursos se solicitan a la red, sin caché persistente de candidatos.
 event.respondWith(fetch(req));
});

self.addEventListener("notificationclick",event=>{event.notification.close();const view=event.notification.data?.cl360View;if(!["conversaciones","candidatos","seguimientos"].includes(view))return;event.waitUntil((async()=>{const destination=new URL(view+"/",self.registration.scope).href;const clients=await self.clients.matchAll({type:"window",includeUncontrolled:true});const existing=clients.find(c=>c.url.startsWith(self.registration.scope));if(existing){await existing.navigate(destination);await existing.focus();}else await self.clients.openWindow(destination);})());});

self.addEventListener("push",event=>{
 let payload;try{payload=event.data?.json();}catch{return;}
 const types={candidate:{body:"Hay una nueva postulación. Revisa el CRM.",view:"candidatos"},waiting:{body:"Una conversación requiere atención. Revisa el CRM.",view:"conversaciones"},overdue:{body:"Hay seguimientos pendientes. Revisa el CRM.",view:"seguimientos"},test:{body:"Notificación de prueba de Conexión Laboral 360.",view:"inicio"}};
 const type=payload?.type;if(!Object.prototype.hasOwnProperty.call(types,type))return;
 const item=types[type];
 event.waitUntil(self.registration.showNotification("Conexión Laboral 360",{body:item.body,tag:"cl360-push-"+type,data:{cl360View:item.view==="inicio"?"seguimientos":item.view}}));
});
