import React, { useState, useEffect } from 'react';
import { Zap, Ban, ArrowUpCircle } from 'lucide-react'; // Quitamos Lock porque usaremos imagen
import { apiUrl } from '../constants/api';

// Configuración
const MAX_POSSIBLE_SLOTS = 5;

const Grimoire = ({ user, onUpdateUser }) => {
    const [mySkills, setMySkills] = useState([]);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState(null);

    // --- CARGAR HABILIDADES ---
    const fetchSkills = () => {
        fetch(apiUrl('/api/skills'), { 
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } 
        })
        .then(res => res.json())
        .then(data => { 
            if (data.success) {
                setMySkills(data.skills);
            }
            setLoading(false);
        })
        .catch(err => {
            console.error(err);
            setLoading(false);
        });
    };

    useEffect(() => {
        fetchSkills();
    }, []);

    // --- HELPERS ---
    const getMaxSlots = () => {
        if (user.level >= 100) return 5;
        if (user.level >= 50) return 4;
        if (user.level >= 10) return 3;
        return 2;
    };

    const calculateUpgradeCost = (skill) => {
        const base = skill.base_price || 100;
        const lvl = skill.skill_level || 1;
        // Fórmula Exponencial: Base * 1.3^(Nivel-1)
        return Math.floor(base * Math.pow(1.3, lvl - 1));
    };

    const formatCurrency = (totalCopper) => {
        if (!totalCopper) return <span className="text-slate-500 font-bold">Gratis</span>;
        const gold = Math.floor(totalCopper / 10000);
        const remainderAfterGold = totalCopper % 10000;
        const silver = Math.floor(remainderAfterGold / 100);
        const copper = remainderAfterGold % 100;
        return (
            <span className="flex items-center gap-1">
                {gold > 0 && <span className="text-yellow-500 font-bold">{gold}g</span>}
                {silver > 0 && <span className="text-slate-300 font-bold">{silver}s</span>}
                {copper > 0 && <span className="text-orange-500 font-bold">{copper}c</span>}
            </span>
        );
    };

    // --- ACCIONES ---
    const handleToggleEquip = async (skillId) => {
        try {
            const res = await fetch(apiUrl('/api/skills/equip'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({ skillId })
            });
            const data = await res.json();
            if (data.success) fetchSkills();
            else setErrorMsg(data.message);
        } catch {
            setErrorMsg("Error de conexión.");
        }
    };

    const handleUpgradeSkill = async (e, skill) => {
        e.stopPropagation(); 

        const maxLevel = skill.max_level || 10;
        if ((skill.skill_level || 1) >= maxLevel) return;

        const cost = calculateUpgradeCost(skill);
        const playerTotalCopper = (user.gold * 10000) + (user.silver * 100) + user.copper;

        if (playerTotalCopper < cost) {
            setErrorMsg("No tienes suficiente dinero.");
            return;
        }

        try {
            const res = await fetch(apiUrl('/api/skills/upgrade'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({ playerSkillId: skill.player_skill_id })
            });
            const data = await res.json();
            
            if (data.success) {
                onUpdateUser({ ...user, ...data.newFunds });
                fetchSkills();
            } else {
                setErrorMsg(data.message);
            }
        } catch {
            setErrorMsg("Error al mejorar habilidad.");
        }
    };

    // --- RENDER ---
    const unlockedSlots = getMaxSlots();
    const equippedSkills = mySkills.filter(s => s.is_equipped).sort((a,b) => (a.slot_index || 0) - (b.slot_index || 0));
    // Crear array fijo de slots para mostrar huecos vacíos
    const slotsDisplay = [...Array(MAX_POSSIBLE_SLOTS)].map((_, i) => {
        return equippedSkills[i] || null;
    });

    return (
        <div className="h-full flex flex-col p-6 animate-in fade-in duration-500 overflow-y-auto custom-scrollbar">
            
            {/* CABECERA: SLOTS EQUIPADOS */}
            <div className="mb-8 p-6 bg-slate-900/80 border border-purple-500/30 rounded-xl shadow-[0_0_50px_rgba(168,85,247,0.1)]">
                <div className="flex justify-between items-center mb-6 border-b border-purple-500/20 pb-4">
                    <h3 className="text-lg font-serif font-bold text-purple-300 uppercase tracking-widest flex items-center gap-2">
                        <img src="/icons/tabs/tab_grimoire.png" className="w-6 h-6" alt=""/> Barra de Batalla
                    </h3>
                    <span className="text-xs font-bold bg-purple-900/40 text-purple-200 px-3 py-1 rounded-full border border-purple-500/30">
                        {equippedSkills.length} / {unlockedSlots} Ranuras Usadas
                    </span>
                </div>
                
                <div className="flex gap-4 justify-center flex-wrap">
                    {[...Array(MAX_POSSIBLE_SLOTS)].map((_, i) => { 
                        const isUnlocked = i < unlockedSlots; 
                        const skill = slotsDisplay[i]; 
                        
                        return (
                            <div 
                                key={i} 
                                className={`w-20 h-20 rounded-xl border-2 flex items-center justify-center relative transition-all overflow-hidden group
                                ${!isUnlocked 
                                    ? 'border-slate-800 bg-slate-950' 
                                    : skill 
                                        ? 'border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.4)] cursor-pointer hover:scale-105 bg-purple-900/20' 
                                        : 'border-slate-700 bg-slate-900/50'}`} 
                                onClick={() => skill && handleToggleEquip(skill.player_skill_id)}
                                title={skill ? "Click para desequipar" : isUnlocked ? "Ranura vacía" : "Bloqueado"}
                            >
                                {!isUnlocked ? (
                                    // SLOT BLOQUEADO (Imagen + Texto)
                                    <>
                                        <img src="/icons/ui/slot_locked.png" className="w-full h-full object-cover opacity-60" alt="Bloqueado" />
                                        <span className="absolute bottom-1 text-[9px] text-white font-bold bg-black/60 px-1 rounded border border-white/10">
                                            LVL {i === 2 ? 10 : i === 3 ? 50 : 100}
                                        </span>
                                    </>
                                ) : skill ? (
                                    // SKILL EQUIPADA
                                    <>
                                        <img src={skill.image_url} className="w-full h-full object-cover" alt={skill.name} />
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                            <Ban className="text-red-400" />
                                        </div>
                                    </>
                                ) : (
                                    // SLOT VACÍO (Imagen)
                                    <img src="/icons/ui/slot_empty.png" className="w-full h-full object-cover opacity-40" alt="Vacío" />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* LISTA DE HABILIDADES */}
            <h2 className="text-2xl font-serif text-slate-200 mb-6 pl-2 border-l-4 border-purple-500">Grimorio de Poderes</h2>
            
            {loading ? (
                <div className="text-center text-slate-500 mt-10">Leyendo pergaminos antiguos...</div>
            ) : mySkills.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-500 border-2 border-dashed border-slate-800 rounded-xl">
                    <img src="/icons/tabs/tab_grimoire.png" className="w-16 h-16 opacity-30 mb-4 grayscale" alt="Empty" />
                    <p>No has aprendido ninguna habilidad aún.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
                    {mySkills.map((skill) => {
                        const maxLevel = skill.max_level || 10;
                        const isMax = (skill.skill_level || 1) >= maxLevel;
                        const upgradeCost = isMax ? null : calculateUpgradeCost(skill);
                        
                        return (
                            <div 
                                key={skill.player_skill_id} 
                                onClick={() => handleToggleEquip(skill.player_skill_id)} 
                                className={`relative group bg-slate-900 border rounded-xl overflow-hidden transition-all cursor-pointer hover:shadow-[0_0_25px_rgba(168,85,247,0.15)] flex flex-col
                                ${skill.is_equipped ? 'border-purple-500 ring-1 ring-purple-500/50 bg-purple-900/5' : 'border-slate-700 hover:border-purple-400/50'}`}
                            >
                                {/* Cabecera Card */}
                                <div className="flex p-4 gap-4 items-start">
                                    <div className={`w-14 h-14 rounded-lg bg-black border shrink-0 overflow-hidden relative shadow-inner ${skill.is_equipped ? 'border-purple-400' : 'border-slate-700'}`}>
                                        {skill.image_url ? (
                                            <img src={skill.image_url} alt={skill.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-purple-900"><Zap /></div>
                                        )}
                                        <div className="absolute bottom-0 right-0 bg-black/80 text-[10px] text-white px-1.5 font-bold border-tl border-slate-700 rounded-tl">
                                            Nv.{skill.skill_level}
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start">
                                            <h3 className={`text-sm font-bold truncate pr-2 ${skill.is_equipped ? 'text-purple-300' : 'text-slate-200 group-hover:text-white'}`}>
                                                {skill.name}
                                            </h3>
                                            {skill.is_equipped && <Zap size={12} className="text-purple-400 shrink-0 mt-1" />}
                                        </div>
                                        <div className="text-[10px] text-yellow-500/80 mb-1">Probabilidad: {(skill.trigger_chance || 15)}%</div>
                                        <p className="text-[10px] text-slate-400 line-clamp-2 leading-tight min-h-[2.5em]">{skill.description}</p>
                                    </div>
                                </div>
                                
                                {/* Barra Inferior (Costos y Botón) */}
                                <div className="mt-auto bg-black/40 px-4 py-2 flex justify-between items-center text-xs border-t border-white/5">
                                    <div className="flex flex-col gap-0.5">
                                        <div className="text-blue-400 font-mono text-[10px]">MP: {skill.energy_cost}</div>
                                        {skill.damage_min > 0 && (
                                            <div className="text-red-400 font-bold text-[10px]">
                                                DMG: {Math.floor(skill.damage_min * (1 + (skill.skill_level-1)*0.1))}
                                            </div>
                                        )}
                                    </div>
                                    
                                    {isMax ? (
                                        <div className="px-3 py-1 bg-slate-800 text-slate-500 rounded text-[10px] font-bold uppercase flex items-center gap-1 border border-slate-700 cursor-default">
                                            MAX
                                        </div>
                                    ) : (
                                        <button 
                                            onClick={(e) => handleUpgradeSkill(e, skill)}
                                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-amber-500 text-slate-300 hover:text-white rounded text-[10px] font-bold uppercase flex items-center gap-2 transition-all shadow-sm group/btn"
                                            title="Mejorar Habilidad"
                                        >
                                            <ArrowUpCircle size={12} className="text-green-500 group-hover/btn:animate-bounce" /> 
                                            {formatCurrency(upgradeCost)}
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {errorMsg && (
                <div className="fixed bottom-4 right-4 bg-red-900/90 text-white px-6 py-3 rounded-lg shadow-xl border border-red-500 animate-in slide-in-from-right fade-in z-50 flex items-center gap-4">
                    <span>{errorMsg}</span>
                    <button onClick={() => setErrorMsg(null)} className="font-bold hover:text-red-200">X</button>
                </div>
            )}
        </div>
    );
};

export default Grimoire;
