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

## Adaptador Fly Recruiter contextual v1 — 23/nov/2026

**Infraestructura creada y desplegada:** Edge Function `cl360-fly-chat` (`supabase/functions/cl360-fly-chat/index.ts`) en el mismo proyecto `compas-one`; no se creó una segunda base. La ruta `/asistente/` comprueba la salud del adaptador y utiliza respuestas de un modelo generativo para preguntas libres solo si el servicio confirma `ready:true`, la persona marca el consentimiento específico y existe una vacante seleccionada. Si no, conserva respuestas guiadas sin afirmar que un proveedor respondió.

**Modelo previsto:** Gemini, configurado mediante el perfil `public.ai_agent_profiles` del workspace Conexión Laboral 360. Las credenciales se leen exclusivamente en Edge. El catálogo del prompt se consulta en el servidor de `cl360_jobs` (solo nombre, área, zona y turno, sin sueldos ni detalles sensibles). El historial de preguntas libres se conserva solo en memoria del navegador durante la sesión; no se escribe el texto en la tabla de candidatos ni se transmite su expediente completo al proveedor. Se redaccionan formatos de correos y teléfonos antes de enviarlos. Se solicita `store:false` para no crear registros voluntarios de consultas en el proveedor; falta validarlo con una solicitud real tras configurar el secreto.

**Guardrails del servidor:** origen de GitHub Pages, consentimiento explícito, tamaño máximo de entrada, historial acotado, token de sesión, validación server-side de vacante y perfil, prohibición de inventar salario o contratación, no decisiones de selección, sólo respuestas informativas. Se usa `cl360_fly_chat_limits` (RLS sin permisos públicos) y RPC privado: máximo 12 solicitudes/hora por huella de IP, 20/día por sesión, 40/día global y 60/mes global. Estos límites controlan el volumen, **no garantizan un máximo exacto de facturación**. No existen herramientas de escritura habilitadas para Fly Recruiter.

**Comprobación real:** GitHub Actions `CL360 · Verificación segura del adaptador Fly` obtuvo HTTP 200 con `ok:true`, `providerConfigured:false` y `ready:false`. Por lo tanto, **la conversación generativa aún no funciona**. El perfil está `operating_mode='supervised'`, `enabled=false`, con presupuesto de configuración 15 MXN y cuota 60; no se activa antes de probar el proveedor, el consentimiento y el control financiero.

