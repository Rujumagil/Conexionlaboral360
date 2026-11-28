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
