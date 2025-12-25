import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle, X, AlertTriangle } from 'lucide-react';
import { apiUrl } from '../constants/api';

const VALHALLA_ICONS = {
    gold: '/icons/valhalla/gold_coin.png',
    silver: '/icons/valhalla/silver_coin.png',
    copper: '/icons/valhalla/copper_coin.png',
    headerActive: '/icons/valhalla/header_active.png',
    headerBoard: '/icons/valhalla/header_board.png',
    headerWeekly: '/icons/valhalla/header_weekly.png',
    inProgress: '/icons/valhalla/in_progress.png',
    refresh: '/icons/valhalla/refresh.png',
    rewardXp: '/icons/valhalla/reward_xp.png',
    tabDaily: '/icons/valhalla/tab_daily.png',
    tabWeekly: '/icons/valhalla/tab_weekly.png',
};

// Tabla de XP (igual que TopBar/Dashboard)
const XP_TABLE = [
    0, // Nivel 0 no existe
    15, 40, 65, 90, 115, 140, 165, 190, 215, 240,
    265, 290, 315, 340, 365, 390, 415, 440, 465, 490,
    515, 540, 565, 595, 625, 655, 685, 720, 755, 790,
    830, 870, 915, 960, 1010, 1060, 1115, 1170, 1230, 1290,
    1355, 1420, 1490, 1565, 1645, 1725, 1810, 1900, 1995, 2095,
    2200, 2310, 2425, 2545, 2670, 2805, 2945, 3090, 3245, 3405,
    3575, 3755, 3940, 4135, 4340, 4555, 4780, 5020, 5270, 5535,
    5810, 6100, 6405, 6725, 7060, 7415, 7785, 8175, 8585, 9015,
    9465, 9940, 10435, 10955, 11500, 12075, 12680, 13315, 13980, 14680,
    15415, 16185, 16995, 17845, 18735, 19670, 20655, 21685, 22770, 23910
];
const ODIN_LEVEL_XP = 25000;

const normalizeUserLevel = (userData) => {
    if (!userData) return userData;
    let level = userData.level || 1;
    let experience = userData.experience || 0;
    // Repartir experiencia sobrante subiendo niveles en cascada
    while (true) {
        const required = level >= 100 ? ODIN_LEVEL_XP : (XP_TABLE[level] || 999999);
        if (experience < required) break;
        experience -= required;
        level += 1;
    }
    return { ...userData, level, experience };
};

