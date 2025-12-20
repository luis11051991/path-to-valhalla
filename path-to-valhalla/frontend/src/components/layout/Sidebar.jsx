import React, { useState } from 'react';
import {
    User, BookOpen, Trophy, BarChart2, Mail, // Héroe
    Package, // Paquetes
    Map, Skull, ArrowUpCircle, Scroll, // Aventura
    Swords, // Combate
    Hammer, Landmark, Gavel, Shield, // Ciudad
    Users, Calendar, // Social
    Crown, // Premium
    X
} from 'lucide-react';

// Ahora recibimos 'onNavigate' y 'currentView' desde GameLayout
const Sidebar = ({ onNavigate, currentView, isOpen, isCompact, isMobile, onCloseMobile, onToggleCompact }) => {

    const showLabels = !isCompact || isMobile;
    const showHoverLabel = !showLabels && !isMobile; // Desktop compacto: mostrar label al hacer hover
    const [hoverInfo, setHoverInfo] = useState(null);
    const targetWidth = isMobile
        ? (isOpen ? 256 : 0) // 64 * 4 = 256px
        : (isCompact ? 80 : 256); // 20 * 4 = 80px
    const positionClass = isMobile ? 'fixed inset-y-0 left-0' : 'static';
    const translateClass = isMobile ? (isOpen ? 'translate-x-0' : '-translate-x-full') : 'translate-x-0';
    
    const handleNavigate = (target) => {
        onNavigate(target);
        if (isMobile && onCloseMobile) {
            onCloseMobile();
        }
    };

    // Componente para los Títulos de Sección
    const SectionHeader = ({ title }) => (
        showLabels ? (
            <div className="px-6 pt-4 pb-2 mt-2">
                <h3 className="text-[10px] font-bold text-amber-600 uppercase tracking-widest border-b border-amber-900/30 pb-1">
                    {title}
                </h3>
            </div>
        ) : (
            <div className="py-2 flex items-center justify-center" aria-hidden>
                <span className="h-0.5 w-8 bg-amber-600/70 rounded-full shadow-[0_0_6px_rgba(245,158,11,0.6)]"></span>
            </div>
        )
    );

    // Componente para los Enlaces
    const MenuLink = ({ icon: Icon, label, active, disabled, onClick }) => (
        <div className="relative group">
            <button
                disabled={disabled}
                onClick={onClick}
                onMouseEnter={(e) => {
                    if (showHoverLabel) {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHoverInfo({ label, top: rect.top + rect.height / 2 });
                    }
                }}
                onMouseLeave={() => showHoverLabel && setHoverInfo(null)}
                className={`
                    w-full flex items-center ${showLabels ? 'justify-start gap-3 px-6' : 'justify-center px-3'} py-2.5
                    transition-all border-l-[3px]
                    ${active
                        ? 'bg-gradient-to-r from-amber-900/40 to-transparent border-amber-500 text-amber-100'
                        : 'border-transparent text-slate-400 hover:text-amber-100 hover:bg-white/5'}
                    ${disabled ? 'opacity-40 cursor-not-allowed grayscale' : 'cursor-pointer'}
                `}
            >
                <Icon size={18} className={active ? 'text-amber-500 drop-shadow-[0_0_5px_rgba(245,158,11,0.8)]' : disabled ? 'text-slate-600' : 'text-slate-500 group-hover:text-amber-200'} />
                {showLabels ? (
                    <span className={`font-sans text-xs uppercase tracking-wide ${active ? 'font-bold' : 'font-medium'}`}>
                        {label}
                    </span>
                ) : (
                    <span className="sr-only">{label}</span>
                )}
            </button>
        </div>
    );

    return (
        <>
            <aside
                className={`
                ${positionClass} transform transition-all duration-300 ease-in-out
                ${translateClass}
                h-screen md:h-full flex flex-col bg-slate-950 border-r border-amber-900/30 shadow-[5px_0_30px_rgba(0,0,0,0.5)] relative z-30
                overflow-hidden md:overflow-visible
                ${!isOpen && isMobile ? 'pointer-events-none' : ''}
            `}
                style={{ width: `${targetWidth}px` }}
                aria-hidden={!isOpen && isMobile}
            >

                {/* ENCABEZADO "MENÚ" */}
                <div className="h-20 flex flex-col items-center justify-center border-b border-amber-900/30 bg-black/20 shrink-0 relative">
                    <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-amber-900/50 to-transparent"></div>
                    {showLabels ? (
                        <>
                            <h1 className="text-amber-500 font-serif font-bold tracking-[0.3em] text-sm drop-shadow-md">
                                + MENÚ +
                            </h1>
                            <div className="w-10 h-0.5 bg-amber-700/50 rounded-full mt-1 shadow-[0_0_8px_rgba(245,158,11,0.4)]"></div>
                        </>
                    ) : (
                        <h1 className="text-amber-500 font-serif font-bold text-sm drop-shadow-md">≡</h1>
                    )}

                    {isMobile && (
                        <button
                            onClick={onCloseMobile}
                            className="absolute right-3 top-3 p-1 text-slate-400 hover:text-amber-300 transition-colors"
                            aria-label="Cerrar menú"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>

                {/* NAVEGACIÓN CON SCROLL */}
                <nav className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-amber-900/50 scrollbar-track-transparent py-2">

                    {/* SECCIÓN: HÉROE */}
                    <SectionHeader title="Héroe" />

                    <MenuLink
                        icon={User}
                        label="Visión General"
                        active={currentView === 'dashboard'}
                        onClick={() => handleNavigate('dashboard')}
                    />

                    <MenuLink
                        icon={Package}
                        label="Paquetes"
                        active={currentView === 'packages'}
                        onClick={() => handleNavigate('packages')}
                    />

                    <MenuLink icon={BookOpen} label="Bestiario" />
                    <MenuLink icon={Trophy} label="Logros" />
                    <MenuLink icon={BarChart2} label="Estadísticas" />
                    <MenuLink icon={Mail} label="Mensajería" />

                    {/* SECCIÓN: AVENTURA */}
                    <SectionHeader title="Aventura" />

                    <MenuLink
                        icon={Map}
                        label="Expediciones"
                        active={currentView === 'expeditions'}
                        onClick={() => handleNavigate('expeditions')}
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
                    
                    {/* --- AQUÍ ESTÁ EL CAMBIO: BOTÓN MERCADO ACTIVADO --- */}
                    <MenuLink 
                        icon={Gavel} 
                        label="Mercado" 
                        active={currentView === 'market'} 
                        onClick={() => handleNavigate('market')} 
                    />
                    
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
                    {showLabels ? (
                        <p className="text-[9px] text-slate-600 font-mono uppercase tracking-widest">
                            Valhalla v0.1.0 Alpha
                        </p>
                    ) : (
                        <button
                            className="hidden md:inline-flex items-center justify-center w-full text-[9px] text-slate-500 uppercase tracking-widest"
                            onClick={onToggleCompact}
                        >
                            Expandir
                        </button>
                    )}
                </div>
            </aside>

            {showHoverLabel && hoverInfo && (
                <div
                    className="fixed z-[100] pointer-events-none px-3 py-1 rounded bg-slate-900/95 border border-amber-900/40 shadow-lg whitespace-nowrap"
                    style={{
                        top: hoverInfo.top,
                        left: targetWidth + 12,
                        transform: 'translateY(-50%)'
                    }}
                >
                    <span className="font-sans text-xs uppercase tracking-wide text-slate-200">
                        {hoverInfo.label}
                    </span>
                </div>
            )}
        </>
    );
};

export default Sidebar;