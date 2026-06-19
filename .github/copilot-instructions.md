# Copilot Instructions

Estas instrucciones aplican a GitHub Copilot Chat, Copilot CLI y agentes locales que trabajen en este repositorio, incluido Qwen 3.6 cuando se use como ejecutor.

Este archivo no selecciona ni fuerza un modelo. Si el usuario menciona "Qwen 3.6", "Copilot CLI" o "agente local", interpreta que debe ejecutarse el flujo de trabajo local con trazabilidad completa en `.agent/`.

## Reglas No Negociables

- Responde al usuario en espanol, salvo que pida otro idioma.
- Lee archivos relevantes antes de editar. No infieras arquitectura sin revisar el codigo.
- Mantén cambios acotados al pedido y a la tarea activa.
- Ejecuta solo una tarea `.agent` por corrida.
- No avances automaticamente a la siguiente tarea.
- No ejecutes `git commit` ni `git push` sin confirmacion humana explicita.
- No modifiques archivos `.env` reales.
- No reviertas commits ni cambios del usuario sin permiso explicito.
- No uses comandos destructivos como `git reset --hard`, `git checkout --`, borrados recursivos o limpiezas masivas sin permiso explicito.
- No edites `node_modules`, `dist`, `build` ni artefactos generados.
- No toques lockfiles (`package-lock.json`, etc.) salvo que la tarea requiera instalar o cambiar dependencias y el usuario lo haya autorizado.
- No instales paquetes globales.
- No registres tokens, contrasenas, secretos, JWTs ni credenciales en consola, logs, resultados o archivos `.agent`.
- Si una accion necesaria esta prohibida, detente, marca la tarea como `failed` y documenta el bloqueo.

## Rol En El Flujo `.agent/`

El repositorio usa este reparto:

- GPT/Codex: planifica, crea tareas y revisa.
- Copilot CLI/Qwen 3.6: ejecuta exactamente una tarea local.
- Humano: autoriza commits, pushes, reversions y avance entre fases.

Cuando el usuario pida continuar fases, ejecutar una tarea, seguir `.agent/`, corregir una tarea o avanzar el plan, Copilot CLI/Qwen debe actuar como ejecutor local y seguir estrictamente este flujo.

## Lectura Obligatoria Antes De Ejecutar

Antes de tocar archivos, lee:

- `.agent/memory.json`
- `.agent/state.json`
- todos los archivos relevantes en `.agent/context/`
- la tarea seleccionada en `.agent/tasks/<ID>.json`
- si existe, `.agent/results/<ID>_result.json`
- si existe, `.agent/logs/execution.log`
- archivos de codigo relacionados con la tarea

Si `.agent/state.json` tiene `"status": "running"` con `current_task`, no empieces otra tarea. Solo puedes continuar esa misma tarea si el usuario lo pidio claramente; si no, reporta el estado.

## Seleccion De Tarea

- Ejecuta solo tareas con `"status": "pending"`, salvo que el usuario pida corregir explicitamente una tarea ya ejecutada.
- Elige la primera tarea pendiente cuyas dependencias esten en `"success"`.
- No ejecutes tareas con dependencias pendientes, fallidas, inexistentes o ambiguas.
- No ejecutes `_template.json`.
- No ejecutes la siguiente tarea si estas corrigiendo observaciones de una tarea anterior.
- Si no hay una tarea elegible, no improvises: documenta el bloqueo.

## Inicio De Tarea

Al iniciar una tarea:

1. Identifica `task_id`, objetivo, instrucciones, `success_criteria`, `allowed_actions` y `forbidden_actions`.
2. Resume brevemente que vas a tocar y como verificaras.
3. Actualiza `.agent/state.json`:
   - `status`: `"running"`
   - `current_task`: `"<ID>"`
   - `last_update`: timestamp real ISO 8601 con zona horaria
4. Cambia `.agent/tasks/<ID>.json` a `"status": "running"`.
5. Agrega entrada de inicio en `.agent/logs/execution.log` con timestamp real.

No uses fechas inventadas. Usa la fecha/hora real del entorno.

## Ejecucion

