# Copilot Instructions

Estas instrucciones aplican a GitHub Copilot Chat, Copilot CLI y agentes que trabajen en este repositorio.

Nota sobre modelos: este archivo no selecciona ni fuerza un modelo especifico. Cuando el usuario pida comportamiento "como GPT-5.5", interpreta eso como: razonar con cuidado, leer el contexto antes de editar, explicar tradeoffs, implementar cambios completos y verificar el resultado.

## Idioma y estilo

- Responde al usuario en espanol salvo que pida otro idioma.
- Se directo, tecnico y accionable. Evita relleno, entusiasmo artificial y explicaciones largas si no agregan valor.
- No afirmes capacidades que no verificaste. Si falta contexto, revisa el codigo primero.
- Si haces una suposicion, declarala brevemente y sigue con una opcion conservadora.
- Usa nombres de variables, funciones y archivos coherentes con el codigo existente. No renombres masivamente sin una razon tecnica clara.

## Reglas de trabajo

- Lee primero los archivos relevantes antes de proponer o editar codigo.
- Mantén los cambios acotados al pedido del usuario.
- No reviertas cambios existentes que no hayas hecho.
- No ejecutes `git commit` ni `git push` automaticamente. Pregunta al usuario antes de cualquier commit.
- No uses comandos destructivos como `git reset --hard`, `git checkout --`, borrados recursivos o limpiezas masivas sin permiso explicito.
- Prefiere `rg` para busquedas.
- No edites `node_modules`, `dist`, `build`, archivos generados o lockfiles salvo que el cambio lo requiera.
- Si agregas dependencias, justifica por que hacen falta y actualiza el `package-lock.json` correspondiente.
- Antes de tocar seguridad, autenticacion, base de datos o contratos API, identifica consumidores backend/frontend para evitar romper compatibilidad.

## Flujo `.agent/` para Copilot CLI

Cuando el usuario pida ejecutar tareas, continuar el plan, avanzar por fases o trabajar desde `.agent/`, Copilot CLI debe actuar como ejecutor de tareas y seguir este flujo.

Archivos que debe leer antes de ejecutar:

- `.agent/memory.json`
- `.agent/state.json`
- todos los archivos relevantes en `.agent/context/`
- la tarea JSON seleccionada en `.agent/tasks/`

Seleccion de tarea:

- Ejecuta solo una tarea por vez.
- Elige la primera tarea con `"status": "pending"` cuyas dependencias ya esten completadas.
- Una dependencia esta completada solo si la tarea correspondiente tiene `"status": "success"`.
- No ejecutes tareas con dependencias pendientes, fallidas o inexistentes.
- No ejecutes `_template.json`.
- Si `.agent/state.json` indica `"status": "running"` y hay una `current_task`, no empieces otra tarea; revisa y reporta el estado.

Ejecucion de una tarea:

1. Resume brevemente la tarea, archivos probables a tocar y verificaciones esperadas.
2. Actualiza `.agent/state.json` con `current_task`, `status: running` y `last_update` en ISO 8601.
3. Cambia la tarea seleccionada a `"status": "running"`.
4. Ejecuta solo las instrucciones de esa tarea.
5. Respeta `allowed_actions` y `forbidden_actions` del JSON.
6. Ejecuta verificaciones razonables segun el area tocada.
7. Registra acciones importantes en `.agent/logs/execution.log`.
8. Guarda el resultado en `.agent/results/<task_id>_result.json`.

Formato recomendado para resultados:

```json
{
  "task_id": "001",
  "status": "success",
  "summary": "Resumen breve del trabajo realizado.",
  "files_changed": [],
  "commands_run": [],
  "verification": [],
  "warnings": [],
  "next_recommended_task": null
}
```

Cierre de tarea:

- Si la tarea cumple sus criterios de exito, cambia su `"status"` a `"success"`, deja `current_task` en `null`, actualiza `last_completed_task` y devuelve `.agent/state.json` a `"status": "idle"`.
- Si la tarea falla o queda bloqueada, cambia su `"status"` a `"failed"`, deja `.agent/state.json` en `"status": "failed"` y documenta el bloqueo en el result JSON.
- No marques una tarea como `"success"` si no cumplio sus `success_criteria`.

Reglas especificas del flujo:

- No avances automaticamente a la siguiente tarea en la misma ejecucion salvo que el usuario lo pida explicitamente.
- No edites `PLAN_REESTRUCTURACION.md` para marcar fases completas si la tarea no lo solicita o si los criterios no se cumplieron.
- No crees nuevas tareas salvo que el usuario pida planificar, dividir trabajo o actualizar la cola `.agent/`.
- Si una tarea requiere una accion prohibida, detente y registra el bloqueo.
- Si necesitas una decision de arquitectura no cubierta por `.agent/` ni por la tarea, pregunta antes de continuar.

## Estructura del repositorio

El repositorio Git tiene una carpeta de proyecto anidada:

```txt
path-to-valhalla/
  backend/
  frontend/
```

Rutas principales:

- Backend: `path-to-valhalla/backend`
- Frontend: `path-to-valhalla/frontend`
- Plan tecnico de reestructuracion: `PLAN_REESTRUCTURACION.md`
- Coordinacion de tareas del agente: `.agent/`

Antes de hacer refactors grandes, lee `PLAN_REESTRUCTURACION.md` y respeta su direccion: migracion incremental, compatibilidad temporal y contratos claros.

## Stack actual

Backend:

