# CRM de Reclutamiento · Conexión Laboral 360

**Estado a 23/nov/2026:** infraestructura y primera interfaz desarrolladas en `main`, con GitHub Pages como frontend estático; integración real con Fly aún pendiente de conectar y probar. No se ha validado una postulación real de extremo a extremo.

## Enlaces

- Sitio: https://rujumagil.github.io/Conexionlaboral360/
- CRM privado: https://rujumagil.github.io/Conexionlaboral360/crm/
- Integración Fly: https://github.com/Rujumagil/compas-evolution/issues/305

## Arquitectura real

- Frontend web estático: GitHub Pages, sin credenciales secretas en frontend.
- Base de datos compartida: Supabase `compas-one`, con **workspace propio**: `c7ab2a78-08e0-4a29-8a3b-fadaf244002f`.
- `cl360_jobs`: catálogo de vacantes de múltiples áreas; se publican solo entradas con `status=active`; **no se almacena ni publica sueldo**.
- `cl360_candidates`: expedientes de postulantes; privados por tenant. Formulario captura nombre, teléfono, vacante y experiencia con consentimiento.
- `cl360_events`: historial de registro, notas y acciones.
- `cl360_followups`: agenda de seguimiento.
- `cl360_submission_limits`: control básico de abuso; no existe política pública de lectura.
- Edge Function `cl360-apply`: única ruta de escritura pública, con validación server-side, control de origen, honeypot y límite aproximado por IP. La clave de servicio permanece en variables del servidor. El RPC `cl360_submit_application` no es ejecutable por roles anónimos.
- `cl360_set_stage`: RPC de cambios de estado en transacción con nota de auditoría y permisos de usuario.

## Reglas de acceso
- Login por Supabase Auth. Solo miembros activos del workspace con rol `owner`, `admin`, `manager`, `sales` o `support` pueden consultar candidatos.
- Alta, publicación o pausa de vacantes: `owner`, `admin`, `manager`.
- Se importó al nuevo workspace la membresía de la cuenta administradora existente de Compás Evolution; los otros reclutadores deben agregarse como miembros autorizados tras validar sus cuentas.
- RLS y restricciones de SQL aíslan expedientes frente a visitantes y otros workspaces. **No** otorgar permiso del panel de Compás Evolution a los reclutadores por este CRM.

## Flujo de candidatos

1. La landing consulta vacantes activas desde `cl360_jobs` (solo datos públicos).
2. La persona completa el formulario y autoriza el tratamiento.
3. Edge valida y llama al RPC transaccional; si no hay éxito, la web **no afirma** que se guardó la postulación.
4. El candidato aparece en el CRM como `new`; puede continuarse la conversación por WhatsApp.
5. Asesora registra notas, cambia etapa, agenda una tarea y decide el resultado.
6. Ingresos directos por WhatsApp/Facebook sin formulario **no se capturan automáticamente** hasta conectar proveedores oficiales o crear una función de captura manual.

## Etapas

`new` → `contacted` → `screening` → `interview` → `qualified` → `hired`. También `rejected` o `archived` por decisión humana. No hay rechazo por IA.

## Compás Fly

Perfil `Fly Recruiter · Conexión Laboral 360` creado en `ai_agent_profiles`, **habilitado=false**, modo `observer`, herramientas de escritura vacías y sin presupuesto asignado. El funcionamiento de Fly todavía **no está conectado** a estas tablas. El adaptador debe verificar autorización y eventos, clasificar por factores objetivos, generar propuestas auditadas, programar seguimientos supervisados y escalar a humanos. Ninguna mensajería autónoma está habilitada.

## Seguridad y límites conocidos