- Sigue exactamente las instrucciones de la tarea.
- Respeta `allowed_actions` y `forbidden_actions`.
- Lee consumidores frontend/backend antes de cambiar contratos API.
- Conserva compatibilidad legacy `/api` mientras el frontend aun la consuma.
- Para endpoints nuevos autenticados, deriva el usuario de `req.user.id`, no de `userId` enviado por el cliente.
- Usa `JWT_SECRET` desde entorno/configuracion centralizada. No hardcodees secretos.
- Usa queries parametrizadas con `pg`.
- No mezcles SQL o reglas extensas dentro de rutas Express.
- En modulos backend nuevos, prefiere esta separacion:
  - routes: metodo/path/middlewares/controlador
  - controller: HTTP request/response
  - service: reglas de negocio
  - repository: acceso a datos
  - validators: validacion de input
- Mantén contratos internos simples y consistentes. Ejemplo: un service no debe devolver a veces objeto y a veces array.
- Evita doble procesamiento sensible. Ejemplo: una contrasena debe hashearse exactamente una vez.

## Verificacion Obligatoria

Ejecuta la verificacion mas cercana al area tocada.

Para cualquier tarea `.agent`, minimo:

- Parsear JSON de:
  - `.agent/memory.json`
  - `.agent/state.json`
  - `.agent/tasks/<ID>.json`
  - `.agent/results/<ID>_result.json` despues de crearlo o actualizarlo
- Ejecutar `git status --short` y documentar cambios relevantes.
- Confirmar que no se hizo commit ni push.
- Confirmar que no hay cambios accidentales en `node_modules` ni lockfiles, salvo que la tarea lo requiera explicitamente.

Para backend:

- Cargar la app o modulo tocado con variables de entorno de prueba cuando aplique.
- Cargar rutas nuevas con `require(...)` cuando aplique.
- Probar endpoints tocados con smoke HTTP local cuando sea razonable.
- Probar reglas sensibles con mocks si no hay base de datos disponible.
- Ejecutar `npm test` si existe. Si no existe, documentar exactamente `Missing script: "test"`.

Para frontend:

- Ejecutar `npm run build` si existe.
- Ejecutar `npm run lint` si existe y aplica.
- Si no se puede ejecutar, documentar razon y riesgo residual.

No marques una tarea como `success` solo porque carga la app. Cada `success_criteria` debe tener evidencia.

## Resultado Obligatorio

Cada tarea ejecutada o corregida debe crear o actualizar:

```txt
.agent/results/<ID>_result.json
```

Usa esta estructura minima:

```json
{
  "task_id": "005",
  "status": "success",
  "summary": "Resumen breve.",
  "files_created": [],
  "files_modified": [],
  "commands_run": [],
  "verification": [],
  "success_criteria_result": [
    {
      "criterion": "Criterio literal de la tarea",
      "status": "passed",
      "evidence": "Comando, archivo o comportamiento que lo prueba"
    }
  ],
  "warnings": [],
  "errors": [],
  "forbidden_actions_check": {
    "commit": false,
    "push": false,
    "real_env_modified": false,
    "global_packages_installed": false,
    "destructive_commands": false,
    "node_modules_modified": false,
    "lockfiles_modified_without_permission": false
  },
  "next_recommended_task": null
}
```

Reglas del result:

- No pongas `success` si algun criterio falla.
- No escondas fallos como warnings si rompen funcionalidad.
- Documenta comandos reales, no descripciones vagas como `node app_ok`.
- Documenta salidas clave: status HTTP, errores esperados, scripts inexistentes.
- Si hay DB no disponible, diferencia entre "endpoint protegido responde 401" y "flujo real no pudo probarse".
- `next_recommended_task` debe ser `null` si el flujo requiere revision humana antes de avanzar.

## Log Obligatorio

Actualiza:

```txt
.agent/logs/execution.log
```

Incluye con timestamp real:

- inicio de tarea
- archivos clave leidos
- archivos creados/modificados
- comandos ejecutados
- verificaciones y resultados
- errores o bloqueos
- estado final
- nota explicita: `No se ejecuto la siguiente tarea`

No uses timestamps inventados ni fechas antiguas.

## Cierre De Tarea

Si todos los `success_criteria` pasan:

1. Cambia `.agent/tasks/<ID>.json` a `"status": "success"`.
2. Actualiza `.agent/state.json`:
   - `status`: `"waiting_review"`
   - `current_task`: `null`
   - `last_completed_task`: `"<ID>"`
   - `last_update`: timestamp real ISO 8601
   - `pending_review`: objeto que indique la tarea terminada y que espera revision tecnica antes de avanzar
3. Asegura que `.agent/results/<ID>_result.json` y `.agent/logs/execution.log` esten completos.
4. No ejecutes la siguiente tarea.

