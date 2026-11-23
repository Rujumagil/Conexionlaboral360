# Conexión Laboral 360

Sitio web de oportunidades laborales y CRM privado de reclutamiento. Hoy se publican cinco vacantes de seguridad, pero el catálogo admite **otras áreas** sin reconstruir la página.

## Páginas

- Landing: https://rujumagil.github.io/Conexionlaboral360/
- CRM del equipo: https://rujumagil.github.io/Conexionlaboral360/crm/
- Información sobre tratamiento de datos: https://rujumagil.github.io/Conexionlaboral360/aviso-candidatos.html

## Funcionalidades

- Catálogo público de vacantes activas en Supabase, sin sueldos.
- Formulario con consentimiento que registra candidatos mediante Edge Function `cl360-apply`; tras guardar, abre WhatsApp con un mensaje preparado.
- CRM para equipo autorizado: tabla de candidatos, filtros, etapas, notas, agenda e historial; alta y pausa de vacantes sin sueldo.
- Resguardo de datos de candidatos con autenticación y RLS por workspace de Conexión Laboral 360.
- Compás Fly: perfil **Fly Recruiter** creado y desactivado en modo observador. Integración real de conversaciones/filtrado/seguimiento **pendiente**: https://github.com/Rujumagil/compas-evolution/issues/305

## Pendientes críticos

- Validar un registro extremo a extremo en navegador real y revisar que funcione el inicio de sesión de todos los reclutadores.
- Completar y aprobar el aviso de privacidad legal; el actual es preliminar.
- Configurar CAPTCHA/Turnstile, alertas y política de conservación antes de campañas a escala.
- Conectar canal de WhatsApp oficial para registro automático de conversaciones externas (los chats directos hoy no se sincronizan).
- Añadir `assets/flyer-reclutamiento.webp` si se desea mostrar el flyer fotográfico (actualmente existe una versión de respaldo en HTML).
- Integrar Fly Connect/API con permisos mínimos y confirmar funcionalidades antes de habilitar el agente.

## Desarrollo

La web se sirve desde `main` mediante GitHub Pages. El código de la función de recepción está en `supabase/functions/cl360-apply/index.ts`. Para límites y contrato, consulta `docs/CRM-FLY-RECLUTAMIENTO.md`. Nunca subir claves privadas al repositorio.
