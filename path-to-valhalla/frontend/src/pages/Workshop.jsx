import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { 
    Hammer, Anvil, FlaskRound, Scroll, Lock, 
    XCircle, CheckCircle, Sword, Shield, Gem, 
    Droplets, Sparkles, Feather
} from 'lucide-react';
import { apiUrl } from '../constants/api';

const PROF_THEMES = {
    weaponsmith: { color: 'text-orange-500', border: 'border-orange-600', bgGradient: 'from-orange-900/40 via-red-900/20 to-slate-950', accent: 'bg-orange-600', icon: Sword, actionIcon: Hammer, actionText: 'Forjar Acero', particleColor: '#f97316' },
    armorsmith: { color: 'text-amber-500', border: 'border-amber-600', bgGradient: 'from-amber-900/40 via-orange-900/20 to-slate-950', accent: 'bg-amber-600', icon: Shield, actionIcon: Anvil, actionText: 'Martillar Placas', particleColor: '#f59e0b' },
    herbalist: { color: 'text-emerald-400', border: 'border-emerald-600', bgGradient: 'from-emerald-900/40 via-green-900/20 to-slate-950', accent: 'bg-emerald-600', icon: FlaskRound, actionIcon: Droplets, actionText: 'Mezclar Brebaje', particleColor: '#34d399' },
    scribe: { color: 'text-blue-400', border: 'border-blue-600', bgGradient: 'from-blue-900/40 via-indigo-900/20 to-slate-950', accent: 'bg-blue-600', icon: Scroll, actionIcon: Feather, actionText: 'Inscribir Runa', particleColor: '#60a5fa' },
    jeweler: { color: 'text-purple-400', border: 'border-purple-600', bgGradient: 'from-purple-900/40 via-fuchsia-900/20 to-slate-950', accent: 'bg-purple-600', icon: Gem, actionIcon: Sparkles, actionText: 'Tallar Gema', particleColor: '#c084fc' }
};

const PROFESSIONS_LIST = [
    { id: 'weaponsmith', name: 'Armero', desc: 'Maestro del acero. Forja armas letales.', icon: Sword },
    { id: 'armorsmith', name: 'Herrero de Armaduras', desc: 'Protector de vidas. Forja defensas.', icon: Shield },
    { id: 'herbalist', name: 'Herbolario', desc: 'Conocedor de la naturaleza. Crea pociones.', icon: FlaskRound },
    { id: 'scribe', name: 'Escriba', desc: 'Sabio de las runas. Crea pergaminos.', icon: Scroll },
    { id: 'jeweler', name: 'Joyero', desc: 'Artesano de lo fino. Corta gemas mágicas.', icon: Gem }
];

const RARITY_OPTS = [
    { id: 'common', name: 'Común', minLvl: 0, color: 'text-slate-300', multiplier: '1.0x' },
    { id: 'uncommon', name: 'Poco Común', minLvl: 10, color: 'text-green-400', multiplier: '1.2x' },
    { id: 'rare', name: 'Raro', minLvl: 30, color: 'text-blue-400', multiplier: '1.5x' },
    { id: 'legendary', name: 'Legendario', minLvl: 60, color: 'text-orange-400', multiplier: '2.0x' },
];

const getRarityIndex = (r) => RARITY_OPTS.findIndex(o => o.id === r);

const CraftingProgress = ({ theme, onComplete }) => {
    const [progress, setProgress] = useState(0);
    useEffect(() => {
        const interval = setInterval(() => setProgress(old => (old >= 100 ? 100 : old + 2)), 30);
        return () => clearInterval(interval);
    }, []);
    useEffect(() => { if (progress === 100) setTimeout(onComplete, 200); }, [progress, onComplete]);

    return (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className={`mb-4 animate-bounce ${theme.color}`}><theme.actionIcon size={64} /></div>
            <h3 className={`text-xl font-bold mb-4 uppercase tracking-widest ${theme.color} animate-pulse`}>{theme.actionText}...</h3>
            <div className="w-64 h-4 bg-slate-800 rounded-full overflow-hidden border border-slate-600 relative shadow-[0_0_20px_rgba(0,0,0,0.8)]">
                <div className={`h-full transition-all ease-linear ${theme.accent}`} style={{ width: `${progress}%`, boxShadow: `0 0 10px ${theme.particleColor}` }} />
            </div>
        </div>
    );
};

