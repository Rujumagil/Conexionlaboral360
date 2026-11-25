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
