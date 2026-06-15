# Backend - Path to Valhalla

## Descripción

El backend de Path to Valhalla es una aplicación Node.js construida con Express.js que proporciona una API RESTful para gestionar el juego. Implementa la lógica del juego, autenticación, gestión de usuarios, inventario, misiones, expediciones y otros componentes del sistema.

## Estructura del Proyecto

```
backend/
├── src/
│   ├── app.js                 # Configuración principal de Express
│   ├── server.js              # Punto de entrada del servidor
│   ├── socket.js              # Configuración de Socket.IO
│   ├── config/                # Configuraciones del sistema
│   │   ├── cors.js            # Configuración CORS
│   │   ├── db.js              # Configuración de base de datos Firestore
│   │   ├── env.js             # Validación y configuración de variables de entorno
│   │   └── firebaseAdmin.js   # Configuración Firebase Admin SDK
│   ├── controllers/           # Controladores para cada recurso
│   ├── middleware/            # Middlewares personalizados
│   ├── routes/                # Definición de rutas
│   ├── modules/               # Módulos de negocio
│   ├── seeds/                 # Datos iniciales del juego
│   └── utils/                 # Funciones utilitarias
├── public/
└── package.json
```

## Tecnologías Utilizadas

- **Node.js**: Entorno de ejecución
- **Express.js**: Framework web
- **Firebase Admin SDK**: Acceso a Firestore y autenticación
- **Socket.IO**: Comunicación en tiempo real
- **JWT**: Autenticación basada en tokens
- **Bcryptjs**: Encriptación de contraseñas
- **Helmet**: Protección de headers HTTP
- **Cors**: Manejo de políticas CORS

## Variables de Entorno

Para ejecutar el backend, se requieren las siguientes variables de entorno definidas en un archivo `.env`:

### Obligatorias

```env
# Clave secreta para JWT (debe tener al menos 32 caracteres)
JWT_SECRET=clave_secreta_segura_aqui

# Orígenes permitidos para CORS (separados por coma)
ALLOWED_ORIGINS=http://localhost:5173,https://tuapp.com
```

### Opcionales

```env
# Puerto del servidor (por defecto 3000)
PORT=3000

# Nivel de log (info, debug, warn, error)
LOG_LEVEL=info

# Configuración de limitador de tasa
RATE_LIMIT_WINDOW=900000    # 15 minutos en ms
RATE_LIMIT_MAX=100          # Máximo de peticiones por ventana

# Configuración de Firebase Admin (se puede usar una de las dos opciones)
FIREBASE_ADMIN_TYPE=service_account
FIREBASE_ADMIN_PROJECT_ID=tu-proyecto-id
FIREBASE_ADMIN_PRIVATE_KEY_ID=clave-privada-id
FIREBASE_ADMIN_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
FIREBASE_ADMIN_CLIENT_EMAIL=correo@proyecto.iam.gserviceaccount.com
FIREBASE_ADMIN_CLIENT_ID=123456789012345678901
FIREBASE_ADMIN_AUTH_URI=https://accounts.google.com/o/oauth2/auth
FIREBASE_ADMIN_TOKEN_URI=https://oauth2.googleapis.com/token
FIREBASE_ADMIN_AUTH_PROVIDER_X509_CERT_URL=https://www.googleapis.com/oauth2/v1/certs
FIREBASE_ADMIN_CLIENT_X509_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/correo@proyecto.iam.gserviceaccount.com

# O alternativamente, puedes usar esta variable con las credenciales en formato JSON:
# FIREBASE_ADMIN_CREDENTIALS={"type":"service_account", ...}
```

## Rutas Disponibles

### Autenticación
- `POST /api/v1/auth/register` - Registro de nuevo usuario
- `POST /api/v1/auth/login` - Inicio de sesión
- `POST /api/v1/auth/logout` - Cierre de sesión

### Jugador
- `GET /api/v1/player/profile` - Obtener perfil del jugador
- `PUT /api/v1/player/profile` - Actualizar perfil del jugador

### Inventario
- `GET /api/v1/inventory` - Obtener inventario del jugador
- `POST /api/v1/inventory` - Añadir item al inventario
- `DELETE /api/v1/inventory/:itemId` - Eliminar item del inventario

### Expediciones
- `GET /api/v1/expeditions` - Listar expediciones disponibles
- `POST /api/v1/expeditions/start` - Iniciar una expedición
- `GET /api/v1/expeditions/:id` - Obtener detalles de una expedición

### Misiones
- `GET /api/v1/quests` - Listar misiones
- `POST /api/v1/quests/complete` - Completar misión

### Tienda
- `GET /api/v1/shop/items` - Listar artículos de la tienda
- `POST /api/v1/shop/buy` - Comprar artículo

### Otros
- `GET /api/health` - Verificar estado del servidor
- `GET /api/ready` - Verificar si el servidor está listo

## Scripts Disponibles

```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  }
}
```

## Configuración de Desarrollo

1. Clonar el repositorio
2. Instalar dependencias: `npm install`
3. Crear archivo `.env` con las variables necesarias
4. Ejecutar en modo desarrollo: `npm run dev`
5. Ejecutar en modo producción: `npm start`

## Despliegue

El backend puede ser desplegado en cualquier plataforma compatible con Node.js, como:
- Heroku
- Vercel
- AWS
- Google Cloud Platform
- Azure

## Seguridad

- Autenticación mediante JWT
- Protección de headers HTTP con Helmet
- Limitador de tasa para prevenir ataques DDoS
- Validación de entradas y sanitización de datos
- Configuración CORS para controlar orígenes permitidos

## Notas Adicionales

- El backend se conecta a Firestore de Firebase para almacenamiento de datos
- Se utiliza Socket.IO para comunicación en tiempo real entre clientes y servidor
- Los datos iniciales del juego se cargan automáticamente al iniciar el servidor
- Las rutas están versionadas (`/api/v1/`) para facilitar futuras actualizaciones