const ValhallaHall = ({ user, onUpdateUser }) => {
    const [loading, setLoading] = useState(true);
    const [hallData, setHallData] = useState(null);
    const [globalCooldown, setGlobalCooldown] = useState(0);
    const [selectedQuest, setSelectedQuest] = useState(null); 
    const [alertData, setAlertData] = useState(null);
    const [activeTab, setActiveTab] = useState('daily'); 

    const loadData = async () => {
        setLoading(true);
        try {
            // Solicitamos contexto 'hall' con timestamp para evitar caché
            const res = await fetch(apiUrl(`/api/quests/status?context=hall&t=${Date.now()}`), {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            setHallData(data);
            if (data.globalCooldown > 0) setGlobalCooldown(data.globalCooldown);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    useEffect(() => { loadData(); }, []); // Cargar al montar

    // Timer Global
    useEffect(() => {
        if (globalCooldown <= 0) return;
        const interval = setInterval(() => {
            setGlobalCooldown(p => p <= 1 ? 0 : p - 1);
        }, 1000);
        return () => clearInterval(interval);
    }, [globalCooldown]);

    const formatTime = (sec) => `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`;

    // Acciones
    const handleAccept = async () => {
        if (!selectedQuest) return;
        const res = await fetch(apiUrl('/api/quests/accept'), {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify({ questId: selectedQuest.id })
        });
        const data = await res.json();
        if (data.success) {
            setAlertData({ type: 'success', msg: "Contrato firmado. (Espera 5 min)" });
            setSelectedQuest(null);
            loadData(); 
        } else {
            setAlertData({ type: 'error', msg: data.message });
        }
    };

    const handleComplete = async (playerQuestId) => {
        const res = await fetch(apiUrl('/api/quests/complete'), {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify({ playerQuestId })
        });
        const data = await res.json();
        if (data.success) {
            setAlertData({ type: 'success', msg: data.message });
            fetch(apiUrl('/api/auth/profile'), { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
                .then(r => r.json())
                .then(d => {
                    const updated = normalizeUserLevel(d.user);
                    onUpdateUser(updated);
                });
            loadData(); 
        } else {
            setAlertData({ type: 'error', msg: data.message });
        }
    };

    const handleRefresh = async () => {
        if (globalCooldown > 0) return;
        try {
            const res = await fetch(apiUrl('/api/quests/refresh'), {
                method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            if (data.success) loadData();
            else setAlertData({ type: 'error', msg: data.message });
        } catch (e) { console.error(e); }
    };

    const { dailyActive = [], dailyAvailable = [], weeklyActive = [], maxSlots } = hallData || {};

    return (
        <div className="h-full flex flex-col p-6 bg-[url('/backgrounds/hall_bg.png')] bg-cover bg-center relative font-sans text-slate-100">
            <div className="absolute inset-0 bg-slate-950/95" />
            
            <div className="relative z-10 flex flex-col h-full max-w-6xl mx-auto w-full gap-6 overflow-y-auto custom-scrollbar pr-2">
                
                {/* Header & Tabs */}
                <div className="flex flex-col md:flex-row justify-between items-end border-b border-amber-900/30 pb-4 gap-4">
                    <div>
                        <h2 className="text-4xl font-serif text-amber-500 uppercase tracking-widest drop-shadow-md">Salón de Valhallus</h2>
                        <div className="flex gap-4 mt-4">
                            <button onClick={() => setActiveTab('daily')} className={`flex items-center gap-2 px-4 py-2 text-sm font-bold uppercase transition-colors border-b-2 ${activeTab === 'daily' ? 'border-amber-500 text-amber-500' : 'border-transparent text-slate-500 hover:text-white'}`}>
                                <img src={VALHALLA_ICONS.tabDaily} alt="Diarias" className="w-5 h-5 object-contain" />
                                Diarias
                            </button>
                            <button onClick={() => setActiveTab('weekly')} className={`flex items-center gap-2 px-4 py-2 text-sm font-bold uppercase transition-colors border-b-2 ${activeTab === 'weekly' ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-500 hover:text-white'}`}>
                                <img src={VALHALLA_ICONS.tabWeekly} alt="Semanales" className="w-5 h-5 object-contain" />
                                Semanales
                            </button>
                        </div>
                    </div>
                    
                    {/* Indicador de Cooldown Global */}
                    {globalCooldown > 0 && (
                        <div className="text-xs font-mono text-orange-400 border border-orange-900 bg-orange-900/20 px-3 py-1 rounded flex gap-2 items-center animate-pulse">
                            <Clock size={14} /> Acciones bloqueadas por: {formatTime(globalCooldown)}
                        </div>
                    )}
                </div>

                {/* --- CONTENIDO: PESTAÑA DIARIA --- */}
                {activeTab === 'daily' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
                        {/* 1. Misiones Activas Diarias */}
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold text-slate-300 uppercase flex items-center gap-2">
                                    <img src={VALHALLA_ICONS.headerActive} alt="Contratos" className="w-5 h-5 object-contain" />
                                    Contratos Activos
                                </h3>
                                <span className="text-xs text-slate-500">Espacios: <span className="text-white">{dailyActive.length} / {maxSlots}</span></span>
                            </div>
                            
                            {dailyActive.length === 0 ? (
                                <div className="text-slate-600 text-sm italic border border-dashed border-slate-800 rounded p-6 text-center">No tienes contratos diarios en curso.</div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {dailyActive.map(q => <QuestCard key={q.id} quest={q} onComplete={handleComplete} isWeekly={false} />)}
                                </div>
                            )}
                        </div>

                        {/* 2. Tablón de Disponibles */}
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold text-slate-300 uppercase flex items-center gap-2">
                                    <img src={VALHALLA_ICONS.headerBoard} alt="Tablon" className="w-5 h-5 object-contain" />
                                    Tablon de Solicitudes
                                </h3>
                                <button 
                                    onClick={handleRefresh} 
                                    disabled={globalCooldown > 0}
                                    className={`px-3 py-1 rounded text-xs font-bold uppercase flex items-center gap-2 transition-colors border ${globalCooldown > 0 ? 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed' : 'bg-slate-800 text-amber-500 border-amber-600 hover:text-white'}`}
                                >
                                    <img src={VALHALLA_ICONS.refresh} alt="Refrescar" className="w-4 h-4 object-contain" /> Refrescar
                                </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                {dailyAvailable.map(quest => (
                                    <div key={quest.id} onClick={() => setSelectedQuest(quest)} className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 hover:border-amber-600 p-4 rounded-lg cursor-pointer transition-all hover:-translate-y-1 group">
                                        <div className="flex justify-between items-start">
                                            <h4 className="font-bold text-sm text-slate-200 group-hover:text-amber-400">{quest.title}</h4>
                                            <span className="text-[10px] bg-black px-1.5 rounded text-slate-500 border border-slate-800">NVL {quest.min_level}</span>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-2 line-clamp-2 h-8">{quest.description}</p>
                                        <div className="mt-3 pt-3 border-t border-slate-800/50 flex gap-3 text-[10px] font-mono text-slate-400 flex-wrap items-center">
                                            <span className="flex items-center gap-1 text-purple-300">
                                                <img src={VALHALLA_ICONS.rewardXp} alt="XP" className="w-4 h-4 object-contain" />
                                                {quest.reward_xp}
                                            </span>
                                            {quest.reward_gold > 0 && (
                                                <span className="flex items-center gap-1 text-yellow-500">
                                                    <img src={VALHALLA_ICONS.gold} alt="Oro" className="w-4 h-4 object-contain" />
                                                    {quest.reward_gold}
                                                </span>
                                            )}
                                            {quest.reward_silver > 0 && (
                                                <span className="flex items-center gap-1 text-slate-300">
                                                    <img src={VALHALLA_ICONS.silver} alt="Plata" className="w-4 h-4 object-contain" />
                                                    {quest.reward_silver}
                                                </span>
                                            )}
                                            {quest.reward_copper > 0 && (
                                                <span className="flex items-center gap-1 text-orange-400">
                                                    <img src={VALHALLA_ICONS.copper} alt="Cobre" className="w-4 h-4 object-contain" />
                                                    {quest.reward_copper}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* --- CONTENIDO: PESTAÑA SEMANAL --- */}
                {activeTab === 'weekly' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2">
                        <div className="bg-purple-900/10 border border-purple-900/50 p-4 rounded-lg mb-6 flex items-start gap-4">
                            <img src={VALHALLA_ICONS.headerWeekly} alt="Desafíos" className="w-10 h-10 object-contain" />
                            <div>
                                <h3 className="text-purple-300 font-bold uppercase text-sm">Desafíos de la Semana</h3>
                                <p className="text-xs text-slate-400 mt-1">Estas misiones se activan automáticamente. Complétalas para obtener grandes recompensas. Se reinician cada semana.</p>
                            </div>
                        </div>

                        {weeklyActive.length === 0 ? (
                            <div className="text-center py-10 text-slate-500">No hay desafíos semanales activos. Vuelve el lunes.</div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4">
                                {weeklyActive.map(q => <QuestCard key={q.id} quest={q} onComplete={handleComplete} isWeekly={true} />)}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* MODAL DETALLE (Para aceptar Diarias) */}
            {selectedQuest && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in zoom-in-95">
                    <div className="bg-slate-900 border-2 border-amber-600 rounded-xl p-6 max-w-sm w-full shadow-2xl relative">
                        <button onClick={() => setSelectedQuest(null)} className="absolute top-3 right-3 text-slate-500 hover:text-white"><X size={20}/></button>
                        <h3 className="text-xl font-bold text-white mb-1">{selectedQuest.title}</h3>
                        <div className="flex gap-2 mb-4"><span className="text-[10px] uppercase font-bold bg-slate-800 text-slate-400 px-2 rounded">Nivel {selectedQuest.min_level}+</span></div>
                        <p className="text-slate-300 text-sm italic mb-4">"{selectedQuest.description}"</p>
                        
                        <div className="bg-black/40 p-3 rounded mb-4">
                            <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-2">Objetivos</h4>
                            {selectedQuest.requirements.map((req, i) => (
                                <div key={i} className="flex justify-between text-xs text-slate-300 border-b border-white/5 pb-1 mb-1">
                                    <span>{req.name}</span> <span className="font-mono text-amber-500">x{req.count}</span>
                                </div>
                            ))}
                        </div>

                        <div className="bg-slate-800 p-3 rounded mb-6">
                            <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-1">Recompensas</h4>
                            <div className="flex flex-wrap gap-3 text-xs items-center">
                                <span className="font-bold text-purple-400 flex items-center gap-1">
                                    <img src={VALHALLA_ICONS.rewardXp} alt="XP" className="w-4 h-4 object-contain" />
                                    + {selectedQuest.reward_xp}
                                </span>
                                {selectedQuest.reward_gold > 0 && <span className="font-bold text-yellow-500 flex items-center gap-1"><img src={VALHALLA_ICONS.gold} alt="Oro" className="w-4 h-4 object-contain" /> + {selectedQuest.reward_gold}</span>}
                                {selectedQuest.reward_silver > 0 && <span className="font-bold text-slate-300 flex items-center gap-1"><img src={VALHALLA_ICONS.silver} alt="Plata" className="w-4 h-4 object-contain" /> + {selectedQuest.reward_silver}</span>}
                                {selectedQuest.reward_copper > 0 && <span className="font-bold text-orange-500 flex items-center gap-1"><img src={VALHALLA_ICONS.copper} alt="Cobre" className="w-4 h-4 object-contain" /> + {selectedQuest.reward_copper}</span>}
                            </div>
                        </div>

                        <button 
                            onClick={handleAccept}
                            disabled={globalCooldown > 0 || dailyActive.length >= maxSlots}
                            className={`w-full py-3 font-bold uppercase rounded shadow-lg transition-all ${globalCooldown > 0 || dailyActive.length >= maxSlots ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-gradient-to-r from-amber-700 to-amber-600 hover:text-white'}`}
                        >
                            {globalCooldown > 0 ? `Espera ${formatTime(globalCooldown)}` : dailyActive.length >= maxSlots ? 'Sin Espacio' : 'Aceptar Contrato'}
                        </button>
                    </div>
                </div>
            )}

            {/* ALERTA */}
            {alertData && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-5 fade-in">
                    <div className={`px-6 py-3 rounded shadow-2xl border flex items-center gap-3 ${alertData.type === 'success' ? 'bg-slate-900 border-green-500 text-green-400' : 'bg-slate-900 border-red-500 text-red-400'}`}>
                        {alertData.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
                        <span className="font-bold text-sm">{alertData.msg}</span>
                        <button onClick={() => setAlertData(null)} className="ml-4 hover:text-white"><X size={14} /></button>
                    </div>
                </div>
            )}
        </div>
    );
};

// Subcomponente para Tarjeta de Misión (para limpiar código)
const QuestCard = ({ quest, onComplete, isWeekly }) => {
    let isComplete = true;
    quest.requirements.forEach(req => {
        if ((quest.progress?.[req.target_id] || 0) < req.count) isComplete = false;
    });

    return (
        <div className={`border rounded-lg p-4 shadow-lg relative ${isWeekly ? 'bg-slate-900 border-purple-900/50' : 'bg-slate-900 border-slate-700'}`}>
            <div className="flex justify-between mb-2 items-start">
                <h4 className={`font-bold text-sm ${isWeekly ? 'text-purple-300' : 'text-amber-100'}`}>{quest.title}</h4>
                {isComplete && <span className="text-[10px] bg-green-900 text-green-300 px-2 py-0.5 rounded border border-green-700 animate-pulse">¡LISTO!</span>}
            </div>
            <p className="text-xs text-slate-500 mb-3 line-clamp-1">{quest.description}</p>
            
            <div className="space-y-2 mb-4">
                {quest.requirements.map((req, i) => {
                    const cur = quest.progress?.[req.target_id] || 0;
                    const pct = Math.min((cur / req.count) * 100, 100);
                    return (
                        <div key={i} className="text-xs">
                            <div className="flex justify-between text-slate-400 mb-0.5">
                                <span>{req.name}</span>
                                <span>{cur}/{req.count}</span>
                            </div>
                            <div className="h-1.5 bg-black rounded-full overflow-hidden">
                                <div className={`h-full transition-all ${isWeekly ? 'bg-purple-600' : 'bg-amber-600'}`} style={{ width: `${pct}%` }}/>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="flex justify-between items-center mt-auto">
                <div className="flex gap-3 text-[10px] font-mono text-slate-400 items-center">
                    <span className="flex items-center gap-1">
                        <img src={VALHALLA_ICONS.rewardXp} alt="XP" className="w-4 h-4 object-contain" />
                        {quest.reward_xp}
                    </span>
                    {/* Mostrar solo la moneda m�s alta para ahorrar espacio en la tarjeta peque�a */}
                    {quest.reward_gold > 0 ? (
                        <span className="text-yellow-500 flex items-center gap-1">
                            <img src={VALHALLA_ICONS.gold} alt="Oro" className="w-4 h-4 object-contain" />
                            {quest.reward_gold}
                        </span>
                    ) : quest.reward_silver > 0 ? (
                        <span className="text-slate-300 flex items-center gap-1">
                            <img src={VALHALLA_ICONS.silver} alt="Plata" className="w-4 h-4 object-contain" />
                            {quest.reward_silver}
                        </span>
                    ) : (
                        <span className="text-orange-400 flex items-center gap-1">
                            <img src={VALHALLA_ICONS.copper} alt="Cobre" className="w-4 h-4 object-contain" />
                            {quest.reward_copper}
                        </span>
                    )}
                </div>
                
                <button 
                    onClick={() => onComplete(quest.id)}
                    disabled={!isComplete}
                    className={`px-4 py-1.5 text-[10px] font-bold uppercase rounded transition-all 
                    ${isComplete 
                        ? 'bg-green-700 hover:bg-green-600 text-white shadow-lg cursor-pointer' 
                        : 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700'}`}
                >
                    {isComplete ? 'Reclamar' : isWeekly ? (
                        <span className="flex items-center gap-1">
                            <img src={VALHALLA_ICONS.inProgress} alt="En progreso" className="w-4 h-4 object-contain" />
                            En Progreso
                        </span>
                    ) : 'Pendiente'}
                </button>
            </div>
        </div>
    );
};

export default ValhallaHall;
