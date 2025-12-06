import React from 'react';
import TopBar from './TopBar';
import Sidebar from './Sidebar';

const GameLayout = ({ user, onLogout, children }) => {
  return (
    // Contenedor Maestro: Ocupa toda la pantalla, fondo oscuro base
    <div className="h-screen w-screen flex flex-col bg-black overflow-hidden relative">
      
      {/* 1. Cabecera (Fija arriba, Z-Index alto) */}
      <div className="shrink-0 relative z-50">
        <TopBar user={user} onLogout={onLogout} />
      </div>

      {/* 2. Cuerpo del Juego */}
      <div className="flex flex-1 overflow-hidden relative z-0">
        
        {/* Columna Izquierda (Sidebar) - Fija */}
        <div className="shrink-0 h-full relative z-40">
            <Sidebar />
        </div>

        {/* Área Principal (Scrollable) */}
        <main className="flex-1 relative overflow-y-auto overflow-x-hidden bg-slate-900">
            {/* Aquí es donde se muestra el Dashboard */}
            {children}
        </main>

      </div>
    </div>
  );
};

export default GameLayout;