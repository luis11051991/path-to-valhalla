import React from 'react';
import { NavLink } from 'react-router-dom';
import { X, Lock } from 'lucide-react';

// --- CONFIGURACIÓN DE ENLACES (ACTUALIZADA CON GRIMORIO) ---
const links = [
    {
        section: 'Heroe',
        items: [
            { to: '/hero', label: 'Vision General', icon: '/icons/sidebar/hero_overview.png' },
            // NUEVO ENLACE: Grimorio
            { to: '/grimoire', label: 'Grimorio', icon: '/icons/tabs/tab_grimoire.png' },

            { to: '/inventory', label: 'Paquetes', icon: '/icons/sidebar/hero_packages.png' },
            { to: '/bestiary', label: 'Bestiario', icon: '/icons/sidebar/hero_bestiary.png' },
            { to: '/achievements', label: 'Logros', icon: '/icons/sidebar/hero_achievements.png', disabled: true },
            { to: '/stats', label: 'Estadísticas', icon: '/icons/sidebar/hero_stats.png', disabled: true },
            { to: '/messages', label: 'Mensajería', icon: '/icons/sidebar/hero_messages.png' },
        ]
    },
    {
        section: 'Aventura',
        items: [
            { to: '/expeditions', label: 'Expediciones', icon: '/icons/sidebar/adv_expeditions.png' },
            { to: '/dungeons', label: 'Mazmorras', icon: '/icons/sidebar/adv_dungeons.png', disabled: true },
            { to: '/tower', label: 'Torre Infinita', icon: '/icons/sidebar/adv_tower.png', disabled: true },
            { to: '/valhalla', label: 'Salon de Valhallus', icon: '/icons/sidebar/adv_valhalla.png' },
        ]
    },
    {
        section: 'Combate',
        items: [
            { to: '/coliseum', label: 'Coliseo', icon: '/icons/sidebar/combat_coliseum.png', disabled: true },
        ]
    },
    {
        section: 'Ciudad',
        items: [
            { to: '/workshop', label: 'Taller', icon: '/icons/sidebar/city_workshop.png', levelLock: 5 },
            { to: '/bank', label: 'Banco', icon: '/icons/sidebar/city_bank.png', disabled: true },
            { to: '/market', label: 'Mercado', icon: '/icons/sidebar/city_market.png' },
        ]
    },
    {
        section: 'Social',
        items: [
            { to: '/alliance', label: 'Alianza', icon: '/icons/sidebar/social_alliance.png', disabled: true },
            { to: '/calendar', label: 'Agenda', icon: '/icons/sidebar/social_calendar.png', disabled: true },
        ]
    },
    {
        section: 'Premium',
        items: [
            { to: '/shop', label: 'Tienda VIP', icon: '/icons/sidebar/shop_vip.png', disabled: true },
        ]
    },
];

