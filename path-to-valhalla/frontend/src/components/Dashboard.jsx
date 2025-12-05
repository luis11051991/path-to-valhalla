import React, { useMemo } from 'react';
import { User, Shield, Zap, Coins, LogOut } from 'lucide-react';
import { RACES } from '../constants/races';

const Dashboard = ({ user, onLogout }) => {
  
  const raceData = useMemo(() => {
    return RACES.find(r => r.id === user.race) || RACES[0];
  }, [user.race]);

  const getAvatarImage = () => {
    return raceData.image;
  };

  return (
    <div className="min-h-screen relative bg-slate-950 text-slate-100 overflow-hidden font-sans">
      
      {/* --- FONDO DINÁMICO POR RAZA --- */}
      <div className="absolute inset-0 z-0">
        <img 
          src={raceData.bgImage} 
          alt="Race Background" 
          // CAMBIO 1: Quitamos 'opacity-40' para que se vea el color real de la imagen
          // Aumentamos blur ligeramente para que no compita con el texto
          className="w-full h-full object-cover blur-[2px] scale-105"
        />
        {/* CAMBIO 2: Redujimos la capa negra de /90 a /40 para que el fondo se note mucho más */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-slate-900/30 to-slate-950/80" />
      </div>

      {/* --- CONTENIDO PRINCIPAL --- */}
      <div className="relative z-10 max-w-6xl mx-auto p-6">
        
        {/* HEADER DEL PERSONAJE */}
        <header className="flex flex-col md:flex-row justify-between items-center mb-10 border-b border-white/10 pb-6 gap-4">
          
          <div className="flex items-center gap-6">
            {/* AVATAR CIRCULAR DINÁMICO */}
            <div className="relative group cursor-pointer">
                {/* Anillo exterior */}
                <div className="absolute -inset-1 rounded-full border-2 border-dashed border-amber-500/30 animate-[spin_10s_linear_infinite]" />
                
                {/* Contenedor de la imagen */}
                <div className="w-24 h-24 rounded-full border-2 border-amber-500 bg-slate-900 overflow-hidden shadow-[0_0_20px_rgba(245,158,11,0.3)] relative z-10">
                    <img 
                        src={getAvatarImage()} 
                        alt="Avatar" 
                        // CAMBIO 3: 'object-top' asegura que se vea la CABEZA y hombros, no la cintura.
                        className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-110"
                    />
                </div>
                
                {/* Etiqueta de Nivel */}
                <div className="absolute -bottom-2 -right-2 bg-slate-900 border border-amber-500 text-amber-500 text-xs font-bold px-2 py-1 rounded-full shadow-lg z-20">
                    LV {user.level}
                </div>
            </div>

            {/* INFO DE TEXTO */}
            <div className="text-center md:text-left">
              <h1 className="text-4xl font-serif text-amber-500 tracking-wide drop-shadow-md text-shadow-lg">
                {user.username}
              </h1>
              <div className="flex items-center gap-2 text-slate-200 text-sm uppercase tracking-widest mt-1 justify-center md:justify-start font-medium shadow-black drop-shadow-md">
                <span className="text-white font-bold">{raceData.name}</span>
                <span className="text-amber-500">•</span>
                <span>{user.class_path === 'novice' ? 'Novato' : user.class_path}</span>
              </div>
            </div>
          </div>

          {/* BOTÓN SALIR */}
          <button 
            onClick={onLogout}
            className="flex items-center gap-2 px-5 py-2 border border-red-500/30 bg-black/20 text-red-400 hover:bg-red-900/40 hover:border-red-500 rounded-full transition-all text-sm uppercase tracking-wide group backdrop-blur-sm"
          >
            <LogOut size={16} className="group-hover:-translate-x-1 transition-transform" />
            Cerrar Sesión
          </button>
        </header>

        {/* --- BARRA DE RECURSOS (HUD) --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          
          {/* Energía PvE */}
          <div className="bg-black/40 backdrop-blur-md p-4 rounded-lg border border-white/10 flex items-center gap-4 hover:border-blue-500/50 transition-colors group shadow-lg">
            <div className="p-3 bg-blue-900/30 rounded-full text-blue-400 group-hover:scale-110 transition-transform shadow-[0_0_10px_rgba(59,130,246,0.2)]">
                <Shield size={24} />
            </div>
            <div>
              <p className="text-[10px] text-slate-300 uppercase tracking-wider font-bold">Energía de Aventura</p>
              <div className="flex items-end gap-2">
                  <span className="text-2xl font-bold text-white drop-shadow-sm">{user.energy}</span>
                  <span className="text-sm text-slate-400 mb-1">/ 100</span>
              </div>
              <div className="w-full h-1.5 bg-slate-700/50 rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" style={{ width: `${user.energy}%` }}></div>
              </div>
            </div>
          </div>

          {/* Valor PvP */}
          <div className="bg-black/40 backdrop-blur-md p-4 rounded-lg border border-white/10 flex items-center gap-4 hover:border-red-500/50 transition-colors group shadow-lg">
            <div className="p-3 bg-red-900/30 rounded-full text-red-400 group-hover:scale-110 transition-transform shadow-[0_0_10px_rgba(239,68,68,0.2)]">
                <Zap size={24} />
            </div>
            <div>
              <p className="text-[10px] text-slate-300 uppercase tracking-wider font-bold">Valor de Coliseo</p>
              <div className="flex items-end gap-2">
                  <span className="text-2xl font-bold text-white drop-shadow-sm">{user.valor}</span>
                  <span className="text-sm text-slate-400 mb-1">/ 5</span>
              </div>
              <div className="w-full h-1.5 bg-slate-700/50 rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" style={{ width: `${(user.valor / 5) * 100}%` }}></div>
              </div>
            </div>
          </div>

          {/* Economía */}
          <div className="bg-black/40 backdrop-blur-md p-4 rounded-lg border border-white/10 flex items-center gap-4 hover:border-amber-500/50 transition-colors group shadow-lg">
            <div className="p-3 bg-amber-900/30 rounded-full text-amber-400 group-hover:scale-110 transition-transform shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                <Coins size={24} />
            </div>
            <div>
              <p className="text-[10px] text-slate-300 uppercase tracking-wider font-bold">Tesorería</p>
              <div className="flex items-baseline gap-3 mt-1">
                  <span className="text-xl font-bold text-amber-400 drop-shadow-sm">{user.gold} <span className="text-[10px] text-slate-400 font-normal">ORO</span></span>
                  <span className="text-lg font-bold text-slate-300 drop-shadow-sm">{user.silver} <span className="text-[10px] text-slate-500 font-normal">PLATA</span></span>
              </div>
            </div>
          </div>
        </div>

        {/* --- ÁREA DE JUEGO (PANEL CENTRAL) --- */}
        <div className="bg-black/30 backdrop-blur-md rounded-xl border border-white/10 min-h-[500px] flex flex-col items-center justify-center p-10 text-center shadow-2xl">
          
          <h2 className="text-3xl font-serif text-white mb-4 drop-shadow-lg">El mundo aguarda, {raceData.name}</h2>
          <p className="text-slate-300 max-w-lg mx-auto mb-8 drop-shadow-md">
            Tu campamento ha sido establecido. Desde aquí podrás partir a expediciones, entrenar tus habilidades o desafiar a otros jugadores.
          </p>

          <div className="flex gap-4">
            <button className="px-8 py-3 bg-slate-800/80 hover:bg-slate-700 text-slate-200 rounded border border-slate-600 transition-all backdrop-blur-sm">
                Inventario
            </button>
            <button className="px-8 py-3 bg-amber-700/90 hover:bg-amber-600 text-white font-bold rounded border border-amber-500 shadow-lg shadow-amber-900/40 transition-all backdrop-blur-sm">
                Ir de Expedición
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};

export default Dashboard;