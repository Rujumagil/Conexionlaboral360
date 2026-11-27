# Registro humano desde Messenger · revisión y despliegue

La propuesta aprovecha las tablas existentes de CL360. No lanza campañas, no envía mensajes, no califica candidatos y no modifica Supabase automáticamente por fusionar el PR.

## Secuencia operativa

1. En Mensajes, Astrid o un integrante autorizado toma control humano de una conversación.
2. Abre Registrar postulación, revisa las sugerencias extraídas del chat y confirma nombre, teléfono, zona declarada, experiencia declarada y vacante activa. El teléfono solo se recopila si la persona lo compartió para su postulación. Los campos extraídos no son evidencia verificada por sí solos.
3. Selecciona al responsable (Astrid cuando corresponda), la fecha y confirma dos casillas distintas: consentimiento explícito de la persona y revisión humana.
4. Una única transacción crea candidato, vínculo a Messenger, seguimiento y evento de auditoría. Si ya hay vínculo, no duplica. Si hay una candidatura con mismo teléfono y vacante, exige vinculación manual, para no asumir que es la misma persona.
5. El CRM ya muestra seguimientos y avisos del navegador mientras la app está abierta y autorizada; no hay push persistente con app cerrada, SMS ni WhatsApp automáticos.

## Activación supervisada (después de revisión)

- Revisar las pruebas del PR y la interfaz autenticada en escritorio y móvil. Comprobar que un usuario sin permiso o con conversación no asignada no puede registrar.
- Aplicar mediante una migración revisada y registrada el archivo docs/cl360-messenger-human-registration.sql al proyecto Supabase compas-one con autorización del propietario. El PR no ejecuta este SQL.
- Probar con candidato y teléfono sintéticos en transacción con ROLLBACK; luego ensayar con una persona real solo tras consentimiento. Probar duplicado, sin consentimiento, otra vacante, sin dueño de conversación, asignación inválida, fecha vencida y ejecución simultánea.
- Validar que el seguimiento sea visible en el CRM para el integrante seleccionado (Astrid, si fue seleccionada), y que el aviso del navegador dependa de tener la app abierta/autorizada.
- Rollback de API: DROP FUNCTION public.cl360_messenger_candidate_register(uuid,text,text,text,text,text,boolean,boolean,timestamptz,uuid); DROP FUNCTION public.cl360_messenger_recruiters(); No eliminar datos de candidatos válidos.
- No activar automatización de Messenger ni envíos a candidatos. Mantener autorización humana para mensajes y decisiones de reclutamiento.

## Dependencias y límites

- El PR #13 de la PWA Mensajes quedó integrado en main.
- El PR #170 de Andy fue integrado a chore/cloudflare-one-deploy en compas-one, pero eso no demuestra que el motor esté en main o publicado. Confirmar CI y rollout Cloudflare por separado.
- Las alertas del CRM son avisos internos y navegador; no garantizan recepción con la app cerrada.
- Nunca inferir consentimiento por saludo, interés o un resumen generado por Andy.
