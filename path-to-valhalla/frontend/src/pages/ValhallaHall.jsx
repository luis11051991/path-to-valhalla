import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Clock, CheckCircle, X, AlertTriangle, Scroll, MessageCircle } from 'lucide-react';
import { apiUrl } from '../constants/api';
import { getRequiredXp } from '../shared/level_xp';
import ConfirmModal from '../components/common/ConfirmModal';

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
    onix: '/icons/currency/onix.png',
};

const MAX_ACTIVE_CONTRACTS = 5;
const QUEST_NPC_IMAGE = '/npcs/receptionist.png';
const QUEST_NPC_FALLBACK = '/npcs/merchant_default.png';

const normalizeUserLevel = (userData) => {
    if (!userData) return userData;
    let level = userData.level || 1;
    let experience = userData.experience || 0;
    while (true) {
        const required = getRequiredXp(level);
        if (experience < required) break;
        experience -= required;
        level += 1;
    }
    return { ...userData, level, experience };
};

const ScribePanel = ({ dailyActive }) => {
    const getPhrase = () => {
        const count = dailyActive?.length || 0;
        if (count >= MAX_ACTIVE_CONTRACTS) {
            return '"Cinco contratos activos. Más que eso y hasta los dioses pierden la paciencia."';
        }
        if (count === 0) {
            return '"Bienvenido al Salón, viajero. Los contratos no se firman solos… y las recompensas no esperan a los cobardes."';
        }
        return '"Bienvenido al Salón, viajero. Los contratos no se firman solos… y las recompensas no esperan a los cobardes."';
    };

    return (
        <div className="flex flex-col h-full">
            <div className="relative w-full max-w-[260px] mx-auto mb-4 pt-6" style={{ aspectRatio: '9/16' }}>
                <div className="absolute inset-0 border-2 border-double border-amber-700/50 rounded-xl bg-black/40 shadow-[0_0_30px_rgba(0,0,0,0.8)] overflow-visible">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-amber-900/10 via-transparent to-black opacity-60 rounded-xl overflow-hidden" />
                    <div className="w-full h-full overflow-hidden rounded-xl">
                        <img
                            src={QUEST_NPC_IMAGE}
                            alt="Recepcionista del Salón"
                            className="w-full h-full object-cover object-center transition-all duration-500"
                            onError={(e) => { e.target.onerror = null; e.target.src = QUEST_NPC_FALLBACK; }}
                        />
                    </div>
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-900 border border-amber-600 px-4 py-1 rounded-full shadow-lg z-10 whitespace-nowrap">
                        <span className="text-xs font-bold text-amber-500 uppercase tracking-widest">Recepcionista del Salón</span>
                    </div>
                </div>
            </div>

            <div className="relative bg-slate-900/90 border border-amber-900/50 p-4 rounded-xl backdrop-blur-md shadow-lg">
                <div className="absolute -top-2 left-8 w-4 h-4 bg-slate-900 border-l border-t border-amber-900/50 transform rotate-45" />
                <div className="flex items-start gap-2">
                    <MessageCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-slate-300 text-xs italic font-serif leading-relaxed">
                        {getPhrase()}
                    </p>
                </div>
            </div>
        </div>
    );
};

