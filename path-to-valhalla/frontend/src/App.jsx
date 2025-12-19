import React, { useState, useEffect } from 'react';
import Auth from './components/Auth';
import RaceSelection from './components/RaceSelection';
import Dashboard from './components/Dashboard';
import Expeditions from './components/Expeditions'; // <--- NUEVO IMPORT
import WelcomeBack from './components/WelcomeBack';
import GameLayout from './components/layout/GameLayout';
import { apiUrl } from './constants/api';

function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('auth');

  // --- NUEVO ESTADO: Controla qué pantalla se ve DENTRO del juego ---
  const [gameView, setGameView] = useState('dashboard'); // 'dashboard' o 'expeditions'

  const [isShopOpen, setIsShopOpen] = useState(false);

  // --- CARGA INICIAL INTELIGENTE ---
  useEffect(() => {
    // 1. Intentar cargar rápido desde localStorage
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');

    if (storedUser && token) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      setView('game');

      // 2. SILENCIOSAMENTE pedir datos frescos al servidor (Background Fetch)
      fetch(apiUrl('/api/auth/profile'), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token // Enviamos el token
        }
      })
        .then(res => {
          if (res.ok) return res.json();
          throw new Error('Sesión expirada');
        })
        .then(data => {
          if (data.user) {
            console.log("Datos actualizados desde el servidor");
            handleUserUpdate(data.user); // Actualizamos el estado con lo nuevo de la DB
          }
        })
        .catch(err => {
          console.log("Error validando sesión:", err);
        });
    }
  }, []);

  const handleAuthSuccess = (userData, isRegistration) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    if (isRegistration) {
      setView('race');
    } else {
      setView('welcome_back');
    }
  };

  const handleRaceSelected = (updatedUserData) => {
    setUser(updatedUserData);
    localStorage.setItem('user', JSON.stringify(updatedUserData));
    setView('game');
  };

  const handleUserUpdate = (updatedData) => {
    const newUserState = { ...user, ...updatedData };
    setUser(newUserState);
    localStorage.setItem('user', JSON.stringify(newUserState));
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setView('auth');
    setIsShopOpen(false);
    setGameView('dashboard'); // Resetear vista al salir
  };

  // --- NUEVA FUNCIÓN: Cambiar vista del juego ---
  const handleNavigate = (newView) => {
    setGameView(newView);
  };

  const openShop = () => setIsShopOpen(true);
  const closeShop = () => setIsShopOpen(false);

  return (
    <div className="w-full h-full font-sans text-slate-100">

      {view === 'auth' && <Auth onLoginSuccess={handleAuthSuccess} />}
      {view === 'race' && <RaceSelection onRaceSelect={handleRaceSelected} />}

      {view === 'welcome_back' && user && (
        <WelcomeBack user={user} onComplete={() => setView('game')} />
      )}

      {view === 'game' && user && (
        <GameLayout
          user={user}
          onLogout={handleLogout}
          onOpenShop={openShop}
          onNavigate={handleNavigate} // Pasamos la función al layout
          currentView={gameView}      // Pasamos la vista actual
        >
          {/* RENDERIZADO CONDICIONAL: Mostramos Dashboard o Expeditions */}
          {gameView === 'dashboard' && (
            <Dashboard
              user={user}
              isShopOpen={isShopOpen}
              onCloseShop={closeShop}
              onUpdateUser={handleUserUpdate}
            />
          )}

          {gameView === 'expeditions' && (
            <Expeditions
              user={user}
              onUpdateUser={handleUserUpdate}
            />
          )}

        </GameLayout>
      )}

    </div>
  );
}

export default App;