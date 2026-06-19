# Business Rules

Registrar aqui reglas funcionales del proyecto que el agente local deba respetar.

## Reglas iniciales

- Tratar autenticacion, JWT, monedas, inventario, banco y admin como areas sensibles.
- No cambiar contratos API sin revisar consumidores con busqueda en el repo.
- Si se modifica una respuesta del backend, actualizar el consumidor frontend en el mismo cambio.
- Para operaciones monetarias, inventario, paquetes o banco, usar transacciones si se modifican varias tablas.

`n## Reglas extraidas de PLAN_REESTRUCTURACION.md`n`n- En endpoints autenticados nuevos, el usuario se deriva de `req.user.id`, no de `userId` enviado por el cliente.`n- Operaciones de moneda, inventario, paquetes, banco y compras deben usar transacciones cuando modifiquen varias tablas.`n- Mensajes solo pueden marcarse como leidos por el destinatario autenticado.`n- Endpoints admin deben requerir autenticacion y permisos admin.`n- El frontend no debe construir URLs ni headers de autenticacion directamente en paginas o componentes.`n
