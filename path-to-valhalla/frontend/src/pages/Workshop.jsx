import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom'; // <--- CONEXIÓN AL ROUTER
import { Hammer, Anvil, FlaskRound, Scroll, Lock, ArrowUpCircle, AlertTriangle, Package, Info, XCircle, CheckCircle } from 'lucide-react';
import { apiUrl } from '../constants/api';

// --- CONFIGURACIÓN DE PROFESIONES ---
const PROFESSIONS = [
    { id: 'blacksmith', name: 'Herrero', icon: Anvil, desc: 'Forja armas y armaduras pesadas.', color: 'text-orange-500', border: 'border-orange-500', bg: 'bg-orange-900/20' },
    { id: 'alchemist', name: 'Alquimista', icon: FlaskRound, desc: 'Crea pociones y transmutaciones.', color: 'text-green-500', border: 'border-green-500', bg: 'bg-green-900/20' },
    { id: 'artificer', name: 'Artífice', icon: Scroll, desc: 'Crea joyas y artefactos mágicos.', color: 'text-blue-500', border: 'border-blue-500', bg: 'bg-blue-900/20' }
];

const STAT_ICONS = { strength: '💪', dexterity: '⚡', constitution: '❤️', intelligence: '🧠', wisdom: '✨', charisma: '🎭', luck: '🍀', defense: '🛡️', block: '🚫', crit: '🎯' };

// --- RANGOS DE MAESTRÍA ---
const getProfessionRankTitle = (level) => {
    if (level < 10) return "Novato";
    if (level < 30) return "Aprendiz";
    if (level < 60) return "Oficial";
    if (level < 90) return "Artífice";
    if (level < 100) return "Maestro";
    return "Leyenda Viviente";
};

