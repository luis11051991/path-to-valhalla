import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom'; 
import { Sword, Shield, Skull, Trophy, Lock, Clock, Crosshair, Ban, FastForward, Map as MapIcon, ChevronRight } from 'lucide-react';
import { RACES } from '../constants/races';
import { apiUrl } from '../constants/api';

const EXPEDITION_ICONS = {
    back: '/icons/expedition/back_arrow.png',
    header: '/icons/expedition/header_map.png',
    skull: '/icons/expedition/skull.png',
    attack: '/icons/expedition/attack_sword.png',
    bossBadge: '/icons/expedition/boss_badge.png',
    win: '/icons/expedition/win.png',
    lose: '/icons/expedition/lose.png',
};

const Expeditions = ({ user: propUser, onUpdateUser: propOnUpdateUser }) => {
    // --- SOPORTE HÍBRIDO (Props o Contexto) ---
    const contextData = useOutletContext();
    const user = propUser || (contextData ? contextData[0] : null);
    const onUpdateUser = propOnUpdateUser || (contextData ? contextData[1] : null);

    // --- ESTADOS ---
    const [view, setView] = useState('MAP');
    const [selectedZone, setSelectedZone] = useState(null);
    const [zones, setZones] = useState([]);
    const [enemies, setEnemies] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Estado para pestañas (Tier 0 = Niveles 1-10, Tier 1 = 11-20, etc.)
    const [activeTabTier, setActiveTabTier] = useState(0); 

    // Estado de Batalla
    const [battleResult, setBattleResult] = useState(null);
    const [currentEnemy, setCurrentEnemy] = useState(null);
    const [isBattling, setIsBattling] = useState(false);

    // --- COOLDOWN (FIX ZONA HORARIA) ---
    const [cooldownSeconds, setCooldownSeconds] = useState(0);

    const formatCooldown = (seconds) => {
        if (seconds <= 0) return "00h 00m 00s";
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        const pad = (v) => String(v).padStart(2, '0');
        return `${pad(hrs)}h ${pad(mins)}m ${pad(secs)}s`;
    };

    useEffect(() => {
        if (!user || !user.last_expedition_at) return;

        const checkCooldown = () => {
            const now = Date.now();
            let dateString = user.last_expedition_at;
            if (typeof dateString === 'string' && !dateString.endsWith('Z')) {
                dateString += 'Z'; 
            }
            const lastExpedition = new Date(dateString).getTime();
            const diffSeconds = (now - lastExpedition) / 1000;

            let needed = 10;
            if (user.level >= 40) needed = 90;
            else if (user.level >= 30) needed = 70;
            else if (user.level >= 20) needed = 50;
            else if (user.level >= 10) needed = 30;

            if (diffSeconds < needed) {
                setCooldownSeconds(Math.ceil(needed - diffSeconds));
            } else {
                setCooldownSeconds(0);
            }
        };

        checkCooldown();
        const interval = setInterval(checkCooldown, 1000);
        return () => clearInterval(interval);
    }, [user]);

    // --- CARGAR MAPA Y AUTO-SELECCIONAR PESTAÑA (CORREGIDO) ---
    useEffect(() => {
        fetch(apiUrl('/api/expeditions'), {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    const fetchedZones = data.expeditions;
                    setZones(fetchedZones);

                    // --- LÓGICA DE AUTO-SELECCIÓN ROBUSTA ---
                    // 1. Identificar qué tiers tienen mapas realmente
                    const tiersWithData = new Set();
                    fetchedZones.forEach(zone => {
                        const tier = Math.floor((zone.level_req - 1) / 10);
                        tiersWithData.add(tier);
                    });
                    // Ordenar tiers disponibles (ej: [0, 2, 5])
                    const sortedAvailableTiers = Array.from(tiersWithData).sort((a, b) => a - b);

                    // 2. Calcular el tier ideal basado en el nivel del jugador
                    let targetTier = 0;
                    if (user && user.level) {
                        targetTier = Math.floor((user.level - 1) / 10);
                    }

                    // 3. Decisión final:
                    // Si el tier ideal del jugador NO tiene datos, usar el primer tier disponible.
                    let finalTierToSelect = targetTier;
                    if (!tiersWithData.has(targetTier) && sortedAvailableTiers.length > 0) {
                        finalTierToSelect = sortedAvailableTiers[0];
                    }

                    // Aplicar la selección
                    setActiveTabTier(finalTierToSelect);
                }
                setLoading(false);
            })
            .catch(err => console.error(err));
    }, [user?.level]); // Se recalcula si el usuario sube de nivel

    // --- CÁLCULO DE STATS REALES ---
    const playerStats = useMemo(() => {
        if (!user) return {}; 
        let bonuses = { strength: 0, dexterity: 0, constitution: 0, luck: 0, armor: 0, damage_min: 0, damage_max: 0 };

        if (user.real_inventory) {
            user.real_inventory.forEach(item => {
                if (item.is_equipped && item.base_stats) {
                    Object.entries(item.base_stats).forEach(([key, val]) => {
                        let valueToAdd = Array.isArray(val) ? Math.floor((val[0] + val[1]) / 2) : val;
                        if (bonuses[key] !== undefined) bonuses[key] += valueToAdd;
                    });
                }
            });
        }

        const totalStr = (user.stats?.strength || 0) + bonuses.strength;
        const totalDex = (user.stats?.dexterity || 0) + bonuses.dexterity;
        const totalCon = (user.stats?.constitution || 0) + bonuses.constitution;
        const totalLuck = (user.stats?.luck || 0) + bonuses.luck;

        const maxHp = user.calculatedMaxHp ?? user.calculated_max_hp ?? 0;
        const strBonus = totalStr * 2;

        return {
            maxHp,
            damageMin: (bonuses.damage_min || 0) + strBonus,
            damageMax: (bonuses.damage_max || 0) + strBonus,
            defense: (bonuses.armor || 0) + Math.floor(totalCon / 2),
            critChance: Math.min(totalDex * 0.25, 25).toFixed(1),
            blockChance: Math.min(totalLuck * 0.25, 25).toFixed(1)
        };
    }, [user]);

    // --- LÓGICA DE AGRUPACIÓN DE ZONAS ---
    const groupedZones = useMemo(() => {
        const groups = {};
        zones.forEach(zone => {
            // Calculamos el Tier: 1-10 -> 0, 11-20 -> 1, etc.
            const tier = Math.floor((zone.level_req - 1) / 10);
            if (!groups[tier]) groups[tier] = [];
            groups[tier].push(zone);
        });
        return groups;
    }, [zones]);

    const activeZones = groupedZones[activeTabTier] || [];
    // Obtenemos solo los keys (tiers) que existen en el objeto agrupado
    const availableTiers = Object.keys(groupedZones).map(Number).sort((a,b) => a-b);

    // --- ACCIONES ---
    const handleSelectZone = (zone) => {
        if (user.level < zone.level_req) return;
        setSelectedZone(zone);
        setLoading(true);
        fetch(apiUrl(`/api/expeditions/${zone.id}/enemies`), {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setEnemies(data.enemies);
                    setView('ENEMIES');
                }
                setLoading(false);
            })
            .catch(err => { console.error(err); setLoading(false); });
    };

    const handleAttack = async (enemy) => {
        if (cooldownSeconds > 0) return;
        if (user.energy < 5) { alert("¡Necesitas 5 de Energía!"); return; }
        if (user.current_hp <= 5) { alert("¡Estás muy herido!"); return; }

        setIsBattling(true);
        setCurrentEnemy(enemy);

        try {
            const res = await fetch(apiUrl('/api/expeditions/start'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ userId: user.id, enemyId: enemy.id, zoneId: selectedZone.id })
            });

            const data = await res.json();

            if (data.success) {
                setBattleResult(data.combatResult);
                setView('BATTLE');
                fetch(apiUrl('/api/auth/profile'), {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                }).then(r => r.json()).then(d => { if (d.user) onUpdateUser(d.user); });
            } else {
                alert(data.message);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsBattling(false);
        }
    };

    // --- HELPER IMÁGENES ---
    const getAvatarImage = () => {
        if (user.class_image) {
            const dbPath = user.class_image;
            const genderSuffix = user.gender === 'female' ? '_female' : '_male';
            if (dbPath.includes('_male') || dbPath.includes('_female')) return dbPath;
            const lastDotIndex = dbPath.lastIndexOf('.');
            if (lastDotIndex === -1) return dbPath + genderSuffix + ".png";
            return `${dbPath.substring(0, lastDotIndex)}${genderSuffix}${dbPath.substring(lastDotIndex)}`;
        }
        const raceData = RACES.find(r => r.id === user.race);
        return raceData ? (raceData.images[user.gender] || raceData.images.male) : "https://via.placeholder.com/300?text=Hero";
    };

    const getPlayerBackground = () => {
        if (user.active_background_url) return user.active_background_url;
        const raceData = RACES.find(r => r.id === user.race);
        return raceData ? raceData.bgImage : null;
    };

    if (!user) return null; 
    if (loading && view === 'MAP' && zones.length === 0) return <div className="text-center mt-20 text-slate-500 animate-pulse">Cargando mapa...</div>;

    return (
        <div className="h-full relative overflow-hidden flex flex-col font-sans">

            {cooldownSeconds > 0 && (
                <div className="bg-red-900/90 text-white text-center py-2 font-bold uppercase tracking-widest text-xs sticky top-0 z-50 flex items-center justify-center gap-2 shadow-lg border-b border-red-500 animate-in slide-in-from-top">
                    <Clock size={16} className="animate-spin-slow" />
                    Descansando... Próximo ataque en: {formatCooldown(cooldownSeconds)}
                </div>
            )}

            <div className="flex-1 overflow-hidden relative">

                {/* VISTA 1: MAPA (NUEVO DISEÑO) */}
                {view === 'MAP' && (
                    <div className="flex flex-col h-full">
                        {/* HEADER + PESTAÑAS */}
                        <div className="p-6 pb-2 shrink-0 bg-slate-950/80 backdrop-blur-sm z-10 border-b border-slate-800">
                            <h2 className="text-3xl font-serif text-amber-500 mb-6 flex items-center gap-3 drop-shadow-md">
                                <img src={EXPEDITION_ICONS.header} alt="Mapa" className="w-8 h-8 object-contain" />
                                Mapa de Expediciones
                            </h2>
                            
                            {/* BARRA DE PESTAÑAS DE NIVELES */}
                            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                                {availableTiers.length === 0 ? (
                                    // Si no hay NINGÚN mapa en toda la base de datos
                                    <span className="text-slate-500 text-sm italic">No hay mapas disponibles.</span>
                                ) : (
                                    availableTiers.map(tierIndex => {
                                        const startLvl = (tierIndex * 10) + 1;
                                        const endLvl = (parseInt(tierIndex) + 1) * 10;
                                        const isActive = tierIndex === activeTabTier;
                                        const isAccessible = user.level >= startLvl;

                                        return (
                                            <button
                                                key={tierIndex}
                                                onClick={() => setActiveTabTier(tierIndex)}
                                                className={`
                                                    relative px-6 py-2 rounded-t-lg text-sm font-bold uppercase tracking-wider transition-all border-b-2 whitespace-nowrap
                                                    ${isActive 
                                                        ? 'bg-amber-900/30 text-amber-400 border-amber-500 shadow-[0_-4px_15px_rgba(245,158,11,0.1)]' 
                                                        : isAccessible
                                                            ? 'bg-slate-900 text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800'
                                                            : 'bg-slate-950 text-slate-600 border-transparent opacity-60 cursor-not-allowed'
                                                    }
                                                `}
                                            >
                                                Nivel {startLvl}-{endLvl}
                                                {!isAccessible && <Lock size={12} className="absolute top-1 right-1 text-slate-700" />}
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* LISTA RECTANGULAR DE MAPAS */}
                        <div className="flex-1 overflow-y-auto p-6 pt-4 custom-scrollbar space-y-4">
                            {activeZones.length === 0 ? (
                                <div className="text-center text-slate-500 mt-20 italic border-2 border-dashed border-slate-800 p-10 rounded-xl">
                                    No hay mapas descubiertos en este rango de niveles.
                                </div>
                            ) : (
                                activeZones.map(zone => {
                                    const isLocked = user.level < zone.level_req;
                                    return (
                                        <div 
                                            key={zone.id} 
                                            onClick={() => !isLocked && handleSelectZone(zone)} 
                                            className={`
                                                relative w-full h-32 md:h-40 rounded-xl overflow-hidden border-2 transition-all group shrink-0
                                                ${isLocked 
                                                    ? 'border-slate-800 grayscale cursor-not-allowed opacity-60' 
                                                    : 'border-slate-700 hover:border-amber-500 cursor-pointer shadow-lg hover:shadow-[0_0_20px_rgba(245,158,11,0.2)]'
                                                }
                                            `}
                                        >
                                            {/* IMAGEN DE FONDO PANORÁMICA */}
                                            <div className="absolute inset-0">
                                                <img 
                                                    src={zone.image_url} 
                                                    className={`w-full h-full object-cover transition-transform duration-700 ${!isLocked && 'group-hover:scale-105'}`} 
                                                    alt={zone.name}
                                                />
                                                {/* GRADIENTE PARA LEER TEXTO */}
                                                <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/70 to-transparent" />
                                            </div>

                                            {/* CONTENIDO DEL RECTÁNGULO */}
                                            <div className="relative z-10 h-full flex justify-between items-center px-6 md:px-10">
                                                
                                                {/* IZQUIERDA: INFORMACIÓN */}
                                                <div className="max-w-[60%] flex flex-col justify-center h-full">
                                                    <h3 className={`text-2xl font-serif font-bold mb-1 ${isLocked ? 'text-slate-500' : 'text-amber-100 group-hover:text-white'}`}>
                                                        {zone.name}
                                                    </h3>
                                                    <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
                                                        <span className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded border border-white/5">
                                                            <MapIcon size={12} /> Zona {zone.id}
                                                        </span>
                                                        {/* Aquí podrías añadir info de drops si la tuvieras disponible */}
                                                    </div>
                                                </div>

                                                {/* DERECHA: ESTADO / ACCIÓN */}
                                                <div className="flex flex-col items-end gap-2">
                                                    {isLocked ? (
                                                        <div className="flex items-center gap-2 text-red-500 font-bold bg-black/60 px-4 py-2 rounded-lg border border-red-900/50 backdrop-blur-sm">
                                                            <Lock size={18} />
                                                            <span>NIVEL {zone.level_req}</span>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div className="text-green-400 text-xs font-bold uppercase tracking-widest mb-1 flex items-center gap-1">
                                                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Disponible
                                                            </div>
                                                            <button className="flex items-center gap-2 bg-amber-700 hover:bg-amber-600 text-white px-6 py-3 rounded-lg font-bold uppercase text-sm shadow-lg transition-transform group-hover:translate-x-1 border border-amber-500">
                                                                Explorar <ChevronRight size={16} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}

                {/* VISTA 2: ENEMIGOS */}
                {view === 'ENEMIES' && selectedZone && (
                    <div className="h-full flex flex-col relative">
                        <div className="absolute inset-0 z-0">
                            <img src={selectedZone.image_url} className="w-full h-full object-cover opacity-100" />
                            <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/30 to-slate-950/90" />
                        </div>

                        <div className="relative z-10 p-6 flex flex-col h-full overflow-y-auto custom-scrollbar">
                            <button onClick={() => { setView('MAP'); setSelectedZone(null); }} className="self-start mb-4 flex items-center gap-2 text-slate-200 hover:text-white transition-colors bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm hover:bg-black/60">
                                <img
                                    src={EXPEDITION_ICONS.back}
                                    alt="Volver"
                                    className="w-8 h-8 object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.6)]"
                                />
                            </button>
                            <h2 className="text-4xl font-serif text-amber-500 mb-8 text-center drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] tracking-wide">
                                {selectedZone.name}
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 px-4 pb-20">
                                {enemies.map((enemy) => (
                                    <EnemyCard
                                        key={enemy.id}
                                        enemy={enemy}
                                        user={user}
                                        onAttack={() => handleAttack(enemy)}
                                        disabled={isBattling || cooldownSeconds > 0}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* VISTA 3: BATALLA */}
                {view === 'BATTLE' && battleResult && (
                    <BattleModal
                        result={battleResult}
                        user={user}
                        baseEnemy={currentEnemy}
                        playerImage={getAvatarImage()}
                        playerBg={getPlayerBackground()}
                        playerStats={playerStats}
                        zoneImage={selectedZone?.image_url}
                        onClose={() => { setView('ENEMIES'); setBattleResult(null); setCurrentEnemy(null); }}
                    />
                )}
            </div>
        </div>
    );
};

// --- COMPONENTE CARTA ENEMIGO ---
const EnemyCard = ({ enemy, user, onAttack, disabled }) => {
    const DIFFICULTY_CONFIG = {
        1: { label: 'Fácil', color: 'text-green-400', border: 'border-green-900/30' },
        2: { label: 'Medio', color: 'text-yellow-400', border: 'border-yellow-900/30' },
        3: { label: 'Difícil', color: 'text-red-500', border: 'border-red-900/30' },
        4: { label: 'Mortal', color: 'text-purple-500', border: 'border-purple-900/30' }
    };

    const tierConfig = DIFFICULTY_CONFIG[enemy.difficulty_tier] || DIFFICULTY_CONFIG[1];
    const containerClasses = enemy.is_boss
        ? "border-2 border-amber-400 shadow-[0_0_30px_rgba(251,191,36,0.4)] scale-105 z-10 ring-1 ring-yellow-200/50"
        : `border border-slate-700 hover:border-amber-500 ${tierConfig.border}`;

    return (
        <div className={`relative bg-slate-900/95 transition-all group overflow-hidden flex flex-col backdrop-blur-md rounded-xl ${containerClasses}`}>
            {enemy.is_boss && (
                <>
                    <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/10 via-transparent to-amber-500/10 animate-pulse pointer-events-none" />
                    <div className="absolute -top-10 -left-10 w-20 h-20 bg-yellow-500/40 blur-xl rounded-full pointer-events-none" />
                    <div className="absolute -bottom-10 -right-10 w-20 h-20 bg-red-600/40 blur-xl rounded-full pointer-events-none" />
                    <div className="absolute top-0 right-0 bg-gradient-to-l from-yellow-600 via-amber-600 to-amber-700 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl z-20 shadow-lg border-b border-l border-yellow-300 flex items-center gap-2">
                        <img src={EXPEDITION_ICONS.bossBadge} alt="Boss" className="w-4 h-4 object-contain" />
                        BOSS DE ZONA
                    </div>
                </>
            )}

            {!enemy.is_boss && (
                <div className={`absolute top-0 right-0 bg-black/60 px-2 py-1 rounded-bl-lg z-20 text-[10px] font-bold uppercase ${tierConfig.color}`}>
                    {tierConfig.label}
                </div>
            )}

            <div className={`h-48 overflow-hidden relative ${enemy.is_boss ? 'bg-gradient-to-b from-amber-900/20 to-black/80' : 'bg-black/50'}`}>
                <img
                    src={enemy.image_url}
                    alt={enemy.name}
                    className={`w-full h-full object-contain p-2 transition-transform duration-500 ${disabled ? 'grayscale opacity-50' : 'group-hover:scale-110'}`}
                    onError={(e) => e.target.src = "https://via.placeholder.com/150?text=Monstruo"}
                />
            </div>

            <div className="p-4 flex-1 flex flex-col relative z-10">
                <h3 className={`font-bold text-lg leading-tight mb-1 truncate ${enemy.is_boss ? 'text-amber-400 drop-shadow-md' : 'text-slate-200'}`}>
                    {enemy.name}
                </h3>

                <div className="text-xs text-slate-500 mb-4 flex justify-between items-center">
                    <span>Nvl {enemy.min_level}-{enemy.max_level}</span>
                    <span className={`${enemy.is_boss ? 'text-red-400 font-black tracking-wider' : tierConfig.color} flex items-center gap-2`}>
                        {enemy.is_boss && (
                            <img src={EXPEDITION_ICONS.skull} alt="Dificultad" className="w-7 h-7 object-contain drop-shadow-[0_0_8px_rgba(248,113,113,0.7)]" />
                        )}
                        {enemy.is_boss ? 'INFERNAL' : tierConfig.label}
                    </span>
                </div>
                <div className="mt-auto">
                    <button
                        onClick={onAttack}
                        disabled={disabled}
                        className={`w-full py-3 rounded font-bold uppercase text-xs tracking-wider flex items-center justify-center gap-2 transition-all 
                        ${disabled
                                ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700'
                                : enemy.is_boss
                                    ? 'bg-gradient-to-r from-red-700 via-red-600 to-amber-700 text-white shadow-[0_0_15px_rgba(220,38,38,0.5)] hover:scale-[1.02] border border-red-500'
                                    : 'bg-gradient-to-r from-amber-700 to-amber-600 text-white shadow-lg hover:scale-[1.02]'
                            }`}
                    >
                        {disabled ? 'Descansando...' : (
                            <>
                                <img src={EXPEDITION_ICONS.attack} alt="Atacar" className="w-6 h-6 object-contain drop-shadow-[0_0_6px_rgba(255,255,255,0.4)]" />
                                {enemy.is_boss ? 'DESAFIAR JEFE' : 'Atacar (5E)'}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- COMPONENTE MODAL DE BATALLA ---
const BattleModal = ({ result, onClose, user, playerImage, playerBg, baseEnemy, playerStats, zoneImage }) => {
    const enemyStats = result.enemy_stats || {};
    const isEnemyReady = enemyStats.hp_max != null;
    const initialEnemyHpValue = enemyStats.hp_max ?? result.initialEnemyHp ?? 0;
    const initialEnemyHpCurrent = enemyStats.hp_current ?? initialEnemyHpValue;
    const [visibleLines, setVisibleLines] = useState([]);
    const [currentHp, setCurrentHp] = useState({ player: result.initialPlayerHp, enemy: initialEnemyHpCurrent });
    const [isFinished, setIsFinished] = useState(false);
    
    // NUEVO: Estado para contar el daño acumulado
    const [totalDamage, setTotalDamage] = useState({ player: 0, enemy: 0 });

    const scrollRef = useRef(null);
    const timerRef = useRef(null); 

    useEffect(() => {
        let idx = 0;
        const log = result.log || [];

        setCurrentHp({
            player: result.initialPlayerHp,
            enemy: initialEnemyHpCurrent
        });
        
        setTotalDamage({ player: 0, enemy: 0 });

        timerRef.current = setInterval(() => {
            if (idx < log.length) {
                const line = log[idx];
                if (line) {
                    setVisibleLines(prev => [...prev, line]);
                    
                    // Actualizar HP
                    setCurrentHp(prev => ({
                        player: line.playerHp !== undefined ? Math.max(0, line.playerHp) : prev.player,
                        enemy: line.enemyHp !== undefined ? Math.max(0, line.enemyHp) : prev.enemy
                    }));

                    // Actualizar Contadores de Daño
                    if (line.damage) {
                        if (line.type === 'player_atk') {
                            setTotalDamage(prev => ({ ...prev, player: prev.player + line.damage }));
                        }
                        if (line.type === 'enemy_atk') {
                            setTotalDamage(prev => ({ ...prev, enemy: prev.enemy + line.damage }));
                        }
                    }
                }
                idx++;
                if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            } else {
                setIsFinished(true);
                clearInterval(timerRef.current);
            }
        }, 600); 

        return () => clearInterval(timerRef.current);
    }, [result]);

    const handleSkip = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        setVisibleLines(result.log);
        setIsFinished(true); 
        
        setCurrentHp({
            player: Math.max(0, result.finalPlayerHp),
            enemy: Math.max(0, result.isWin ? 0 : (result.log[result.log.length - 2]?.enemyHp || 0))
        });

        // Calcular daño total instantáneo recorriendo todo el log
        let finalDmgPlayer = 0;
        let finalDmgEnemy = 0;
        result.log.forEach(line => {
            if (line.damage) {
                if (line.type === 'player_atk') finalDmgPlayer += line.damage;
                if (line.type === 'enemy_atk') finalDmgEnemy += line.damage;
            }
        });
        setTotalDamage({ player: finalDmgPlayer, enemy: finalDmgEnemy });

        if (scrollRef.current) setTimeout(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, 100);
    };

    const playerPct = Math.max(0, result.initialPlayerHp ? (currentHp.player / result.initialPlayerHp) * 100 : 0);
    const enemyPct = Math.max(0, initialEnemyHpValue ? (currentHp.enemy / initialEnemyHpValue) * 100 : 0);

    return (
        <div className="fixed inset-0 z-[100] flex flex-col bg-slate-950 animate-in fade-in duration-300">

            {/* BOTÓN SKIP ABSOLUTO */}
            {!isFinished && (
                <button 
                    onClick={handleSkip}
                    className="absolute top-24 right-8 z-[200] bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white px-6 py-2 rounded-full border-2 border-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.8)] flex items-center gap-2 transition-all hover:scale-105 active:scale-95 group"
                >
                    <FastForward size={20} className="fill-white group-hover:rotate-180 transition-transform" /> 
                    <span className="text-xs font-black uppercase tracking-widest drop-shadow-md">OMITIR</span>
                </button>
            )}

            {/* 1. ARENA VISUAL (SUPERIOR - 55%) */}
            <div className="h-[55%] relative flex items-center justify-center border-b-4 border-amber-900 shadow-2xl pt-16 overflow-hidden">
                <div className="absolute inset-0 z-0">
                    <img
                        src={zoneImage || '/backgrounds/arena_bg.png'}
                        className="w-full h-full object-cover opacity-100"
                        alt="Battle Background"
                    />
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />
                </div>

                {/* CONTENEDOR PRINCIPAL DE LUCHADORES */}
                <div className="relative z-10 flex items-center justify-center gap-8 md:gap-16 w-full px-4">
                    
                    {/* LADO JUGADOR */}
                    <div className="flex flex-col items-center gap-4 animate-in slide-in-from-left duration-500">
                        {/* CONTADOR DE DAÑO */}
                        <div className="text-white font-black text-2xl drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] flex flex-col items-center">
                            <span className="text-[10px] text-slate-300 uppercase tracking-widest font-normal mb-1">Daño Total</span>
                            {totalDamage.player}
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="hidden md:flex flex-col gap-2 text-right bg-black/60 p-3 rounded-lg border-r-2 border-amber-600 backdrop-blur-md shadow-lg">
                                <div className="text-amber-500 font-bold text-xs uppercase tracking-widest mb-1 border-b border-white/10 pb-1">Tus Stats</div>
                                <StatRow icon={<Sword size={12} />} label="Daño" value={`${playerStats.damageMin}-${playerStats.damageMax}`} />
                                <StatRow icon={<Shield size={12} />} label="Defensa" value={playerStats.defense} />
                                <StatRow icon={<Crosshair size={12} />} label="Crítico" value={`${playerStats.critChance}%`} color="text-yellow-400" />
                                <StatRow icon={<Ban size={12} />} label="Bloqueo" value={`${playerStats.blockChance}%`} color="text-blue-400" />
                            </div>

                            <div className="w-36 md:w-56 bg-slate-900 border-2 border-amber-600 rounded-lg shadow-[0_0_40px_rgba(245,158,11,0.3)] overflow-hidden flex flex-col transform hover:scale-105 transition-transform">
                                <div className="h-40 md:h-56 bg-slate-800 relative">
                                    {playerBg && <img src={playerBg} className="absolute inset-0 w-full h-full object-cover opacity-60" alt="User Bg" />}
                                    <img
                                        src={playerImage}
                                        className="relative z-10 w-full h-full object-contain object-bottom drop-shadow-[0_0_25px_rgba(0,0,0,0.9)]"
                                        style={{ filter: 'contrast(1.28) saturate(1.2) brightness(0.9)' }}
                                        alt="Hero"
                                    />
                                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-900 to-transparent h-10 z-20" />
                                </div>
                                <div className="p-2 bg-slate-950 text-center border-t border-slate-800">
                                    <div className="text-amber-500 font-bold text-xs md:text-sm truncate uppercase tracking-wider">{user.username}</div>
                                    <div className="w-full h-3 bg-slate-800 rounded-full mt-2 overflow-hidden border border-slate-700 relative">
                                        <div className="h-full bg-gradient-to-r from-green-600 to-green-400 transition-all duration-500" style={{ width: `${playerPct}%` }} />
                                    </div>
                                    <div className="text-[10px] text-slate-400 mt-1 font-mono font-bold">{currentHp.player} HP</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* VS */}
                    <div className="text-4xl md:text-7xl font-serif text-white/20 italic font-bold select-none drop-shadow-lg">VS</div>

                    {/* LADO ENEMIGO */}
                    <div className="flex flex-col items-center gap-4 animate-in slide-in-from-right duration-500">
                        {/* CONTADOR DE DAÑO */}
                        <div className="text-white font-black text-2xl drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] flex flex-col items-center">
                            <span className="text-[10px] text-slate-300 uppercase tracking-widest font-normal mb-1">Daño Total</span>
                            {totalDamage.enemy}
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="w-36 md:w-56 bg-slate-900 border-2 border-red-600 rounded-lg shadow-[0_0_40px_rgba(220,38,38,0.3)] overflow-hidden flex flex-col transform hover:scale-105 transition-transform">
                                <div className="h-40 md:h-56 bg-slate-800 relative">
                                    <img src={result.enemyImage} className="w-full h-full object-cover" alt="Enemy" onError={(e) => e.target.src = "https://via.placeholder.com/150?text=Enemy"} />
                                    {baseEnemy?.is_boss && <div className="absolute top-2 right-2 bg-red-600 text-white text-[9px] px-2 py-0.5 rounded font-bold animate-pulse shadow-lg">BOSS</div>}
                                </div>
                                <div className="p-2 bg-slate-950 text-center border-t border-slate-800">
                                    <div className="text-red-400 font-bold text-xs md:text-sm truncate uppercase tracking-wider">{result.enemyName}</div>
                                    <div className="w-full h-3 bg-slate-800 rounded-full mt-2 overflow-hidden border border-slate-700 relative">
                                        <div className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-500" style={{ width: `${enemyPct}%` }} />
                                    </div>
                                    <div className="text-[10px] text-slate-400 mt-1 font-mono font-bold">
                                        {isEnemyReady ? `${currentHp.enemy}/${initialEnemyHpValue} HP` : '...'}
                                    </div>
                                </div>
                            </div>

                            <div className="hidden md:flex flex-col gap-2 text-left bg-black/60 p-3 rounded-lg border-l-2 border-red-600 backdrop-blur-md shadow-lg">
                                <div className="text-red-500 font-bold text-xs uppercase tracking-widest mb-1 border-b border-white/10 pb-1">Enemigo</div>
                                <StatRow icon={<Sword size={12} />} label="Daño" value={`${enemyStats.damage_min ?? 0}-${enemyStats.damage_max ?? 0}`} align="left" />
                                <StatRow icon={<Shield size={12} />} label="Armadura" value={enemyStats.armor ?? 0} align="left" />
                                <StatRow icon={<Crosshair size={12} />} label="Crítico" value={`${enemyStats.crit_chance ?? 0}%`} color="text-yellow-600" align="left" />
                                <StatRow icon={<Ban size={12} />} label="Bloqueo" value={`${enemyStats.block_chance ?? 0}%`} color="text-blue-400" align="left" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. LOG DE BATALLA Y MULTITUD (INFERIOR - 45%) */}
            <div className="h-[45%] flex flex-col bg-slate-950 relative overflow-hidden">
                
                {/* --- MULTITUD ALENTANDO (LADOS) - ANCHO AUMENTADO AL 35% --- */}
                <img 
                    src="/decors/battle/vikings_cheer.png" 
                    className="absolute bottom-0 left-0 h-full w-[35%] object-cover object-bottom opacity-60 pointer-events-none z-0" 
                    alt="Vikings" 
                />
                <img 
                    src="/decors/battle/mobs_cheer.png" 
                    className="absolute bottom-0 right-0 h-full w-[35%] object-cover object-bottom opacity-60 pointer-events-none z-0 scale-x-[-1]" 
                    alt="Mobs" 
                />

                <div className="absolute top-0 inset-x-0 h-6 bg-gradient-to-b from-black/60 to-transparent pointer-events-none z-10" />

                {/* --- CONTENEDOR LOG (Flexible) --- */}
                <div className="flex-1 flex flex-col relative z-10 overflow-hidden">
                    <div className="flex-1 flex justify-center overflow-hidden px-6 pb-1 pt-0">
                        <div 
                            className="w-full max-w-xl bg-slate-950 border-2 border-blue-900/50 rounded-xl p-4 shadow-[0_0_50px_rgba(0,0,0,0.8)] h-full overflow-y-auto custom-scrollbar flex flex-col"
                            ref={scrollRef}
                        >
                            <div className="space-y-2 font-mono text-sm text-slate-300">
                                {visibleLines.map((line, idx) => (
                                    <div key={idx} className={`py-2 px-4 rounded ${getLogStyle(line.type)} animate-in slide-in-from-bottom-2`}>
                                        {line.msg}
                                    </div>
                                ))}
                            </div>

                            {/* MENSAJE DE VICTORIA/DERROTA (DENTRO DEL LOG) */}
                            {isFinished && (
                                <div className="mt-4 flex flex-col items-center animate-in zoom-in duration-500">
                                    <img
                                        src={result.isWin ? EXPEDITION_ICONS.win : EXPEDITION_ICONS.lose}
                                        alt={result.isWin ? "Victory" : "Defeat"}
                                        className="w-32 h-32 object-contain drop-shadow-[0_0_15px_rgba(0,0,0,0.8)]"
                                    />
                                    {/* TEXTO CALIGRÁFICO/ÉPICO ÚNICO */}
                                    <div className={`text-4xl font-serif font-bold italic tracking-wide mt-4 ${result.isWin ? 'text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-200 drop-shadow-[0_0_15px_rgba(250,204,21,0.8)]' : 'text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-red-600 to-red-400 drop-shadow-[0_0_15px_rgba(220,38,38,0.8)]'}`}>
                                        {result.isWin ? 'Victoria' : 'Derrota'}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* BOTONERA FINAL */}
                    {isFinished && (
                        <div className="p-4 bg-slate-900/95 border-t border-amber-900/30 flex flex-col items-center animate-in slide-in-from-bottom shadow-[0_-10px_30px_rgba(0,0,0,0.5)] z-20 shrink-0">
                            {result.isWin && (
                                <div className="flex flex-wrap gap-2 justify-center mb-4">
                                    <RewardBadge label={`${result.rewards.xp} XP`} color="text-purple-300" />
                                    <RewardBadge label={`${result.rewards.copper} Cobre`} color="text-yellow-300" />
                                    {result.rewards.items?.map((item, i) => (
                                        <RewardBadge key={i} label={`${item.qty}x ${item.name}`} color="text-white" icon />
                                    ))}
                                </div>
                            )}
                            <button onClick={onClose} className="w-full max-w-md py-4 bg-gradient-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white font-bold uppercase rounded shadow-[0_0_20px_rgba(245,158,11,0.4)] transition-all transform hover:scale-105">
                                {result.isWin ? 'Recoger Botín' : 'Volver al Mapa'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Sub-componentes visuales
const StatRow = ({ icon, label, value, color = "text-slate-200", align = "right" }) => (
    <div className={`flex items-center gap-2 text-[10px] md:text-xs ${align === "left" ? "flex-row" : "flex-row-reverse"}`}>
        <span className="text-slate-500">{icon}</span>
        <span className="text-slate-400 uppercase">{label}</span>
        <span className={`font-mono font-bold ${color}`}>{value}</span>
    </div>
);

const RewardBadge = ({ label, color, icon }) => (
    <span className={`bg-slate-800 px-3 py-1.5 rounded text-xs border border-slate-700 ${color} flex items-center gap-2 shadow-sm`}>
        {icon && <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />} {label}
    </span>
);

const getLogStyle = (type) => {
    switch (type) {
        case 'round': return "text-slate-500 font-bold text-center border-b border-slate-800/50 mt-4 mb-2 pb-1 text-xs tracking-[0.2em]";
        case 'player_atk': return "text-blue-300 bg-blue-900/10 border-l-4 border-blue-500 shadow-sm";
        case 'enemy_atk': return "text-red-300 bg-red-900/10 border-l-4 border-red-500 shadow-sm";
        case 'info': return "text-yellow-500 italic text-center opacity-80 mt-2 text-xs";
        default: return "text-slate-300";
    }
};

export default Expeditions;