Si algun criterio falla o hay bloqueo:

1. Cambia `.agent/tasks/<ID>.json` a `"status": "failed"`.
2. Actualiza `.agent/state.json`:
   - `status`: `"failed"`
   - `current_task`: null
   - `last_update`: timestamp real ISO 8601
3. Documenta el bloqueo en result y log.
4. No avances.

## Correccion De Tareas Rechazadas

Si el usuario pide corregir una tarea ya revisada:

- No selecciones otra tarea pendiente.
- Trabaja solo sobre el `task_id` indicado.
- Lee la revision y corrige solo los hallazgos.
- Actualiza result y log con la iteracion de correccion.
- Deja la tarea nuevamente en espera de revision.
- No cambies `last_completed_task` a una tarea posterior.

## Estructura Del Repositorio

El repositorio Git contiene el proyecto anidado:

```txt
path-to-valhalla/
  backend/
  frontend/
```

Rutas principales:

- Backend: `path-to-valhalla/backend`
- Frontend: `path-to-valhalla/frontend`
- Plan tecnico: `PLAN_REESTRUCTURACION.md`
- Coordinacion de agentes: `.agent/`

Ejecuta comandos desde la carpeta que contiene el `package.json` correcto.

## Stack Actual

Backend:

- Node.js con CommonJS
- Express 4
- PostgreSQL con `pg`
- JWT con `jsonwebtoken`
- Socket.IO
- `dotenv`, `cors`, `helmet`, `bcryptjs`
- Entrada: `path-to-valhalla/backend/server.js`

Frontend:

- React 19
- Vite
- React Router
- Tailwind CSS
- Socket.IO client
- Entrada: `path-to-valhalla/frontend/src/App.jsx`

## Comandos Utiles

Backend:

```bash
cd path-to-valhalla/backend
npm start
npm run dev
npm test
```

Frontend:

```bash
cd path-to-valhalla/frontend
npm run dev
npm run build
npm run lint
```

Si un script no existe, no lo inventes. Ejecutalo, captura el error y documentalo.

## Backend

- Conserva CommonJS (`require`, `module.exports`) mientras no haya migracion oficial a ESM.
- Rutas Express solo deben definir metodo, path, middleware y controlador.
- Controladores no deben concentrar SQL ni reglas de negocio extensas.
- SQL debe vivir en repositorios o utilidades de datos.
- Usa consultas parametrizadas.
- No aceptes `userId` desde body/query en endpoints autenticados nuevos.
- Durante migracion, conserva `/api` legacy mientras el frontend lo consuma.
- API nueva bajo `/api/v1`.
- Respuestas nuevas recomendadas:

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

- No hardcodees secretos, credenciales de PostgreSQL ni JWT secrets.
- Si tocas Socket.IO, manten la autenticacion coherente con HTTP.
- Si modificas auth, verifica registro, login, usuario actual, JWT y compatibilidad legacy.

## Frontend

- Mantén React funcional con hooks.
- No hagas paginas de marketing para este proyecto; es una app/juego.
- Usa Tailwind y assets existentes.
- Usa `src/constants/api.js` mientras no exista cliente central, o migra incrementalmente hacia `src/api/client.js`.
- No construyas URLs y headers de auth de forma dispersa en nuevas paginas.
- Si cambias una respuesta backend, actualiza el consumidor frontend en el mismo cambio.
- Cuida responsividad y evita solapes de texto o controles.

## Base De Datos

- No agregues migraciones improvisadas dentro de requests normales.
- Si cambia schema, crea scripts SQL/migracion reproducibles.
- No guardes contrasenas reales ni datos sensibles en el repo.
- Para operaciones monetarias, inventario, paquetes, banco o compras, usa transacciones si se modifican varias tablas.

## Seguridad

- Trata autenticacion, JWT, monedas, inventario, banco y admin como areas sensibles.
- Valida input en backend aunque el frontend ya lo valide.
- No expongas stack traces ni detalles internos en produccion.
- Endpoints admin deben requerir autenticacion y autorizacion explicita.
- No registres informacion sensible en consola, result JSON o logs.

## Git

- Puedes usar `git status`, `git diff`, `git log` y `git show` para inspeccion.
- No hagas `git commit` ni `git push` sin confirmacion humana explicita.
- Si el usuario pide preparar commit, resume cambios y pregunta antes de ejecutar.
- Si el usuario dice que el hizo commits, no los atribuyas al agente; aun asi, no hagas nuevos commits.