const Workshop = ({ user: propUser, onUpdateUser: propOnUpdateUser }) => {
    // --- SOPORTE HÍBRIDO (Props o Contexto) ---
    const contextData = useOutletContext();
    const user = propUser || (contextData ? contextData[0] : null);
    const onUpdateUser = propOnUpdateUser || (contextData ? contextData[1] : null);

    const [loading, setLoading] = useState(true);
    const [workshopData, setWorkshopData] = useState(null);
    const [selectedRecipe, setSelectedRecipe] = useState(null);
    const [confirmProfession, setConfirmProfession] = useState(null);
    
    // Estado unificado para mensajes (Éxito o Error)
    const [messageModal, setMessageModal] = useState(null); 
    const [tooltipData, setTooltipData] = useState(null);

    useEffect(() => { if(user) loadData(); }, [user]);

    const loadData = async () => {
        try {
            const res = await fetch(apiUrl('/api/workshop'), { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
            const data = await res.json();
            if (data.success) {
                setWorkshopData(data);
                // Actualizar profesión en el usuario local si ha cambiado
                if(data.hasProfession && (!user.profession || user.profession !== data.profession)) {
                    onUpdateUser({ ...user, profession: data.profession });
                }
            }
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleSelectClick = (profId) => setConfirmProfession(profId);

    const handleConfirmChoice = async () => {
        if (!confirmProfession) return;
        try {
            const res = await fetch(apiUrl('/api/workshop/choose'), {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({ profession: confirmProfession })
            });
            const data = await res.json();
            if (data.success) { 
                setConfirmProfession(null); 
                setLoading(true); 
                await loadData(); 
            } else {
                setMessageModal({ type: 'error', title: 'Error', message: data.message });
            }
        } catch (err) { console.error(err); }
    };

    const handleCraft = async () => {
        if (!selectedRecipe) return;
        try {
            const res = await fetch(apiUrl('/api/workshop/craft'), {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({ recipeId: selectedRecipe.id })
            });
            const data = await res.json();
            if (data.success) {
                setMessageModal({ type: 'success', title: data.message, message: data.detail, item: selectedRecipe });
                loadData(); 
            } else {
                setMessageModal({ type: 'error', title: 'Fallo al Forjar', message: data.message });
            }
        } catch (err) { 
            setMessageModal({ type: 'error', title: 'Error de Conexión', message: 'No se pudo contactar con el taller.' });
        }
    };

    // --- TOOLTIP LOGIC ---
    const handleMouseEnter = (item, e) => {
        if (!item) return;
        const rect = e.currentTarget.getBoundingClientRect();
        setTooltipData({ item, rect });
    };
    const handleMouseLeave = () => setTooltipData(null);

    const getItemStyles = (rarity) => {
        switch (rarity) {
            case 'uncommon': return { text: 'text-green-400', border: 'border-green-800', glow: '' };
            case 'rare': return { text: 'text-blue-400', border: 'border-blue-800', glow: '' };
            case 'legendary': return { text: 'text-orange-400', border: 'border-orange-500', glow: 'shadow-[0_0_15px_rgba(251,146,60,0.4)]' };
            case 'mythic': return { text: 'text-red-500', border: 'border-red-600', glow: 'shadow-[0_0_20px_rgba(220,38,38,0.6)] animate-pulse' };
            default: return { text: 'text-slate-200', border: 'border-slate-600', glow: '' };
        }
    };

    const CraftTooltip = () => {
        if (!tooltipData) return null;
        const { item, rect } = tooltipData;
        const styles = getItemStyles(item.rarity);
        const stats = item.base_stats || {};
        const renderValue = (val) => Array.isArray(val) ? `${val[0]}-${val[1]}` : val;

        return (
            <div 
                className={`fixed z-[100] bg-slate-950 border-2 p-3 rounded shadow-[0_0_30px_rgba(0,0,0,0.9)] w-[220px] pointer-events-none animate-in fade-in zoom-in-95 duration-100 ${styles.border} ${styles.glow}`}
                style={{ top: rect.top, left: rect.right + 15 }}
            >
                <p className={`font-bold text-sm ${styles.text}`}>{item.result_name}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2 border-b border-white/10 pb-1">{item.type} • {item.rarity}</p>
                
                <div className="space-y-1 mb-2">
                    {stats.damage_min && <p className="text-xs text-slate-300">⚔️ Daño: <span className="text-white">{renderValue(stats.damage_min)} - {renderValue(stats.damage_max)}</span></p>}
                    {stats.armor && <p className="text-xs text-slate-300">🛡️ Armadura: <span className="text-white">{renderValue(stats.armor)}</span></p>}
                    
                    {Object.entries(stats).map(([key, val]) => {
                        if (['damage_min', 'damage_max', 'armor'].includes(key)) return null;
                        const icon = STAT_ICONS[key] || '🔹';
                        return <p key={key} className="text-xs text-green-400 capitalize">{icon} {key}: +{renderValue(val)}</p>;
                    })}
                </div>
                {item.item_desc && <p className="text-[10px] text-slate-400 italic border-t border-white/10 pt-1 mt-2 line-clamp-3">{item.item_desc}</p>}
            </div>
        );
    };

    if (!user) return null;
    if (loading) return <div className="h-full flex items-center justify-center text-slate-500 animate-pulse">Cargando Taller...</div>;

    // --- BLOQUEO NIVEL ---
    if (user.level < 5) return (
        <div className="h-full flex flex-col items-center justify-center bg-slate-950 p-6 text-center">
            <div className="p-6 bg-slate-900 border-2 border-red-900 rounded-full mb-4 shadow-[0_0_30px_rgba(220,38,38,0.2)]"><Lock size={64} className="text-red-600" /></div>
            <h2 className="text-3xl font-serif text-slate-200 mb-2">Taller Cerrado</h2>
            <p className="text-slate-500 max-w-md">Vuelve al <span className="text-amber-500 font-bold">Nivel 5</span>.</p>
        </div>
    );

    // --- SELECCIÓN DE PROFESIÓN ---
    if (!workshopData?.hasProfession) {
        const selectedProfData = PROFESSIONS.find(p => p.id === confirmProfession);
        return (
            <div className="h-full p-8 bg-slate-950 flex flex-col items-center relative">
                <h2 className="text-3xl font-serif text-amber-500 mb-2">Elige tu Camino</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl mt-8">
                    {PROFESSIONS.map(prof => (
                        <button key={prof.id} onClick={() => handleSelectClick(prof.id)} className={`bg-slate-900 border-2 ${prof.border} p-6 rounded-xl hover:bg-slate-800 transition-all hover:scale-105 group flex flex-col items-center gap-4 relative overflow-hidden`}>
                            <div className={`absolute inset-0 ${prof.bg} opacity-0 group-hover:opacity-20 transition-opacity`}></div>
                            <prof.icon size={48} className={`${prof.color} group-hover:animate-bounce`} />
                            <h3 className="text-xl font-bold text-white">{prof.name}</h3>
                            <p className="text-sm text-slate-400 text-center">{prof.desc}</p>
                            <span className="mt-auto bg-white/10 px-4 py-2 rounded text-xs uppercase font-bold tracking-widest hover:bg-white/20 border border-white/5">Seleccionar</span>
                        </button>
                    ))}
                </div>
                {confirmProfession && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
                        <div className={`bg-slate-900 border-2 ${selectedProfData.border} rounded-xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center`}>
                            <selectedProfData.icon size={40} className={`mb-4 ${selectedProfData.color}`} />
                            <h3 className="text-2xl font-bold text-white mb-2 text-center">¿Ser <span className={selectedProfData.color}>{selectedProfData.name}</span>?</h3>
                            <p className="text-slate-400 text-center text-sm mb-6">No podrás cambiarlo fácilmente.</p>
                            <div className="flex gap-4 w-full">
                                <button onClick={() => setConfirmProfession(null)} className="flex-1 py-2 rounded bg-slate-800 text-slate-400 font-bold border border-slate-600">Cancelar</button>
                                <button onClick={handleConfirmChoice} className="flex-1 py-2 rounded bg-amber-600 text-white font-bold hover:bg-amber-500 shadow-lg">Aceptar</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // --- MESA DE TRABAJO ---
    const { profession, level, xp, nextLevelXp, recipes } = workshopData;
    const profInfo = PROFESSIONS.find(p => p.id === profession) || PROFESSIONS[0];
    const xpPercent = Math.min((xp / nextLevelXp) * 100, 100);
    const rankTitle = getProfessionRankTitle(level);

    return (
        <div className="h-full flex flex-col bg-slate-950 relative overflow-hidden animate-in fade-in duration-500">
            <CraftTooltip />
            
            {/* Header */}
            <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-lg border ${profInfo.border} bg-black/40 shadow-[0_0_15px_rgba(0,0,0,0.5)]`}>
                        <profInfo.icon size={32} className={profInfo.color} />
                    </div>
                    <div>
                        <h2 className={`text-2xl font-serif font-bold ${profInfo.color}`}>{profInfo.name} <span className="text-slate-300 text-xs ml-2 uppercase tracking-widest border border-slate-700 bg-black/30 px-2 py-1 rounded-full">{rankTitle} (NVL {level})</span></h2>
                        <div className="w-64 h-2.5 bg-slate-800 rounded-full mt-2 overflow-hidden border border-slate-700 relative shadow-inner">
                            <div className={`h-full ${profInfo.color.replace('text', 'bg')} transition-all duration-500 shadow-[0_0_10px_currentColor]`} style={{ width: `${xpPercent}%` }} />
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1 flex justify-between font-mono"><span>{xp} XP</span><span>{nextLevelXp} XP</span></div>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Lista Recetas */}
                <div className="w-1/3 border-r border-slate-800 bg-black/20 p-4 overflow-y-auto custom-scrollbar">
                    <h3 className="text-slate-400 text-xs uppercase tracking-widest font-bold mb-4 flex items-center gap-2"><Scroll size={14} /> Recetas Conocidas</h3>
                    <div className="space-y-2">
                        {recipes.length === 0 ? <div className="text-slate-600 text-xs italic text-center py-4">No conoces ninguna receta aún.</div> : recipes.map(recipe => {
                            const styles = getItemStyles(recipe.rarity);
                            return (
                                <div key={recipe.id} onClick={() => setSelectedRecipe(recipe)} className={`p-3 rounded border cursor-pointer flex items-center gap-3 transition-all ${selectedRecipe?.id === recipe.id ? 'bg-amber-900/20 border-amber-500 shadow-md' : 'bg-slate-900 border-slate-700 hover:border-slate-500 hover:bg-slate-800'}`}>
                                    <div className={`w-10 h-10 rounded bg-black border flex items-center justify-center relative overflow-hidden ${styles.border}`}>
                                        <img src={recipe.result_image} className="w-8 h-8 object-contain" />
                                    </div>
                                    <div>
                                        <div className={`text-sm font-bold ${styles.text}`}>{recipe.result_name}</div>
                                        <div className="text-[10px] text-slate-500">Nivel Req: {recipe.min_profession_level}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Área de Trabajo */}
                <div className="flex-1 p-8 flex flex-col items-center justify-center relative bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900/50 to-slate-950">
                    {selectedRecipe ? (
                        <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl p-6 shadow-2xl animate-in zoom-in-95 duration-200 relative">
                            {/* Info Icon for Tooltip */}
                            <div className="absolute top-2 right-2 text-slate-500 hover:text-white cursor-help" onMouseEnter={(e) => handleMouseEnter(selectedRecipe, e)} onMouseLeave={handleMouseLeave}><Info size={16} /></div>
                            
                            <div className="flex justify-center mb-6">
                                <div className="relative group">
                                    <div className={`w-24 h-24 bg-black border-2 rounded flex items-center justify-center shadow-[0_0_30px_rgba(0,0,0,0.5)] ${getItemStyles(selectedRecipe.rarity).border} ${getItemStyles(selectedRecipe.rarity).glow}`}>
                                        <img src={selectedRecipe.result_image} className="w-20 h-20 object-contain drop-shadow-md" />
                                    </div>
                                    <div className="absolute -bottom-3 -right-3 bg-slate-800 text-slate-200 text-xs px-2 py-1 rounded border border-slate-600 font-mono shadow-lg">x{selectedRecipe.result_quantity}</div>
                                </div>
                            </div>
                            
                            <h3 className={`text-xl font-bold text-center mb-2 ${getItemStyles(selectedRecipe.rarity).text}`}>{selectedRecipe.result_name}</h3>
                            <div className="flex justify-center gap-4 text-xs text-slate-400 mb-6 border-b border-slate-800 pb-4">
                                <span className="flex items-center gap-1 bg-green-900/20 px-2 py-1 rounded border border-green-900/30 text-green-400"><ArrowUpCircle size={14} /> +{selectedRecipe.xp_reward} XP</span>
                                <span className="flex items-center gap-1 bg-amber-900/20 px-2 py-1 rounded border border-amber-900/30 text-amber-400"><Hammer size={14} /> Costo: {selectedRecipe.cost_gold}c</span>
                            </div>

                            <div className="mb-6">
                                <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Materiales Requeridos</h4>
                                <div className="grid grid-cols-4 gap-2">
                                    {Object.entries(selectedRecipe.materials).map(([matId, qty]) => (
                                        <div key={matId} className="bg-black/40 p-2 rounded border border-slate-700 flex flex-col items-center justify-center text-center relative group" title={`Item ID: ${matId}`}>
                                            <div className="w-8 h-8 bg-slate-800 rounded mb-1 border border-slate-600"></div>
                                            <span className="text-[10px] text-slate-300 font-mono">x{qty}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <button onClick={handleCraft} className="w-full py-3 bg-gradient-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white font-bold uppercase tracking-wider rounded shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2 border border-amber-500/50">
                                <Hammer size={18} /> Forjar Objeto
                            </button>
                        </div>
                    ) : (
                        <div className="text-slate-600 flex flex-col items-center select-none p-10 border-2 border-dashed border-slate-800 rounded-xl">
                            <Anvil size={64} className="mb-4 opacity-20" />
                            <p className="text-sm font-bold text-slate-500">Mesa de Trabajo Vacía</p>
                            <p className="text-xs text-slate-600">Selecciona una receta de la izquierda.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* --- MODAL UNIFICADO PARA MENSAJES (ÉXITO O ERROR) --- */}
            {messageModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md animate-in zoom-in-95 duration-300">
                    <div className={`bg-slate-900 border-2 rounded-xl p-8 max-w-sm w-full shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col items-center text-center relative overflow-hidden ${messageModal.type === 'success' ? 'border-green-500 shadow-green-500/20' : 'border-red-500 shadow-red-500/20'}`}>
                        <div className={`absolute inset-0 animate-pulse pointer-events-none ${messageModal.type === 'success' ? 'bg-green-500/10' : 'bg-red-500/10'}`}></div>
                        
                        <div className={`p-4 rounded-full mb-4 border relative z-10 ${messageModal.type === 'success' ? 'bg-green-900/30 border-green-500/50' : 'bg-red-900/30 border-red-500/50'}`}>
                            {messageModal.type === 'success' ? <Package size={40} className="text-green-400" /> : <XCircle size={40} className="text-red-400" />}
                        </div>
                        
                        <h3 className="text-2xl font-serif font-bold text-white mb-2 relative z-10">{messageModal.title}</h3>
                        
                        {messageModal.item && (
                            <p className="text-green-300 text-xs mb-4 uppercase tracking-widest font-bold relative z-10 border border-green-900 bg-green-900/20 px-2 py-1 rounded">
                                {messageModal.item.result_name}
                            </p>
                        )}
                        
                        <p className="text-slate-400 text-sm mb-6 leading-relaxed relative z-10">{messageModal.message}</p>
                        
                        <button 
                            onClick={() => setMessageModal(null)} 
                            className={`w-full py-3 text-white font-bold uppercase rounded shadow-lg transition-all relative z-10 border ${messageModal.type === 'success' ? 'bg-green-700 hover:bg-green-600 border-green-500' : 'bg-red-700 hover:bg-red-600 border-red-500'}`}
                        >
                            {messageModal.type === 'success' ? 'Entendido' : 'Cerrar'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Workshop;