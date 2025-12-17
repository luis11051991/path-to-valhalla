import React, { useState, useEffect } from 'react';
import { Sword, Shield, Zap, Skull, Trophy, Lock } from 'lucide-react';

const Expeditions = ({ user, onUpdateUser }) => {
    const [expeditions, setExpeditions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [battlingId, setBattlingId] = useState(null); // ID de la misión actual
    const [battleResult, setBattleResult] = useState(null); // Resultado para el modal

    // --- CARGAR MISIONES ---
    useEffect(() => {
        fetch('http://localhost:3000/api/expeditions', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) setExpeditions(data.expeditions);
            setLoading(false);
        })
        .catch(err => { console.error(err); setLoading(false); });
    }, []);

    // --- INICIAR ATAQUE ---
    const handleAttack = async (expedition) => {
        if (user.energy < expedition.energy_cost) {
            alert("¡No tienes suficiente energía!");
            return;
        }
        if (user.current_hp <= 5) {
            alert("Estás muy herido. ¡Cúrate primero!");
            return;
        }

        setBattlingId(expedition.id);

        try {
            const res = await fetch('http://localhost:3000/api/expeditions/start', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ userId: user.id, expeditionId: expedition.id })
            });

            const data = await res.json();

            // Pequeño delay para dramatismo
            setTimeout(() => {
                setBattlingId(null);
                if (data.success) {
                    setBattleResult(data.result);
                    onUpdateUser(data.user); // Actualizar vida/xp/dinero en la App
                } else {
                    alert(data.message);
                }
            }, 1000);

        } catch (error) {
            console.error(error);
            setBattlingId(null);
        }
    };

    // --- CERRAR MODAL ---
    const closeResult = () => setBattleResult(null);

    // --- HELPER: CALCULAR CHANCE VISUAL ---
    const calculateChance = (mission) => {
        let chance = 50;
        const stats = user.stats || {};
        const req = mission.min_stat_req || {};
        
        if (req.strength) chance += ((stats.strength || 0) - req.strength) * 2;
        if (req.defense) chance += ((stats.constitution || 0) - req.defense) * 2;
        if (req.dexterity) chance += ((stats.dexterity || 0) - req.dexterity) * 2;

        if (chance > 95) return 95;
        if (chance < 10) return 10;
        return chance;
    };

    const formatSimpleMoney = (copper) => {
        if (!copper) return "0c";
        const g = Math.floor(copper / 10000);
        const s = Math.floor((copper % 10000) / 100);
        const c = copper % 100;
        let text = "";
        if (g > 0) text += `${g}g `;
        if (s > 0) text += `${s}s `;
        if (c > 0) text += `${c}c`;
        return text;
    };

    if (loading) return <div className="text-center text-slate-500 mt-20">Explorando el mapa...</div>;

    return (
        <div className="p-6 h-full pb-20">
            <h2 className="text-3xl font-serif text-amber-500 mb-2 border-b border-amber-900/30 pb-2 flex items-center gap-3">
                <Sword size={32} /> Mapa de Expediciones
            </h2>
            <p className="text-slate-400 mb-8 text-sm">Viaja a tierras peligrosas. <span className="text-amber-500">Cuidado con tu vida.</span></p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {expeditions.map(exp => {
                    const winChance = calculateChance(exp);
                    const isTooHard = user.level < exp.level_req;
                    const canAfford = user.energy >= exp.energy_cost;

                    return (
                        <div key={exp.id} className={`relative group bg-slate-900 border-2 rounded-xl overflow-hidden transition-all ${isTooHard ? 'border-red-900/50 opacity-70 grayscale' : 'border-slate-700 hover:border-amber-500'}`}>
                            
                            <div className="h-32 overflow-hidden relative">
                                <img src={exp.image_url} alt={exp.name} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent"></div>
                                <div className="absolute bottom-2 left-3">
                                    <h3 className="text-lg font-bold text-white drop-shadow-md">{exp.name}</h3>
                                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${isTooHard ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-300'}`}>
                                        NVL REQ: {exp.level_req}
                                    </span>
                                </div>
                            </div>

                            <div className="p-4 space-y-3">
                                <p className="text-xs text-slate-400 line-clamp-2 h-8">{exp.description}</p>
                                
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="bg-black/40 p-2 rounded border border-slate-800">
                                        <div className="text-slate-500 mb-1">Coste</div>
                                        <div className={`font-bold flex items-center gap-1 ${canAfford ? 'text-blue-400' : 'text-red-400'}`}>
                                            <Zap size={12} /> -{exp.energy_cost} EN
                                        </div>
                                    </div>
                                    <div className="bg-black/40 p-2 rounded border border-slate-800">
                                        <div className="text-slate-500 mb-1">Probabilidad</div>
                                        <div className={`font-bold ${winChance > 70 ? 'text-green-400' : winChance > 40 ? 'text-yellow-400' : 'text-red-500'}`}>
                                            {winChance}% Éxito
                                        </div>
                                    </div>
                                </div>

                                <button 
                                    onClick={() => handleAttack(exp)}
                                    disabled={isTooHard || battlingId !== null}
                                    className={`w-full py-3 rounded font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all 
                                        ${isTooHard 
                                            ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                                            : battlingId === exp.id 
                                                ? 'bg-amber-700 text-white animate-pulse'
                                                : 'bg-gradient-to-r from-red-900 to-red-700 hover:from-red-700 hover:to-red-500 text-white shadow-lg border border-red-500/30'
                                        }`}
                                >
                                    {battlingId === exp.id ? (
                                        <><Sword className="animate-spin" size={14} /> Peleando...</>
                                    ) : isTooHard ? (
                                        <><Lock size={14} /> Bloqueado</>
                                    ) : (
                                        <><Sword size={14} /> Iniciar Expedición</>
                                    )}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* --- MODAL DE RESULTADO --- */}
            {battleResult && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-slate-900 border-2 border-amber-600 w-full max-w-md p-1 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] transform scale-100 transition-transform">
                        <div className="bg-black/60 rounded-xl p-6 text-center relative overflow-hidden">
                            <div className={`absolute inset-0 opacity-20 ${battleResult.won ? 'bg-green-600' : 'bg-red-600'}`}></div>
                            
                            <div className="relative z-10">
                                {battleResult.won ? (
                                    <Trophy size={64} className="mx-auto text-yellow-400 mb-4 drop-shadow-[0_0_15px_rgba(250,204,21,0.6)]" />
                                ) : (
                                    <Skull size={64} className="mx-auto text-red-500 mb-4 drop-shadow-[0_0_15px_rgba(239,68,68,0.6)]" />
                                )}

                                <h2 className={`text-2xl font-bold uppercase mb-2 ${battleResult.won ? 'text-yellow-400' : 'text-red-500'}`}>
                                    {battleResult.won ? '¡VICTORIA!' : '¡DERROTA!'}
                                </h2>
                                
                                <p className="text-slate-300 text-sm mb-6 px-4 italic">"{battleResult.log}"</p>

                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <div className="bg-slate-800 p-3 rounded border border-slate-700">
                                        <div className="text-[10px] text-slate-500 uppercase">Daño Recibido</div>
                                        <div className="text-red-400 font-bold text-lg flex items-center justify-center gap-1">
                                            <HeartBroken size={16} /> -{battleResult.hpLoss} HP
                                        </div>
                                    </div>
                                    <div className="bg-slate-800 p-3 rounded border border-slate-700">
                                        <div className="text-[10px] text-slate-500 uppercase">Recompensas</div>
                                        {battleResult.won ? (
                                            <div>
                                                <div className="text-yellow-400 font-bold text-sm">+{formatSimpleMoney(battleResult.rewards.copper)}</div>
                                                <div className="text-purple-400 font-bold text-xs">+{battleResult.rewards.xp} XP</div>
                                            </div>
                                        ) : (
                                            <div className="text-slate-500 text-sm">Nada...</div>
                                        )}
                                    </div>
                                </div>

                                <button onClick={closeResult} className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white rounded font-bold uppercase transition-colors">
                                    Continuar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Pequeño helper para mostrar dinero en el modal (G/S/C simplificado)
const formatSimpleMoney = (copper) => {
    if (!copper) return "0c";
    const g = Math.floor(copper / 10000);
    const s = Math.floor((copper % 10000) / 100);
    const c = copper % 100;
    let text = "";
    if (g > 0) text += `${g}g `;
    if (s > 0) text += `${s}s `;
    if (c > 0) text += `${c}c`;
    return text;
};

// Icono auxiliar para el modal
const HeartBroken = ({size}) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M12 13l-1.5-2.5L12 9l1.5 1.5L12 13Z"/></svg>
);

export default Expeditions;