import React, { useMemo, useState, useEffect } from 'react';
import { LogOut, Menu, PanelLeft, PanelRightClose } from 'lucide-react';
import { RACES } from '../../constants/races';
import { getRequiredXp } from '../../shared/level_xp';

const CURRENCY_ICONS = {
  gold: '/icons/currency/gold.png',
  silver: '/icons/currency/silver.png',
  copper: '/icons/currency/copper.png',
  onix: '/icons/currency/onix.png'
};

const getTimeUntilRegen = (lastRegenAt, type, currentVal, maxVal) => {
  if (currentVal >= maxVal || !lastRegenAt) return null;

  const now = new Date();
  const last = new Date(lastRegenAt);
  const diffSeconds = Math.max(0, (now - last) / 1000);

  let interval = 3;
  if (type === 'energy') interval = 120;
  if (type === 'valor') interval = 1800;

  const remaining = interval - (diffSeconds % interval);
  if (remaining < 0) return "00:00";

  const m = Math.floor(remaining / 60);
  const s = Math.floor(remaining % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const TopBarStatBar = ({ colorClass, value, max, label, timerText }) => {
  const percent = max > 0 ? Math.min((value / max) * 100, 100) : 0;

  return (
    <div className="flex flex-col w-24 lg:w-32 relative group">
      <div className="flex justify-between px-1 mb-0.5 items-end">
        <div className="flex gap-1 items-center">
          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{label}</span>
          {timerText && (
            <span className="text-[9px] text-amber-400 font-mono animate-pulse">({timerText})</span>
          )}
        </div>
        <span className="text-[9px] text-white font-mono">{value}/{max}</span>
      </div>
      <div className="h-2.5 bg-black/60 border border-slate-700/50 rounded-sm overflow-hidden shadow-inner relative">
        <div className={'h-full ' + colorClass + ' transition-all duration-500 shadow-[0_0_10px_currentColor]'} style={{ width: percent + '%' }} />
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-white/20"></div>
      </div>
    </div>
  );
};

const TopBar = ({ user, onLogout, onOpenShop, onToggleSidebar, onToggleCompact, isSidebarCompact }) => {
  const [, setTick] = useState(0);
  const raceData = useMemo(() => RACES.find(r => r.id === user?.race) || RACES[0], [user?.race]);

  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // --- GUARD: si no hay user, mostrar loading placeholder ---
  if (!user) {
    return (
      <header className="h-20 bg-slate-950 border-b border-amber-700/60 flex items-center justify-between px-4 shadow-[0_5px_20px_black] relative z-50">
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-black opacity-90 z-0"></div>
        <div className="relative z-10 flex items-center gap-4 w-full justify-center animate-pulse">
          <div className="w-12 h-12 rounded-full bg-slate-800/50 border border-slate-700"></div>
          <div className="h-6 w-32 bg-slate-800/50 rounded"></div>
        </div>
      </header>
    );
  }

  const maxHp = user.calculatedMaxHp ?? user.calculated_max_hp ?? 0;
  const currentHp = user.current_hp ?? 0;
  const currentXp = user.experience || 0;
  const maxXp = getRequiredXp(user.level);

  const bgUrl = user.active_background_url || "https://images.unsplash.com/photo-1519074069444-1ba4fff66d16?q=80&w=2544&auto=format&fit=crop";

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

  return (
    <header className="h-20 bg-slate-950 border-b border-amber-700/60 flex items-center justify-between px-4 shadow-[0_5px_20px_black] relative z-50">
      <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-black opacity-90 z-0"></div>

      <div className="relative z-10 flex items-center gap-3 pl-2 min-w-fit">
        <button onClick={onToggleSidebar} className="md:hidden p-2 rounded text-slate-400 hover:text-amber-300 hover:bg-white/5 transition-colors" aria-label="Abrir menú">
          <Menu size={18} />
        </button>

        <button onClick={onToggleCompact} className="hidden md:flex p-2 rounded text-slate-500 hover:text-amber-300 hover:bg-white/5 transition-colors" aria-label={isSidebarCompact ? 'Expandir menú' : 'Contraer menú'}>
          {isSidebarCompact ? <PanelLeft size={18} /> : <PanelRightClose size={18} />}
        </button>

        <div className="relative shrink-0">
          <div className="w-12 h-12 rounded bg-black border-2 border-amber-600 shadow-[0_0_15px_rgba(245,158,11,0.2)] overflow-hidden relative">
            <img src={bgUrl} className="absolute inset-0 w-full h-full object-cover opacity-80" alt="BG" />
            <img src={getAvatarImage()} className="absolute inset-0 w-full h-full object-cover object-top z-10 drop-shadow-[0_0_14px_rgba(0,0,0,0.7)]" style={{ filter: 'contrast(1.28) saturate(1.2) brightness(0.9)' }} alt="Avatar" />
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

      <div className="relative z-10 hidden xl:flex items-center gap-6 bg-black/30 px-6 py-2 rounded border border-white/5 shadow-inner mx-4">
        <TopBarStatBar value={currentXp} max={maxXp} label="Exp" colorClass="bg-yellow-500" />
        <TopBarStatBar value={currentHp} max={maxHp} label="Vida" colorClass="bg-red-600" timerText={getTimeUntilRegen(user.last_regen_at, 'hp', currentHp, maxHp)} />
        <TopBarStatBar value={user.energy ?? 0} max={100} label="Energ\u00eda" colorClass="bg-blue-600" timerText={getTimeUntilRegen(user.last_regen_at, 'energy', user.energy ?? 0, 100)} />
        <TopBarStatBar value={user.valor ?? 0} max={5} label="Valor" colorClass="bg-orange-500" timerText={getTimeUntilRegen(user.last_regen_at, 'valor', user.valor ?? 0, 5)} />
      </div>

      <button onClick={onOpenShop} className="relative z-20 flex items-center gap-2 bg-gradient-to-r from-purple-900/80 to-slate-900 border border-purple-500/50 px-4 py-1.5 rounded-full hover:scale-105 transition-transform group shadow-[0_0_15px_rgba(168,85,247,0.3)] animate-pulse hover:animate-none cursor-pointer mx-auto md:mx-4">
        <div className="relative">
          <img src={CURRENCY_ICONS.onix} alt="Shop" className="w-5 h-5 object-contain drop-shadow-[0_0_5px_rgba(168,85,247,0.8)]" />
          <span className="absolute -top-1 -right-1 flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span></span>
        </div>
        <span className="text-xs font-bold text-purple-200 group-hover:text-white uppercase tracking-wider hidden md:inline">Tienda Ónix</span>
      </button>

      <div className="relative z-10 flex items-center gap-4 ml-auto bg-black/40 px-4 py-2 rounded border border-white/5 shadow-inner">
        <div className="flex items-center gap-2" title="Oro">
          <img src={CURRENCY_ICONS.gold} alt="Oro" className="w-5 h-5 object-contain drop-shadow-md" />
          <span className="text-amber-400 font-bold text-sm">{user.gold ?? 0}</span>
        </div>
        <div className="flex items-center gap-2" title="Plata">
          <img src={CURRENCY_ICONS.silver} alt="Plata" className="w-5 h-5 object-contain drop-shadow-md" />
          <span className="text-slate-300 font-bold text-sm">{user.silver ?? 0}</span>
        </div>
        <div className="flex items-center gap-2" title="Cobre">
          <img src={CURRENCY_ICONS.copper} alt="Cobre" className="w-5 h-5 object-contain drop-shadow-md" />
          <span className="text-orange-500 font-bold text-sm">{user.copper ?? 0}</span>
        </div>

        <div className="h-6 w-px bg-white/10 mx-1"></div>

        <div className="flex items-center gap-2" title="Onix">
          <img src={CURRENCY_ICONS.onix} alt="Onix" className="w-5 h-5 object-contain drop-shadow-[0_0_5px_rgba(168,85,247,0.6)]" />
          <span className="text-purple-300 font-bold text-sm">{user.onix ?? 0}</span>
        </div>
      </div>

      <button onClick={onLogout} className="relative z-10 ml-4 p-2 text-slate-500 hover:text-red-400 transition-colors" title="Cerrar Sesi\u00f3n"><LogOut size={18} /></button>
    </header>
  );
};

export default TopBar;
