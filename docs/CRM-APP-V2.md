# CRM Conexión Laboral 360 · App modular v2

Actualizado: 23 de noviembre de 2026.

## Acceso

- CRM: https://rujumagil.github.io/Conexionlaboral360/crm/
- Repositorio: https://github.com/Rujumagil/Conexionlaboral360
- Publicación: `main` mediante GitHub Pages.
- Identidad: Supabase Auth y membresías del workspace Conexión Laboral 360, sin acceso público a expedientes.

## Interfaz

- **Inicio:** métricas, vacantes activas, conversaciones pendientes y seguimientos.
- **Vacantes:** catálogo desde Supabase; creación de otras áreas en estado pausado, activación posterior; sin salarios publicados.
- **Candidatos:** listado, búsqueda, filtros, expediente, notas, preentrevista, seguimiento y WhatsApp.
- **Pipeline:** tablero kanban por etapa. Al abrir tarjeta se muestra el expediente y la persona autorizada puede actualizar la etapa.
- **Conversaciones:** bandeja por estado, mensajes **internos**, toma y devolución de casos, cierre/reapertura, acceso al expediente y botón de WhatsApp con mensaje contextual prellenado.
- **Seguimientos:** agenda y tareas vinculadas a candidatos.
- **Compás Fly:** estado real de la conexión; sin afirmaciones de que Gemini está activo cuando falta credencial.
- **Ajustes:** enlaces y acceso de cuenta.
- Diseño adaptable: menú lateral en escritorio, navegación inferior en móvil; en «Más» hay accesos a Seguimientos y Fly.

## Modelo de conversación

Se crearon `public.cl360_conversations` y `public.cl360_chat_messages`. Una postulación nueva crea el hilo con estado `waiting`; guarda un **resumen estructurado de la preentrevista** señalado explícitamente como tal, no una transcripción ficticia. Una persona puede tomar el caso mediante RPC `cl360_take_conversation`, con comprobación de membresía, límites de ownership y bitácora. La devolución deja el caso en bandeja de espera, **no activa Fly automáticamente**.

Las notas de la bandeja son internas: **no se envían al candidato**. El enlace de WhatsApp abre el cliente de mensajería y prepara un texto; enviar ese texto depende de la persona. **No se importan automáticamente respuestas de WhatsApp** ni conversaciones previas de la IA. Para ver transcripciones completas futuras será necesario conectar explícitamente la persistencia del canal/chat a estos hilos, con consentimientos y garantías de atribución.

## Validación

- Funciones y tablas creadas en la base compartida Compás One.
- Prueba SQL de creación, toma, nota y devolución realizada dentro de `BEGIN/ROLLBACK`: **no se almacenaron candidatos de prueba**.
- RLS protege expedientes, hilos y mensajes; `anon` no puede leerlos ni invocar `cl360_take_conversation`. Usuario externo autenticado comprobado sin visibilidad.
- Los cambios de código se verifican por GitHub Actions, incluida sintaxis JavaScript del CRM.
- Pendientes: prueba completa con candidato consentido desde navegador, aviso de privacidad legal definitivo, conexión generativa Fly (Gemini) y conexión oficial bidireccional WhatsApp. Sin estas pruebas no anunciar conversaciones externas sincronizadas.

## Pasos operativos

1. Abrir la app e iniciar sesión con usuario autorizado.
2. En Vacantes, revisar/crear publicaciones; las nuevas quedan pausadas.
3. Cuando alguien se postule, revisar el expediente en Candidatos o Pipeline.
4. Abrir Conversaciones, seleccionar el hilo y pulsar **Tomar conversación**.
5. Agregar notas internas y, si corresponde, abrir WhatsApp para comunicación humana.
6. Actualizar etapa y programar próximo seguimiento.

No publicar sueldos; la asesora los comunica personalmente. No rechazar automáticamente por respuestas de disponibilidad o experiencia.

## Fly Recruiter · Vinculación de conversaciones (24/nov/2026)

La bandeja de Conversaciones ya admite el historial real de turnos Fly con fuente `candidate` / `fly`, **únicamente generado y registrado por el servidor**, después de que el candidato aceptó su tratamiento y completó la postulación. Los registros previos al alta son temporales y se eliminan mediante tarea programada. `cl360_take_conversation` mantiene estados humanos; Fly valida esos estados antes de responder. El canal WhatsApp sigue abriéndose externamente y no se sincroniza. **La credencial Gemini no está disponible**, por lo que el modo generativo sigue bloqueado hasta validación.
