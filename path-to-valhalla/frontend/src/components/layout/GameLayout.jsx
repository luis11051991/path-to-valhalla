import React, { useEffect, useState } from 'react';
// IMPORTANTE: Usamos ./ porque están en la misma carpeta 'layout'
import TopBar from './TopBar'; // Asegúrate de la ruta correcta según tu estructura
import Sidebar from './Sidebar';

const GameLayout = ({ user, onLogout, onOpenShop, onNavigate, currentView, children }) => {
  const [isMobile, setIsMobile] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCompact, setIsSidebarCompact] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleResize = () => {
      const small = window.innerWidth < 768;
      setIsMobile(small);
      if (small) {
        setIsSidebarOpen(false);
        setIsSidebarCompact(false);
      } else {
        setIsSidebarOpen(true);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleMobileSidebar = () => setIsSidebarOpen((prev) => !prev);
  const closeMobileSidebar = () => setIsSidebarOpen(false);
  const toggleCompactSidebar = () => setIsSidebarCompact((prev) => !prev);

  const sidebarIsOpen = isMobile ? isSidebarOpen : true;
  const sidebarIsCompact = !isMobile && isSidebarCompact;

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden text-slate-100 font-sans">

      {/* 1A. BARRA LATERAL DESKTOP */}
      <div className="hidden md:flex md:flex-shrink-0">
        <Sidebar
          user={user} // <--- ¡ESTO FALTABA! Pasamos el usuario al Sidebar
          onNavigate={onNavigate}
          currentView={currentView}
          isOpen={true}
          isCompact={sidebarIsCompact}
          isMobile={false}
          onToggleCompact={toggleCompactSidebar}
        />
      </div>

      {/* 1B. BARRA LATERAL MÓVIL */}
      <div className="md:hidden w-0 h-0">
        <Sidebar
          user={user} // <--- ¡AQUÍ TAMBIÉN!
          onNavigate={onNavigate}
          currentView={currentView}
          isOpen={sidebarIsOpen}
          isCompact={false}
          isMobile={true}
          onCloseMobile={closeMobileSidebar}
        />
      </div>

      {/* Overlay para móvil */}
      {isMobile && isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 md:hidden"
          onClick={closeMobileSidebar}
          aria-hidden
        />
      )}

      {/* 2. CONTENEDOR PRINCIPAL */}
      <div className="flex-1 flex flex-col relative min-w-0">
        <TopBar
          user={user}
          onLogout={onLogout}
          onOpenShop={onOpenShop}
          onToggleSidebar={toggleMobileSidebar}
          onToggleCompact={toggleCompactSidebar}
          isSidebarCompact={sidebarIsCompact}
        />

        <main className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-amber-900 scrollbar-track-slate-900 relative z-0">
          {children}
        </main>
      </div>
    </div>
  );
};

export default GameLayout;