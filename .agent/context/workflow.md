# GPT + Qwen Workflow

## 1. Analisis GPT

GPT debe:

- entender el objetivo;
- revisar contexto relevante del repo;
- identificar riesgos;
- dividir el trabajo en pasos concretos;
- definir criterios de aceptacion verificables;
- crear una tarea JSON en `.agent/tasks/`.

La tarea debe tener `"status": "pending"` solo cuando este lista para que Qwen la ejecute.

## 2. Ejecucion Qwen

Qwen debe:

- leer `.agent/memory.json`;
- leer `.agent/state.json`;
- revisar `.agent/context/`;
- buscar tareas con `"status": "pending"`;
- ejecutar solo una tarea a la vez;
- actualizar `.agent/state.json` a `running`;
- seguir la tarea escrita por GPT;
- editar solo los archivos necesarios;
- ejecutar comandos y tests indicados;
- reportar cambios, comandos, errores y dudas en `.agent/results/<task_id>_result.json`;
- registrar acciones en `.agent/logs/execution.log`;
- no ampliar alcance sin aprobacion.

## 3. Revision GPT

GPT debe revisar:

- si los cambios cumplen el objetivo;
- si los criterios de aceptacion estan cubiertos;
- si hay riesgos, regresiones o pruebas faltantes;
- si hace falta pedir otra iteracion a Qwen.

## Estados sugeridos

```txt
pending -> running -> success
pending -> running -> failed
success -> waiting_review
```

Estados permitidos en `.agent/state.json`:

```txt
idle
running
success
failed
waiting_review
```