const ValhallaHall = ({ user: propUser, onUpdateUser: propOnUpdateUser }) => {
    const contextData = useOutletContext();
    const user = propUser || (contextData ? contextData[0] : null);
    const onUpdateUser = propOnUpdateUser || (contextData ? contextData[1] : null);

    const [loading, setLoading] = useState(true);
    const [hallData, setHallData] = useState(null);
    const [globalCooldown, setGlobalCooldown] = useState(0);
    const [selectedQuest, setSelectedQuest] = useState(null);
    const [alertData, setAlertData] = useState(null);
    const [activeTab, setActiveTab] = useState('daily');
    const [cancelConfirm, setCancelConfirm] = useState({ open: false, playerQuestId: null });
    const [onixConfirmOpen, setOnixConfirmOpen] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await fetch(apiUrl(`/api/quests/status?context=hall&t=${Date.now()}`), {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            setHallData(data);
            if (data.globalCooldown > 0) setGlobalCooldown(data.globalCooldown);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    useEffect(() => {
        if (user) loadData();
    }, [user]);

    useEffect(() => {
        if (globalCooldown <= 0) return;
        const interval = setInterval(() => {
            setGlobalCooldown(p => p <= 1 ? 0 : p - 1);
        }, 1000);
        return () => clearInterval(interval);
    }, [globalCooldown]);

    const formatTime = (sec) => `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`;

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

    const handleCancelClick = (playerQuestId) => {
        setCancelConfirm({ open: true, playerQuestId });
    };

    const executeCancel = async () => {
        const playerQuestId = cancelConfirm.playerQuestId;
        setCancelConfirm({ open: false, playerQuestId: null });
        try {
            const res = await fetch(apiUrl('/api/quests/cancel'), {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({ playerQuestId })
            });
            const data = await res.json();
            if (data.success) {
                setAlertData({ type: 'success', msg: data.message });
                loadData();
            } else {
                setAlertData({ type: 'error', msg: data.message });
            }
        } catch (e) { console.error(e); }
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

    const handleRefreshOnix = async () => {
        setOnixConfirmOpen(false);
        try {
            const res = await fetch(apiUrl('/api/quests/refresh-onix'), {
                method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            if (data.success) {
                setAlertData({ type: 'success', msg: data.message });
                setGlobalCooldown(0);
                const updated = { ...user, onix: data.onix };
                onUpdateUser(updated);
                loadData();
            } else {
                setAlertData({ type: 'error', msg: data.message });
            }
        } catch (e) { console.error(e); }
    };

    const { dailyActive = [], dailyAvailable = [], weeklyActive = [], maxSlots } = hallData || {};

    if (!user) return null;

    const typeBadge = (type) => {
        if (!type) return null;
        const styles = {
            daily: 'border-amber-700 text-amber-400',
            side: 'border-blue-700 text-blue-400',
            zone: 'border-green-700 text-green-400',
            weekly: 'border-purple-700 text-purple-400',
        };
        const labels = {
            daily: 'DIARIA',
            side: 'SECUNDARIA',
            zone: 'ZONA',
            weekly: 'SEMANAL',
        };
        const cls = styles[type] || 'border-slate-700 text-slate-400';
        const label = labels[type] || type.toUpperCase();
        return (
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase border shrink-0 ${cls}`}>
                {label}
            </span>
        );
    };

    return (
        <div className="h-full flex flex-col bg-[url('/backgrounds/city/salon_valhallus.png')] bg-cover bg-center relative font-sans text-slate-100">
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/65 to-slate-950/85" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-transparent via-slate-950/30 to-slate-950/60 pointer-events-none" />

            <div className="relative z-10 flex flex-col h-full overflow-hidden">

                {/* HEADER ÉPICO */}
                <div className="shrink-0 border-b border-amber-900/30 bg-gradient-to-r from-slate-950 via-slate-900/95 to-slate-950 px-4 md:px-6 py-3 flex items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <Scroll size={24} className="text-amber-500 shrink-0" />
                            <h1 className="text-xl md:text-2xl lg:text-3xl font-serif text-amber-500 uppercase tracking-[0.3em] drop-shadow-[0_2px_4px_rgba(245,158,11,0.3)]">
                                Salón de Valhallus
                            </h1>
                        </div>
                        <p className="text-[10px] text-amber-600/70 italic mt-0.5 ml-1 tracking-wide">
                            "Donde los contratos se firman con tinta… o sangre."
                        </p>
                    </div>

                    {globalCooldown > 0 && (
                        <div className="shrink-0 text-[11px] font-mono text-orange-400 border border-orange-900 bg-orange-900/20 px-3 py-1.5 rounded-full flex items-center gap-2 animate-pulse shadow-[0_0_15px_rgba(251,146,60,0.15)]">
                            <Clock size={14} /> Bloqueado: {formatTime(globalCooldown)}
                        </div>
                    )}
                </div>

                {/* NPC + CONTENIDO */}
                <div className="flex-1 flex overflow-y-auto custom-scrollbar gap-4 md:gap-6 py-4">

                    {/* NPC PANEL (izquierda, oculto en mobile) */}
                    <div className="hidden lg:flex flex-col w-[280px] shrink-0 pl-4 md:pl-6">
                        <ScribePanel dailyActive={dailyActive} />
                    </div>

                    {/* CONTENIDO PRINCIPAL (derecha) */}
                    <div className="flex-1 flex flex-col gap-4 md:gap-6 pr-4 md:pr-6">

                        {/* TABS */}
                        <div className="flex gap-1 bg-slate-900/60 border border-slate-800 rounded-lg p-1 shrink-0 self-start">
                            <button
                                onClick={() => setActiveTab('daily')}
                                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase rounded-md transition-all ${
                                    activeTab === 'daily'
                                        ? 'bg-amber-700/30 text-amber-400 shadow-inner border border-amber-700/30'
                                        : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                                }`}
                            >
                                <img src={VALHALLA_ICONS.tabDaily} alt="" className="w-4 h-4 object-contain" />
                                Diarias
                            </button>
                            <button
                                onClick={() => setActiveTab('weekly')}
                                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase rounded-md transition-all ${
                                    activeTab === 'weekly'
                                        ? 'bg-purple-700/30 text-purple-400 shadow-inner border border-purple-700/30'
                                        : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                                }`}
                            >
                                <img src={VALHALLA_ICONS.tabWeekly} alt="" className="w-4 h-4 object-contain" />
                                Semanales
                            </button>
                        </div>

                        {/* PESTAÑA DIARIA */}
                        {activeTab === 'daily' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">

                                {/* CONTRATOS ACTIVOS */}
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                                            <img src={VALHALLA_ICONS.headerActive} alt="" className="w-4 h-4 object-contain" />
                                            Contratos Activos
                                        </h3>
                                        <span className="text-[11px] text-slate-500">
                                            Espacios: <span className="text-white font-bold">{dailyActive.length}</span>
                                            <span className="text-slate-600"> / {MAX_ACTIVE_CONTRACTS}</span>
                                        </span>
                                    </div>

                                    {dailyActive.length === 0 ? (
                                        <div className="text-slate-600 text-xs italic border border-dashed border-slate-800 rounded-lg p-6 text-center bg-black/20">
                                            No tienes contratos activos.
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {dailyActive.map(q => (
                                                <QuestCard key={q.id} quest={q} onComplete={handleComplete} onCancel={handleCancelClick} isWeekly={false} typeBadge={typeBadge} />
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* TABLÓN DE SOLICITUDES */}
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                                            <img src={VALHALLA_ICONS.headerBoard} alt="" className="w-4 h-4 object-contain" />
                                            Tablón de Solicitudes
                                        </h3>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={handleRefresh}
                                                disabled={globalCooldown > 0}
                                                className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase flex items-center gap-2 transition-all border ${
                                                    globalCooldown > 0
                                                        ? 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'
                                                        : 'bg-slate-800 text-amber-500 border-amber-600 hover:bg-amber-700 hover:text-white active:scale-95'
                                                }`}
                                            >
                                                <img src={VALHALLA_ICONS.refresh} alt="" className="w-3.5 h-3.5 object-contain" />
                                                {globalCooldown > 0 ? `Espera ${formatTime(globalCooldown)}` : 'Refrescar'}
                                            </button>
                                            {globalCooldown > 0 && (
                                                <button
                                                    onClick={() => setOnixConfirmOpen(true)}
                                                    disabled={(user?.onix || 0) < 10}
                                                    className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase flex items-center gap-1.5 transition-all border ${
                                                        (user?.onix || 0) < 10
                                                            ? 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'
                                                            : 'bg-purple-900/40 text-purple-300 border-purple-700/60 hover:bg-purple-800/50 hover:text-purple-200 active:scale-95'
                                                    }`}
                                                >
                                                    <img src={VALHALLA_ICONS.onix} alt="" className="w-3.5 h-3.5 object-contain" />
                                                    {(user?.onix || 0) < 10 ? 'Ónix insuficiente' : 'Refrescar 10'}
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {dailyAvailable.length === 0 ? (
                                        <div className="text-slate-600 text-xs italic border border-dashed border-slate-800 rounded-lg p-6 text-center bg-black/20">
                                            No hay solicitudes disponibles ahora.
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                            {dailyAvailable.map(quest => (
                                                <div
                                                    key={quest.id}
                                                    onClick={() => setSelectedQuest(quest)}
                                                    className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 hover:border-amber-600 p-3 rounded-lg cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(245,158,11,0.1)] group"
                                                >
                                                    <div className="flex items-start justify-between gap-1.5 mb-1.5">
                                                        <h4 className="font-bold text-xs text-slate-200 group-hover:text-amber-400 leading-tight truncate">{quest.title}</h4>
                                                        {typeBadge(quest.type)}
                                                    </div>
                                                    <p className="text-[11px] text-slate-500 line-clamp-1 mb-2">{quest.description}</p>
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex gap-1.5 text-[10px] font-mono text-slate-500">
                                                            <span className="text-purple-400">{quest.reward_xp}XP</span>
                                                            {quest.reward_gold > 0 && <span className="text-yellow-500">{quest.reward_gold}O</span>}
                                                            {quest.reward_silver > 0 && <span className="text-slate-400">{quest.reward_silver}P</span>}
                                                            {quest.reward_copper > 0 && <span className="text-orange-400">{quest.reward_copper}C</span>}
                                                        </div>
                                                        <span className="text-[9px] bg-black/60 px-1.5 py-0.5 rounded text-slate-500 border border-slate-800">NVL {quest.min_level}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* PESTAÑA SEMANAL */}
                        {activeTab === 'weekly' && (
                            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="bg-gradient-to-r from-purple-900/20 to-slate-900/20 border border-purple-900/50 rounded-lg p-4 mb-4 flex items-start gap-4">
                                    <img src={VALHALLA_ICONS.headerWeekly} alt="" className="w-10 h-10 object-contain shrink-0" />
                                    <div>
                                        <h3 className="text-purple-300 font-bold uppercase text-sm">Desafíos de la Semana</h3>
                                        <p className="text-xs text-slate-500 mt-1">Se activan automáticamente. Grandes recompensas. Se reinician cada semana.</p>
                                    </div>
                                </div>

                                {weeklyActive.length === 0 ? (
                                    <div className="text-center py-12 text-slate-600 italic text-sm border border-dashed border-slate-800 rounded-lg bg-black/20">
                                        No hay desafíos semanales activos. Vuelve el lunes.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-3">
                                        {weeklyActive.map(q => (
                                            <QuestCard key={q.id} quest={q} onComplete={handleComplete} isWeekly={true} typeBadge={typeBadge} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                    </div>
                </div>

                {/* LOADING OVERLAY */}
                {loading && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
                            <p className="text-amber-500 text-xs font-bold uppercase tracking-widest animate-pulse">Cargando Salón...</p>
                        </div>
                    </div>
                )}
            </div>

            {/* MODAL DETALLE DE MISIÓN */}
            {selectedQuest && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in zoom-in-95 duration-200">
                    <div className="bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-amber-600/80 rounded-xl max-w-sm w-full shadow-[0_0_40px_rgba(245,158,11,0.2)] relative overflow-hidden">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-amber-900/10 via-transparent to-transparent pointer-events-none" />

                        <button onClick={() => setSelectedQuest(null)} className="absolute top-3 right-3 z-10 text-slate-500 hover:text-white p-1 bg-black/50 rounded-full hover:bg-red-900/60 transition-colors">
                            <X size={18} />
                        </button>

                        <div className="p-5 relative z-[1]">
                            <div className="flex items-start justify-between gap-2 mb-3">
                                <div>
                                    <h3 className="text-lg font-bold text-white leading-tight">{selectedQuest.title}</h3>
                                    <div className="flex gap-2 mt-1.5">
                                        {typeBadge(selectedQuest.type)}
                                        <span className="text-[10px] uppercase font-bold bg-slate-800 text-slate-400 px-2 rounded">Nvl {selectedQuest.min_level}+</span>
                                    </div>
                                </div>
                            </div>

                            <p className="text-slate-400 text-sm italic mb-4 border-l-2 border-amber-700/50 pl-3">"{selectedQuest.description}"</p>

                            <div className="bg-black/40 rounded-lg p-3 mb-3 border border-slate-800">
                                <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-2 tracking-wider flex items-center gap-1.5">
                                    <Scroll size={12} /> Objetivos
                                </h4>
                                <div className="space-y-1.5">
                                    {selectedQuest.requirements.map((req, i) => (
                                        <div key={i} className="flex justify-between text-xs text-slate-300 bg-slate-900/50 rounded px-2 py-1">
                                            <span>{req.name}</span>
                                            <span className="font-mono text-amber-500 font-bold">x{req.count}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-slate-800/60 rounded-lg p-3 mb-4 border border-slate-700/50">
                                <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-2 tracking-wider">Recompensas</h4>
                                <div className="flex flex-wrap gap-3 text-xs items-center">
                                    <span className="font-bold text-purple-400 flex items-center gap-1">
                                        <img src={VALHALLA_ICONS.rewardXp} alt="" className="w-4 h-4 object-contain" />
                                        +{selectedQuest.reward_xp}
                                    </span>
                                    {selectedQuest.reward_gold > 0 && (
                                        <span className="font-bold text-yellow-500 flex items-center gap-1">
                                            <img src={VALHALLA_ICONS.gold} alt="" className="w-4 h-4 object-contain" />
                                            +{selectedQuest.reward_gold}
                                        </span>
                                    )}
                                    {selectedQuest.reward_silver > 0 && (
                                        <span className="font-bold text-slate-300 flex items-center gap-1">
                                            <img src={VALHALLA_ICONS.silver} alt="" className="w-4 h-4 object-contain" />
                                            +{selectedQuest.reward_silver}
                                        </span>
                                    )}
                                    {selectedQuest.reward_copper > 0 && (
                                        <span className="font-bold text-orange-400 flex items-center gap-1">
                                            <img src={VALHALLA_ICONS.copper} alt="" className="w-4 h-4 object-contain" />
                                            +{selectedQuest.reward_copper}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <button
                                onClick={handleAccept}
                                disabled={globalCooldown > 0 || dailyActive.length >= MAX_ACTIVE_CONTRACTS}
                                className={`w-full py-3 font-bold uppercase rounded-lg shadow-lg transition-all text-sm tracking-wider ${
                                    globalCooldown > 0 || dailyActive.length >= MAX_ACTIVE_CONTRACTS
                                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                                        : 'bg-gradient-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white active:scale-[0.98] hover:shadow-[0_0_20px_rgba(245,158,11,0.3)]'
                                }`}
                            >
                                {globalCooldown > 0
                                    ? `Espera ${formatTime(globalCooldown)}`
                                    : dailyActive.length >= MAX_ACTIVE_CONTRACTS
                                        ? 'Sin Espacio'
                                        : 'Aceptar Contrato'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ALERTA FLOTANTE */}
            {alertData && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-5 fade-in duration-300">
                    <div className={`px-5 py-3 rounded-xl shadow-2xl border flex items-center gap-3 backdrop-blur-md ${
                        alertData.type === 'success'
                            ? 'bg-green-900/80 border-green-500/60 text-green-300'
                            : 'bg-red-900/80 border-red-500/60 text-red-300'
                    }`}>
                        {alertData.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                        <span className="font-bold text-sm">{alertData.msg}</span>
                        <button onClick={() => setAlertData(null)} className="ml-2 hover:text-white opacity-60 hover:opacity-100 transition-opacity">
                            <X size={14} />
                        </button>
                    </div>
                </div>
            )}

            <ConfirmModal
                open={onixConfirmOpen}
                title="Refrescar con Ónix"
                message="¿Gastar 10 Ónix para renovar el tablón inmediatamente?"
                confirmText="Gastar 10"
                cancelText="Volver"
                variant="warning"
                onConfirm={handleRefreshOnix}
                onCancel={() => setOnixConfirmOpen(false)}
            />

            <ConfirmModal
                open={cancelConfirm.open}
                title="Cancelar misión"
                message="¿Cancelar esta misión? Se perderá el progreso."
                confirmText="Cancelar"
                cancelText="Volver"
                variant="danger"
                onConfirm={executeCancel}
                onCancel={() => setCancelConfirm({ open: false, playerQuestId: null })}
            />
        </div>
    );
};

const QuestCard = ({ quest, onComplete, onCancel, isWeekly, typeBadge }) => {
    let isComplete = true;
    quest.requirements.forEach(req => {
        if ((quest.progress?.[req.target_id || req.type] || 0) < req.count) isComplete = false;
    });

    return (
        <div className={`border rounded-lg p-3 shadow-lg relative flex flex-col gap-2 ${
            isWeekly
                ? 'bg-gradient-to-br from-slate-900 to-purple-950/30 border-purple-900/50'
                : 'bg-gradient-to-br from-slate-900 to-slate-950 border-slate-700'
        }`}>
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <h4 className={`font-bold text-xs leading-tight truncate ${isWeekly ? 'text-purple-300' : 'text-amber-100'}`}>{quest.title}</h4>
                    {typeBadge && typeBadge(quest.type)}
                </div>
                {isComplete && (
                    <span className="text-[10px] bg-green-900/80 text-green-300 px-2 py-0.5 rounded-full border border-green-700/50 animate-pulse shrink-0 font-bold leading-none">
                        ¡LISTO!
                    </span>
                )}
            </div>

            <div className="space-y-1">
                {quest.requirements.map((req, i) => {
                    const cur = quest.progress?.[req.target_id || req.type] || 0;
                    const pct = Math.min((cur / req.count) * 100, 100);
                    return (
                        <div key={i} className="text-[11px]">
                            <div className="flex justify-between text-slate-400 mb-0.5">
                                <span className="truncate">{req.name}</span>
                                <span className="font-mono shrink-0 ml-2">{cur}/{req.count}</span>
                            </div>
                            <div className="h-1.5 bg-black/60 rounded-full overflow-hidden border border-slate-800/50">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${
                                        isWeekly
                                            ? 'bg-gradient-to-r from-purple-600 to-purple-400'
                                            : isComplete ? 'bg-gradient-to-r from-green-600 to-green-400' : 'bg-gradient-to-r from-amber-600 to-amber-400'
                                    }`}
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800/50 mt-1">
                <div className="flex gap-2 text-[10px] font-mono text-slate-400 items-center">
                    <span className="flex items-center gap-1 font-bold text-purple-400">
                        <img src={VALHALLA_ICONS.rewardXp} alt="" className="w-3 h-3 object-contain" />
                        {quest.reward_xp}
                    </span>
                    {quest.reward_gold > 0 && (
                        <span className="flex items-center gap-1 text-yellow-500">
                            <img src={VALHALLA_ICONS.gold} alt="" className="w-3 h-3 object-contain" />
                            {quest.reward_gold}
                        </span>
                    )}
                    {quest.reward_silver > 0 && (
                        <span className="flex items-center gap-1 text-slate-300">
                            <img src={VALHALLA_ICONS.silver} alt="" className="w-3 h-3 object-contain" />
                            {quest.reward_silver}
                        </span>
                    )}
                    {quest.reward_copper > 0 && (
                        <span className="flex items-center gap-1 text-orange-400">
                            <img src={VALHALLA_ICONS.copper} alt="" className="w-3 h-3 object-contain" />
                            {quest.reward_copper}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                    {onCancel && ['daily', 'side', 'zone'].includes(quest.type) && quest.status === 'active' && (
                        <button
                            onClick={() => onCancel(quest.id)}
                            className="px-2 py-1 text-[9px] font-bold uppercase rounded bg-slate-800/80 text-slate-500 border border-slate-700 hover:bg-red-900/80 hover:text-red-300 hover:border-red-700/60 transition-all active:scale-95"
                        >
                            Cancelar
                        </button>
                    )}
                    <button
                        onClick={() => onComplete(quest.id)}
                        disabled={!isComplete}
                        className={`px-3 py-1 text-[9px] font-bold uppercase rounded transition-all active:scale-95 ${
                            isComplete
                                ? 'bg-gradient-to-r from-green-700 to-green-600 hover:from-green-600 hover:to-green-500 text-white shadow-lg cursor-pointer border border-green-500/30'
                                : 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700'
                        }`}
                    >
                        {isComplete ? 'Reclamar' : isWeekly ? (
                            <span className="flex items-center gap-1">
                                <img src={VALHALLA_ICONS.inProgress} alt="" className="w-2.5 h-2.5 object-contain" />
                                En Progreso
                            </span>
                        ) : 'Pendiente'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ValhallaHall;
