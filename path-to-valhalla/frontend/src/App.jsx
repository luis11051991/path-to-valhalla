import React, { useState, useEffect } from 'react';
import Auth from './components/Auth';
import RaceSelection from './components/RaceSelection';
import Dashboard from './components/Dashboard';

function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('auth'); // 'auth', 'race', 'game'

  useEffect(() => {
    // Al cargar, revisar si hay sesión
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      // Si ya tiene sesión, asumimos que va al juego (o validamos raza si queremos ser estrictos)
      // Por simplicidad del flujo pedido: Login existente -> Juego
      setView('game'); 
    }
  }, []);

  // Función que se llama desde Auth.jsx cuando el usuario se loguea/registra
  const handleAuthSuccess = (userData, isRegistration) => {
    setUser(userData);
    
    if (isRegistration) {
      // FLUJO 1: Si se acaba de registrar -> Escoger Raza
      setView('race');
    } else {
      // FLUJO 2: Si es login normal -> Juego directo + Alerta
      alert(`¡Bienvenido de vuelta, guerrero ${userData.username}!`);
      setView('game');
    }
  };

  // Función que se llama desde RaceSelection.jsx cuando termina la bienvenida
  const handleRaceSelected = (updatedUserData) => {
    // Actualizamos los datos del usuario (ahora tiene raza)
    setUser(updatedUserData); 
    setView('game');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setView('auth');
  };

  return (
    <div className="w-full h-full font-sans text-slate-100">
      
      {view === 'auth' && (
        <Auth onLoginSuccess={handleAuthSuccess} />
      )}

      {view === 'race' && (
        <RaceSelection onRaceSelect={handleRaceSelected} />
      )}

      {view === 'game' && user && (
        <Dashboard user={user} onLogout={handleLogout} />
      )}

    </div>
  );
}

export default App;