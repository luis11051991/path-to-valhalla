import React, { useCallback, useEffect, useState } from "react";
// 1. Importamos las herramientas del Router
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Auth from "./components/Auth";
import RaceSelection from "./components/RaceSelection";
import HeroOverview from "./pages/HeroOverview";
import Expeditions from "./pages/Expeditions";
import Packages from "./pages/Packages";
import Market from "./pages/Market";
import Workshop from "./pages/Workshop";
import Bank from "./pages/Bank";
import ValhallaHall from "./pages/ValhallaHall";
import WelcomeBack from "./components/WelcomeBack";
import GameLayout from "./components/layout/GameLayout";
import OnixShopModal from "./components/OnixShopModal";
import Grimoire from "./pages/Grimoire";
import Bestiary from "./pages/Bestiary";
import MessagingPage from "./pages/MessagingPage";
import { apiUrl } from "./constants/api";
import { signOutFirebase } from "./lib/firebase";

import { io } from "socket.io-client";
import { messageService } from "./services/messageService";

function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("auth"); // 'auth', 'race', 'welcome_back', 'game'
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [socket, setSocket] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const clearLocalSession = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUnreadCount(0);
    setUser(null);
    setView("auth");
    setSocket((currentSocket) => {
      currentSocket?.disconnect();
      return null;
    });
  }, []);

  const handleUserUpdate = useCallback((updatedData) => {
    setUser((currentUser) => {
      const newUserState = { ...(currentUser || {}), ...updatedData };
      localStorage.setItem("user", JSON.stringify(newUserState));
      return newUserState;
    });
  }, []);

  const updateUnreadCount = useCallback(async () => {
    try {
      const count = await messageService.getUnreadCount();
      setUnreadCount(count);
    } catch (error) {
      console.log("Error cargando mensajes no leidos:", error);
      setUnreadCount(0);
    }
  }, []);

  const initSocket = useCallback((token) => {
    if (!token) return null;

    const newSocket = io(apiUrl(""), {
      auth: { token },
    });

    newSocket.on("connect", () => console.log("Socket conectado"));
    newSocket.on("new_message", () => {
      void updateUnreadCount();
    });
    newSocket.on("message_read", () => {
      void updateUnreadCount();
    });

    setSocket((currentSocket) => {
      currentSocket?.disconnect();
      return newSocket;
    });

    return newSocket;
  }, [updateUnreadCount]);

  // --- LÓGICA DE SESIÓN ---
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const token = localStorage.getItem("token");

    if (!storedUser || !token) {
      return undefined;
    }

    let cancelled = false;
    let activeSocket = null;

    const restoreSession = async () => {
      try {
        const parsedUser = JSON.parse(storedUser);
        if (cancelled) return;

        setUser(parsedUser);
        setView(!parsedUser.race ? "race" : "game");

        activeSocket = initSocket(token);
        await updateUnreadCount();

        const response = await fetch(apiUrl("/api/auth/profile"), {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Sesion expirada");
        }

        const data = await response.json();
        if (!cancelled && data.user) {
          handleUserUpdate(data.user);
          setView(!data.user.race ? "race" : "game");
        }
      } catch (error) {
        console.log("Error validando sesi\u00f3n:", error);
        if (!cancelled) {
          clearLocalSession();
        }
      }
    };

    void restoreSession();

    return () => {
      cancelled = true;
      activeSocket?.disconnect();
    };
  }, [clearLocalSession, handleUserUpdate, initSocket, updateUnreadCount]);

  const handleAuthSuccess = (userData, isRegistration) => {
    setUser(userData);
    localStorage.setItem("user", JSON.stringify(userData));
    const token = localStorage.getItem("token");

    if (token) {
      initSocket(token);
      updateUnreadCount();
    }

    // Si no tiene raza, forzar creacion de personaje
    if (isRegistration || !userData.race) {
      setView("race");
    } else {
      setView("welcome_back");
    }
  };

  const handleRaceSelected = (updatedUserData) => {
    setUser(updatedUserData);
    localStorage.setItem("user", JSON.stringify(updatedUserData));
    setView("game");
  };

  // --- Logout con Firebase Auth ---
  const handleLogout = async () => {
    try {
      await signOutFirebase();
    } catch (e) {
      console.log("Error en logout:", e);
    }
    clearLocalSession();
    setIsShopOpen(false);
  };

  const openShop = () => setIsShopOpen(true);
  const closeShop = () => setIsShopOpen(false);

  // --- RENDERIZADO ---

  if (view === "auth") return <Auth onLoginSuccess={handleAuthSuccess} />;
  if (view === "race") return <RaceSelection onRaceSelect={handleRaceSelected} />;
  if (view === "welcome_back" && user) return <WelcomeBack user={user} onComplete={() => setView("game")} />;

  // AQUÍ COMIENZA EL ROUTER (Solo cuando el usuario ya entró al juego)
  if (view === "game" && user) {
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
                element={<Packages user={user} token={localStorage.getItem("token")} onUpdateUser={handleUserUpdate} />}
              />

              {/* Bestiario */}
              <Route
                path="/bestiary"
                element={<Bestiary user={user} onUpdateUser={handleUserUpdate} />}
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

              {/* Ruta comodín: Si la URL no existe, vuelve a /hero */}
              <Route path="*" element={<Navigate to="/hero" replace />} />
            </Routes>
          </GameLayout>

          <OnixShopModal isOpen={isShopOpen} onClose={closeShop} />
        </div>
      </BrowserRouter>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center text-amber-500 font-bold animate-pulse">
      Cargando Valhalla...
    </div>
  );
}

export default App;