const Workshop = ({ user: propUser, onUpdateUser: propOnUpdateUser }) => {
    const contextData = useOutletContext();
    const user = propUser || (contextData ? contextData[0] : null);
    const onUpdateUser = propOnUpdateUser || (contextData ? contextData[1] : null);

    const [loading, setLoading] = useState(true);
    const [workshopData, setWorkshopData] = useState(null);
    const [selectedRecipe, setSelectedRecipe] = useState(null);
    const [confirmProfession, setConfirmProfession] = useState(null);
    const [messageModal, setMessageModal] = useState(null); 
    const [isCrafting, setIsCrafting] = useState(false);
    
    // Selector de Rareza
    const [selectedRarity, setSelectedRarity] = useState('common');

    const loadData = useCallback(async () => {
        try {
            const res = await fetch(apiUrl('/api/workshop'), { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
            const data = await res.json();
            if (data.success) {
                setWorkshopData(data);
                if(data.hasProfession && (!user.profession || user.profession !== data.profession)) {
                    onUpdateUser({ ...user, profession: data.profession }); 
                }
            }
        } catch (err) { console.error(err); } finally { setLoading(false); }
    }, [onUpdateUser, user]);

    useEffect(() => {
        if (!user) return;
        const timer = setTimeout(() => {
            void loadData();
        }, 0);
        return () => clearTimeout(timer);
    }, [loadData, user]);

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

    const startCrafting = () => { if (selectedRecipe) setIsCrafting(true); };

    const finishCrafting = async () => {
        setIsCrafting(false);
        try {
            const res = await fetch(apiUrl('/api/workshop/craft'), {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({ recipeId: selectedRecipe.id, targetRarity: selectedRarity })
            });
            const data = await res.json();
            
            if (data.success || data.isCraftFail) {
                setMessageModal({ 
                    type: data.success ? 'success' : 'fail', 
                    title: data.message, 
                    message: data.detail, 
                    item: data.success ? selectedRecipe : null 
                });
                loadData(); 
                fetch(apiUrl('/api/auth/profile'), { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
                    .then(r=>r.json()).then(d=> { if(d.user) onUpdateUser(d.user); });

            } else {
                setMessageModal({ type: 'error', title: 'Error', message: data.message });
            }
        } catch { 
            setMessageModal({ type: 'error', title: 'Error de Conexión', message: 'No se pudo contactar con el taller.' });
        }
    };

    if (!user) return null;
    if (loading) return <div className="h-full flex items-center justify-center text-slate-500 animate-pulse">Cargando Taller...</div>;

    if (user.level < 5) return (
        <div className="h-full flex flex-col items-center justify-center bg-slate-950 p-6 text-center">
            <div className="p-6 bg-slate-900 border-2 border-red-900 rounded-full mb-4 shadow-[0_0_30px_rgba(220,38,38,0.2)]"><Lock size={64} className="text-red-600" /></div>
            <h2 className="text-3xl font-serif text-slate-200 mb-2">Taller Cerrado</h2>
            <p className="text-slate-500 max-w-md">Debes alcanzar el <span className="text-amber-500 font-bold">Nivel 5</span> para aprender un oficio.</p>
        </div>
    );

    if (!workshopData?.hasProfession) {
        return (
            <div className="h-full p-8 bg-slate-950 flex flex-col items-center relative overflow-y-auto custom-scrollbar">
                <h2 className="text-4xl font-serif text-amber-500 mb-2 mt-4 text-center">Elige tu Vocación</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 w-full max-w-7xl px-4 pb-10 mt-10">
                    {PROFESSIONS_LIST.map(prof => {
                        const theme = PROF_THEMES[prof.id] || PROF_THEMES.weaponsmith;
                        return (
                            <button key={prof.id} onClick={() => setConfirmProfession(prof.id)} className={`relative bg-slate-900 border-2 ${theme.border} p-6 rounded-xl hover:bg-slate-800 transition-all hover:scale-105 group flex flex-col items-center gap-4 shadow-lg hover:shadow-[0_0_20px_rgba(0,0,0,0.5)] overflow-hidden`}>
                                <div className={`absolute inset-0 bg-gradient-to-b ${theme.bgGradient} opacity-30 group-hover:opacity-50 transition-opacity`}></div>
                                <prof.icon size={48} className={`${theme.color} relative z-10 group-hover:animate-bounce`} />
                                <h3 className="text-lg font-bold text-white relative z-10 text-center">{prof.name}</h3>
                                <p className="text-xs text-slate-400 text-center relative z-10">{prof.desc}</p>
                                <span className={`mt-auto px-4 py-2 rounded text-[10px] uppercase font-bold tracking-widest border border-white/10 bg-black/40 relative z-10 ${theme.color}`}>Seleccionar</span>
                            </button>
                        );
                    })}
                </div>
                {confirmProfession && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
                        <div className="bg-slate-900 border-2 border-slate-600 rounded-xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center">
                            <h3 className="text-2xl font-bold text-white mb-4 text-center">¿Confirmar Elección?</h3>
                            <div className="flex gap-4 w-full"><button onClick={() => setConfirmProfession(null)} className="flex-1 py-3 rounded bg-slate-800 text-slate-400 font-bold">Cancelar</button><button onClick={handleConfirmChoice} className="flex-1 py-3 rounded bg-amber-600 text-white font-bold">Aceptar</button></div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    const { profession, level, xp, nextLevelXp, recipes, inventory, materials_info } = workshopData;
    const theme = PROF_THEMES[profession] || PROF_THEMES.weaponsmith;
    const profName = PROFESSIONS_LIST.find(p => p.id === profession)?.name || profession;
    const xpPercent = Math.min((xp / nextLevelXp) * 100, 100);

    // --- VALIDACIÓN DE RECURSOS (INTELIGENTE) ---
    let canCraft = false;
    let goldCost = 0;
    
    if (selectedRecipe) {
        goldCost = selectedRecipe.cost_gold;
        // CORRECCIÓN CLAVE: Calculamos riqueza total del usuario (Oro+Plata+Cobre) para ver si puede pagar
        const totalUserWealth = (parseInt(user.gold || 0) * 10000) + (parseInt(user.silver || 0) * 100) + parseInt(user.copper || 0);
        const hasGold = totalUserWealth >= goldCost;
        
        const hasMats = Object.entries(selectedRecipe.materials).every(([matId, qty]) => {
            const myQty = inventory[matId] || 0;
            return myQty >= qty;
        });
        canCraft = hasGold && hasMats;
    }

    return (
        <div className={`h-full flex flex-col relative overflow-hidden animate-in fade-in duration-500 bg-slate-950`}>
            <div className={`absolute inset-0 bg-gradient-to-br ${theme.bgGradient} opacity-60 pointer-events-none`} />
            {isCrafting && <CraftingProgress theme={theme} onComplete={finishCrafting} />}

            <div className="p-6 border-b border-slate-800/50 bg-black/20 flex items-center justify-between shrink-0 relative z-10 backdrop-blur-sm">
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-lg border ${theme.border} bg-black/40`}><theme.icon size={32} className={theme.color} /></div>
                    <div>
                        <h2 className={`text-2xl font-serif font-bold ${theme.color} flex items-center gap-3`}>{profName} <span className="text-slate-400 text-xs font-sans font-normal uppercase tracking-widest border border-slate-700 bg-black/30 px-2 py-0.5 rounded">Nivel {level}</span></h2>
                        <div className="flex items-center gap-3 mt-2">
                            <div className="w-48 h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700 relative shadow-inner"><div className={`h-full ${theme.accent} transition-all duration-500`} style={{ width: `${xpPercent}%` }} /></div>
                            <span className="text-[10px] text-slate-500 font-mono">{xp} / {nextLevelXp} XP</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden relative z-10">
                <div className="w-1/3 min-w-[280px] max-w-sm border-r border-slate-800/50 bg-black/20 p-4 overflow-y-auto custom-scrollbar backdrop-blur-sm">
                    <h3 className="text-slate-500 text-[10px] uppercase tracking-widest font-bold mb-4 flex items-center gap-2"><Scroll size={12} /> Recetas Disponibles</h3>
                    <div className="space-y-2">
                        {recipes.map(recipe => (
                        <div key={recipe.id} onClick={() => {
                            if (!isCrafting) {
                                setSelectedRecipe(recipe);
                                setSelectedRarity(recipe.rarity || 'common');
                            }
                        }} className={`p-3 rounded border cursor-pointer flex items-center gap-3 transition-all group relative overflow-hidden ${selectedRecipe?.id === recipe.id ? `bg-slate-800 ${theme.border} shadow-md` : 'bg-slate-900/50 border-slate-800 hover:border-slate-600 hover:bg-slate-800'} ${isCrafting ? 'opacity-50 pointer-events-none' : ''}`}>
                                <div className={`w-10 h-10 rounded bg-black/60 border flex items-center justify-center shrink-0 ${selectedRecipe?.id === recipe.id ? theme.border : 'border-slate-700'}`}><img src={recipe.result_image} className="w-8 h-8 object-contain" /></div>
                                <div><div className={`text-sm font-bold ${selectedRecipe?.id === recipe.id ? 'text-white' : 'text-slate-300'}`}>{recipe.result_name}</div><div className="text-[10px] text-slate-500 flex items-center gap-2"><span>Nvl {recipe.min_profession_level}</span>{recipe.xp_reward > 0 && <span className="text-green-500/80">+{recipe.xp_reward} XP</span>}</div></div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex-1 p-8 flex flex-col items-center justify-center relative">
                    {selectedRecipe ? (
                        <div className="w-full max-w-lg bg-slate-900/90 border border-slate-700 rounded-xl p-8 shadow-2xl animate-in zoom-in-95 duration-200 relative backdrop-blur-md">
                            <div className="flex justify-center mb-4 relative">
                                <div className={`absolute inset-0 blur-3xl opacity-20 ${theme.accent}`}></div>
                                <div className={`w-24 h-24 bg-black border-2 rounded-lg flex items-center justify-center shadow-lg relative z-10 ${theme.border}`}><img src={selectedRecipe.result_image} className="w-16 h-16 object-contain drop-shadow-[0_0_10px_rgba(0,0,0,0.8)]" /><div className="absolute -bottom-3 -right-3 bg-slate-800 text-white text-xs px-2 py-1 rounded border border-slate-600 font-mono shadow-lg">x{selectedRecipe.result_quantity}</div></div>
                            </div>
                            <h3 className={`text-2xl font-bold text-center mb-1 text-white`}>{selectedRecipe.result_name}</h3>
                            <p className="text-center text-slate-400 text-xs italic mb-4">"{selectedRecipe.item_desc || 'Objeto artesanal.'}"</p>

                            {/* SELECTOR DE CALIDAD (INTELIGENTE) */}
                            <div className="mb-4">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Calidad de Fabricación</label>
                                <div className="grid grid-cols-4 gap-1 p-1 bg-black/40 rounded border border-slate-700">
                                    {RARITY_OPTS.map(opt => {
                                        // Bloqueo: Nivel insuficiente O intentar hacer algo peor de lo que la receta permite
                                        const recipeBaseIdx = getRarityIndex(selectedRecipe.rarity || 'common');
                                        const thisIdx = getRarityIndex(opt.id);
                                        const isBelowRecipeTier = thisIdx < recipeBaseIdx;

                                        const disabled = level < opt.minLvl || isBelowRecipeTier;
                                        const active = selectedRarity === opt.id;
                                        return (
                                            <button 
                                                key={opt.id}
                                                disabled={disabled}
                                                onClick={() => setSelectedRarity(opt.id)}
                                                className={`text-[10px] py-2 rounded transition-all ${disabled ? 'opacity-20 cursor-not-allowed' : 'hover:bg-slate-700'} ${active ? 'bg-slate-700 font-bold border border-slate-500' : ''}`}
                                            >
                                                <div className={`${opt.color}`}>{opt.name}</div>
                                                <div className="text-[9px] text-slate-500">{opt.multiplier} Stats</div>
                                                {disabled && !isBelowRecipeTier && <div className="text-[8px] text-red-500">Nvl {opt.minLvl}</div>}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            <div className="bg-black/40 rounded p-4 mb-6 border border-slate-800">
                                <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-3 tracking-widest">Requisitos</h4>
                                <div className="flex justify-between items-center mb-3 text-sm border-b border-slate-800 pb-2">
                                    <span className="text-slate-400">Costo</span>
                                    {/* VALIDACIÓN VISUAL CORRECTA (Usa Riqueza Total) */}
                                    <span className={`font-mono font-bold ${((user.gold || 0) * 10000 + (user.silver || 0) * 100 + (user.copper || 0)) >= goldCost ? 'text-amber-400' : 'text-red-500'}`}>{goldCost} Cobre</span>
                                </div>
                                <div className="grid grid-cols-4 gap-2">
                                    {Object.entries(selectedRecipe.materials || {}).map(([matId, qtyNeeded]) => {
                                        const myQty = inventory[matId] || 0;
                                        const info = materials_info ? materials_info[matId] : null;
                                        const matName = info ? info.name : `Mat #${matId}`;
                                        const matImg = info ? info.image_url : null;
                                        const hasEnough = myQty >= qtyNeeded;
                                        return (
                                            <div key={matId} className={`bg-slate-800 p-2 rounded border text-center ${hasEnough ? 'border-slate-600' : 'border-red-500 bg-red-900/10'}`} title={matName}>
                                                {matImg && <div className="flex justify-center mb-1"><img src={matImg} className="w-6 h-6 object-contain"/></div>}
                                                <div className="text-[10px] text-slate-300 font-bold mb-1 truncate px-1">{matName}</div>
                                                <div className={`text-[10px] font-mono ${hasEnough ? 'text-green-400' : 'text-red-400 font-bold'}`}>{myQty} / {qtyNeeded}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <button 
                                onClick={startCrafting} 
                                disabled={isCrafting || !canCraft}
                                className={`w-full py-4 text-white font-bold uppercase tracking-wider rounded shadow-lg flex items-center justify-center gap-3 transition-all ${canCraft ? `${theme.accent} hover:brightness-110 active:scale-95` : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'}`}
                            >
                                {isCrafting ? 'Trabajando...' : ( !canCraft ? 'Recursos Insuficientes' : <><theme.actionIcon size={20} /> {theme.actionText}</> )}
                            </button>
                        </div>
                    ) : (
                        <div className="text-slate-600 flex flex-col items-center select-none p-10 border-2 border-dashed border-slate-800 rounded-xl bg-slate-900/30">
                            <div className="opacity-20 mb-4 animate-pulse"><theme.actionIcon size={80} /></div>
                            <p className="text-lg font-bold text-slate-500 mb-1">Mesa de Trabajo Lista</p>
                            <p className="text-xs text-slate-600">Selecciona una receta.</p>
                        </div>
                    )}
                </div>
            </div>

            {messageModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md animate-in zoom-in-95 duration-300" onClick={() => setMessageModal(null)}>
                    <div className={`bg-slate-900 border-2 rounded-xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center text-center relative overflow-hidden ${messageModal.type === 'success' ? 'border-green-500 shadow-green-500/20' : messageModal.type === 'fail' ? 'border-orange-500 shadow-orange-500/20' : 'border-red-500 shadow-red-500/20'}`} onClick={e => e.stopPropagation()}>
                        <div className={`p-4 rounded-full mb-4 border relative z-10 ${messageModal.type === 'success' ? 'bg-green-900/30 border-green-500/50' : messageModal.type === 'fail' ? 'bg-orange-900/30 border-orange-500/50' : 'bg-red-900/30 border-red-500/50'}`}>
                            {messageModal.type === 'success' ? <CheckCircle size={40} className="text-green-400" /> : messageModal.type === 'fail' ? <Hammer size={40} className="text-orange-400" /> : <XCircle size={40} className="text-red-400" />}
                        </div>
                        <h3 className="text-2xl font-serif font-bold text-white mb-2 relative z-10">{messageModal.title}</h3>
                        {messageModal.item && messageModal.type === 'success' && <div className="my-4 relative z-10 animate-bounce-slow"><img src={messageModal.item.result_image} className="w-16 h-16 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]" /></div>}
                        <p className="text-slate-400 text-sm mb-6 leading-relaxed relative z-10">{messageModal.message}</p>
                        <button onClick={() => setMessageModal(null)} className={`w-full py-3 text-white font-bold uppercase rounded shadow-lg transition-all relative z-10 border ${messageModal.type === 'success' ? 'bg-green-700 hover:bg-green-600 border-green-500' : 'bg-slate-700 hover:bg-slate-600 border-slate-500'}`}>Cerrar</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Workshop;
