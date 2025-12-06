import React, { useState, useEffect } from 'react';
import Auth from './components/Auth';
import RaceSelection from './components/RaceSelection';
import Dashboard from './components/Dashboard';
import WelcomeBack from './components/WelcomeBack'; // <--- 1. Importamos el nuevo componente
import GameLayout from './components/layout/GameLayout'; // <--- IMPORTAR

function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('auth'); // 'auth', 'race', 'welcome_back', 'game'

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      // Si refresca la página y ya tiene sesión, va directo al juego (sin intro para no molestar)
      setView('game'); 
    }
  }, []);

  const handleAuthSuccess = (userData, isRegistration) => {
    setUser(userData);
    
    if (isRegistration) {
      // CASO 1: REGISTRO NUEVO -> Va a selección de raza (Flujo que ya tenías)
      setView('race');
    } else {
      // CASO 2: LOGIN (Usuario existente) -> Va a la nueva pantalla de bienvenida
      // Eliminamos el alert() feo y ponemos esto:
      setView('welcome_back');
    }
  };

  const handleRaceSelected = (updatedUserData) => {
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
      
      {/* 1. LOGIN / REGISTRO */}
      {view === 'auth' && (
        <Auth onLoginSuccess={handleAuthSuccess} />
      )}

      {/* 2. SELECCIÓN DE RAZA (Solo nuevos) */}
      {view === 'race' && (
        <RaceSelection onRaceSelect={handleRaceSelected} />
      )}

      {/* 3. PANTALLA DE BIENVENIDA (Solo Login) */}
      {view === 'welcome_back' && user && (
        <WelcomeBack 
            user={user} 
            onComplete={() => setView('game')} // Cuando termina la barra, va al juego
        />
      )}

     {/* 4. EL JUEGO REAL (Ahora con Layout Estilo Gladiatus) */}
      {view === 'game' && user && (
        <GameLayout user={user} onLogout={handleLogout}>
            {/* Aquí adentro va la pantalla actual, por defecto Dashboard */}
            <Dashboard user={user} />
        </GameLayout>
      )}

    </div>
  );
}

export default App;