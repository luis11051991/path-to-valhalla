import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom'; 
import { BookOpen, Skull, Sword, Shield, Info, HelpCircle, X, Heart, Crosshair, Ban, Gift } from 'lucide-react';
import { apiUrl } from '../constants/api';

const Bestiary = ({ user: propUser, onUpdateUser: propOnUpdateUser }) => {
    const contextData = useOutletContext();
    const user = propUser || (contextData ? contextData[0] : null);
    void propOnUpdateUser;
    
    const [enemies, setEnemies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedEnemy, setSelectedEnemy] = useState(null);
    
    // CORRECCIÓN: Siempre inicia en la pestaña 0 (Niveles 1-10) por defecto
    const [activeTabTier, setActiveTabTier] = useState(0); 

    const fetchBestiary = useCallback(async () => {
        try {
            const res = await fetch(apiUrl('/api/bestiary'), { 
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            if (data.success) {
                setEnemies(data.bestiary);
                // NOTA: Eliminamos el auto-salto de nivel para evitar pantallas vacías
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!user) return;
        const timer = setTimeout(() => {
            void fetchBestiary();
        }, 0);
        return () => clearTimeout(timer);
    }, [fetchBestiary, user]);

    // --- LÓGICA DE FILTRADO POR PESTAÑAS ---
    const groupedEnemies = useMemo(() => {
        const groups = {};
        // Inicializamos el Tier 0 para asegurar que la pestaña 1-10 siempre exista
        groups[0] = []; 
        
        enemies.forEach(enemy => {
            const tier = Math.floor((enemy.min_level - 1) / 10);
            if (!groups[tier]) groups[tier] = [];
            groups[tier].push(enemy);
        });
        return groups;
    }, [enemies]);

    const activeEnemies = groupedEnemies[activeTabTier] || [];
    // Obtenemos las claves numéricas y las ordenamos
    const availableTiers = Object.keys(groupedEnemies).map(Number).sort((a,b) => a-b);

    // --- RENDER DE CARTA ---
    const MonsterCard = ({ enemy }) => {
        const isDiscovered = enemy.kills > 0;
        
        const tierColors = {
            1: 'border-slate-600',
            2: 'border-yellow-600',
            3: 'border-red-600',
            4: 'border-purple-600'
        };
        const borderColor = isDiscovered ? (tierColors[enemy.difficulty_tier] || 'border-slate-600') : 'border-slate-800';

        return (
            <div 
                onClick={() => isDiscovered && setSelectedEnemy(enemy)}
                className={`relative group aspect-[3/4] rounded-xl border-2 ${borderColor} bg-slate-900 overflow-hidden transition-all duration-300 ${isDiscovered ? 'cursor-pointer hover:scale-105 hover:shadow-[0_0_20px_rgba(0,0,0,0.5)]' : 'opacity-60 grayscale'}`}
            >
                <div className="absolute inset-0 bg-black">
                    {isDiscovered ? (
                        <img src={enemy.image_url} alt={enemy.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-950">
                            <HelpCircle size={48} className="text-slate-700" />
                        </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-90" />
                </div>

                <div className="absolute bottom-0 inset-x-0 p-4">
                    {isDiscovered ? (
                        <>
                            <h3 className="text-lg font-serif font-bold text-slate-200 leading-tight mb-1 truncate">{enemy.name}</h3>
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-400 font-mono">Nvl {enemy.min_level}-{enemy.max_level}</span>
                                <span className="text-red-400 font-bold flex items-center gap-1 bg-red-900/20 px-2 py-0.5 rounded border border-red-900/30">
                                    <Skull size={10} /> {enemy.kills}
                                </span>
                            </div>
                        </>
                    ) : (
                        <div className="text-center text-slate-600 font-serif italic text-sm">Desconocido</div>
                    )}
                </div>
            </div>
        );
    };

    // --- MODAL DE DETALLE (CON DATOS REALES) ---
    const detailModal = selectedEnemy ? (() => {
        const e = selectedEnemy;
        const drops = e.drops || []; 
        const stats = e.calculated_stats || {};

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in p-4" onClick={() => setSelectedEnemy(null)}>
                <div className="bg-slate-900 border-2 border-amber-700/50 rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col md:flex-row shadow-[0_0_50px_rgba(245,158,11,0.1)] relative" onClick={(ev) => ev.stopPropagation()}>
                    
                    <button onClick={() => setSelectedEnemy(null)} className="absolute top-4 right-4 z-10 p-2 bg-black/50 text-white hover:text-red-400 rounded-full transition-colors"><X size={24}/></button>

                    {/* IMAGEN GRANDE */}
                    <div className="w-full md:w-2/5 h-64 md:h-auto relative bg-black">
                        <img src={e.image_url} className="w-full h-full object-cover opacity-100" alt={e.name} />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent md:bg-gradient-to-r" />
                        
                        {e.difficulty_tier >= 3 && (
                            <div className="absolute top-4 left-4 bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg animate-pulse">
                                PELIGRO ALTO
                            </div>
                        )}
                    </div>

                    {/* INFORMACIÓN */}
                    <div className="w-full md:w-3/5 p-6 md:p-8 flex flex-col overflow-y-auto custom-scrollbar bg-slate-900/95">
                        <h2 className="text-3xl md:text-4xl font-serif font-bold text-amber-500 mb-1">{e.name}</h2>
                        <div className="flex items-center gap-4 text-sm text-slate-400 mb-6 font-mono border-b border-slate-800 pb-4">
                            <span className="text-white">Nivel {e.min_level}-{e.max_level}</span>
                            <span>•</span>
                            <span className="text-red-400 flex items-center gap-1"><Skull size={14}/> {e.kills} Eliminaciones</span>
                        </div>

                        <div className="space-y-6">
                            {/* HISTORIA */}
                            <div className="bg-black/40 p-4 rounded-lg border border-slate-800/50">
                                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2"><BookOpen size={12}/> Historia</h3>
                                <p className="text-slate-300 italic font-serif leading-relaxed text-sm">
                                    "{e.description || 'Una criatura salvaje cuyos orígenes se pierden en la niebla del tiempo.'}"
                                </p>
                            </div>

                            {/* ESTADÍSTICAS CALCULADAS */}
                            <div>
                                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2"><Info size={12}/> Estadísticas de Combate</h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    <StatBox icon={<Sword size={16}/>} label="Daño" value={stats.damage || '??'} color="text-red-400" bg="bg-red-900/20" />
                                    <StatBox icon={<Heart size={16}/>} label="Vida" value={stats.hp || '??'} color="text-green-400" bg="bg-green-900/20" />
                                    <StatBox icon={<Shield size={16}/>} label="Armadura" value={stats.armor || '0'} color="text-blue-400" bg="bg-blue-900/20" />
                                    <StatBox icon={<Crosshair size={16}/>} label="Crítico" value={stats.crit || '0%'} color="text-yellow-400" bg="bg-yellow-900/20" />
                                    <StatBox icon={<Ban size={16}/>} label="Bloqueo" value={stats.block || '0%'} color="text-purple-400" bg="bg-purple-900/20" />
                                </div>
                            </div>

                            {/* LOOT / BOTÍN */}
                            <div>
                                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2"><Gift size={12}/> Posible Botín</h3>
                                {drops && drops.length > 0 && drops[0] !== null ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {drops.map((drop, idx) => (
                                            <div key={idx} className="flex items-center gap-3 bg-slate-800/40 p-2 rounded border border-slate-700/50">
                                                {drop.image_url ? (
                                                    <img src={drop.image_url} className="w-8 h-8 object-contain bg-black/50 rounded" alt="Item" />
                                                ) : (
                                                    <div className={`w-8 h-8 rounded bg-slate-700 flex items-center justify-center text-[9px] text-slate-500`}>?</div>
                                                )}
                                                <div className="flex flex-col">
                                                    <span className={`text-xs font-bold ${getRarityColor(drop.rarity)}`}>{drop.name}</span>
                                                    <span className="text-[10px] text-slate-400">Probabilidad: <span className="text-white font-bold">{drop.chance}%</span></span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-slate-500 text-xs italic bg-slate-800/30 p-2 rounded text-center border border-slate-800">
                                        No se han registrado objetos para esta bestia.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    })() : null;

    if (!user) return null;

    return (
        <div className="h-full p-6 md:p-10 flex flex-col font-sans overflow-hidden relative">
            
            {/* HEADER */}
            <div className="shrink-0 mb-6">
                <div className="flex justify-between items-end mb-4">
                    <div>
                        <h2 className="text-4xl font-serif font-bold text-amber-500 flex items-center gap-3">
                            <BookOpen className="text-amber-600" size={32} /> Compendio
                        </h2>
                        <p className="text-slate-400 text-sm mt-1">Colecciona conocimiento derrotando a las bestias de Valhalla.</p>
                    </div>
                    <div className="text-right">
                        <div className="text-2xl font-bold text-slate-200">{enemies.filter(e => e.kills > 0).length} <span className="text-slate-500 text-lg">/ {enemies.length}</span></div>
                        <div className="text-[10px] uppercase tracking-widest text-slate-500">Descubiertos</div>
                    </div>
                </div>

                {/* PESTAÑAS */}
                <div className="flex gap-2 overflow-x-auto no-scrollbar border-b border-slate-800 pb-1">
                    {availableTiers.map(tierIndex => {
                        const startLvl = (tierIndex * 10) + 1;
                        const endLvl = (parseInt(tierIndex) + 1) * 10;
                        const isActive = parseInt(tierIndex) === activeTabTier;

                        return (
                            <button
                                key={tierIndex}
                                onClick={() => setActiveTabTier(parseInt(tierIndex))}
                                className={`
                                    px-4 py-2 rounded-t-lg text-xs font-bold uppercase tracking-wider transition-all border-b-2 whitespace-nowrap
                                    ${isActive 
                                        ? 'bg-amber-900/20 text-amber-400 border-amber-500' 
                                        : 'bg-slate-900 text-slate-500 border-transparent hover:text-slate-300 hover:bg-slate-800'
                                    }
                                `}
                            >
                                Nivel {startLvl}-{endLvl}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* CONTENIDO (GRID) */}
            {loading ? (
                <div className="flex-1 flex items-center justify-center text-slate-500 animate-pulse">Abriendo libro...</div>
            ) : (
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                    {activeEnemies.length === 0 ? (
                        <div className="text-center text-slate-500 mt-20 italic border-2 border-dashed border-slate-800 p-10 rounded-xl">
                            No hay bestias registradas en este rango.
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 pb-10">
                            {activeEnemies.map(enemy => <MonsterCard key={enemy.id} enemy={enemy} />)}
                        </div>
                    )}
                </div>
            )}

            {detailModal}
        </div>
    );
};

// --- SUBCOMPONENTES ---
const StatBox = ({ icon, label, value, color, bg }) => (
    <div className={`p-2 rounded border border-slate-700/50 flex items-center gap-3 ${bg}`}>
        <div className={color}>{icon}</div>
        <div>
            <div className="text-[9px] text-slate-400 uppercase tracking-wide">{label}</div>
            <div className={`font-mono font-bold text-sm ${color} drop-shadow-sm`}>{value}</div>
        </div>
    </div>
);

const getRarityColor = (rarity) => {
    switch (rarity) {
        case 'legendary': return 'text-orange-400';
        case 'epic': return 'text-purple-400';
        case 'rare': return 'text-blue-400';
        case 'uncommon': return 'text-green-400';
        default: return 'text-slate-300';
    }
};

export default Bestiary;
