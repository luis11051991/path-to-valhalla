import React from 'react';
import { Home, Backpack, Swords, Map, Hammer, FlaskConical, ScrollText } from 'lucide-react';

const Sidebar = () => {
  
  const MenuLink = ({ icon: Icon, label, active }) => (
    <button 
        className={`
            w-full flex items-center gap-3 px-4 py-3 mb-1
            transition-all border-y border-transparent
            ${active 
                ? 'bg-gradient-to-r from-amber-900/80 to-transparent text-amber-200 border-l-4 border-l-amber-500 shadow-inner' 
                : 'text-slate-400 hover:text-amber-100 hover:bg-white/5 hover:border-b-white/5 hover:pl-5'}
        `}
    >
        {/* Icono con brillo si está activo */}
        <div className={`p-1.5 rounded ${active ? 'bg-amber-950/50 shadow-sm' : ''}`}>
            <Icon size={18} className={active ? 'text-amber-400 drop-shadow-[0_0_5px_rgba(245,158,11,0.8)]' : 'text-slate-500 group-hover:text-amber-200'} />
        </div>
        <span className={`font-serif tracking-wider text-sm uppercase ${active ? 'font-bold text-shadow-sm' : ''}`}>
            {label}
        </span>
    </button>
  );

  return (
    <aside className="w-64 h-full flex flex-col relative z-20">
        
        {/* Fondo con textura simulada (Degradado complejo) */}
        <div className="absolute inset-0 bg-slate-950 bg-[radial-gradient(ellipse_at_left,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black z-0 border-r-2 border-amber-800/60 shadow-[5px_0_30px_rgba(0,0,0,0.8)]"></div>

        {/* Decoración Superior (Cabeza de Columna) */}
        <div className="relative z-10 p-5 text-center border-b-2 border-amber-900/50 bg-black/20">
            <h3 className="text-amber-600 text-xs font-bold uppercase tracking-[0.3em] drop-shadow-md">
                Menú
            </h3>
            <div className="mt-2 w-16 h-1 bg-gradient-to-r from-transparent via-amber-800 to-transparent mx-auto"></div>
        </div>

        {/* Lista de Navegación */}
        <nav className="relative z-10 flex-1 py-4 overflow-y-auto space-y-1">
            <MenuLink icon={Home} label="Visión General" active />
            <MenuLink icon={Backpack} label="Inventario" />
            <MenuLink icon={Swords} label="Coliseo" />
            <MenuLink icon={Map} label="Expedición" />
            
            {/* Separador Decorativo */}
            <div className="py-4 flex items-center justify-center opacity-50">
                <div className="h-px w-10 bg-amber-900"></div>
                <div className="w-2 h-2 rotate-45 border border-amber-800 mx-2"></div>
                <div className="h-px w-10 bg-amber-900"></div>
            </div>

            <MenuLink icon={Hammer} label="Herrería" />
            <MenuLink icon={FlaskConical} label="Alquimia" />
            <MenuLink icon={ScrollText} label="Misiones" />
        </nav>

        {/* Pie de Columna */}
        <div className="relative z-10 p-4 text-center border-t border-amber-900/30 bg-black/40">
            <p className="text-[10px] text-slate-600 font-mono">v0.1.0 Alpha</p>
        </div>
    </aside>
  );
};

export default Sidebar;