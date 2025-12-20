import React, { useState, useEffect } from 'react';
import Auth from './components/Auth';
import RaceSelection from './components/RaceSelection';
import Dashboard from './components/Dashboard';
import Expeditions from './components/Expeditions';
import Packages from './components/Packages';
import Market from './components/Market'; // <--- 1. NUEVO IMPORT
import WelcomeBack from './components/WelcomeBack';
import GameLayout from './components/layout/GameLayout';
import { apiUrl } from './constants/api';

function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('auth');
  const [gameView, setGameView] = useState('dashboard'); 
  const [isShopOpen, setIsShopOpen] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');

    if (storedUser && token) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      setView('game');

      fetch(apiUrl('/api/auth/profile'), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token 
        }
      })
        .then(res => {
          if (res.ok) return res.json();
          throw new Error('Sesión expirada');
        })
        .then(data => {
          if (data.user) {
            handleUserUpdate(data.user);
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
    setGameView('dashboard');
  };

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
          onNavigate={handleNavigate} 
          currentView={gameView}      
        >
          {/* RENDERIZADO CONDICIONAL */}
          
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

          {gameView === 'packages' && (
            <Packages 
                user={user}
                token={localStorage.getItem('token')}
                onUpdateUser={handleUserUpdate}
            />
          )}

          {/* --- 2. RENDERIZAR MERCADO --- */}
          {gameView === 'market' && (
            <Market 
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