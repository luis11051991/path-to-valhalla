# Técnico Inventario y Baseline - Path to Valhalla

## Mapa de Endpoints Actuales

### Endpoint de Autenticación
- `POST /api/auth/register` - Registro de usuario
- `POST /api/auth/login` - Login de usuario  
- `GET /api/auth/profile` - Perfil de usuario (protegido)

### Endpoints del Jugador/Personaje
- `POST /api/choose-race` - Elección de raza
- `POST /api/train-stats` - Entrenar estadísticas
- `POST /api/rent-bag` - Alquilar mochila

### Endpoints de Habilidades
- `GET /api/my-skills` - Habilidades del usuario (protegido)
- `POST /api/equip-skill` - Equipar habilidad (protegido)
- `POST /api/skills/upgrade` - Mejorar habilidad (protegido)

### Endpoints de Mascotas
- `GET /api/my-pets` - Mascotas del usuario (protegido)
- `POST /api/equip-pet` - Equipar mascota (protegido)
- `POST /api/feed-pet` - Alimentar mascota (protegido)

### Endpoints de Fondos
- `GET /api/backgrounds` - Fondos disponibles
- `POST /api/equip-background` - Equipar fondo
- `POST /api/buy-background` - Comprar fondo

### Endpoints de Inventario
- `POST /api/inventory/move` - Mover ítems (protegido)
- `POST /api/inventory/organize` - Organizar inventario (protegido)
- `POST /api/inventory/use` - Usar ítem (protegido)

### Endpoints de Evolución
- `GET /api/evolution/options` - Opciones de evolución (protegido)
- `POST /api/evolution/start` - Iniciar evolución (protegido)

### Endpoints de Expediciones
- `GET /api/expeditions` - Zonas de expedición (protegido)
- `GET /api/expeditions/:zoneId/enemies` - Enemigos en zona (protegido)
- `POST /api/expeditions/start` - Iniciar batalla de expedición (protegido)

### Endpoints de Paquetes
- `GET /api/packages/my-packages` - Paquetes del usuario (protegido)
- `POST /api/packages/claim` - Reclamar paquete (protegido)

### Endpoints de Tienda
- `GET /api/shop/items` - Ítems de tienda (protegido)
- `POST /api/shop/refresh` - Refrescar stock de tienda (protegido)
- `POST /api/shop/buy` - Comprar ítem (protegido)
- `POST /api/shop/sell` - Vender ítem (protegido)

### Endpoints de Talleres
- `GET /api/workshop` - Datos del taller (protegido)
- `POST /api/workshop/choose` - Elegir profesión (protegido)
- `POST /api/workshop/craft` - Crear ítem (protegido)

### Endpoints de Misiones
- `GET /api/quests/status` - Estado de misiones (protegido)
- `POST /api/quests/accept` - Aceptar misión (protegido)
- `POST /api/quests/complete` - Completar misión (protegido)

### Endpoints del Banco
- `GET /api/bank/status` - Estado del banco (protegido)
- `POST /api/bank/deposit` - Depositar ítem (protegido)
- `POST /api/bank/withdraw` - Retirar ítem (protegido)

### Endpoints de Bestiary
- `GET /api/bestiary` - Entradas del bestiary (protegido)

### Endpoints de Mensajería
- `POST /api/messages/send` - Enviar mensaje (protegido)
- `GET /api/messages/` - Obtener mensajes (protegido)
- `GET /api/messages/unread` - Contador de no leídos (protegido)
- `POST /api/messages/read` - Marcar como leído (protegido)

### Otros Endpoints
- `GET /api/search-users` - Buscar usuarios
- `POST /api/admin/give-item` - Dar ítem (solo admin)

## Consumidores de API Frontend

### Componente MessagingPage.jsx
- `/api/messages/send` - Enviar mensaje
- `/api/messages/` - Obtener mensajes
- `/api/messages/read` - Marcar como leído
- `/api/messages/unread` - Contador no leídos
- `/api/search-users?q=query` - Búsqueda de usuarios

### Componente App.jsx
- `/api/messages/unread` - Actualizar contador de mensajes no leídos

## Checklist de Smoke Tests Críticos

1. **Autenticación**
   - [ ] Registro de nuevo usuario
   - [ ] Inicio de sesión con credenciales correctas
   - [ ] Recuperación de perfil de usuario

2. **Funcionalidades Básicas del Personaje**
   - [ ] Elección de raza al registrar
   - [ ] Entrenamiento de estadísticas
   - [ ] Alquiler de mochila

3. **Sistema de Inventario**
   - [ ] Visualización de ítems disponibles
   - [ ] Movimiento de ítems entre slots
   - [ ] Organización de inventario

4. **Sistema de Mensajería**
   - [ ] Envío de mensaje entre usuarios
   - [ ] Recepción de mensajes
   - [ ] Marcar mensajes como leídos
   - [ ] Obtener contador de mensajes no leídos

5. **Funcionalidades Especiales**
   - [ ] Elección de habilidades y mascotas
   - [ ] Uso de ítems del inventario
   - [ ] Acceso al sistema de tienda
   - [ ] Compra y venta de ítems

## Endpoints Legacy a Conservar Temporalmente

Los siguientes endpoints legacy deben mantenerse durante la migración:

1. `POST /api/register` - Registro (legacy)
2. `POST /api/login` - Login (legacy) 
3. `GET /api/backgrounds` - Obtener fondos (se usa en vistas antiguas)
4. `GET /api/search-users` - Búsqueda de usuarios (se usa en vistas antiguas)

Estos endpoints serán reemplazados por los nuevos endpoints en `/api/v1` una vez que el frontend se haya migrado completamente.