const Sidebar = ({ user, unreadCount, isOpen, isCompact, isMobile, onCloseMobile, onToggleCompact }) => {
    const showLabels = !isCompact || isMobile;
    const targetWidth = isMobile ? (isOpen ? 256 : 0) : (isCompact ? 80 : 256);
    const positionClass = isMobile ? 'fixed inset-y-0 left-0' : 'static';
    const translateClass = isMobile ? (isOpen ? 'translate-x-0' : '-translate-x-full') : 'translate-x-0';

    const SectionHeader = ({ title }) => (
        showLabels ? (
            <div className="px-6 pt-4 pb-2 mt-2">
                <h3 className="text-[10px] font-bold text-amber-600 uppercase tracking-widest border-b border-amber-900/30 pb-1">{title}</h3>
            </div>
        ) : (
            <div className="py-2 flex items-center justify-center" aria-hidden>
                <span className="h-0.5 w-8 bg-amber-600/70 rounded-full shadow-[0_0_6px_rgba(245,158,11,0.6)]"></span>
            </div>
        )
    );

    const getLinkClasses = ({ isActive, disabled }) => `
        w-full flex items-center ${showLabels ? 'justify-start gap-3 px-6' : 'justify-center px-3'} py-2.5
        transition-all border-l-[3px] group relative
        ${isActive
            ? 'bg-gradient-to-r from-amber-900/40 to-transparent border-amber-500 text-amber-100'
            : 'border-transparent text-slate-400 hover:text-amber-100 hover:bg-white/5'}
        ${disabled ? 'opacity-50 cursor-not-allowed grayscale' : 'cursor-pointer'}
    `;

    return (
        <aside
            className={`${positionClass} transform transition-all duration-300 ease-in-out ${translateClass} h-screen md:h-full flex flex-col bg-slate-950 border-r border-amber-900/30 shadow-[5px_0_30px_rgba(0,0,0,0.5)] relative z-30 overflow-hidden md:overflow-visible ${!isOpen && isMobile ? 'pointer-events-none' : ''}`}
            style={{ width: `${targetWidth}px` }}
            aria-hidden={!isOpen && isMobile}
        >
            <div className="h-20 flex flex-col items-center justify-center border-b border-amber-900/30 bg-black/20 shrink-0 relative">
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-amber-900/50 to-transparent"></div>
                {showLabels ? (
                    <>
                        <h1 className="text-amber-500 font-serif font-bold tracking-[0.3em] text-sm drop-shadow-md">+ MENU +</h1>
                        <div className="w-10 h-0.5 bg-amber-700/50 rounded-full mt-1 shadow-[0_0_8px_rgba(245,158,11,0.4)]"></div>
                    </>
                ) : <h1 className="text-amber-500 font-serif font-bold text-sm drop-shadow-md">M</h1>}

                {isMobile && (
                    <button onClick={onCloseMobile} className="absolute right-3 top-3 p-1 text-slate-400 hover:text-amber-300 transition-colors">
                        <X size={16} />
                    </button>
                )}
            </div>

            <nav className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-amber-900/50 scrollbar-track-transparent py-2">
                {links.map(section => (
                    <div key={section.section}>
                        <SectionHeader title={section.section} />
                        {section.items.map(item => {
                            const isLocked = item.levelLock && user?.level < item.levelLock;
                            const isDisabled = item.disabled || isLocked;

                            if (isDisabled) {
                                return (
                                    <div key={item.to} className={getLinkClasses({ isActive: false, disabled: true })}>
                                        <img src={item.icon} alt={item.label} className="w-6 h-6 object-contain opacity-60" onError={(e) => e.target.style.display = 'none'} />
                                        {showLabels && <span className="font-sans text-xs uppercase tracking-wide">{item.label}</span>}
                                        {isLocked && <Lock size={12} className="ml-auto text-red-500" />}
                                    </div>
                                );
                            }

                            return (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    className={({ isActive }) => getLinkClasses({ isActive, disabled: false })}
                                >
                                    {({ isActive }) => (
                                        <>
                                            <img
                                                src={item.icon}
                                                alt={item.label}
                                                className={`w-6 h-6 object-contain transition-transform group-hover:scale-110 ${showLabels ? '' : 'opacity-70'} ${isActive ? 'drop-shadow-[0_0_5px_rgba(245,158,11,0.8)]' : 'group-hover:opacity-100'}`}
                                                onError={(e) => e.target.style.display = 'none'}
                                            />
                                            {showLabels && (
                                                <span className={`font-sans text-xs uppercase tracking-wide ${isActive ? 'font-bold' : 'font-medium'}`}>
                                                    {item.label}
                                                </span>
                                            )}
                                            {/* BADGE DE NO LEÍDOS */}
                                            {item.to === '/messages' && unreadCount > 0 && (
                                                <span className="absolute right-2 top-1/2 -translate-y-1/2 bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full animate-pulse shadow-sm">
                                                    {unreadCount}
                                                </span>
                                            )}
                                        </>
                                    )}
                                </NavLink>
                            );
                        })}
                    </div>
                ))}
            </nav>

            <div className="p-3 text-center border-t border-amber-900/30 bg-black/40 shrink-0">
                {showLabels ? (
                    <p className="text-[9px] text-slate-600 font-mono uppercase tracking-widest">Valhalla v0.1.0 Alpha</p>
                ) : (
                    <button className="hidden md:inline-flex items-center justify-center w-full text-[9px] text-slate-500 uppercase tracking-widest" onClick={onToggleCompact}>
                        Expandir
                    </button>
                )}
            </div>
        </aside>
    );
};

export default Sidebar;