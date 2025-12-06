import React, { useMemo } from 'react';
import { Heart, Shield, Zap, Coins, Gem, LogOut } from 'lucide-react'; // Usamos iconos de lucide
import { RACES } from '../../constants/races';

const TopBar = ({ user, onLogout }) => {
  
  const raceData = useMemo(() => RACES.find(r => r.id === user.race) || RACES[0], [user.race]);
  
  // Cálculo de HP (Simulado por ahora basado en constitución)
  const maxHp = (user.stats?.constitution || 10) * 20;
  const currentHp = maxHp; 

  // Componente de Barra
  const StatBar = ({ colorClass, value, max, label }) => (
    <div className="flex flex-col w-24 lg:w-32 relative group">
      <div className="flex justify-between px-1 mb-0.5">
        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{label}</span>
        <span className="text-[9px] text-white font-mono">{value}/{max}</span>
      </div>
      <div className="h-2.5 bg-black/60 border border-slate-700/50 rounded-sm overflow-hidden shadow-inner relative">
        <div 
            className={`h-full ${colorClass} transition-all duration-500 shadow-[0_0_10px_currentColor]`} 
            style={{ width: `${Math.min((value / max) * 100, 100)}%` }}
        />
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-white/20"></div>
      </div>
    </div>
  );

  return (
    <header className="h-20 bg-slate-950 border-b border-amber-700/60 flex items-center justify-between px-4 shadow-[0_5px_20px_black] relative z-50">
      
      {/* Fondo Texturizado */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-slate-900 to-black opacity-90 z-0"></div>

      {/* --- IZQUIERDA: PERFIL --- */}
      <div className="relative z-10 flex items-center gap-4 pl-2 min-w-fit">
        <div className="relative shrink-0">
            <div className="w-12 h-12 rounded bg-black border-2 border-amber-600 shadow-[0_0_15px_rgba(245,158,11,0.2)] overflow-hidden">
                <img src={raceData.image} className="w-full h-full object-cover object-top" alt="Avatar" />
            </div>
            <div className="absolute -bottom-1.5 -right-1.5 bg-amber-900 text-amber-100 text-[9px] font-bold px-1.5 py-0.5 border border-amber-500 rounded shadow-md">
                {user.level}
            </div>
        </div>
        <div className="hidden sm:block">
            <h2 className="text-lg font-serif font-bold text-amber-500 tracking-wide drop-shadow-md leading-none">
                {user.username}
            </h2>
            <span className="text-[10px] text-slate-500 uppercase tracking-widest">
                {raceData.name}
            </span>
        </div>
      </div>

      {/* --- CENTRO: BARRAS (Solo visible en pantallas medianas+) --- */}
      <div className="relative z-10 hidden xl:flex items-center gap-6 bg-black/30 px-6 py-2 rounded border border-white/5 shadow-inner mx-4">
        <StatBar value={currentHp} max={maxHp} label="Vida" colorClass="bg-red-600" />
        <StatBar value={user.energy} max={100} label="Energía" colorClass="bg-blue-600" />
        <StatBar value={user.valor} max={5} label="Valor" colorClass="bg-orange-500" />
      </div>

      {/* --- DERECHA: ECONOMÍA (EL CAMBIO QUE PEDISTE) --- */}
      <div className="relative z-10 flex items-center gap-4 ml-auto bg-black/40 px-4 py-2 rounded border border-white/5 shadow-inner">
        
        {/* ORO */}
        <div className="flex items-center gap-1.5" title="Oro">
            <Coins size={14} className="text-amber-400 fill-amber-400/20" />
            <span className="text-amber-400 font-bold text-sm">{user.gold}</span>
            <span className="text-[10px] text-amber-600 font-bold uppercase hidden md:inline">Oro</span>
        </div>

        {/* PLATA */}
        <div className="flex items-center gap-1.5" title="Plata">
            <div className="w-3 h-3 rounded-full bg-slate-400 border border-slate-300 shadow-[0_0_5px_white]"></div>
            <span className="text-slate-300 font-bold text-sm">{user.silver}</span>
            <span className="text-[10px] text-slate-500 font-bold uppercase hidden md:inline">Plata</span>
        </div>

        {/* COBRE */}
        <div className="flex items-center gap-1.5" title="Cobre">
            <div className="w-3 h-3 rounded-full bg-orange-700 border border-orange-500 shadow-[0_0_5px_orange]"></div>
            <span className="text-orange-500 font-bold text-sm">{user.copper}</span>
            <span className="text-[10px] text-orange-700 font-bold uppercase hidden md:inline">Cobre</span>
        </div>

        {/* Separador */}
        <div className="h-4 w-px bg-white/10 mx-1"></div>

        {/* ONIX */}
        <div className="flex items-center gap-1.5" title="Onix">
            <Gem size={14} className="text-purple-400" />
            <span className="text-purple-300 font-bold text-sm">{user.onix || 0}</span>
            <span className="text-[10px] text-purple-500 font-bold uppercase hidden md:inline">Onix</span>
        </div>

      </div>

      {/* Botón Salir */}
      <button onClick={onLogout} className="relative z-10 ml-4 p-2 text-slate-500 hover:text-red-400 transition-colors" title="Cerrar Sesión">
        <LogOut size={18} />
      </button>

    </header>
  );
};

export default TopBar;