import React, { useState, useEffect } from 'react';
import Auth from './components/Auth';
import RaceSelection from './components/RaceSelection';
import Dashboard from './components/Dashboard';
import WelcomeBack from './components/WelcomeBack';
import GameLayout from './components/layout/GameLayout';

function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('auth'); 
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
    localStorage.setItem('user', JSON.stringify(userData)); // Guardar en persistencia
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

  // --- NUEVA FUNCIÓN PARA ACTUALIZAR ESTADO EN TIEMPO REAL ---
  const handleUserUpdate = (updatedData) => {
    // Fusionamos los datos viejos con los nuevos para no perder nada
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
        <GameLayout user={user} onLogout={handleLogout} onOpenShop={openShop}>
            {/* Pasamos handleUserUpdate al Dashboard */}
            <Dashboard 
                user={user} 
                isShopOpen={isShopOpen} 
                onCloseShop={closeShop}
                onUpdateUser={handleUserUpdate} // <--- AQUÍ ESTÁ LA CLAVE
            />
        </GameLayout>
      )}

    </div>
  );
}

export default App;