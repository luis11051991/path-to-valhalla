import React from 'react';
// IMPORTANTE: Usamos ./ porque están en la misma carpeta 'layout'
import TopBar from './TopBar'; 
import Sidebar from './Sidebar'; 

const GameLayout = ({ user, onLogout, onOpenShop, children }) => {
  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden text-slate-100 font-sans">
      
      {/* 1. BARRA LATERAL (Izquierda) */}
      {/* Al ponerlo primero en un contenedor flex, aparece a la izquierda */}
      <Sidebar />

      {/* 2. CONTENEDOR PRINCIPAL (Derecha) */}
      <div className="flex-1 flex flex-col relative min-w-0">
        
        {/* BARRA SUPERIOR (Con el botón de tienda conectado) */}
        <TopBar 
            user={user} 
            onLogout={onLogout} 
            onOpenShop={onOpenShop} 
        />
        
        {/* CONTENIDO DEL JUEGO (Dashboard, Inventario, etc.) */}
        <main className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-amber-900 scrollbar-track-slate-900 relative z-0">
           {children}
        </main>

      </div>
    </div>
  );
};

export default GameLayout;