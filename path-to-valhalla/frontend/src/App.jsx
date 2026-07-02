import React, { useState, useEffect } from 'react';
// 1. Importamos las herramientas del Router
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import Auth from './components/Auth';
import RaceSelection from './components/RaceSelection';
import HeroOverview from './pages/HeroOverview';
import Expeditions from './pages/Expeditions';
import Packages from './pages/Packages';
import Market from './pages/Market';
import Workshop from './pages/Workshop';
import Bank from './pages/Bank';
import BlackMarket from './pages/BlackMarket';
import BountyBoard from './pages/BountyBoard';
import Auction from './pages/Auction';
import ValhallaHall from './pages/ValhallaHall';
import WelcomeBack from './components/WelcomeBack';
import GameLayout from './components/layout/GameLayout';
import OnixShopModal from './components/OnixShopModal';
import Grimoire from './pages/Grimoire';
import Bestiary from './pages/Bestiary';
import MessagingPage from './pages/MessagingPage';
import AchievementsPage from './pages/Achievements';
import StatisticsPage from './pages/Statistics';
import { apiUrl } from './constants/api';

import { io } from 'socket.io-client';
import { messageService } from './services/messageService';

function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('auth'); // 'auth', 'race', 'welcome_back', 'game'
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [socket, setSocket] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // --- LÓGICA DE SESIÓN ---
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');

    if (storedUser && token) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      setView('game');
      // Iniciar socket y datos
      initSocket(token);
      updateUnreadCount();

      fetch(apiUrl('/api/auth/profile'), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'x-auth-token': token }
      })
        .then(res => res.ok ? res.json() : Promise.reject('Sesión expirada'))
        .then(data => data.user && handleUserUpdate(data.user))
        .catch(err => console.log("Error validando sesión:", err));
    }
  }, []);

  const initSocket = (token) => {
    // Conexión socket
    const newSocket = io(apiUrl(''), {
      auth: { token }
    });

    newSocket.on('connect', () => console.log("Socket conectado"));

    // Escuchar nuevos mensajes GLOBALMENTE para el contador
    newSocket.on('new_message', () => {
      updateUnreadCount();
      // Opcional: Sonido de notificación
    });

    setSocket(newSocket);
  };

  const updateUnreadCount = async () => {
    const count = await messageService.getUnreadCount();
    setUnreadCount(count);
  };

  const handleAuthSuccess = (userData, isRegistration) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    const token = localStorage.getItem('token');

    // Iniciar socket al login
    if (token) {
      initSocket(token);
      updateUnreadCount();
    }

    if (isRegistration) setView('race');
    else setView('welcome_back');
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
  };

  const openShop = () => setIsShopOpen(true);
  const closeShop = () => setIsShopOpen(false);

  // --- RENDERIZADO ---

  if (view === 'auth') return <Auth onLoginSuccess={handleAuthSuccess} />;
  if (view === 'race') return <RaceSelection onRaceSelect={handleRaceSelected} />;
  if (view === 'welcome_back' && user) return <WelcomeBack user={user} onComplete={() => setView('game')} />;

  // AQUÍ COMIENZA EL ROUTER (Solo cuando el usuario ya entró al juego)
  if (view === 'game' && user) {
    return (
      <BrowserRouter>
        <div className="w-full h-full font-sans text-slate-100">
          <GameLayout
            user={user}
            unreadCount={unreadCount} // <--- Pasamos el contador
            onLogout={handleLogout}
            onOpenShop={openShop}
          >
            <Routes>
              {/* Redirección: Si entras a la raíz, te manda a Visión General */}
              <Route path="/" element={<Navigate to="/hero" replace />} />

              {/* --- RUTAS DEL JUEGO --- */}

              {/* Visión General (AHORA USA HeroOverview) */}
              <Route
                path="/hero"
                element={<HeroOverview user={user} onUpdateUser={handleUserUpdate} />}
              />

              {/* Grimorio */}
              <Route
                path="/grimoire"
                element={<Grimoire user={user} onUpdateUser={handleUserUpdate} />}
              />

              {/* Inventario (Paquetes) */}
              <Route
                path="/inventory"
                element={<Packages user={user} token={localStorage.getItem('token')} onUpdateUser={handleUserUpdate} />}
              />

              {/* Bestiario */}
              <Route
                path="/bestiary"
                element={<Bestiary user={user} onUpdateUser={handleUserUpdate} />}
              />

              {/* Logros */}
              <Route
                path="/achievements"
                element={<AchievementsPage user={user} onUpdateUser={handleUserUpdate} />}
              />

              {/* Estadísticas */}
              <Route
                path="/statistics"
                element={<StatisticsPage user={user} />}
              />

              {/* Mensajería */}
              <Route
                path="/messages"
                element={<MessagingPage user={user} socket={socket} onMessageRead={updateUnreadCount} />}
              />

              {/* Aventura */}
              <Route
                path="/expeditions"
                element={<Expeditions user={user} onUpdateUser={handleUserUpdate} />}
              />

              <Route
                path="/valhalla"
                element={<ValhallaHall user={user} onUpdateUser={handleUserUpdate} />}
              />

              {/* Ciudad */}
              <Route
                path="/market"
                element={<Market user={user} onUpdateUser={handleUserUpdate} />}
              />
              <Route
                path="/workshop"
                element={<Workshop user={user} onUpdateUser={handleUserUpdate} />}
              />
              <Route
                path="/bank"
                element={<Bank user={user} onUpdateUser={handleUserUpdate} />}
              />
              <Route
                path="/black-market"
                element={<BlackMarket user={user} />}
              />
              <Route
                path="/bounty-board"
                element={<BountyBoard user={user} />}
              />
              <Route
                path="/auction"
                element={<Auction user={user} />}
              />

              {/* Ruta comodín: Si la URL no existe, vuelve a /hero */}
              <Route path="*" element={<Navigate to="/hero" replace />} />
            </Routes>
          </GameLayout>

          <OnixShopModal isOpen={isShopOpen} onClose={closeShop} />
        </div>
      </BrowserRouter>
    );
  }

  return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-amber-500 font-bold animate-pulse">Cargando Valhalla...</div>;
}

export default App;
