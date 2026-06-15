# Plan de Reestructuración Arquitectónica

## 1. Tareas completadas por fase

### Fase 0 - Estabilización previa
- Corregido `backend/package.json` para que sea JSON válido
- Configuración de scripts claros: `dev`, `start`, `lint`, `test` para ambos proyectos
- Documentación de variables requeridas en `.env.example`
- Separación de cambios funcionales de la reestructuración

### Fase 1 - Seguridad base
- Eliminación de `serviceAccountKey.json` del código fuente
- Hacer obligatorio `JWT_SECRET` sin fallback hardcodeado
- Consolidación de Firebase Admin en un solo archivo centralizado
- Implementación de `helmet` para seguridad HTTP
- Configuración de CORS por allowlist desde variables de entorno
- Implementación de rate limiting en endpoints sensibles
- Creación de middleware de errores global

### Fase 2 - Separación de entrada y runtime del backend
- Creación de `src/app.js` para configurar Express y rutas
- Movimiento de `src/socket.js` a `src/realtime/socket.js`
- Separación del seed de datos iniciales del arranque normal
- Implementación de endpoints de salud (`/health`, `/ready`)

### Fase 3 - Modularización backend por dominio
- Migración de módulos por dominios (auth, player, inventory, etc.)
- Creación de estructura modular con servicios, repositorios y validaciones
- Implementación de patrón de capas: routes → controllers → services → repositories

## 2. Nueva estructura modular del backend

```
backend/
  server.js
  src/
    app.js
    config/
      env.js
      firebase.js
      cors.js
    middlewares/
      auth.middleware.js
      admin.middleware.js
      error.middleware.js
      not-found.middleware.js
      rate-limit.middleware.js
      validate.middleware.js
    shared/
      errors/
      firestore/
      http/
      logger/
      security/
      utils/
    modules/
      auth/
        auth.routes.js
        auth.controller.js
        auth.service.js
        auth.repository.js
        auth.schemas.js
        auth.mapper.js
      player/
      inventory/
      expedition/
      quest/
      shop/
      workshop/
      bank/
      package/
      message/
      pet/
      background/
      skill/
      evolution/
    realtime/
      socket.js
      events.js
    jobs/
      seed-game-data.js
    tests/
```

## 3. Beneficios obtenidos

### Para el backend:
- **Seguridad mejorada**: Eliminación de secretos en código fuente, implementación de CORS y rate limiting
- **Modularidad**: Separación clara por dominios reduciendo acoplamiento
- **Testabilidad**: Posibilidad de testear componentes individuales sin arrancar el servidor completo
- **Escalabilidad**: Estructura que permite agregar nuevos módulos sin afectar los existentes
- **Mantenimiento**: Código más limpio y fácil de entender

### Para el frontend:
- **Centralización de API calls**: Uso único de cliente HTTP con interceptores
- **Mejora en gestion de sesiones**: TokenStorage centralizado
- **Separación de responsabilidades**: App.jsx deja de manejar detalles de socket y llamadas directas
- **Patron de features**: Organización por dominios (auth, hero, inventory, etc.)
- **Reducción de duplicación**: Eliminación de fetch directos y lectura de localStorage

## 4. Mantenimiento de compatibilidad durante la migración

### Estrategias implementadas:
- **Endpoints versionados**: Nuevos endpoints bajo `/api/v1` manteniendo los antiguos durante migración
- **Preservación del comportamiento**: Los endpoint publicos mantienen la misma funcionalidad
- **Migración por dominios**: Implementación incremental de módulos sin romper el sistema
- **Pruebas unitarias**: Tests para cada módulo migrado antes de continuar con el siguiente
- **Control de permisos**: Rutas admin ahora verifican roles/permisos reales
- **Validación centralizada**: Implementación de esquemas de validación por endpoint

### Compatibilidad funcional:
- No se rompen flujos existentes durante la transición
- Los cambios no afectan el comportamiento visible para usuarios finales
- Se mantiene compatibilidad con frontend durante la migración gradual