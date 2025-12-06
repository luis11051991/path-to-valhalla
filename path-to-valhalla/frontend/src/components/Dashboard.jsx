import React, { useMemo, useState } from 'react';
import { Maximize2, X, Sword, Shield, Shirt, Footprints, Crown, Gem, Sparkles, Hand, Lock } from 'lucide-react';
import { RACES } from '../constants/races';
import StatsPanel from './StatsPanel';

const Dashboard = ({ user, onLogout }) => {

    const [showAvatarModal, setShowAvatarModal] = useState(false);
    const [activeBag, setActiveBag] = useState(1);

    const raceData = useMemo(() => {
        return RACES.find(r => r.id === user.race) || RACES[0];
    }, [user.race]);

    const getAvatarImage = () => {
        return raceData.image;
    };

    const isBagUnlocked = (bagNumber) => {
        if (bagNumber <= 2) return true;
        if (bagNumber === 3) return user.level >= 20;
        return false;
    };

    const handleSaveStats = async (newStats, pointsSpent) => {
        try {
            const response = await fetch('http://localhost:3000/api/train-stats', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    newStats,
                    pointsSpent
                })
            });

            if (response.ok) {
                const data = await response.json();
                window.location.reload(); 
            } else {
                alert("Error al entrenar.");
            }
        } catch (error) {
            console.error(error);
        }
    };

    const EquipmentSlot = ({ icon: Icon, type, className }) => (
        <div className={`
      w-12 h-12 lg:w-14 lg:h-14 bg-slate-900/80 border-2 border-slate-600 rounded 
      flex items-center justify-center relative group shadow-lg 
      hover:border-amber-500 hover:bg-slate-800 transition-all cursor-pointer z-20
      ${className}
    `}>
            <Icon className="text-slate-500 opacity-40 group-hover:opacity-100 group-hover:text-amber-500 transition-all" size={24} />
            <div className="absolute bottom-full mb-1 hidden group-hover:block bg-black text-[10px] px-2 py-1 border border-amber-500 text-amber-500 whitespace-nowrap z-50 rounded">
                {type}
            </div>
        </div>
    );

    console.log("Datos del usuario en Dashboard:", user);

    return (
        <div className="min-h-full relative font-sans p-4 flex flex-col gap-4">

            {/* FONDO DINÁMICO */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <img
                    src={raceData.bgImage}
                    alt="Race Background"
                    className="w-full h-full object-cover opacity-60 fixed inset-0"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/60 to-slate-900/30 fixed inset-0" />
            </div>

            {/* --- CONTENIDO PRINCIPAL --- */}
            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">

                {/* COLUMNA 1: ESTADÍSTICAS */}
                <div className="lg:col-span-3 space-y-4">
                    {/* AVATAR PEQUEÑO (CLICKEABLE) */}
                    <div className="bg-black/50 backdrop-blur-md border border-amber-900/30 rounded-lg p-4 flex items-center gap-4 shadow-lg">
                        <div
                            className="relative group cursor-zoom-in w-16 h-16 shrink-0 transition-transform hover:scale-105"
                            onClick={() => setShowAvatarModal(true)}
                        >
                            <div className="w-full h-full rounded border-2 border-amber-600 bg-slate-900 overflow-hidden relative z-10">
                                <img src={getAvatarImage()} className="w-full h-full object-cover object-top" />
                            </div>
                            {/* Pequeño indicador de lupa al hacer hover */}
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity z-20 rounded">
                                <Maximize2 size={16} className="text-white" />
                            </div>
                        </div>
                        <div>
                            <h2 className="text-xl font-serif text-amber-500">{user.username}</h2>
                            <p className="text-slate-400 text-[10px] uppercase tracking-widest">{raceData.name} • Lvl {user.level}</p>
                        </div>
                    </div>

                    <StatsPanel stats={user.stats} availablePoints={user.stat_points || 0} onSave={handleSaveStats} />
                    
                    <div className="bg-black/50 backdrop-blur-sm border border-slate-700 rounded p-3 text-xs space-y-1">
                        <div className="flex justify-between"><span className="text-slate-400">Daño</span> <span className="text-white font-mono">12 - 18</span></div>
                        <div className="flex justify-between"><span className="text-slate-400">Armadura</span> <span className="text-white font-mono">240</span></div>
                        <div className="flex justify-between"><span className="text-slate-400">Vida</span> <span className="text-red-400 font-mono">100%</span></div>
                    </div>
                </div>

                {/* COLUMNA 2: PAPERDOLL (ESTÁTICO) */}
                <div className="lg:col-span-5">
                    <div className="bg-black/40 backdrop-blur-md border border-amber-900/30 rounded-lg p-4 h-[700px] relative shadow-2xl flex flex-col items-center">
                        <h3 className="text-amber-500 font-serif uppercase tracking-widest text-sm mb-4 border-b border-amber-500/20 w-full text-center pb-2">
                            Equipamiento
                        </h3>
                        <div className="relative w-full h-full max-w-[420px]">

                            {/* IMAGEN DE FONDO (ESTÁTICA AHORA) */}
                            {/* Se agregó pointer-events-none y se eliminó onClick/hover effects */}
                            <div className="absolute inset-x-0 top-12 bottom-12 flex items-center justify-center z-0 opacity-90 pointer-events-none select-none">
                                <img
                                    src={getAvatarImage()}
                                    alt="Paperdoll"
                                    className="h-full w-auto object-contain drop-shadow-[0_0_15px_rgba(0,0,0,1)]"
                                />
                            </div>

                            {/* --- SLOTS IZQUIERDA --- */}
                            <div className="absolute top-4 left-0"><EquipmentSlot icon={Sparkles} type="Pendiente I" /></div>
                            <div className="absolute top-24 left-0"><EquipmentSlot icon={Gem} type="Collar" /></div>
                            <div className="absolute top-44 left-0"><EquipmentSlot icon={Sword} type="Arma Principal" /></div>
                            <div className="absolute bottom-36 left-0"><EquipmentSlot icon={Gem} type="Anillo I" /></div>
                            <div className="absolute bottom-16 left-0"><EquipmentSlot icon={Hand} type="Guantes" /></div>

                            {/* --- SLOTS CENTRO --- */}
                            <div className="absolute top-0 left-1/2 -translate-x-1/2"><EquipmentSlot icon={Crown} type="Casco" /></div>

                            <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 z-10 opacity-80 hover:opacity-100">
                                <div className="w-20 h-20 border-2 border-slate-600/30 rounded-full flex items-center justify-center hover:bg-black/40 hover:border-amber-500 transition-colors cursor-pointer" title="Armadura">
                                    <Shirt className="text-slate-500 opacity-20" />
                                </div>
                            </div>

                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2"><EquipmentSlot icon={Footprints} type="Botas" /></div>

                            {/* --- SLOTS DERECHA --- */}
                            <div className="absolute top-4 right-0"><EquipmentSlot icon={Sparkles} type="Pendiente II" /></div>
                            <div className="absolute top-44 right-0"><EquipmentSlot icon={Shield} type="Escudo" /></div>
                            <div className="absolute bottom-36 right-0"><EquipmentSlot icon={Gem} type="Anillo II" /></div>
                        </div>
                    </div>
                </div>

                {/* COLUMNA 3: MOCHILA */}
                <div className="lg:col-span-4">
                    <div className="bg-slate-900 border-2 border-amber-900/50 rounded-lg p-1 h-[700px] flex flex-col shadow-2xl relative">
                        <div className="flex gap-1 mb-1 px-1 overflow-x-auto">
                            {[1, 2, 3, 4, 5, 6].map((num) => {
                                const locked = !isBagUnlocked(num);
                                return (
                                    <button
                                        key={num}
                                        onClick={() => setActiveBag(num)}
                                        className={`
                                    flex-1 py-1.5 text-[10px] font-bold uppercase border-t-2 transition-colors relative
                                    ${activeBag === num
                                                ? 'bg-amber-900/80 text-amber-100 border-amber-500'
                                                : 'bg-slate-800 text-slate-500 border-transparent hover:bg-slate-700'}
                                    ${locked ? 'opacity-70' : ''}
                                `}
                                    >
                                        {locked && <Lock size={10} className="absolute top-0.5 right-0.5 text-red-400" />}
                                        {num >= 4 ? <span className="text-purple-400">VIP</span> : `BOLSA ${num}`}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="flex-1 bg-black/60 border border-slate-700 rounded p-2 overflow-y-auto relative">
                            {!isBagUnlocked(activeBag) ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-black/80 z-20">
                                    <Lock size={48} className={activeBag >= 4 ? "text-purple-500 mb-4" : "text-slate-500 mb-4"} />
                                    <h3 className="text-white font-bold mb-2">Mochila Bloqueada</h3>
                                    {activeBag === 3 ? (
                                        <p className="text-slate-400 text-xs">Necesitas alcanzar el <span className="text-amber-500">Nivel 20</span>.</p>
                                    ) : (
                                        <div>
                                            <p className="text-slate-400 text-xs mb-4">Esta es una bolsa <span className="text-purple-400 font-bold">Premium</span>.</p>
                                            <button className="px-4 py-2 bg-purple-700 hover:bg-purple-600 text-white text-xs font-bold rounded shadow-lg transition-colors border border-purple-400">
                                                Alquilar por 7 días
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="grid grid-cols-5 gap-1.5 h-full content-start">
                                    {[...Array(40)].map((_, i) => (
                                        <div
                                            key={i}
                                            className="aspect-square bg-slate-800/50 border border-slate-700 hover:border-amber-500/50 hover:bg-slate-700 transition-colors rounded-sm flex items-center justify-center cursor-pointer shadow-inner"
                                        ></div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="mt-1 flex justify-between items-center px-2 py-1 text-[10px] text-slate-500 bg-slate-950 rounded-b">
                            <span>Espacios libres: 40/40</span>
                            <button className="text-amber-500 hover:underline">Organizar</button>
                        </div>
                    </div>
                </div>

            </div>

            {/* --- MODAL POPUP --- */}
            {showAvatarModal && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-8 animate-[fadeIn_0.2s_ease-out]"
                    onClick={() => setShowAvatarModal(false)}
                >
                    <div
                        className="relative bg-slate-900 rounded-lg border-2 border-amber-500 shadow-[0_0_60px_rgba(180,83,9,0.6)] overflow-hidden h-full max-h-[85vh] w-auto flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button onClick={() => setShowAvatarModal(false)} className="absolute top-4 right-4 p-2 bg-black/60 text-slate-200 hover:text-white rounded-full z-50 border border-white/20"><X size={24} /></button>
                        <div className="relative h-full w-full flex items-center justify-center bg-black">
                            <img src={getAvatarImage()} alt="Full Character" className="h-full w-auto object-contain max-w-full" />
                            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-6 text-center pointer-events-none">
                                <h3 className="text-3xl font-serif text-amber-500 uppercase tracking-widest">{raceData.name}</h3>
                                <p className="text-slate-300 text-sm mt-1 uppercase tracking-[0.2em] font-bold">Nivel {user.level} • {user.class_path}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Dashboard;