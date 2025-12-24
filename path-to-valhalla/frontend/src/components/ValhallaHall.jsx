import React, { useState, useEffect } from 'react';
import { Scroll, Clock, CheckCircle, Sword, Skull, RefreshCw, X, AlertTriangle } from 'lucide-react';
import { apiUrl } from '../constants/api';

const ValhallaHall = ({ user, onUpdateUser }) => {
    const [loading, setLoading] = useState(true);
    const [hallData, setHallData] = useState(null);
    const [acceptCooldown, setAcceptCooldown] = useState(0);
    const [selectedQuest, setSelectedQuest] = useState(null); 
    const [alertData, setAlertData] = useState(null); 

    const loadData = async () => {
        try {
            // FIX DE CACHÉ: ?context=hall&t=${Date.now()}
            const res = await fetch(apiUrl(`/api/quests/status?context=hall&t=${Date.now()}`), {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            setHallData(data);
            if (data.acceptCooldown > 0) setAcceptCooldown(data.acceptCooldown);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    useEffect(() => { loadData(); }, []);

    // Timer Cooldown
    useEffect(() => {
        if (acceptCooldown <= 0) return;
        const interval = setInterval(() => setAcceptCooldown(p => p <= 1 ? 0 : p - 1), 1000);
        return () => clearInterval(interval);
    }, [acceptCooldown]);

    const formatTime = (sec) => `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`;

    const handleAccept = async () => {
        if (!selectedQuest) return;
        const res = await fetch(apiUrl('/api/quests/accept'), {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify({ questId: selectedQuest.id })
        });
        const data = await res.json();
        if (data.success) {
            setAlertData({ type: 'success', msg: "Contrato firmado. La caza comienza." });
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
                .then(r => r.json()).then(d => onUpdateUser(d.user));
            loadData(); 
        } else {
            setAlertData({ type: 'error', msg: data.message });
        }
    };

    const handleRefresh = () => {
        setLoading(true);
        setTimeout(loadData, 500); 
    };

    if (loading) return <div className="text-center mt-20 text-slate-500 animate-pulse">Cargando Tablón...</div>;

    const { activeQuests = [], availableQuests = [], maxSlots } = hallData || {};

    return (
        <div className="h-full flex flex-col p-6 bg-[url('/backgrounds/hall_bg.png')] bg-cover bg-center relative font-sans text-slate-100">
            <div className="absolute inset-0 bg-slate-950/95" />
            
            <div className="relative z-10 flex flex-col h-full max-w-6xl mx-auto w-full gap-8 overflow-y-auto custom-scrollbar pr-2">
                
                {/* Header */}
                <div className="flex justify-between items-end border-b border-amber-900/30 pb-4">
                    <div>
                        <h2 className="text-4xl font-serif text-amber-500 uppercase tracking-widest drop-shadow-md">Salón de Valhallus</h2>
                        <p className="text-slate-400 text-sm mt-1">Capacidad: <span className="text-white font-bold">{activeQuests.length} / {maxSlots}</span></p>
                    </div>
                    {acceptCooldown > 0 && (
                        <div className="text-xs font-mono text-orange-400 border border-orange-900 bg-orange-900/20 px-3 py-1 rounded flex gap-2">
                            <Clock size={14} /> Nuevo contrato en: {formatTime(acceptCooldown)}
                        </div>
                    )}
                </div>

                {/* 1. ACTIVAS */}
                <div>
                    <h3 className="text-lg font-bold text-slate-300 uppercase mb-4 flex items-center gap-2"><Sword size={18} className="text-green-500"/> Contratos en Curso</h3>
                    {activeQuests.length === 0 ? (
                        <div className="text-slate-600 text-sm italic border border-dashed border-slate-800 rounded p-6 text-center">No tienes misiones activas.</div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {activeQuests.map(q => {
                                let isComplete = true;
                                q.requirements.forEach(req => {
                                    if ((q.progress?.[req.target_id] || 0) < req.count) isComplete = false;
                                });

                                return (
                                    <div key={q.id} className="bg-slate-900 border border-slate-700 rounded-lg p-4 shadow-lg relative">
                                        <div className="flex justify-between mb-2">
                                            <h4 className="font-bold text-amber-100">{q.title}</h4>
                                            {isComplete && <span className="text-[10px] bg-green-900 text-green-300 px-2 py-0.5 rounded border border-green-700 animate-pulse">¡LISTO!</span>}
                                        </div>
                                        <div className="space-y-2 mb-4">
                                            {q.requirements.map((req, i) => {
                                                const cur = q.progress?.[req.target_id] || 0;
                                                const pct = Math.min((cur / req.count) * 100, 100);
                                                return (
                                                    <div key={i} className="text-xs">
                                                        <div className="flex justify-between text-slate-400 mb-0.5"><span>{req.name}</span><span>{cur}/{req.count}</span></div>
                                                        <div className="h-1.5 bg-black rounded-full overflow-hidden"><div className="h-full bg-amber-600 transition-all" style={{ width: `${pct}%` }}/></div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <button 
                                            onClick={() => handleComplete(q.id)}
                                            disabled={!isComplete}
                                            className={`w-full py-2 text-xs font-bold uppercase rounded transition-all ${isComplete ? 'bg-green-700 hover:bg-green-600 text-white shadow-lg' : 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700'}`}
                                        >
                                            {isComplete ? 'Cobrar Recompensa' : 'En Progreso...'}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* 2. TABLÓN */}
                <div className="mt-4">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-slate-300 uppercase flex items-center gap-2"><Scroll size={18} className="text-amber-500"/> Tablón de Solicitudes</h3>
                        <button onClick={handleRefresh} className="text-xs flex items-center gap-1 text-slate-400 hover:text-white transition-colors"><RefreshCw size={12} /> Refrescar</button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {availableQuests.map(quest => (
                            <div key={quest.id} onClick={() => setSelectedQuest(quest)} className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 hover:border-amber-600 p-4 rounded-lg cursor-pointer transition-all hover:-translate-y-1 group">
                                <div className="flex justify-between items-start">
                                    <h4 className="font-bold text-sm text-slate-200 group-hover:text-amber-400">{quest.title}</h4>
                                    <span className="text-[10px] bg-black px-1.5 rounded text-slate-500 border border-slate-800">NVL {quest.min_level}+</span>
                                </div>
                                <p className="text-xs text-slate-500 mt-2 line-clamp-2 h-8">{quest.description}</p>
                                <div className="mt-3 pt-3 border-t border-slate-800/50 flex gap-3 text-[10px] font-mono text-slate-400">
                                    <span>XP: {quest.reward_xp}</span>
                                    <span className="text-yellow-500/80">Oro: {quest.reward_gold}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* MODAL DETALLE */}
            {selectedQuest && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in zoom-in-95">
                    <div className="bg-slate-900 border-2 border-amber-600 rounded-xl max-w-sm w-full p-6 shadow-2xl relative">
                        <button onClick={() => setSelectedQuest(null)} className="absolute top-3 right-3 text-slate-500 hover:text-white"><X size={20}/></button>
                        <h3 className="text-xl font-bold text-white mb-1">{selectedQuest.title}</h3>
                        <div className="bg-black/30 p-3 rounded text-sm text-slate-300 italic border-l-2 border-slate-700 mb-4">"{selectedQuest.description}"</div>
                        <div className="mb-6">
                            <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Objetivos</h4>
                            {selectedQuest.requirements.map((req, i) => (
                                <div key={i} className="flex justify-between text-sm border-b border-white/5 pb-1 mb-1">
                                    <span className="text-slate-200 flex items-center gap-2"><Skull size={12}/> {req.name}</span>
                                    <span className="font-mono text-amber-500">x{req.count}</span>
                                </div>
                            ))}
                        </div>
                        <button 
                            onClick={handleAccept}
                            disabled={acceptCooldown > 0 || activeQuests.length >= maxSlots}
                            className={`w-full py-3 font-bold uppercase rounded shadow-lg transition-all flex items-center justify-center gap-2 ${acceptCooldown > 0 || activeQuests.length >= maxSlots ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-gradient-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white'}`}
                        >
                            {acceptCooldown > 0 ? `Espera ${formatTime(acceptCooldown)}` : activeQuests.length >= maxSlots ? 'Sin Espacio' : 'Aceptar Contrato'}
                        </button>
                    </div>
                </div>
            )}

            {/* ALERTA CUSTOM */}
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

export default ValhallaHall;