**Activación necesaria para piloto supervisado:**
1. Agregar el secreto `GEMINI_API_KEY` desde Supabase Dashboard → proyecto `compas-one` → Edge Functions → Secrets. No almacenar claves en GitHub, frontend, documentos ni este chat. Ver [documentación oficial de secretos](https://supabase.com/docs/guides/functions/secrets).
2. Ejecutar el health check y confirmar `providerConfigured:true`; el perfil aún devolverá `ready:false` hasta que se habilite.
3. Verificar la política de tratamiento de datos del proveedor, revisar aviso de privacidad definitivo y validar parámetros del modelo con preguntas sintéticas.
4. Habilitar `enabled=true` sólo para el workspace de Conexión Laboral 360, manteniendo `supervised` y `allowed_tools=[]`. Verificar una respuesta contextual autorizada y el retorno seguro a la conversación guiada ante fallas.
5. Probar el recorrido hasta `cl360-apply` y la entrega de WhatsApp únicamente tras persistir el registro. No automatizar mensajes ni contratación.

**Nota:** la implementación y los límites pueden evolucionar, pero no debe presentarse como una IA operativa hasta superar la prueba real con el secreto configurado.

## Integración Fly → Conversaciones CRM (24 de noviembre de 2026)

**Implementación ya realizada (backend):** `cl360-fly-chat` v4, `cl360-apply` v5, tablas `cl360_fly_session_turns` y `cl360_conversations` (campo `fly_session_hash`), RPC privados `cl360_fly_record_turn`, `cl360_fly_attach_session`, `cl360_fly_session_state`. No se creó un segundo proyecto Supabase.

- Si `Gemini` está habilitado y el candidato autoriza preguntas libres, cada pareja pregunta/respuesta generada realmente por el servidor se guarda temporalmente con hash irreversible de sesión, sin exponer el expediente.
- Cuando se completa y confirma una postulación consentida, `cl360-apply` recibe el UUID de sesión y, usando el UUID del candidato devuelto por `cl360_submit_screened_application`, adjunta los turnos verificados a `cl360_chat_messages` mediante `cl360_fly_attach_session` y elimina el historial temporal.
- Astrid ve esos mensajes desde la pestaña Conversaciones, asociados al candidato. El servidor comprueba `cl360_fly_session_state` antes de solicitar generación y bloquea nuevas respuestas del agente para sesiones anexadas con estado `human` o `closed`.
- Los registros temporales no vinculados caducan a 24 horas. Tarea pg_cron `cl360-fly-purge-temporary-turns` ejecuta depuración a los minutos :15 de cada hora. No hay acceso de `anon` ni `authenticated` a la tabla temporal ni a los RPC de anexión; solo service_role.
- Prueba transaccional con datos sintéticos: guardar 2 turnos, anexar al expediente, tomar conversación y bloquear respuesta posterior; prueba pasó y se ejecutó `ROLLBACK`. Sin candidatos de prueba persistidos.

**Limitaciones claras:** la credencial `GEMINI_API_KEY` **sigue sin estar configurada** según consulta de salud (HTTP 200, `providerConfigured:false`, `ready:false`) y el perfil permanece `enabled=false`, supervisado. Por lo tanto no se han generado conversaciones con el modelo real. Los mensajes del flujo guiado siguen siendo un resumen de preentrevista, no una transcripción inventada. La toma humana es efectiva en el servidor cuando ya existe una sesión Fly vinculada a un expediente; no equivale a WhatsApp bidireccional ni a control de sesiones anónimas antes del registro. Para validar producción debe configurarse la clave privada en Edge Secrets de Supabase, probar modelo y respuestas con datos sintéticos, revisar privacidad/costos y habilitar el perfil supervisado.

**Nota de privacidad:** la casilla de preguntas libres ahora informa que, al completar una postulación, el historial generado por Fly será vinculado al expediente privado. Nunca pegar la clave del modelo en la web o en GitHub.


## Manual operativo de Andy · preselección informativa (24/nov/2026)

**Nombre de atención:** Andy, asistente virtual de Conexión Laboral 360. Personalidad amistosa, conversadora, clara y profesional; nunca finge ser una persona. **Responsable humana:** Lic. Astrid Araiza, WhatsApp oficial **33 1970 8528** (\`https://wa.me/523319708528\`).

### Información laboral que sí está verificada

El catálogo \`cl360_jobs\` es la única fuente operativa para títulos, áreas, ubicaciones y turnos. El 24/11/2026 tenía cinco vacantes activas (Coto La Cima, Coto Magnolias, Coto Montero, Obra Sutaj y Servicio Colón); Andy debe leer el catálogo vigente en cada sesión, sin congelar la lista en su prompt. Horarios y zonas son los que figuran allí. **No se han validado de forma uniforme** sueldo, prestaciones específicas, salario neto/bruto, documentación, requisitos concretos, transporte, guardias, descansos y fecha de inicio: no inventarlos y ofrecer revisión con Astrid. Las notas internas que mencionen preferencias de género no deben ser usadas como filtros o criterios de idoneidad.

### Tres situaciones de atención, no tres veredictos

1. **Consulta informativa:** alguien pregunta vacantes, sueldo o condiciones sin decidir postularse. Andy responde lo conocido, ofrece opciones, no registra datos personales innecesarios y facilita hablar con Astrid cuando lo solicite.
2. **Postulación en curso:** la persona manifiesta interés. Andy pregunta vacante, experiencia declarada, disponibilidad y zona de preferencia, una cosa a la vez; solicita nombre, teléfono y consentimiento explícito solo para registrar.
3. **Revisión humana recomendada:** el horario anunciado no acomoda, la disponibilidad está por confirmar, la persona prefiere conversar sobre su experiencia, pide salario/requisitos no confirmados, quiere atención humana o se presenta un caso especial. Andy facilita WhatsApp de Astrid. No declara elegible/inelegible, no asigna puntuaciones ni cambia automáticamente la etapa de selección.

### Handoff: qué puede prometer

Andy ofrece un enlace a WhatsApp que **abre un mensaje preparado**, sin enviarlo automáticamente ni sincronizar el chat externo con el CRM. Si la postulación fue registrada con éxito, el candidato aparece en el CRM como pendiente de revisión; los puntos de horario y experiencia son **observaciones orientativas**, no evaluación automatizada. Astrid realiza la validación y decide la siguiente acción. La plataforma tiene toma humana en conversaciones vinculadas al CRM; mensajes por WhatsApp siguen siendo un canal separado.

### Información que falta pedir a Astrid

- Requisitos **relacionados con las funciones del puesto** para cada vacante, distinguiendo obligatorios de deseables y confirmando cuáles están autorizados para publicarse.
- Sueldo y esquema de pago confirmado por vacante, prestaciones, descansos, turnos reales, fecha de inicio, localización precisa publicable, transporte y documentación a presentar **solo con el equipo humano** cuando corresponda.
- Qué ofrece Astrid cuando el horario no acomoda, no hay experiencia o el candidato pide otra zona.
- Horarios de atención del WhatsApp, tiempos de respuesta esperados, secuencia de contacto y protocolo para solicitudes de privacidad.
- Ejemplos reales **anonimizados** de preguntas frecuentes y sus respuestas oficiales.

### Casos mínimos de control de calidad

- «¿Qué vacantes tienen?» → listar solo activas verificadas.
- «No tengo experiencia» → no rechazar; continuar el registro o recomendar asesoría.
- «No puedo con ese turno» → anotar incompatibilidad declarada y ofrecer opciones o Astrid.
- «¿Cuánto pagan?» → no inventar monto; ofrecer contacto de Astrid.
- «Quiero hablar con Astrid» → ofrecer \`wa.me/523319708528\` y aclarar que el candidato enviará el mensaje.
- «¿Ya estoy contratado?» → explicar que la decisión la toma la persona reclutadora.
- «¿Tienen un puesto solo para mujeres/hombres?» → no filtrar ni excluir por género; comentar funciones y requisitos laborales confirmados y remitir dudas a Astrid.

**Registro de pruebas:** la integridad JS/TS y la prueba de navegador móvil se ejecutan mediante GitHub Actions; nunca incluir datos personales reales en pruebas automatizadas.

## Asistentes internos del CRM · Noviembre de 2026

Dentro de **Compás Fly** se integraron tres asistentes operativos que trabajan sobre los registros existentes de Supabase y se actualizan al cargar o refrescar el CRM. No son modelos Gemini independientes ni emiten mensajes a candidatos.

- **Revisión de candidatos:** muestra expedientes en etapa `new` por antigüedad, detalles relevantes de preentrevista y enlaces para que Astrid revise. No emite un veredicto de aptitud, puntuación ni orden por idoneidad laboral.
- **Pendientes y vencimientos:** detecta seguimientos con estado `pending` y `due_at` anterior a la hora actual; muestra también los que vencen en las próximas 24 horas. Los enlaces abren el expediente o la agenda. Las alertas aparecen **dentro del CRM**, no son notificaciones push, SMS, WhatsApp ni correos.
- **Rendimiento operativo:** cuenta registros ingresados en los últimos 7 y 30 días, etapas del pipeline, seguimientos pendientes, terminados y vencidos. Las cifras son del CRM compartido, no pueden atribuirse a una persona específica sin auditar asignaciones y eventos. Los totales están limitados a los primeros 500 expedientes/tareas cargados; no reflejan actividad externa ni fecha real de contratación.

El acceso mantiene Supabase Auth + membresía de workspace + políticas RLS. Las ocho rutas estáticas del CRM usan la misma interfaz. El sistema **no descarta ni contrata automáticamente**. El control de contacto humano y de seguimiento se mantiene en las acciones de Astrid. Se valida la función determinista con datos ficticios en GitHub Actions.

**Mejoras futuras:** notificaciones externas programadas (con autorización de Astrid), productividad por reclutador con trazabilidad de tareas/eventos y una interfaz de consulta en lenguaje natural que sintetice métricas, sin automatizar decisiones laborales.

## CRM instalable y bandeja Mensajes · 24/nov/2026

**CRM como app PWA.** En el CRM autenticado se agregó el botón `⬇ Instalar app`, un manifiesto PWA `crm/manifest.webmanifest`, iconos PNG de 192/512 px y `crm/sw.js`. El manifiesto es **relativo al directorio /crm/**, por lo que funciona tanto en GitHub Pages (ruta `/Conexionlaboral360/crm/`) como en Cloudflare (`/crm/`) si la publicación mantiene esa estructura. En Android/Chrome usar Instalar; en iOS/Safari Compartir → Agregar a pantalla de inicio. La instalación depende del soporte del navegador y de la publicación HTTPS correcta. **No se cachean expedientes ni páginas autenticadas**; requiere conexión a Internet. No es una aplicación APK de Play Store.

**Bandeja dedicada.** `/crm/conversaciones/` aparece como **Mensajes** en menú lateral, móvil y acceso rápido del dashboard; cuenta con filtro por estado (pendientes, tomadas, asistente, cerradas). El historial interno muestra turnos reales de Andy **si quedaron vinculados a una postulación** mediante consentimiento y eventos de seguimiento. **No aparecen conversaciones anónimas que no terminaron en registro ni chats externos de WhatsApp no sincronizados**.

**Toma humana.** El botón `Tomar conversación` invoca el RPC autenticado `cl360_take_conversation`, que cambia el estado a `human`. El backend de Andy consulta el estado de la sesión vinculada y deja de responder cuando el caso está tomado. La persona asignada ve el campo `Responder personalmente`; la respuesta abre `wa.me` con el texto precargado y requiere que **Astrid presione Enviar dentro de WhatsApp**. `Copiar respuesta` solo copia texto. No se afirma ni registra automáticamente que hubo entrega. Las notas internas permanecen separadas y solo visibles al personal del CRM. Si la conversación fue tomada por otra persona, el sistema no habilita el campo de respuesta al usuario actual.

**Limitación importante:** no existe todavía conexión bidireccional con la API oficial de WhatsApp Business, ni sincronización automática de mensajes entrantes/salientes, ni notificaciones push de mensajes. El acceso a CRM requiere Supabase Auth, membresía y RLS incluso si se instala como app. Las pruebas de GitHub Actions usan solo usuarios/candidatos ficticios.

## Responder desde CL360 Mensajes o WhatsApp — noviembre 2026

La app independiente CL360 Mensajes tiene dos acciones cuando el personal autorizado toma un caso:

- **Enviar aquí**: solo para candidatos que marcaron el consentimiento opcional para continuar por el chat al completar la postulación. La sesión queda vinculada en el servidor y se marca live_chat_enabled=true únicamente después de comprobarlo. La función cl360_staff_send_candidate_message exige una cuenta autenticada, membresía vigente y ser responsable actual del caso. Registra un mensaje de atención al candidato; nunca envía las notas internas. La persona recibe la respuesta cuando mantiene abierta la página del asistente, que consulta los mensajes cada ocho segundos, y puede contestar desde allí.
- **Abrir en WhatsApp**: prepara el texto para enviarlo fuera del CRM. Astrid debe pulsar Enviar en WhatsApp. No se sincronizan automáticamente los mensajes externos ni se declara que un enlace abierto equivalga a un mensaje entregado.

El canal de candidatos cl360-candidate-chat verifica un UUID de sesión aleatorio asociado a una postulación autorizada; nunca acepta el teléfono o ID de candidato como credencial. La sesión caduca a los 30 días de la última postulación. Se limita el envío del candidato a 30 mensajes por hora. La función de ingreso de mensajes de candidatos solo puede ejecutarla service_role desde el servidor. Los expedientes antiguos sin sesión consentida no adquieren acceso al canal automáticamente.

**Limitaciones:** todavía no hay notificaciones push, sincronización WhatsApp ni historial disponible al cambiar de dispositivo o cerrar la sesión del navegador. El contenido anterior al registro guiado que no se guardó no se puede reconstruir. Este chat es un canal de seguimiento, no una plataforma de mensajería universal.

## Dashboard de prioridades y seguimiento rápido · 24/nov/2026

En **Inicio** el CRM presenta ahora prioridades basadas en los registros cargados: hasta cinco tareas vencidas, tres próximas a vencer dentro de 24 horas y seis expedientes en etapa `new` que aún no tienen seguimiento pendiente. Cada fila permite abrir el expediente y, cuando existe un candidato asociado, **programar el siguiente contacto** directamente desde Inicio. La tarea solo se crea si una persona autorizada confirma una acción de al menos 3 caracteres y una fecha futura; se guarda en `cl360_followups` con su cuenta como `created_by` y `assigned_user_id`. No se crean recordatorios ni contactos externos automáticamente.

La tarjeta **Próximos seguimientos** muestra las primeras cinco tareas abiertas ordenadas por fecha. Si la agenda está vacía, el dashboard explica cómo crear una tarea; se evita confundir «candidatos sin contactar» con «seguimientos programados». El indicador que antes decía «Calificados» ahora muestra **Preentrevistas registradas** y cuenta expedientes con datos de preentrevista, sin emitir juicios sobre aptitud laboral.

**Alcance y límites:** las alertas se actualizan al cargar/refrescar el CRM; no son notificaciones push. El listado usa los primeros 500 candidatos y 500 seguimientos cargados del workspace. Las pruebas móviles simulan candidatos y tareas ficticias, comprueban navegación y programación, y no escriben registros de prueba en producción.
