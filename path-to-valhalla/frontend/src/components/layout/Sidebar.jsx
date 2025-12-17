import React from 'react';
import { 
    User, BookOpen, Trophy, BarChart2, Mail, // Héroe
    Map, Skull, ArrowUpCircle, Scroll, // Aventura
    Swords, // Combate
    Hammer, Landmark, Gavel, Shield, // Ciudad
    Users, Calendar, // Social
    Crown // Premium
} from 'lucide-react';

// Ahora recibimos 'onNavigate' y 'currentView' desde GameLayout
const Sidebar = ({ onNavigate, currentView }) => {
  
  // Componente para los Títulos de Sección
  const SectionHeader = ({ title }) => (
    <div className="px-6 pt-4 pb-2 mt-2">
        <h3 className="text-[10px] font-bold text-amber-600 uppercase tracking-widest border-b border-amber-900/30 pb-1">
            {title}
        </h3>
    </div>
  );

  // Componente para los Enlaces (Actualizado para aceptar onClick)
  const MenuLink = ({ icon: Icon, label, active, disabled, onClick }) => (
    <button 
        disabled={disabled}
        onClick={onClick}
        className={`
            w-full flex items-center gap-3 px-6 py-2.5
            transition-all border-l-[3px]
            ${active 
                ? 'bg-gradient-to-r from-amber-900/40 to-transparent border-amber-500 text-amber-100' 
                : 'border-transparent text-slate-400 hover:text-amber-100 hover:bg-white/5'}
            ${disabled ? 'opacity-40 cursor-not-allowed grayscale' : 'cursor-pointer'}
        `}
    >
        <Icon size={18} className={active ? 'text-amber-500 drop-shadow-[0_0_5px_rgba(245,158,11,0.8)]' : disabled ? 'text-slate-600' : 'text-slate-500 group-hover:text-amber-200'} />
        <span className={`font-sans text-xs uppercase tracking-wide ${active ? 'font-bold' : 'font-medium'}`}>
            {label}
        </span>
    </button>
  );

  return (
    <aside className="w-64 h-full flex flex-col bg-slate-950 border-r border-amber-900/30 shadow-[5px_0_30px_rgba(0,0,0,0.5)] relative z-30 overflow-hidden">
        
        {/* ENCABEZADO "MENÚ" */}
        <div className="h-20 flex flex-col items-center justify-center border-b border-amber-900/30 bg-black/20 shrink-0 relative">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-amber-900/50 to-transparent"></div>
            <h1 className="text-amber-500 font-serif font-bold tracking-[0.3em] text-sm drop-shadow-md">
                + MENÚ +
            </h1>
            <div className="w-10 h-0.5 bg-amber-700/50 rounded-full mt-1 shadow-[0_0_8px_rgba(245,158,11,0.4)]"></div>
        </div>

        {/* NAVEGACIÓN CON SCROLL */}
        <nav className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-amber-900/50 scrollbar-track-transparent py-2">
            
            {/* SECCIÓN: HÉROE */}
            <SectionHeader title="Héroe" />
            
            {/* Botón Visión General (Dashboard) */}
            <MenuLink 
                icon={User} 
                label="Visión General" 
                active={currentView === 'dashboard'} 
                onClick={() => onNavigate('dashboard')} 
            />
            
            <MenuLink icon={BookOpen} label="Bestiario" />
            <MenuLink icon={Trophy} label="Logros" />
            <MenuLink icon={BarChart2} label="Estadísticas" />
            <MenuLink icon={Mail} label="Mensajería" />

            {/* SECCIÓN: AVENTURA */}
            <SectionHeader title="Aventura" />
            
            {/* Botón Expediciones */}
            <MenuLink 
                icon={Map} 
                label="Expediciones" 
                active={currentView === 'expeditions'} 
                onClick={() => onNavigate('expeditions')} 
            />
            
            <MenuLink icon={Skull} label="Mazmorras" />
            <MenuLink icon={ArrowUpCircle} label="Torre Infinita" disabled />
            <MenuLink icon={Scroll} label="Salón de Valhallus" />

            {/* SECCIÓN: COMBATE */}
            <SectionHeader title="Combate" />
            <MenuLink icon={Swords} label="Coliseo" />

            {/* SECCIÓN: CIUDAD */}
            <SectionHeader title="Ciudad" />
            <MenuLink icon={Hammer} label="Taller" />
            <MenuLink icon={Landmark} label="Banco" />
            <MenuLink icon={Gavel} label="Mercado" />
            <MenuLink icon={Shield} label="Armero" />

            {/* SECCIÓN: SOCIAL */}
            <SectionHeader title="Social" />
            <MenuLink icon={Users} label="Alianza" />
            <MenuLink icon={Calendar} label="Agenda" />

            {/* SECCIÓN: PREMIUM */}
            <SectionHeader title="Premium" />
            <MenuLink icon={Crown} label="Tienda VIP" />

            <div className="h-10"></div>
        </nav>

        {/* PIE DE PÁGINA */}
        <div className="p-3 text-center border-t border-amber-900/30 bg-black/40 shrink-0">
            <p className="text-[9px] text-slate-600 font-mono uppercase tracking-widest">
                Valhalla v0.1.0 Alpha
            </p>
        </div>
    </aside>
  );
};

export default Sidebar;