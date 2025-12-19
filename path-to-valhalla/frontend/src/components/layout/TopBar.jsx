import React, { useMemo, useState, useEffect } from 'react';
import { Heart, Shield, Zap, Coins, Gem, LogOut } from 'lucide-react'; 
import { RACES } from '../../constants/races';

const TopBar = ({ user, onLogout, onOpenShop }) => {
  // Estado para forzar la actualización del timer cada segundo
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const raceData = useMemo(() => RACES.find(r => r.id === user.race) || RACES[0], [user.race]);

  // --- DATOS DEL USUARIO ---
  const maxHp = user.calculatedMaxHp || ((user.stats?.constitution || 10) * 20);
  const currentHp = user.current_hp;
  const currentXp = user.experience || 0;
  const maxXp = user.level * 1000;
  const bgUrl = user.active_background_url || "https://images.unsplash.com/photo-1519074069444-1ba4fff66d16?q=80&w=2544&auto=format&fit=crop";

  // --- LÓGICA DE TIEMPO RESTANTE ---
  const getTimeUntilRegen = (type, currentVal, maxVal) => {
    if (currentVal >= maxVal) return null; // Si está lleno, no mostrar timer
    if (!user.last_regen_at) return null;

    const now = new Date();
    const last = new Date(user.last_regen_at);
    // Diferencia en segundos desde la última vez que el servidor regeneró
    const diffSeconds = Math.max(0, (now - last) / 1000);

    let interval = 10; // HP (Default)
    if (type === 'energy') interval = 120; // 2 minutos
    if (type === 'valor') interval = 1800; // 30 minutos

    // El tiempo restante es el intervalo MENOS el "sobrante" del ciclo actual
    const remaining = interval - (diffSeconds % interval);
    
    if (remaining < 0) return "00:00"; // Prevención visual

    const m = Math.floor(remaining / 60);
    const s = Math.floor(remaining % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getAvatarImage = () => {
    if (user.class_image) {
        const dbPath = user.class_image; 
        const genderSuffix = user.gender === 'female' ? '_female' : '_male';
        const lastDotIndex = dbPath.lastIndexOf('.');
        if (lastDotIndex === -1) return dbPath + genderSuffix + ".png"; 
        const path = dbPath.substring(0, lastDotIndex);
        const ext = dbPath.substring(lastDotIndex);
        return `${path}${genderSuffix}${ext}`; 
    }
    return raceData.images[user.gender || 'male'];
  };

  // --- COMPONENTE DE BARRA MEJORADO ---
  const StatBar = ({ colorClass, value, max, label, type }) => {
    const timerText = type ? getTimeUntilRegen(type, value, max) : null;

    return (
      <div className="flex flex-col w-24 lg:w-32 relative group">
        <div className="flex justify-between px-1 mb-0.5 items-end">
          <div className="flex gap-1 items-center">
             <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{label}</span>
             {/* AQUÍ ESTÁ EL TIMER QUE PEDISTE */}
             {timerText && (
                <span className="text-[9px] text-amber-400 font-mono animate-pulse">({timerText})</span>
             )}
          </div>
          <span className="text-[9px] text-white font-mono">{value}/{max}</span>
        </div>
        <div className="h-2.5 bg-black/60 border border-slate-700/50 rounded-sm overflow-hidden shadow-inner relative">
          <div className={`h-full ${colorClass} transition-all duration-500 shadow-[0_0_10px_currentColor]`} style={{ width: `${Math.min((value / max) * 100, 100)}%` }} />
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-white/20"></div>
        </div>
      </div>
    );
  };

  return (
    <header className="h-20 bg-slate-950 border-b border-amber-700/60 flex items-center justify-between px-4 shadow-[0_5px_20px_black] relative z-50">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-slate-900 to-black opacity-90 z-0"></div>

      {/* SECCIÓN IZQUIERDA: AVATAR Y NIVEL */}
      <div className="relative z-10 flex items-center gap-4 pl-2 min-w-fit">
        <div className="relative shrink-0">
            <div className="w-12 h-12 rounded bg-black border-2 border-amber-600 shadow-[0_0_15px_rgba(245,158,11,0.2)] overflow-hidden relative">
                <img src={bgUrl} className="absolute inset-0 w-full h-full object-cover opacity-80" alt="BG" />
                <img src={getAvatarImage()} className="absolute inset-0 w-full h-full object-cover object-top z-10" alt="Avatar" />
            </div>
            <div className="absolute -bottom-1.5 -right-1.5 bg-amber-900 text-amber-100 text-[9px] font-bold px-1.5 py-0.5 border border-amber-500 rounded shadow-md z-20">{user.level}</div>
        </div>
        <div className="hidden sm:block">
            <h2 className="text-lg font-serif font-bold text-amber-500 tracking-wide drop-shadow-md leading-none">{user.username}</h2>
            <span className="text-[10px] text-slate-500 uppercase tracking-widest">
                {user.class_name || raceData.name}
            </span>
        </div>
      </div>

      {/* SECCIÓN CENTRAL: BARRAS DE ESTADO CON TIMERS */}
      <div className="relative z-10 hidden xl:flex items-center gap-6 bg-black/30 px-6 py-2 rounded border border-white/5 shadow-inner mx-4">
        <StatBar value={currentXp} max={maxXp} label="Exp" colorClass="bg-yellow-500" />
        {/* Pasamos el 'type' para activar el timer correspondiente */}
        <StatBar value={currentHp} max={maxHp} label="Vida" colorClass="bg-red-600" type="hp" />
        <StatBar value={user.energy} max={100} label="Energía" colorClass="bg-blue-600" type="energy" />
        <StatBar value={user.valor} max={5} label="Valor" colorClass="bg-orange-500" type="valor" />
      </div>

      {/* BOTÓN TIENDA */}
      <button onClick={onOpenShop} className="relative z-20 flex items-center gap-2 bg-gradient-to-r from-purple-900/80 to-slate-900 border border-purple-500/50 px-4 py-1.5 rounded-full hover:scale-105 transition-transform group shadow-[0_0_15px_rgba(168,85,247,0.3)] animate-pulse hover:animate-none cursor-pointer mx-auto md:mx-4">
        <div className="relative">
            <Gem size={14} className="text-purple-400 group-hover:text-white transition-colors" />
            <span className="absolute -top-1 -right-1 flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span></span>
        </div>
        <span className="text-xs font-bold text-purple-200 group-hover:text-white uppercase tracking-wider hidden md:inline">Tienda Ónix</span>
      </button>

      {/* SECCIÓN DERECHA: ECONOMÍA */}
      <div className="relative z-10 flex items-center gap-4 ml-auto bg-black/40 px-4 py-2 rounded border border-white/5 shadow-inner">
        <div className="flex items-center gap-1.5" title="Oro"><Coins size={14} className="text-amber-400 fill-amber-400/20" /><span className="text-amber-400 font-bold text-sm">{user.gold}</span></div>
        <div className="flex items-center gap-1.5" title="Plata"><div className="w-3 h-3 rounded-full bg-slate-400 border border-slate-300 shadow-[0_0_5px_white]"></div><span className="text-slate-300 font-bold text-sm">{user.silver}</span></div>
        <div className="flex items-center gap-1.5" title="Cobre"><div className="w-3 h-3 rounded-full bg-orange-700 border border-orange-500 shadow-[0_0_5px_orange]"></div><span className="text-orange-500 font-bold text-sm">{user.copper}</span></div>
        <div className="h-4 w-px bg-white/10 mx-1"></div>
        <div className="flex items-center gap-1.5" title="Onix"><Gem size={14} className="text-purple-400" /><span className="text-purple-300 font-bold text-sm">{user.onix || 0}</span></div>
      </div>

      <button onClick={onLogout} className="relative z-10 ml-4 p-2 text-slate-500 hover:text-red-400 transition-colors" title="Cerrar Sesión"><LogOut size={18} /></button>
    </header>
  );
};

export default TopBar;