- Node.js con CommonJS.
- Express 4.
- PostgreSQL con `pg`.
- JWT con `jsonwebtoken`.
- Socket.IO.
- `dotenv`, `cors`, `helmet`, `bcryptjs`.
- Entrada actual: `path-to-valhalla/backend/server.js`.

Frontend:

- React 19.
- Vite.
- React Router.
- Tailwind CSS.
- Socket.IO client.
- Zustand esta instalado, pero no lo asumas como patron dominante hasta verificar uso real.
- Entrada actual: `path-to-valhalla/frontend/src/App.jsx`.

## Comandos utiles

Ejecuta comandos desde la carpeta que contiene el `package.json` correcto.

Backend:

```bash
cd path-to-valhalla/backend
npm run dev
npm start
```

Frontend:

```bash
cd path-to-valhalla/frontend
npm run dev
npm run build
npm run lint
```

Si cambias frontend, ejecuta al menos `npm run build` y, si aplica, `npm run lint`.
Si cambias backend, arranca o valida Node con el flujo disponible. Actualmente no hay suite formal de tests.

## Backend

- Conserva CommonJS (`require`, `module.exports`) mientras el backend no migre oficialmente a ESM.
- Rutas Express solo deben definir metodo, path, middleware y controlador.
- Controladores deben traducir HTTP a llamadas de servicio, no concentrar SQL ni reglas extensas.
- SQL debe vivir en repositorios o utilidades de datos, no mezclado con componentes frontend ni handlers largos.
- Usa consultas parametrizadas con `pg`; nunca interpolar input de usuario en SQL.
- No aceptes `userId` desde body/query para acciones autenticadas. Deriva el usuario desde `req.user`.
- Para endpoints nuevos, prefiere `Authorization: Bearer <token>`.
- Durante migracion, conserva compatibilidad con endpoints legacy `/api` cuando el frontend aun los consuma.
- Para API nueva, usa base `/api/v1` y formato consistente:

```json
{
  "ok": true,
  "data": {},
  "meta": {}
}
```

Errores nuevos:

```json
{
  "ok": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Mensaje claro.",
    "details": {}
  }
}
```

- No hardcodees secretos, credenciales de PostgreSQL ni JWT secrets. Usa variables de entorno y `.env.example`.
- Si tocas Socket.IO, mantén autenticacion coherente con HTTP y evita duplicar secretos.
- Aplica `helmet` y CORS configurado por entorno cuando trabajes en la inicializacion del servidor.

## Frontend

- Mantén React funcional con hooks.
- No hagas paginas de marketing; este proyecto es una app/juego. La primera pantalla debe ser experiencia funcional.
- Usa el sistema visual existente: Tailwind, assets en `public`, componentes de `src/components` y layout actual.
- Usa `lucide-react` para iconos nuevos cuando corresponda.
- No construyas URLs de API de forma dispersa. Usa `src/constants/api.js` mientras no exista un cliente central, o migra de forma incremental hacia `src/api/client.js`.
- No repitas headers de autenticacion en componentes cuando puedas centralizarlos.
- Evita leer `localStorage` desde multiples paginas nuevas. Centraliza sesion cuando trabajes en esa zona.
- Mantén componentes de pagina enfocados en UI y orquestacion ligera; mueve llamadas HTTP a servicios o `features/*/api` cuando hagas refactors.
- Cuida responsividad: textos no deben solaparse, botones deben tener dimensiones estables y estados visibles.
- No agregues paletas visuales incongruentes con el estilo del juego. Reutiliza assets existentes cuando sea posible.

## Contratos API y migracion

- El frontend actual consume varios endpoints bajo `/api`. No cambies paths existentes sin revisar consumidores con `rg`.
- Al introducir `/api/v1`, deja adaptadores o endpoints legacy mientras el frontend migra.
- Migra por dominio completo cuando sea posible: auth, hero, inventory, packages, shop, bank, quests, expeditions, bestiary, evolution, skills, pets, backgrounds, messages.
- Si cambias una respuesta del backend, actualiza el consumidor frontend en el mismo cambio.
- Si agregas un servicio frontend nuevo, nombralo por dominio, por ejemplo `shop.api.js`, `bank.api.js`, `messages.api.js`.

## Base de datos

- No agregues migraciones improvisadas dentro de requests normales.
- Si cambia el schema, crea o actualiza scripts SQL/migracion de forma reproducible.
- No guardes contrasenas reales ni datos sensibles en el repo.
- Para operaciones monetarias, inventario, paquetes o banco, usa transacciones si se modifican varias tablas.

## Calidad y verificacion

- Despues de cambios, ejecuta el comando mas cercano al area tocada.
- Si no puedes ejecutar una verificacion, dilo claramente y explica el riesgo residual.
- Para bugs, intenta reproducir o razonar desde el flujo real antes de editar.
- Para refactors, conserva comportamiento y contratos; mejora estructura en pasos pequenos.
- Agrega pruebas solo cuando el repo ya tenga soporte o cuando el cambio justifique incorporar infraestructura de test.

## Seguridad

- Trata autenticacion, JWT, monedas, inventario, banco y admin como areas sensibles.
- Valida input en backend aunque el frontend ya lo valide.
- No expongas stack traces ni detalles internos en respuestas de produccion.
- Endpoints admin deben requerir autenticacion y autorizacion explicita.
- No registres tokens, contrasenas ni informacion sensible en consola.

## Git

- Puedes revisar estado con `git status` y diffs con `git diff`.
- No hagas commits ni pushes sin confirmacion explicita del usuario.
- Si el usuario pide preparar un commit, primero resume los cambios y pregunta antes de ejecutar `git commit`.

