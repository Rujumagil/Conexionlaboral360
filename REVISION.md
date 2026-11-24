# Estado de la landing y CRM — 23 de noviembre de 2026

**Frontend:** GitHub Pages conectado a `main`, con despliegues verificados mediante GitHub Actions.

**CRM:** disponible en la ruta `/crm/`, protegido con Supabase Auth y RLS. Acceso inicial habilitado al administrador de Compás Evolution y a la cuenta activa de la Lic. Astrid Araiza (rol manager). El acceso exige contraseña correcta en Supabase Auth.

**Vacantes:** cinco servicios de seguridad actualmente activos; catálogo de más áreas administrable desde el CRM; sueldos excluidos.

**Postulaciones:** Edge Function `cl360-apply` desplegada como ACTIVE. Registros protegidos en `cl360_candidates` con evento y seguimiento. Falta verificar extremo a extremo con un candidato real de prueba consentida; no se garantiza disponibilidad hasta esa prueba.

**Agente:** endpoint de conversación contextual `cl360-fly-chat` desplegado como ACTIVE; integrado en la interfaz `/asistente/` y en el CRM. Prueba HTTP 200 del servicio superada. Falta `GEMINI_API_KEY` en Supabase: la conversación generativa no se encuentra activa. Perfil `enabled=false`, `operating_mode=supervised`. La atención guiada sigue funcionando como respaldo. No se han habilitado decisiones automatizadas ni envíos de WhatsApp.

**Bloqueantes de operación completa:** validar aviso de privacidad y política de conservación; mejorar protección antispam; configurar Gemini y verificar Fly, así como conectar mensajería oficial; completar flyer fotográfico sin logo si se quiere usar.

Ver `docs/CRM-FLY-RECLUTAMIENTO.md`.
