import React, { useState, useEffect } from 'react';
import Auth from './components/Auth';
import RaceSelection from './components/RaceSelection';
import Dashboard from './components/Dashboard';
import WelcomeBack from './components/WelcomeBack';
import GameLayout from './components/layout/GameLayout';

function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('auth'); 

  // CAMBIO 1: Usamos un booleano (true/false) en lugar de un contador.
  // "false" asegura que SIEMPRE empiece cerrada al cargar.
  const [isShopOpen, setIsShopOpen] = useState(false); 

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      setView('game'); 
    }
  }, []);

  const handleAuthSuccess = (userData, isRegistration) => {
    setUser(userData);
    if (isRegistration) {
      setView('race');
    } else {
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
    setIsShopOpen(false); // Aseguramos que se cierre al salir
  };

  // CAMBIO 2: Funciones directas para abrir y cerrar
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
        // Pasamos openShop al layout (para el botón de arriba)
        <GameLayout user={user} onLogout={handleLogout} onOpenShop={openShop}>
            {/* Pasamos el estado (isShopOpen) y la función de cerrar (closeShop) al Dashboard */}
            <Dashboard 
                user={user} 
                isShopOpen={isShopOpen} 
                onCloseShop={closeShop} 
            />
        </GameLayout>
      )}

    </div>
  );
}

export default App;