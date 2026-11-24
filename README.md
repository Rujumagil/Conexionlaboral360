# Conexión Laboral 360

Sitio web de oportunidades laborales y CRM privado de reclutamiento. Hoy se publican cinco vacantes de seguridad, pero el catálogo admite **otras áreas** sin reconstruir la página.

## Páginas

- Landing: https://rujumagil.github.io/Conexionlaboral360/
- Preentrevista guiada: https://rujumagil.github.io/Conexionlaboral360/asistente/
- CRM del equipo: https://rujumagil.github.io/Conexionlaboral360/crm/
- Información sobre tratamiento de datos: https://rujumagil.github.io/Conexionlaboral360/aviso-candidatos.html

## Funcionalidades

- Catálogo público de vacantes activas en Supabase, sin sueldos.
- Preentrevista conversacional **guiada**: consulta vacantes verificadas, pregunta por experiencia, turno y zona preferida; al concluir muestra consentimiento, guarda respuestas con la Edge Function `cl360-apply` y **solo tras confirmación** entrega el enlace al WhatsApp de la asesora.
- Las respuestas alimentan filtros informativos de disponibilidad en el CRM, sin rechazos automáticos ni puntuaciones de IA.
- CRM para equipo autorizado: tabla de candidatos, filtros, etapas, notas, agenda e historial; alta y pausa de vacantes sin sueldo.
- Resguardo de datos de candidatos con autenticación y RLS por workspace de Conexión Laboral 360.
- Compás Fly: perfil **Fly Recruiter** creado y desactivado en modo observador. La preentrevista implementada aún no usa IA generativa: su integración real de conversaciones libres/filtrado asistido/seguimiento **está pendiente**: https://github.com/Rujumagil/compas-evolution/issues/305

## Pendientes críticos

- Validar un registro extremo a extremo en navegador real y revisar que funcione el inicio de sesión de todos los reclutadores.
- Completar y aprobar el aviso de privacidad legal; el actual es preliminar.
- Configurar CAPTCHA/Turnstile, alertas y política de conservación antes de campañas a escala.
- Conectar canal de WhatsApp oficial para registro automático de conversaciones externas (los chats directos hoy no se sincronizan).
- Añadir `assets/flyer-reclutamiento.webp` si se desea mostrar el flyer fotográfico (actualmente existe una versión de respaldo en HTML).
- Integrar Fly Connect/API con permisos mínimos y confirmar funcionalidades antes de habilitar el agente.

## Desarrollo

La web se sirve desde `main` mediante GitHub Pages. El código de la función de recepción está en `supabase/functions/cl360-apply/index.ts`. Para límites y contrato, consulta `docs/CRM-FLY-RECLUTAMIENTO.md`. Nunca subir claves privadas al repositorio.
