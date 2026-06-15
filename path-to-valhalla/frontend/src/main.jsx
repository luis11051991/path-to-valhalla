import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Crear cliente HTTP global para todas las llamadas
window.apiClient = {
  // Esta será la implementación real del cliente que usamos en el frontend (desde shared/api/client.js)
  // Por ahora definimos un stub básico
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
