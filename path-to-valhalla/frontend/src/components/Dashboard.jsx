import React, { useMemo, useState, useEffect } from 'react';
import {
    Maximize2, X, Sword, Shield, Shirt, Footprints, Crown, Gem, Sparkles, Hand, Lock,
    Store, Gift, PlayCircle, Users, MessageCircle, ScrollText, CheckCircle2, Image as ImageIcon, AlertTriangle, Ban, Clock, Plus
} from 'lucide-react';
import { RACES } from '../constants/races';
import StatsPanel from './StatsPanel';

const Dashboard = ({ user, onLogout, isShopOpen, onCloseShop, onUpdateUser }) => {

    const [showAvatarModal, setShowAvatarModal] = useState(false);
    const [shopTab, setShopTab] = useState('buy');
    const [activeBag, setActiveBag] = useState(1);
    const [tooltipData, setTooltipData] = useState(null);

    // Estados Fondos
    const [backgroundsList, setBackgroundsList] = useState([]);
    const [currentBgUrl, setCurrentBgUrl] = useState(user.active_background_url);

    // Estados Modales
    const [pendingPurchase, setPendingPurchase] = useState(null); // { type, id, price, name }
    const [errorMsg, setErrorMsg] = useState(null);

    const ITEM_ICONS = {
        'Sword': Sword, 'Shield': Shield, 'Shirt': Shirt, 'Gem': Gem,
        'Crown': Crown, 'Footprints': Footprints, 'Sparkles': Sparkles, 'Hand': Hand, 'Scroll': ScrollText
    };

    const raceData = useMemo(() => RACES.find(r => r.id === user.race) || RACES[0], [user.race]);
    // Ahora buscamos en 'images' usando el género del usuario. Si no tiene, default a 'male'.
    const getAvatarImage = () => raceData.images[user.gender || 'male'];
    // Si no hay fondo activo, muestra el fondo base humano LOCAL, nunca internet
    const getBackgroundImage = () => currentBgUrl || raceData.bgImage;

    const currentXp = user.experience || 0;
    const maxXp = user.level * 1000;
    const xpPercent = Math.min((currentXp / maxXp) * 100, 100);
    const maxHp = (user.stats?.constitution || 10) * 20;

    // --- LÓGICA BOLSAS ---
    const isBagUnlocked = (bagNumber) => {
        if (bagNumber <= 2) return true;
        if (bagNumber === 3) return user.level >= 20;
        if (bagNumber >= 4) {
            return user.rented_bags?.some(b => b.bag_number === bagNumber);
        }
        return false;
    };

    // Calcular tiempo restante
    const getBagTimeRemaining = (bagNumber) => {
        const bag = user.rented_bags?.find(b => b.bag_number === bagNumber);
        if (!bag) return null;
        const now = new Date();
        const expires = new Date(bag.expires_at);
        const diffMs = expires - now;
        if (diffMs <= 0) return "Expirado";
        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        if (days > 0) return `${days}d ${hours}h`;
        return `${hours}h restantes`;
    };

    const getEquippedItem = (slotName) => user.real_inventory?.find(i => i.is_equipped && i.equipped_slot === slotName);
    const getBagItem = (slotIndex) => {
        const realIndex = ((activeBag - 1) * 40) + slotIndex;
        return user.real_inventory?.find(i => !i.is_equipped && i.bag_slot === realIndex);
    };

    useEffect(() => {
        if (showAvatarModal) {
            fetch(`http://localhost:3000/api/backgrounds?userId=${user.id}`)
                .then(res => res.json())
                .then(data => setBackgroundsList(data))
                .catch(err => console.error("Error cargando fondos:", err));
        }
    }, [showAvatarModal, user.id]);

    const handleSaveStats = async (newStats, pointsSpent) => {
        try {
            const response = await fetch('http://localhost:3000/api/train-stats', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id, newStats, pointsSpent })
            });
            const data = await response.json();
            if (data.success) onUpdateUser(data.user);
        } catch (e) { console.error(e); }
    };

    const handleEquipBg = async (bgId) => {
        const res = await fetch('http://localhost:3000/api/equip-background', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, backgroundId: bgId })
        });
        const data = await res.json();
        if (data.success) {
            setCurrentBgUrl(data.newUrl);
            onUpdateUser({ ...user, active_background_url: data.newUrl, active_background_id: bgId });
        }
    };

    // --- COMPRAS ---
    const handleBuyBgClick = (bgId, price) => { setPendingPurchase({ type: 'bg', id: bgId, price, name: 'Fondo Exclusivo' }); };

    // Alquiler o Extensión
    const handleRentBagClick = (bagNum) => {
        const isActive = isBagUnlocked(bagNum);
        const action = isActive ? "Extender" : "Alquilar";
        setPendingPurchase({ type: 'bag', id: bagNum, price: 50, name: `${action} Mochila ${bagNum} (7 días)` });
    };

    const executePurchase = async () => {
        if (!pendingPurchase) return;
        let url = '', body = {};

        if (pendingPurchase.type === 'bg') {
            url = 'http://localhost:3000/api/buy-background';
            body = { userId: user.id, backgroundId: pendingPurchase.id };
        } else if (pendingPurchase.type === 'bag') {
            url = 'http://localhost:3000/api/rent-bag';
            body = { userId: user.id, bagNumber: pendingPurchase.id };
        }

        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = await res.json();
        setPendingPurchase(null);

        if (data.success) {
            if (pendingPurchase.type === 'bg') {
                fetch(`http://localhost:3000/api/backgrounds?userId=${user.id}`).then(r => r.json()).then(list => setBackgroundsList(list));
                onUpdateUser({ ...user, onix: user.onix - pendingPurchase.price });
            } else if (pendingPurchase.type === 'bag') {
                onUpdateUser(data.user); // Actualizamos usuario con nuevas fechas
            }
        } else { setErrorMsg(data.message); }
    };

    const handleMouseEnter = (item, e, side) => { if (!item) return; const rect = e.currentTarget.getBoundingClientRect(); setTooltipData({ item, rect, side }); };
    const handleMouseLeave = () => { setTooltipData(null); };

    const renderEquipmentSlot = (DefaultIcon, slotName, className = '', tooltipSide = 'top') => {
        const item = getEquippedItem(slotName);
        const ItemIcon = item ? ITEM_ICONS[item.icon] : DefaultIcon;
        return (
            <div className={`w-12 h-12 lg:w-14 lg:h-14 bg-slate-900/80 border-2 rounded flex items-center justify-center relative group shadow-lg cursor-pointer z-20 ${item ? 'border-amber-500 bg-slate-800' : 'border-slate-600'} ${className}`} onMouseEnter={(e) => handleMouseEnter(item, e, tooltipSide)} onMouseLeave={handleMouseLeave}>
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
        if (side === 'left') { style.right = (window.innerWidth - rect.left) + 10; style.top = rect.top; }
        else if (side === 'top') { style.left = rect.left + (rect.width / 2) - 100; style.bottom = (window.innerHeight - rect.top) + 10; }
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
                    <div className="flex justify-between text-[10px] mb-0.5"><span className={isBroken ? "text-red-500 font-bold" : "text-slate-400"}>{isBroken ? "ROTO" : "Durabilidad"}</span><span className={durability < 20 ? "text-red-400" : "text-slate-400"}>{durability}/{maxDurability}</span></div>
                    <div className="h-1 bg-slate-800 rounded-full overflow-hidden"><div className={`h-full ${durability < 20 ? 'bg-red-600' : 'bg-green-600'}`} style={{ width: `${(durability / maxDurability) * 100}%` }}></div></div>
                </div>
                <p className="text-[10px] text-amber-500 mt-2 text-right">Valor: {item.price_gold} Oro</p>
            </div>
        );
    };

    const ONYX_PACKAGES = [{ id: 1, amount: 100, price: "0.99" }, { id: 2, amount: 500, price: "4.99", popular: true }, { id: 3, amount: 1200, price: "9.99" }, { id: 4, amount: 3000, price: "24.99" }];
    const FREE_REWARDS = [{ id: 1, title: "Ver Anuncio", reward: "2 Ónix", icon: PlayCircle }, { id: 2, title: "Invitar Amigo", reward: "50 Ónix", icon: Users }, { id: 3, title: "Discord", reward: "20 Ónix", icon: MessageCircle }, { id: 4, title: "Bono Diario", reward: "5 Ónix", icon: Gift, completed: true }];

    return (
        <div className="min-h-full relative font-sans p-4 flex flex-col gap-4">
            <GlobalTooltip />
            <div className="absolute inset-0 z-0 pointer-events-none"><img src={raceData.bgImage} className="w-full h-full object-cover opacity-60 fixed inset-0" /><div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/60 to-slate-900/30 fixed inset-0" /></div>

            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                {/* COLUMNA 1 */}
                <div className="lg:col-span-3 space-y-4">
                    <div className="bg-black/50 backdrop-blur-md border border-amber-900/30 rounded-lg p-4 flex items-center gap-4 shadow-lg">
                        <div className="relative group cursor-zoom-in w-16 h-16 shrink-0" onClick={() => setShowAvatarModal(true)}>
                            <div className="w-full h-full rounded border-2 border-amber-600 bg-slate-900 overflow-hidden relative z-10"><img src={getBackgroundImage()} className="absolute inset-0 w-full h-full object-cover opacity-80" /><img src={getAvatarImage()} className="absolute inset-0 w-full h-full object-cover object-top z-10" /></div>
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity z-20 rounded"><Maximize2 size={16} className="text-white" /></div>
                        </div>
                        <div className="flex-1"><h2 className="text-xl font-serif text-amber-500">{user.username}</h2><p className="text-slate-400 text-[10px] uppercase tracking-widest">{raceData.name} • Lvl {user.level}</p><div className="w-full mt-2"><div className="flex justify-between text-[9px] text-slate-400 mb-0.5"><span>EXP</span><span>{Math.floor(xpPercent)}%</span></div><div className="h-1.5 bg-slate-800 border border-slate-600 rounded-full overflow-hidden"><div className="h-full bg-yellow-500 shadow-[0_0_5px_rgba(234,179,8,0.8)]" style={{ width: `${xpPercent}%` }}></div></div></div></div>
                    </div>
                    <StatsPanel stats={user.stats} availablePoints={user.stat_points || 0} onSave={handleSaveStats} />
                    <div className="bg-black/50 backdrop-blur-sm border border-slate-700 rounded p-3 text-xs space-y-1"><div className="flex justify-between"><span className="text-slate-400">Daño</span> <span className="text-white font-mono">12 - 18</span></div><div className="flex justify-between"><span className="text-slate-400">Armadura</span> <span className="text-white font-mono">240</span></div><div className="flex justify-between"><span className="text-slate-400">Vida</span> <span className="text-red-400 font-mono">{user.current_hp} / {maxHp}</span></div></div>
                </div>

                {/* COLUMNA 2 */}
                <div className="lg:col-span-5">
                    <div className="bg-black/40 backdrop-blur-md border border-amber-900/30 rounded-lg p-4 h-[700px] relative shadow-2xl flex flex-col items-center">
                        <h3 className="text-amber-500 font-serif uppercase tracking-widest text-sm mb-4 border-b border-amber-500/20 w-full text-center pb-2">Equipamiento</h3>
                        <div className="relative w-full h-full max-w-[420px]">
                            <div className="absolute inset-x-0 top-12 bottom-12 flex items-center justify-center z-0 opacity-90 pointer-events-none select-none"><img src={getAvatarImage()} className="h-full w-auto object-contain drop-shadow-[0_0_15px_rgba(0,0,0,1)]" /></div>
                            <div className="absolute top-4 left-0">{renderEquipmentSlot(Sparkles, "head_accessory")}</div><div className="absolute top-24 left-0">{renderEquipmentSlot(Gem, "neck")}</div><div className="absolute top-44 left-0">{renderEquipmentSlot(Sword, "main_hand")}</div><div className="absolute bottom-36 left-0">{renderEquipmentSlot(Gem, "ring_1")}</div><div className="absolute bottom-16 left-0">{renderEquipmentSlot(Hand, "gloves")}</div><div className="absolute top-0 left-1/2 -translate-x-1/2">{renderEquipmentSlot(Crown, "head")}</div><div className="absolute bottom-0 left-1/2 -translate-x-1/2">{renderEquipmentSlot(Footprints, "feet")}</div><div className="absolute top-4 right-0">{renderEquipmentSlot(Sparkles, "earring")}</div><div className="absolute top-24 right-0">{renderEquipmentSlot(Shirt, "chest")}</div><div className="absolute top-44 right-0">{renderEquipmentSlot(Shield, "off_hand")}</div><div className="absolute bottom-36 right-0">{renderEquipmentSlot(Gem, "ring_2")}</div>
                        </div>
                    </div>
                </div>

                {/* COLUMNA 3: MOCHILA */}
                <div className="lg:col-span-4">
                    <div className="bg-slate-900 border-2 border-amber-900/50 rounded-lg p-1 h-[700px] flex flex-col shadow-2xl relative">
                        <div className="flex gap-1 mb-1 px-1 overflow-x-auto">{[1, 2, 3, 4, 5, 6].map((num) => (<button key={num} onClick={() => setActiveBag(num)} className={`flex-1 py-1.5 text-[10px] font-bold uppercase border-t-2 transition-colors relative ${activeBag === num ? 'bg-amber-900/80 text-amber-100 border-amber-500' : 'bg-slate-800 text-slate-500 border-transparent hover:bg-slate-700'} ${!isBagUnlocked(num) ? 'opacity-70' : ''}`}>{!isBagUnlocked(num) && <Lock size={10} className="absolute top-0.5 right-0.5 text-red-400" />}{num >= 4 ? <span className="text-purple-400">VIP</span> : `BOLSA ${num}`}</button>))}</div>
                        <div className="flex-1 bg-black/60 border border-slate-700 rounded p-2 overflow-y-auto relative">
                            {!isBagUnlocked(activeBag) ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-black/80 z-20">
                                    <Lock size={48} className={activeBag >= 4 ? "text-purple-500 mb-4" : "text-slate-500 mb-4"} />
                                    <h3 className="text-white font-bold mb-2">Mochila Bloqueada</h3>
                                    {activeBag === 3 ? (<p className="text-slate-400 text-xs">Necesitas alcanzar el <span className="text-amber-500">Nivel 20</span>.</p>) : (<div><p className="text-slate-400 text-xs mb-4">Esta es una bolsa <span className="text-purple-400 font-bold">Premium</span>.</p><button onClick={() => handleRentBagClick(activeBag)} className="px-4 py-2 bg-purple-700 hover:bg-purple-600 text-white text-xs font-bold rounded shadow-lg transition-colors border border-purple-400 flex items-center justify-center gap-2 mx-auto"><Gem size={12} /> 7 días por 50 Ónix</button></div>)}
                                </div>
                            ) : (
                                <div className="grid grid-cols-5 gap-1.5 h-full content-start">{[...Array(40)].map((_, i) => { const item = getBagItem(i); const ItemIcon = item ? ITEM_ICONS[item.icon] : null; return (<div key={i} className={`aspect-square border rounded-sm flex items-center justify-center cursor-pointer shadow-inner relative group ${item ? 'bg-slate-800 border-amber-600/50' : 'bg-slate-800/50 border-slate-700 hover:border-amber-500/30'}`} onMouseEnter={(e) => handleMouseEnter(item, e, 'left')} onMouseLeave={handleMouseLeave}>{item && ItemIcon && <ItemIcon size={20} className="text-amber-500 drop-shadow-md" />}</div>); })}</div>
                            )}
                        </div>
                        {/* PIE DE MOCHILA MEJORADO */}
                        <div className="mt-1 flex justify-between items-center px-2 py-1 text-[10px] text-slate-500 bg-slate-950 rounded-b">
                            <span>Libres: {40 - (user.real_inventory?.filter(i => !i.is_equipped && i.bag_slot >= (activeBag - 1) * 40 && i.bag_slot < activeBag * 40).length || 0)}</span>
                            {activeBag >= 4 && isBagUnlocked(activeBag) && (
                                <div className="flex items-center gap-2">
                                    <span className="text-green-400 font-bold flex items-center gap-1 bg-green-900/20 px-1.5 py-0.5 rounded border border-green-900/50"><Clock size={10} /> {getBagTimeRemaining(activeBag)}</span>
                                    <button onClick={() => handleRentBagClick(activeBag)} className="bg-purple-700 hover:bg-purple-600 text-white rounded p-0.5 transition-colors border border-purple-500 shadow-md" title="Extender 7 días (50 Ónix)"><Plus size={12} /></button>
                                </div>
                            )}
                            <button className="text-amber-500 hover:underline">Organizar</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* MODALES */}
            {isShopOpen && (<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4" onClick={onCloseShop}> <div className="bg-slate-900 w-full max-w-2xl rounded-xl border border-purple-500/30 flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}> <div className="flex justify-between items-center p-4 bg-gradient-to-r from-slate-900 to-purple-900/40 border-b border-purple-500/20"><div className="flex items-center gap-2"><Store className="text-purple-400" /><h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-200 to-purple-400">Tienda de Ónix</h3></div><button onClick={onCloseShop} className="text-slate-400 hover:text-white"><X size={20} /></button></div> <div className="flex border-b border-slate-700"><button onClick={() => setShopTab('buy')} className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider ${shopTab === 'buy' ? 'bg-purple-900/20 text-purple-300 border-b-2 border-purple-500' : 'text-slate-500'}`}>Comprar</button><button onClick={() => setShopTab('earn')} className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider ${shopTab === 'earn' ? 'bg-green-900/20 text-green-300 border-b-2 border-green-500' : 'text-slate-500'}`}>Gratis</button></div> <div className="p-6 bg-slate-950 min-h-[300px]"> {shopTab === 'buy' ? (<div className="grid grid-cols-2 md:grid-cols-4 gap-4">{ONYX_PACKAGES.map(pkg => (<div key={pkg.id} className="bg-slate-900 rounded p-4 border border-slate-700"><div className="text-center mb-3"><Gem className="mx-auto text-purple-500 mb-2" /><div className="text-white font-bold">{pkg.amount}</div></div><button className="w-full bg-slate-800 text-white rounded text-sm py-1 border border-slate-600">${pkg.price}</button></div>))}</div>) : (<div className="space-y-3">{FREE_REWARDS.map(r => (<div key={r.id} className="flex justify-between bg-slate-900 p-3 rounded border border-slate-700"><div className="flex gap-3"><r.icon className="text-slate-400" /><div className="text-sm font-bold text-slate-200">{r.title}</div></div><button className="text-xs bg-green-700 text-white px-3 py-1 rounded">+{r.reward}</button></div>))}</div>)} </div> </div> </div>)}
            {showAvatarModal && (<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-[fadeIn_0.2s_ease-out]" onClick={() => setShowAvatarModal(false)}> <div className="relative w-full max-w-4xl flex flex-col gap-4" onClick={e => e.stopPropagation()}> <div className="relative w-full h-[60vh] bg-black/50 rounded-lg overflow-hidden border-2 border-amber-600 shadow-2xl flex items-center justify-center"> <img src={getBackgroundImage()} className="absolute inset-0 w-full h-full object-cover opacity-60 transition-opacity duration-500" /> <img src={getAvatarImage()} className="relative z-10 max-h-full w-auto object-contain drop-shadow-[0_0_30px_rgba(0,0,0,0.8)]" /> <button onClick={() => setShowAvatarModal(false)} className="absolute top-4 right-4 p-2 bg-black/60 text-slate-200 hover:text-white hover:bg-red-600/80 rounded-full z-50 border border-white/10 transition-colors"><X size={24} /></button> </div> <div className="w-full bg-slate-900/90 border-2 border-slate-700 rounded-lg p-4 backdrop-blur-sm"> <h3 className="text-amber-500 font-bold text-sm mb-3 uppercase tracking-wider flex items-center gap-2"><ImageIcon size={16} /> Colección de Fondos</h3> <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-amber-900 scrollbar-track-slate-800"> {backgroundsList.map(bg => (<div key={bg.id} className="relative group shrink-0 w-32 cursor-pointer" onClick={() => bg.owned && handleEquipBg(bg.id)}> <div className={`h-20 rounded-md overflow-hidden border-2 transition-all relative ${currentBgUrl === bg.image_url ? 'border-amber-500 shadow-[0_0_10px_#f59e0b]' : 'border-slate-600 opacity-70 group-hover:opacity-100 group-hover:border-slate-400'}`}> <img src={bg.image_url} className="w-full h-full object-cover" /> {!bg.owned && <div className="absolute inset-0 bg-black/70 flex items-center justify-center"><Lock size={20} className="text-slate-400" /></div>} </div> <div className="mt-1 text-center"> {bg.owned ? <span className={`text-[10px] font-bold ${currentBgUrl === bg.image_url ? 'text-green-400' : 'text-slate-400'}`}>{currentBgUrl === bg.image_url ? 'Equipado' : 'Equipar'}</span> : <button onClick={(e) => { e.stopPropagation(); handleBuyBgClick(bg.id, bg.price_onyx); }} className="w-full text-[10px] bg-purple-700 hover:bg-purple-600 text-white rounded px-1 py-0.5 flex items-center justify-center gap-1"><Gem size={8} /> {bg.price_onyx}</button>} </div> </div>))} </div> </div> </div> </div>)}
            {pendingPurchase && (<div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in"><div className="bg-slate-900 border-2 border-amber-600 rounded-lg p-6 max-w-sm w-full shadow-[0_0_50px_rgba(245,158,11,0.2)] transform scale-100 flex flex-col items-center"><AlertTriangle className="text-amber-500 mb-4 h-10 w-10" /><h3 className="text-xl font-serif font-bold text-amber-500 mb-2 text-center uppercase tracking-widest">Confirmar Compra</h3><p className="text-slate-300 text-center text-sm mb-6 leading-relaxed">¿Deseas confirmar la transacción por <br /><span className="font-bold text-purple-400 text-lg">{pendingPurchase.price} Ónix</span>?<br /><span className="text-xs text-slate-500 mt-2 block">{pendingPurchase.name}</span></p><div className="flex justify-center gap-4 w-full"><button onClick={() => setPendingPurchase(null)} className="flex-1 py-2 rounded bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors text-sm font-bold uppercase">Cancelar</button><button onClick={executePurchase} className="flex-1 py-2 rounded bg-gradient-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white shadow-lg transition-all text-sm font-bold uppercase">Confirmar</button></div></div></div>)}
            {errorMsg && (<div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in"><div className="bg-slate-900 border-2 border-red-600 rounded-lg p-6 max-w-sm w-full shadow-[0_0_50px_rgba(220,38,38,0.3)] flex flex-col items-center"><Ban className="text-red-500 mb-4 h-10 w-10" /><h3 className="text-xl font-serif font-bold text-red-500 mb-2 text-center uppercase tracking-widest">Saldo Insuficiente</h3><p className="text-slate-300 text-center text-sm mb-6 leading-relaxed">{errorMsg}</p><button onClick={() => setErrorMsg(null)} className="w-full py-2 rounded bg-red-700 hover:bg-red-600 text-white shadow-lg transition-all text-sm font-bold uppercase">Entendido</button></div></div>)}

        </div>
    );
};

export default Dashboard;