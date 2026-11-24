# Conexión Laboral 360 · CRM multipágina y dashboard de KPIs

## Rutas independientes

- **Dashboard e inicio:** https://rujumagil.github.io/Conexionlaboral360/crm/
- **Vacantes:** https://rujumagil.github.io/Conexionlaboral360/crm/vacantes/
- **Candidatos:** https://rujumagil.github.io/Conexionlaboral360/crm/candidatos/
- **Pipeline:** https://rujumagil.github.io/Conexionlaboral360/crm/pipeline/
- **Conversaciones:** https://rujumagil.github.io/Conexionlaboral360/crm/conversaciones/
- **Seguimientos:** https://rujumagil.github.io/Conexionlaboral360/crm/seguimientos/
- **Compás Fly:** https://rujumagil.github.io/Conexionlaboral360/crm/fly/
- **Ajustes:** https://rujumagil.github.io/Conexionlaboral360/crm/ajustes/

Cada módulo tiene un archivo `index.html` y una URL propia. Todos utilizan el diseño y código compartidos de `crm/app.css`, `crm/app.js` y `crm/shell.html`. Las rutas son páginas estáticas reales de GitHub Pages, no fragmentos de URL (`#...`).

## Página principal = dashboard

La ruta `/crm/` es exclusivamente el inicio con indicadores:
- Postulantes totales
- Sin contactar
- En proceso
- Calificados
- Seguimientos vencidos
- Vacantes activas
- Conversaciones pendientes
- Conversaciones atendidas por personas
- Contrataciones
- Próximas acciones y resumen de atención

Las cifras se obtienen de tablas protegidas en Supabase, sin datos simulados.

## Navegación

- Escritorio: menú lateral de módulos.
- Móvil: barra inferior con Inicio, Vacantes, Candidatos, Pipeline, Chats y Más; Más tiene enlaces a Seguimientos y Fly.
- Un candidato abierto desde Pipeline o Conversaciones lleva a `/crm/candidatos/?candidato=<uuid>`, donde se abre su expediente.
- La sesión se valida en cada página con Supabase Auth; no hay endpoints nuevos para exponer datos personales.

## Estado real de las conversaciones

La bandeja guarda notas internas, permite tomar y cerrar casos y abre WhatsApp con un mensaje prellenado. **No** envía mensajes desde el CRM ni sincroniza conversaciones externas automáticamente. La atención generativa de Fly sigue pendiente de credencial y habilitación supervisada. Las transcripciones completas de Fly requieren una integración posterior.

## Validación

Prueba automatizada de GitHub Actions verificó JavaScript, archivo de shell, estilos, ocho rutas y KPIs. El despliegue en GitHub Pages debe terminar antes de comprobar la navegación en un navegador. El backend Supabase y RLS permanecieron intactos durante esta separación visual.
