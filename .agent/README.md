# Agent Workspace

Este directorio coordina tareas entre GPT-5.5 y el agente local Qwen.

- GPT-5.5 actua como planificador, analista y revisor.
- Qwen 3.6 local actua como ejecutor local de tareas, codigo, tests y reportes.

## Regla principal

```txt
GPT decide que hacer.
Qwen ejecuta como hacerlo.
GPT valida si quedo bien.
```

## Estructura

```txt
.agent/
├── tasks/
├── results/
├── memory.json
├── state.json
├── context/
│   ├── architecture.md
│   ├── coding_standards.md
│   ├── business_rules.md
│   ├── project-rules.md
│   └── workflow.md
└── logs/
```

## Flujo obligatorio

1. Leer `.agent/memory.json`.
2. Leer `.agent/state.json`.
3. Revisar `.agent/context/` si existe.
4. Buscar tareas pendientes en `.agent/tasks/`.
5. Ejecutar solo una tarea a la vez.
6. Cambiar el estado a `running`.
7. Ejecutar la tarea siguiendo sus instrucciones.
8. Validar los criterios de exito.
9. Guardar resultado en `.agent/results/`.
10. Actualizar `.agent/state.json`.
11. Registrar acciones en `.agent/logs/execution.log`.

## Tareas

Cada tarea debe ser un archivo JSON independiente dentro de `.agent/tasks/`.

El agente local solo debe ejecutar tareas con:

```json
{
  "status": "pending"
}
```

Ver `.agent/tasks/_template.json` para el formato base.

## Resultados

Por cada tarea ejecutada, Qwen debe crear un archivo:

```txt
.agent/results/<task_id>_result.json
```

El resultado debe incluir estado, resumen, archivos creados/modificados, comandos ejecutados, errores y recomendaciones.

## Seguridad

El agente local no debe:

- borrar el proyecto;
- hacer `git push`;
- hacer `git commit` sin confirmacion humana explicita;
- modificar archivos `.env`;
- instalar paquetes globales;
- ejecutar comandos destructivos;
- eliminar carpetas completas;
- cambiar configuraciones criticas sin instruccion explicita.

Si una tarea requiere una accion prohibida, el agente debe detenerse y generar un resultado con estado `failed`.

## Archivos generados

```txt
.agent/
├── logs/
│   └── execution.log
├── results/
│   └── <task_id>_result.json
└── tasks/
    └── <task_id>.json
```

Los logs y resultados generados se ignoran por defecto en Git, excepto los README de cada carpeta.
