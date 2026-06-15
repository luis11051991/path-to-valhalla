# Frontend del Proyecto Path to Valhalla

## Descripción

El frontend del proyecto "Path to Valhalla" es una aplicación web desarrollada con React y Vite que proporciona la interfaz de usuario para el juego. Utiliza tecnologías modernas como Tailwind CSS para el diseño, Firebase para autenticación y almacenamiento, y Socket.IO para comunicación en tiempo real.

## Estructura del Proyecto

```
frontend/
├── public/                 # Archivos estáticos
│   ├── backgrounds/
│   ├── classes/
│   ├── decors/
│   ├── enemies/
│   ├── icons/
│   ├── images/
│   ├── items/
│   ├── locations/
│   ├── npcs/
│   ├── patterns/
│   ├── pets/
│   └── skills/
├── src/                    # Código fuente
│   ├── App.jsx             # Componente principal de la aplicación
│   ├── main.jsx            # Punto de entrada de la aplicación
│   ├── components/         # Componentes reutilizables
│   ├── pages/              # Páginas de la aplicación
│   ├── services/           # Servicios de la aplicación
│   ├── lib/                # Librerías y utilidades
│   ├── constants/          # Constantes globales
│   └── assets/             # Recursos estáticos
├── package.json            # Dependencias y scripts
└── vite.config.js          # Configuración de Vite
```

## Tecnologías Utilizadas

- **React 19**: Biblioteca para construir interfaces de usuario
- **Vite**: Herramienta de construcción rápida
- **Tailwind CSS**: Framework de estilos utilitarios
- **Firebase**: Plataforma para autenticación y almacenamiento
- **Socket.IO Client**: Para comunicación en tiempo real con el backend
- **React Router DOM**: Manejo de rutas
- **Zustand**: Gestor de estado global

## Funcionamiento

La aplicación sigue un flujo de navegación basado en el estado del usuario:

1. **Autenticación**: El usuario inicia sesión usando Firebase (Google o correo/contraseña)
2. **Selección de Raza**: Después de autenticarse, el usuario selecciona su raza
3. **Bienvenida**: Se muestra una pantalla de bienvenida con información del personaje
4. **Juego**: Acceso al menú principal con las siguientes secciones:
   - Vista general del héroe
   - Expediciones
   - Paquetes
   - Mercado
   - Taller
   - Banco
   - Salón de la Valhalla
   - Grimoire (hechizos)
   - Bestiario
   - Mensajería

## Variables de Entorno

Para ejecutar el frontend correctamente, se requieren las siguientes variables de entorno en el archivo `.env`:

```env
# Configuración de Firebase
VITE_FIREBASE_API_KEY=AIzaSyD8uB80EmzkMUAILXdVWLOtLL0hIAA7qJc
VITE_FIREBASE_AUTH_DOMAIN=path-to-valhalla.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=path-to-valhalla
VITE_FIREBASE_STORAGE_BUCKET=path-to-valhalla.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=109648813411
VITE_FIREBASE_APP_ID=1:109648813411:web:d1e3364b24e765f5820756
VITE_FIREBASE_MEASUREMENT_ID=G-HEKBL43R72

# Configuración de la API (opcional)
VITE_API_BASE_URL=http://localhost:3000
```

## Scripts Disponibles

- `npm run dev`: Inicia el servidor de desarrollo
- `npm run build`: Construye la aplicación para producción
- `npm run lint`: Ejecuta el linter
- `npm run preview`: Previsualiza la aplicación construida

## Comunicación con el Backend

La aplicación se comunica con el backend a través de una API REST en el puerto 3000 (por defecto). La configuración del proxy en Vite redirige las solicitudes a `/api` al servidor backend.

## Estado Global

El estado de la aplicación se gestiona utilizando Zustand, un gestor de estado ligero para React. Esto permite compartir datos entre componentes de forma eficiente sin necesidad de props drilling.

## Componentes Principales

- `App.jsx`: Componente principal que maneja el estado y las rutas
- `GameLayout.jsx`: Layout principal con barra superior y menú lateral
- `Auth.jsx`: Componente de autenticación
- `RaceSelection.jsx`: Selección de raza del personaje
- `WelcomeBack.jsx`: Pantalla de bienvenida

## Notas Adicionales

- El frontend está configurado para funcionar en conjunto con el backend en `http://localhost:3000`
- Se utiliza Socket.IO para la comunicación en tiempo real entre el cliente y el servidor
- La aplicación es responsive y se adapta a diferentes tamaños de pantalla
```
