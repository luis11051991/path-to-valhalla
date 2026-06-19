# Riesgos del plan

| Riesgo | Impacto | Mitigacion |
|---|---|---|
| Romper frontend al cambiar endpoints | Alto | Mantener `/api` legacy mientras se migra a `/api/v1` |
| Divergencia entre respuestas nuevas y viejas | Medio | `apiClient` adapta respuestas y se migran dominios completos |
| Reglas de negocio escondidas en componentes | Medio | Migrar por feature y extraer hooks/API antes de tocar UI |
| Transacciones incompletas en operaciones monetarias/inventario | Alto | Extraer servicios con helper transaccional y pruebas |
| Secretos expuestos en repo | Alto | Mover a variables de entorno, agregar `.env.example`, revisar `.gitignore` |
| Socket desconectado tras logout/login | Medio | Centralizar lifecycle en `socketStore` |
| Migracion demasiado grande | Alto | Ejecutar por dominios, con compatibilidad temporal |

## Notas de ambiguedad

- El plan recomienda herramientas de migracion y test, pero no obliga a instalar una dependencia especifica.
- Si una tarea detecta acoplamiento mayor al esperado, debe registrar el bloqueo en `.agent/results/` y detenerse.