- Se verificó por SQL que `anon` no tiene privilegio SELECT en candidatos ni EXECUTE en RPC de captura y que un usuario autenticado no miembro no ve vacantes internas. El despliegue de Edge Function consta como ACTIVE.
- Falta una prueba de postulación de extremo a extremo con una persona de pruebas consentida. Evitar simular candidatos reales en producción.
- La protección antispam del MVP no reemplaza CAPTCHA/Turnstile, monitoreo, alertas ni controles antifraude de producción.
- Falta aviso de privacidad legal definitivo (razón social/domicilio responsable, conservación, transferencias, ejercicio de derechos); `aviso-candidatos.html` es preliminar y debe validarse antes de una campaña de captación.
- La publicación de la web depende del estado del workflow GitHub Pages; comprobar carga de JS y acciones desde navegador real.
- El logotipo sigue disponible en encabezado/pie. El flyer fotográfico en `assets/flyer-reclutamiento.webp` aún debe cargarse si se desea mostrar la versión con fotografías.
- El CRM limita la vista a 500 candidatos en esta primera entrega; desarrollar paginación antes de grandes volúmenes.
- Evaluar política de retención y borrado de postulantes y limpieza programada de registros de frecuencia.

## Alcance no implementado

Conector operativo Fly, autoseguimiento de mensajes reales, sincronización oficial WhatsApp/Messenger, importación automática de conversaciones externas, notificaciones push de seguimiento, reportes PDF y filtro avanzado de CV. No anunciar estas funciones como disponibles.


## Nuevo recorrido: preentrevista antes de WhatsApp (23/nov/2026)

**Ruta pública:** `/asistente/`. Los botones principales de la landing apuntan a este recorrido, conservando el contacto humano para consultas de accesibilidad y privacidad.

1. La persona elige una vacante **activa** desde el catálogo del workspace.
2. El asistente guiado informa área, ubicación, turno y respuestas frecuentes; no publica montos ni inventa condiciones.
3. Pregunta por experiencia previa, descripción libre de experiencia, disponibilidad para el turno y zona preferida. Una respuesta negativa **no elimina ni bloquea** la postulación.
4. Solicita nombre, teléfono y autorización de tratamiento. Antes de enviarla muestra un resumen para revisión.
5. La Edge Function `cl360-apply` valida el cuestionario y llama al RPC privado `cl360_submit_screened_application`. Registra las respuestas en `cl360_candidates.screening_data`, junto con el texto de experiencia, sin puntajes ni decisiones automatizadas.
6. **Solo tras la confirmación de guardado**, muestra el enlace de WhatsApp para la Lic. Astrid Araiza. No se envía ningún mensaje automáticamente.
7. El CRM muestra los datos declarados y deja las decisiones sobre contacto, entrevista y contratación al equipo humano.

**Estado real:** la experiencia conversacional actual es **guiada y determinista**, no un modelo generativo de IA en funcionamiento. Compás Fly Recruiter sigue desactivado y pendiente de conexión verificada, conforme al issue [#305](https://github.com/Rujumagil/compas-evolution/issues/305). No se deben presentar sus respuestas como IA generativa hasta completar conexión, trazabilidad, control de costos, supervisión, pruebas de discriminación y consentimiento.

**Seguridad:** el RPC de registro con cuestionario no está disponible para `anon`; se ejecuta solo desde Edge con rol de servicio y sus credenciales no aparecen en GitHub Pages. La casilla de consentimiento es obligatoria. Falta una prueba completa de registro desde navegador usando datos de una persona que autorice expresamente el ensayo, y validar el aviso de privacidad definitivo antes de campañas masivas.

## Experiencia conversacional mejorada — 23/nov/2026

La ruta `/asistente/` ahora presenta una charla más natural: mensajes individuales, señal de escritura breve, respuestas en contexto según experiencia y disponibilidad, selección de vacantes por tarjetas, campo de preguntas libres dentro del chat y preguntas rápidas. Los textos son respetuosos y no excluyentes. La interfaz se identifica con claridad como **asistente virtual de reclutamiento**, sin atribuirse identidad humana.

El motor actual sigue siendo **guiado y determinista**: responde a preguntas comunes (sueldos, beneficios, turnos, ubicación, experiencia, privacidad y proceso) mediante reglas basadas en datos confirmados. Para preguntas fuera de cobertura, deriva la aclaración a la Lic. Astrid Araiza. No se afirma que exista una IA generativa conectada: Fly Recruiter sigue deshabilitado y su conexión real permanece pendiente en el issue #305.

Se conserva el requisito de consentimiento, la validación server-side del cuestionario, el guardado en el CRM y la entrega de WhatsApp **solo tras registrar la postulación**. No se toman decisiones automatizadas de rechazo ni contratación. La guía conversacional no equivale a una verificación de identidad, referencia o aptitud laboral.
