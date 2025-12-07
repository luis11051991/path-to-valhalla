import React, { useMemo, useState } from 'react';
import { 
    Maximize2, X, Sword, Shield, Shirt, Footprints, Crown, Gem, Sparkles, Hand, Lock, 
    Store, Gift, PlayCircle, Users, MessageCircle, ScrollText, CheckCircle2 
} from 'lucide-react';
import { RACES } from '../constants/races';
import StatsPanel from './StatsPanel';

const Dashboard = ({ user, onLogout, isShopOpen, onCloseShop }) => {

    const [showAvatarModal, setShowAvatarModal] = useState(false);
    const [shopTab, setShopTab] = useState('buy');
    const [activeBag, setActiveBag] = useState(1);
    const [tooltipData, setTooltipData] = useState(null); 

    const ITEM_ICONS = {
        'Sword': Sword, 'Shield': Shield, 'Shirt': Shirt, 'Gem': Gem,
        'Crown': Crown, 'Footprints': Footprints, 'Sparkles': Sparkles, 'Hand': Hand, 'Scroll': ScrollText
    };

    const raceData = useMemo(() => RACES.find(r => r.id === user.race) || RACES[0], [user.race]);
    const getAvatarImage = () => raceData.image; // PNG Transparente
    
    // URL del fondo (segura) desde la DB
    const getBackgroundImage = () => user.active_background_url || "https://images.unsplash.com/photo-1519074069444-1ba4fff66d16?q=80&w=2544&auto=format&fit=crop";

    const currentXp = user.experience || 0;
    const maxXp = user.level * 1000; 
    const xpPercent = Math.min((currentXp / maxXp) * 100, 100);
    const maxHp = (user.stats?.constitution || 10) * 20;

    const isBagUnlocked = (bagNumber) => {
        if (bagNumber <= 2) return true;
        if (bagNumber === 3) return user.level >= 20;
        return false;
    };

    const getEquippedItem = (slotName) => user.real_inventory?.find(i => i.is_equipped && i.equipped_slot === slotName);
    const getBagItem = (slotIndex) => {
        const realIndex = ((activeBag - 1) * 40) + slotIndex;
        return user.real_inventory?.find(i => !i.is_equipped && i.bag_slot === realIndex);
    };

    const handleSaveStats = async (newStats, pointsSpent) => {
         try {
            const response = await fetch('http://localhost:3000/api/train-stats', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id, newStats, pointsSpent })
            });
            if (response.ok) window.location.reload();
         } catch (e) { console.error(e); }
    };

    const handleMouseEnter = (item, e, side) => {
        if (!item) return;
        const rect = e.currentTarget.getBoundingClientRect();
        setTooltipData({ item, rect, side });
    };

    const handleMouseLeave = () => {
        setTooltipData(null);
    };

    const renderEquipmentSlot = (DefaultIcon, slotName, className = '', tooltipSide = 'top') => {
        const item = getEquippedItem(slotName);
        const ItemIcon = item ? ITEM_ICONS[item.icon] : DefaultIcon;
        return (
            <div 
                key={slotName}
                className={`w-12 h-12 lg:w-14 lg:h-14 bg-slate-900/80 border-2 rounded flex items-center justify-center relative group shadow-lg cursor-pointer z-20 ${item ? 'border-amber-500 bg-slate-800' : 'border-slate-600'} ${className}`}
                onMouseEnter={(e) => handleMouseEnter(item, e, tooltipSide)}
                onMouseLeave={handleMouseLeave}
            >
                <ItemIcon className={`transition-all ${item ? 'text-amber-500 drop-shadow-md' : 'text-slate-500 opacity-40'}`} size={24} />
            </div>
        );
    };

    const GlobalTooltip = () => {
        if (!tooltipData) return null;
        const { item, rect, side } = tooltipData;
        const stats = item.base_stats || {}; 
        const durability = item.durability_current !== undefined ? item.durability_current : 100;
        const maxDurability = item.durability_max || 100;
        const isBroken = durability === 0;

        let style = { position: 'fixed', zIndex: 9999 };
        if (side === 'left') {
            style.right = (window.innerWidth - rect.left) + 10; 
            style.top = rect.top;
        } else if (side === 'top') {
            style.left = rect.left + (rect.width / 2) - 100; 
            style.bottom = (window.innerHeight - rect.top) + 10;
        }

        return (
            <div style={style} className="bg-slate-950 border-2 border-amber-600 p-3 rounded shadow-[0_0_20px_rgba(0,0,0,0.8)] min-w-[200px] pointer-events-none animate-in fade-in zoom-in-95 duration-100">
                <p className={`font-bold text-sm ${item.rarity === 'rare' ? 'text-blue-400' : item.rarity === 'epic' ? 'text-purple-400' : 'text-slate-200'}`}>{item.name}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2 border-b border-white/10 pb-1">{item.type} • {item.rarity}</p>
                <div className="space-y-1 mb-2">
                    {stats.damage_min && <p className={`text-xs ${isBroken ? 'text-slate-600 line-through' : 'text-slate-300'}`}>⚔️ Daño: <span className="text-white">{stats.damage_min} - {stats.damage_max}</span></p>}
                    {stats.armor && <p className={`text-xs ${isBroken ? 'text-slate-600 line-through' : 'text-slate-300'}`}>🛡️ Armadura: <span className="text-white">{stats.armor}</span></p>}
                    {stats.luck && <p className="text-xs text-green-400">🍀 Suerte +{stats.luck}</p>}
                </div>
                <div className="mt-2 pt-1 border-t border-white/10">
                    <div className="flex justify-between text-[10px] mb-0.5">
                        <span className={isBroken ? "text-red-500 font-bold" : "text-slate-400"}>{isBroken ? "ROTO" : "Durabilidad"}</span>
                        <span className={durability < 20 ? "text-red-400" : "text-slate-400"}>{durability}/{maxDurability}</span>
                    </div>
                    <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full ${durability < 20 ? 'bg-red-600' : 'bg-green-600'}`} style={{ width: `${(durability/maxDurability)*100}%` }}></div>
                    </div>
                </div>
                <p className="text-[10px] text-amber-500 mt-2 text-right">Valor: {item.price_gold} Oro</p>
            </div>
        );
    };

    const ONYX_PACKAGES = [{id:1, price:"0.99", amount:100}, {id:2, price:"4.99", amount:500}];
    const FREE_REWARDS = [{id:1, title:"Ver Anuncio", reward:"2 Ónix", icon:PlayCircle, desc:"5/5"}, {id:2, title:"Invitar Amigo", reward:"50 Ónix", icon:Users, desc:"Nivel 10"}];

    return (
        <div className="min-h-full relative font-sans p-4 flex flex-col gap-4">
            
            <GlobalTooltip />

            <div className="absolute inset-0 z-0 pointer-events-none">
                <img src={raceData.bgImage} className="w-full h-full object-cover opacity-60 fixed inset-0" />
                <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/60 to-slate-900/30 fixed inset-0" />
            </div>

             <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                
                {/* COLUMNA 1: PERFIL */}
                <div className="lg:col-span-3 space-y-4">
                    <div className="bg-black/50 backdrop-blur-md border border-amber-900/30 rounded-lg p-4 flex items-center gap-4 shadow-lg">
                        <div className="relative group cursor-zoom-in w-16 h-16 shrink-0" onClick={() => setShowAvatarModal(true)}>
                            {/* --- SANDWICH VISUAL EN MINIATURA --- */}
                            <div className="w-full h-full rounded border-2 border-amber-600 bg-slate-900 overflow-hidden relative z-10">
                                {/* Capa 1: Fondo desde DB */}
                                <img src={getBackgroundImage()} className="absolute inset-0 w-full h-full object-cover opacity-80" alt="BG" />
                                {/* Capa 2: Personaje */}
                                <img src={getAvatarImage()} className="absolute inset-0 w-full h-full object-cover object-top z-10" alt="Avatar" />
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity z-20 rounded"><Maximize2 size={16} className="text-white" /></div>
                        </div>
                        <div className="flex-1">
                            <h2 className="text-xl font-serif text-amber-500">{user.username}</h2>
                            <p className="text-slate-400 text-[10px] uppercase tracking-widest">{raceData.name} • Lvl {user.level}</p>
                            <div className="w-full mt-2">
                                <div className="flex justify-between text-[9px] text-slate-400 mb-0.5"><span>EXP</span><span>{Math.floor(xpPercent)}%</span></div>
                                <div className="h-1.5 bg-slate-800 border border-slate-600 rounded-full overflow-hidden">
                                    <div className="h-full bg-yellow-500 shadow-[0_0_5px_rgba(234,179,8,0.8)]" style={{ width: `${xpPercent}%` }}></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <StatsPanel stats={user.stats} availablePoints={user.stat_points || 0} onSave={handleSaveStats} />
                    <div className="bg-black/50 backdrop-blur-sm border border-slate-700 rounded p-3 text-xs space-y-1">
                        <div className="flex justify-between"><span className="text-slate-400">Daño</span> <span className="text-white font-mono">12 - 18</span></div>
                        <div className="flex justify-between"><span className="text-slate-400">Armadura</span> <span className="text-white font-mono">240</span></div>
                        <div className="flex justify-between"><span className="text-slate-400">Vida</span> <span className="text-red-400 font-mono">{user.current_hp} / {maxHp}</span></div>
                    </div>
                </div>

                {/* COLUMNA 2: PAPERDOLL (SIN FONDO, SOLO PNG) */}
                <div className="lg:col-span-5">
                    <div className="bg-black/40 backdrop-blur-md border border-amber-900/30 rounded-lg p-4 h-[700px] relative shadow-2xl flex flex-col items-center">
                        <h3 className="text-amber-500 font-serif uppercase tracking-widest text-sm mb-4 border-b border-amber-500/20 w-full text-center pb-2">Equipamiento</h3>
                        <div className="relative w-full h-full max-w-[420px]">
                            <div className="absolute inset-x-0 top-12 bottom-12 flex items-center justify-center z-0 opacity-90 pointer-events-none select-none">
                                {/* AQUÍ SOLO EL PERSONAJE */}
                                <img src={getAvatarImage()} className="h-full w-auto object-contain drop-shadow-[0_0_15px_rgba(0,0,0,1)]" />
                            </div>
                            <div className="absolute top-4 left-0">{renderEquipmentSlot(Sparkles, "head_accessory")}</div>
                            <div className="absolute top-24 left-0">{renderEquipmentSlot(Gem, "neck")}</div>
                            <div className="absolute top-44 left-0">{renderEquipmentSlot(Sword, "main_hand")}</div>
                            <div className="absolute bottom-36 left-0">{renderEquipmentSlot(Gem, "ring_1")}</div>
                            <div className="absolute bottom-16 left-0">{renderEquipmentSlot(Hand, "gloves")}</div>
                            <div className="absolute top-0 left-1/2 -translate-x-1/2">{renderEquipmentSlot(Crown, "head")}</div>
                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2">{renderEquipmentSlot(Footprints, "feet")}</div>
                            <div className="absolute top-4 right-0">{renderEquipmentSlot(Sparkles, "earring")}</div>
                            <div className="absolute top-24 right-0">{renderEquipmentSlot(Shirt, "chest")}</div>
                            <div className="absolute top-44 right-0">{renderEquipmentSlot(Shield, "off_hand")}</div>
                            <div className="absolute bottom-36 right-0">{renderEquipmentSlot(Gem, "ring_2")}</div>
                        </div>
                    </div>
                </div>

                {/* COLUMNA 3: MOCHILA */}
                <div className="lg:col-span-4">
                    <div className="bg-slate-900 border-2 border-amber-900/50 rounded-lg p-1 h-[700px] flex flex-col shadow-2xl relative">
                        <div className="flex gap-1 mb-1 px-1 overflow-x-auto">
                            {[1, 2, 3, 4, 5, 6].map((num) => (
                                <button key={num} onClick={() => setActiveBag(num)} className={`flex-1 py-1.5 text-[10px] font-bold uppercase border-t-2 ${activeBag === num ? 'bg-amber-900/80 text-amber-100 border-amber-500' : 'bg-slate-800 text-slate-500 border-transparent'} ${!isBagUnlocked(num) ? 'opacity-70' : ''}`}>
                                    {!isBagUnlocked(num) && <Lock size={10} className="absolute top-0.5 right-0.5 text-red-400" />}
                                    {num >= 4 ? <span className="text-purple-400">VIP</span> : `BOLSA ${num}`}
                                </button>
                            ))}
                        </div>
                        <div className="flex-1 bg-black/60 border border-slate-700 rounded p-2 overflow-y-auto relative">
                            {!isBagUnlocked(activeBag) ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-black/80 z-20">
                                    <Lock size={48} className={activeBag >= 4 ? "text-purple-500 mb-4" : "text-slate-500 mb-4"} />
                                    <h3 className="text-white font-bold mb-2">Mochila Bloqueada</h3>
                                    {activeBag === 3 ? (<p className="text-slate-400 text-xs">Necesitas alcanzar el <span className="text-amber-500">Nivel 20</span>.</p>) : (<div><p className="text-slate-400 text-xs mb-4">Esta es una bolsa <span className="text-purple-400 font-bold">Premium</span>.</p><button className="px-4 py-2 bg-purple-700 hover:bg-purple-600 text-white text-xs font-bold rounded shadow-lg transition-colors border border-purple-400">Alquilar por 7 días</button></div>)}
                                </div>
                            ) : (
                                <div className="grid grid-cols-5 gap-1.5 h-full content-start">
                                    {[...Array(40)].map((_, i) => {
                                        const item = getBagItem(i);
                                        const ItemIcon = item ? ITEM_ICONS[item.icon] : null;
                                        return (
                                            <div key={i} className={`aspect-square border rounded-sm flex items-center justify-center cursor-pointer shadow-inner relative group ${item ? 'bg-slate-800 border-amber-600/50' : 'bg-slate-800/50 border-slate-700 hover:border-amber-500/30'}`} onMouseEnter={(e) => handleMouseEnter(item, e, 'left')} onMouseLeave={handleMouseLeave}>
                                                {item && ItemIcon && <ItemIcon size={20} className="text-amber-500 drop-shadow-md" />}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        <div className="mt-1 flex justify-between items-center px-2 py-1 text-[10px] text-slate-500 bg-slate-950 rounded-b">
                            <span>Libres: {40 - (user.real_inventory?.filter(i => !i.is_equipped && i.bag_slot >= (activeBag-1)*40 && i.bag_slot < activeBag*40).length || 0)}</span>
                            <button className="text-amber-500 hover:underline">Organizar</button>
                        </div>
                    </div>
                </div>
             </div>

            {/* MODAL TIENDA */}
            {isShopOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-[fadeIn_0.2s_ease-out]" onClick={onCloseShop}>
                    <div className="bg-slate-900 w-full max-w-2xl rounded-xl border border-purple-500/30 shadow-[0_0_50px_rgba(168,85,247,0.15)] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-4 bg-gradient-to-r from-slate-900 to-purple-900/40 border-b border-purple-500/20">
                            <div className="flex items-center gap-2"><Store className="text-purple-400" /><h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-200 to-purple-400">Tienda de Ónix</h3></div>
                            <button onClick={onCloseShop} className="text-slate-400 hover:text-white"><X size={20} /></button>
                        </div>
                        <div className="flex border-b border-slate-700">
                            <button onClick={() => setShopTab('buy')} className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 ${shopTab === 'buy' ? 'bg-purple-900/20 text-purple-300 border-b-2 border-purple-500' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}><Gem size={14} /> Comprar</button>
                            <button onClick={() => setShopTab('earn')} className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 ${shopTab === 'earn' ? 'bg-green-900/20 text-green-300 border-b-2 border-green-500' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}><Gift size={14} /> Conseguir Gratis</button>
                        </div>
                        <div className="p-6 bg-slate-950 min-h-[300px]">
                            {shopTab === 'buy' ? (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {ONYX_PACKAGES.map((pkg) => (
                                        <div key={pkg.id} className="bg-slate-900 rounded-lg p-4 border border-slate-700 flex flex-col items-center justify-between hover:scale-105 transition-transform cursor-pointer relative group hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10">
                                            {pkg.popular && <div className="absolute -top-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-lg uppercase tracking-wider">Popular</div>}
                                            <div className="my-2 relative"><Gem size={32} className="text-purple-500 drop-shadow-[0_0_10px_rgba(168,85,247,0.6)]" />{pkg.bonus > 0 && <span className="absolute -bottom-1 -right-2 text-[9px] bg-green-900 text-green-300 px-1 rounded border border-green-500">+{pkg.bonus}</span>}</div>
                                            <div className="text-center mb-3"><div className="text-lg font-bold text-white">{pkg.amount}</div><div className="text-xs text-purple-300">Ónix</div></div>
                                            <button className="w-full py-1.5 bg-slate-800 hover:bg-purple-600 text-white rounded font-bold text-sm transition-colors border border-slate-600 hover:border-purple-400">${pkg.price}</button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {FREE_REWARDS.map((reward) => (
                                        <div key={reward.id} className="flex items-center justify-between bg-slate-900 p-3 rounded-lg border border-slate-700 hover:border-green-500/30 transition-colors group">
                                            <div className="flex items-center gap-4"><div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center group-hover:bg-green-900/20 group-hover:text-green-400 transition-colors"><reward.icon size={20} className="text-slate-400 group-hover:text-green-400" /></div><div><h4 className="font-bold text-slate-200 text-sm">{reward.title}</h4><p className="text-[10px] text-slate-500">{reward.desc}</p></div></div>
                                            {reward.completed ? <div className="flex items-center gap-1 text-slate-500 text-xs px-3 py-1.5 bg-slate-800 rounded border border-slate-700 opacity-70"><CheckCircle2 size={12}/> Reclamado</div> : <button className="px-4 py-1.5 bg-gradient-to-r from-green-700 to-emerald-600 hover:from-green-600 hover:to-emerald-500 text-white text-xs font-bold rounded shadow-lg transition-transform hover:scale-105 border border-green-500/50">+{reward.reward}</button>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="p-3 bg-black/40 text-center text-[10px] text-slate-600 border-t border-slate-800">Las compras ayudan a mantener Valhalla. ¡Gracias por tu apoyo!</div>
                    </div>
                </div>
            )}
            
            {/* --- MODAL AVATAR (CON SANDWICH VISUAL) --- */}
            {showAvatarModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-[fadeIn_0.2s_ease-out]" onClick={() => setShowAvatarModal(false)}>
                    {/* Contenedor relativo que tendrá fondo + imagen */}
                    <div className="relative max-h-[85vh] h-full aspect-[3/4] bg-black/50 rounded-lg overflow-hidden border-2 border-amber-600 shadow-2xl flex items-center justify-center" onClick={e => e.stopPropagation()}>
                        
                        {/* CAPA 1: FONDO COMPLETO (Desde DB) */}
                        <img src={getBackgroundImage()} className="absolute inset-0 w-full h-full object-cover opacity-60" alt="Background" />
                        
                        {/* CAPA 2: PERSONAJE TRANSPARENTE */}
                        <img src={getAvatarImage()} className="relative z-10 max-h-full w-auto object-contain drop-shadow-[0_0_30px_rgba(0,0,0,0.8)]" alt="Full Character" />
                        
                        <button onClick={() => setShowAvatarModal(false)} className="absolute top-4 right-4 p-2 bg-black/60 text-slate-200 hover:text-white hover:bg-red-600/80 rounded-full z-50 border border-white/10 transition-colors"><X size={24}/></button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;