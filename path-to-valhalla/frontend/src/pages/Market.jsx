import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom'; // <--- IMPORTACIÓN CLAVE
import { 
    ShoppingBag, Coins, Sword, Shield, Gem, Scroll, FlaskConical, DollarSign, 
    Store, RefreshCw, AlertTriangle 
} from 'lucide-react';
import { apiUrl } from '../constants/api';

// --- CONFIGURACIÓN DINÁMICA ---
const SHOP_CONFIG = {
    weapons: { label: 'Armas', icon: Sword, npcImage: '/npcs/merchant_weapons.png', bgImage: '/backgrounds/city/shop_weapons.png', lore: "¡Bienvenido, 'guerrero'! O eso intentas parecer. Mira estas bellezas, pesan más que tu conciencia, pero cortan mejor.", fallbackNpc: '/npcs/merchant_viking.png' },
    armor: { label: 'Armaduras', icon: Shield, npcImage: '/npcs/merchant_armor.png', bgImage: '/backgrounds/city/shop_armor.png', lore: "¿Miedo a que te toquen? Típico. Cúbrete con este acero, al menos si mueres dejarás un cadáver bonito.", fallbackNpc: '/npcs/merchant_viking.png' },
    jewelry: { label: 'Joyería', icon: Gem, npcImage: '/npcs/merchant_jewelry.png', bgImage: '/backgrounds/city/shop_jewelry.png', lore: "Brillantes para las urracas... digo, para los héroes. Estos anillos tienen más magia que tu cerebro.", fallbackNpc: '/npcs/merchant_viking.png' },
    consumables: { label: 'Pociones', icon: FlaskConical, npcImage: '/npcs/merchant_consumables.png', bgImage: '/backgrounds/city/shop_consumables.png', lore: "Bébetelo todo. Si sabe a podrido es que funciona. No acepto devoluciones si te salen tentáculos.", fallbackNpc: '/npcs/merchant_viking.png' },
    recipes: { label: 'Recetas', icon: Scroll, npcImage: '/npcs/merchant_recipes.png', bgImage: '/backgrounds/city/shop_recipes.png', lore: "El conocimiento es poder, pero tú pareces necesitar instrucciones hasta para respirar. Toma, lee.", fallbackNpc: '/npcs/merchant_viking.png' },
    default: { npcImage: '/npcs/merchant_default.png', bgImage: '/backgrounds/city/shop_default.png', lore: "Así que vienes a vender tu basura... Digo, tus 'tesoros'. Veamos cuánto me apiado de ti hoy.", fallbackNpc: '/npcs/merchant_viking.png' }
};

const STAT_ICONS = { strength: '💪', dexterity: '⚡', constitution: '❤️', intelligence: '🧠', wisdom: '✨', charisma: '🎭', luck: '🍀', defense: '🛡️', block: '🚫', crit: '🎯' };

const Market = ({ user: propUser, onUpdateUser: propOnUpdateUser }) => {
    // --- SOPORTE HÍBRIDO (Props o Contexto) ---
    const contextData = useOutletContext();
    const user = propUser || (contextData ? contextData[0] : null);
    const onUpdateUser = propOnUpdateUser || (contextData ? contextData[1] : null);

    const [mode, setMode] = useState('buy'); // 'buy' or 'sell'
    const [activeCategory, setActiveCategory] = useState('weapons');
    
    // Feedback mejorado
    const [feedbackMsg, setFeedbackMsg] = useState(null);
    const [feedbackKey, setFeedbackKey] = useState(0); 
    
    const [shopItems, setShopItems] = useState([]);
    const [inventory, setInventory] = useState(user?.real_inventory || []);
    const [loadingShop, setLoadingShop] = useState(false);
    
    const [refreshCost, setRefreshCost] = useState(0);
    const [refreshesUsed, setRefreshesUsed] = useState(0);

    const [tooltipData, setTooltipData] = useState(null);
    const [itemToSell, setItemToSell] = useState(null); 

    useEffect(() => { 
        if (user) setInventory(user.real_inventory || []); 
    }, [user?.real_inventory]);

    useEffect(() => {
        if (mode === 'buy' && user) { loadShopData(); }
    }, [mode, user]);

    // Helpers para cambiar modo y limpiar tooltip
    const changeMode = (newMode) => {
        setMode(newMode);
        setTooltipData(null); 
    };

    const changeCategory = (catId) => {
        setActiveCategory(catId);
        setTooltipData(null);
    };

    const loadShopData = async () => {
        setLoadingShop(true);
        try {
            const res = await fetch(apiUrl('/api/shop/items'), { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
            const data = await res.json();
            if (data.success) {
                setShopItems(data.items);
                setRefreshesUsed(data.refreshesUsed);
                setRefreshCost(data.nextRefreshCost);
            }
        } catch (err) { console.error(err); } finally { setLoadingShop(false); }
    };

    const handleRefresh = async () => {
        if (refreshCost > 0 && user.onix < refreshCost) { showFeedback("No tienes suficiente Ónix.", "error"); return; }
        setLoadingShop(true);
        try {
            const res = await fetch(apiUrl('/api/shop/refresh'), {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            if (data.success) {
                setShopItems(data.items);
                setRefreshesUsed(data.refreshesUsed);
                setRefreshCost(data.nextRefreshCost);
                if (data.newOnix !== undefined) { onUpdateUser({ ...user, onix: data.newOnix }); }
                showFeedback("¡Mercancía nueva!", "success");
            } else { showFeedback(data.message, "error"); }
        } catch (error) { showFeedback("Error al refrescar.", "error"); } finally { setLoadingShop(false); }
    };

    const handleBuy = async (item) => {
        try {
            const res = await fetch(apiUrl('/api/shop/buy'), {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({ shopId: item.shop_id, quantity: 1 }) 
            });
            const data = await res.json();
            if (data.success) {
                onUpdateUser({ ...user, ...data.newMoney, real_inventory: data.inventory });
                if (data.updatedStock) {
                    setShopItems(data.updatedStock);
                }
                showFeedback(`Comprado: ${item.name}`, "success");
            } else { showFeedback(data.message, "error"); }
        } catch (error) { showFeedback("Error al comprar", "error"); }
    };

    const initiateSell = (item) => {
        setTooltipData(null); 
        if (item.rarity === 'common' || item.rarity === 'uncommon') { performSell(item); } 
        else { setItemToSell(item); }
    };

    const performSell = async (item) => {
        try {
            const res = await fetch(apiUrl('/api/shop/sell'), {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({ itemId: item.id, quantity: 1 })
            });
            const data = await res.json();
            if (data.success) {
                onUpdateUser({ ...user, ...data.newMoney, real_inventory: data.inventory });
                showFeedback(`+${item.price_copper} Cobre`, "success");
                setItemToSell(null);
                setTooltipData(null); 
            } else { showFeedback(data.message, "error"); }
        } catch (error) { showFeedback("Error al vender", "error"); }
    };

    const showFeedback = (msg, type) => {
        setFeedbackMsg({ text: msg, type });
        setFeedbackKey(prev => prev + 1); 
        setTimeout(() => setFeedbackMsg(null), 2000);
    };

    const formatCurrency = (totalCopper) => {
        const gold = Math.floor(totalCopper / 10000);
        const remainder = totalCopper % 10000;
        const silver = Math.floor(remainder / 100);
        const copper = remainder % 100;
        return (
            <div className="flex items-center gap-1 text-xs font-mono bg-black/60 px-2 py-1 rounded-full border border-amber-900/50 shadow-inner min-w-[60px] justify-end">
                {gold > 0 && <span className="text-yellow-400 font-bold drop-shadow-sm">{gold}g</span>}
                {silver > 0 && <span className="text-slate-300 font-bold drop-shadow-sm">{silver}s</span>}
                <span className="text-orange-500 font-bold drop-shadow-sm">{copper}c</span>
            </div>
        );
    };

    const handleMouseEnter = (item, e, type) => {
        if (!item) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const screenWidth = window.innerWidth;
        const isRightSide = rect.left > screenWidth / 2;
        
        const statsToShow = type === 'buy' ? (item.specific_stats || {}) : (item.base_stats || item.data || {});

        const tooltipItem = {
            ...item,
            base_stats: statsToShow, 
            durability_current: item.durability_current ?? 100,
            durability_max: item.durability_max ?? 100
        };
        
        setTooltipData({ item: tooltipItem, rect, side: isRightSide ? 'left' : 'right', viewType: type });
    };

    const getItemStyles = (rarity) => {
        switch (rarity) {
            case 'uncommon': return { text: 'text-green-400', border: 'border-green-800', glow: '' };
            case 'rare': return { text: 'text-blue-400', border: 'border-blue-800', glow: '' };
            case 'legendary': return { text: 'text-orange-400', border: 'border-orange-500', glow: 'shadow-[0_0_15px_rgba(251,146,60,0.4)]' };
            case 'mythic': return { text: 'text-red-500', border: 'border-red-600', glow: 'shadow-[0_0_20px_rgba(220,38,38,0.6)] animate-pulse' };
            default: return { text: 'text-slate-200', border: 'border-slate-600', glow: '' };
        }
    };

    const GlobalTooltip = () => {
        if (!tooltipData) return null;
        const { item, rect, side, viewType } = tooltipData;
        const styles = getItemStyles(item.rarity);
        
        let style = { position: 'fixed', top: rect.top, zIndex: 100 };
        if (side === 'left') { style.left = rect.left - 210; } 
        else { style.left = rect.right + 10; }
        if (rect.top + 300 > window.innerHeight) { style.top = window.innerHeight - 310; }

        return (
            <div style={style} className="w-[200px] pointer-events-none">
                <div className={`bg-slate-950 border-2 p-3 rounded shadow-[0_0_30px_rgba(0,0,0,0.9)] animate-in fade-in zoom-in-95 duration-100 ${styles.border}`}>
                    <p className={`font-bold text-sm ${styles.text}`}>{item.name}</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2 border-b border-white/10 pb-1">{item.type} • {item.rarity}</p>
                    
                    {item.base_stats?.damage_min && <p className="text-xs text-slate-300 mt-1">⚔️ Daño: <span className="text-white">{item.base_stats.damage_min} - {item.base_stats.damage_max}</span></p>}
                    {item.base_stats?.armor && <p className="text-xs text-slate-300 mt-1">🛡️ Armadura: <span className="text-white">{item.base_stats.armor}</span></p>}

                    {Object.entries(item.base_stats || {}).map(([key, val]) => {
                        if (['damage_min', 'damage_max', 'armor'].includes(key)) return null;
                        if (val <= 0) return null; 
                        const icon = STAT_ICONS[key] || '🔹';
                        return <p key={key} className="text-xs text-green-400 capitalize flex items-center gap-1">{icon} {key}: <span className="text-white">+{val}</span></p>;
                    })}

                    {item.description && <p className="text-[10px] text-slate-400 italic mt-2 border-t border-white/10 pt-1 line-clamp-3">{item.description}</p>}
                    
                    <div className="mt-2 pt-1 border-t border-white/10 space-y-1">
                        {viewType === 'buy' && (
                            <>
                                <div className="flex justify-between items-center"><span className="text-[10px] text-red-400 font-bold">Precio Compra:</span>{formatCurrency(item.buy_price || 0)}</div>
                                <div className="flex justify-between items-center opacity-70"><span className="text-[10px] text-slate-500">Valor Real:</span>{formatCurrency(item.price_copper || 0)}</div>
                            </>
                        )}
                        {viewType === 'sell' && (
                            <div className="flex justify-between items-center"><span className="text-[10px] text-green-400 font-bold">Te paga:</span>{formatCurrency(item.price_copper || 0)}</div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    if (!user) return null;

    const currentConfig = mode === 'buy' ? SHOP_CONFIG[activeCategory] : SHOP_CONFIG.default;
    
    const filteredShopItems = shopItems.filter(item => {
        if (activeCategory === 'weapons') return item.type === 'weapon';
        if (activeCategory === 'jewelry') return ['ring', 'neck', 'earring', 'accessory'].includes(item.type);
        if (activeCategory === 'recipes') return item.type === 'recipe';
        if (activeCategory === 'consumables') return item.type === 'consumable';
        return item.type === activeCategory;
    });

    return (
        <div className="h-full flex flex-col relative overflow-hidden bg-slate-950 font-sans select-none">
            <GlobalTooltip />
            <div className="absolute inset-0 z-0 transition-opacity duration-700">
                <img src={currentConfig.bgImage} className="w-full h-full object-cover opacity-60 animate-in fade-in duration-700" onError={(e) => { e.target.style.display = 'none'; }} />
                <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-slate-900/20 to-slate-950/90" />
            </div>

            <div className="relative z-20 flex justify-between items-center p-4 border-b border-amber-900/30 bg-slate-900/80 backdrop-blur-md shadow-lg shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-900/20 rounded-lg border border-amber-700/50"><Store className="text-amber-500" size={24} /></div>
                    <div><h2 className="text-xl font-serif font-bold text-amber-100 tracking-wide">Distrito Comercial</h2><p className="text-[10px] text-amber-500/60 uppercase tracking-widest">Nivel de Reputación: Neutral</p></div>
                </div>
                <div className="flex bg-black/40 rounded-lg p-1 border border-slate-700 shadow-inner">
                    <button onClick={() => changeMode('buy')} className={`px-6 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all ${mode === 'buy' ? 'bg-amber-700 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>Comprar</button>
                    <button onClick={() => changeMode('sell')} className={`px-6 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all ${mode === 'sell' ? 'bg-green-700 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>Vender</button>
                </div>
                <div className="flex flex-col items-end"><span className="text-[9px] text-slate-400 uppercase tracking-widest mb-1">Tu Bolsa</span>{formatCurrency((user.gold * 10000) + (user.silver * 100) + user.copper)}</div>
            </div>

            <div className="relative z-20 flex-1 flex overflow-hidden p-4 lg:p-6 gap-6">
                <div className="hidden lg:flex flex-col w-1/3 h-full items-center justify-center relative pointer-events-none">
                    <div className="relative w-full max-w-sm aspect-[3/4] mb-4">
                        <div className="absolute inset-0 border-4 border-double border-amber-700/60 rounded-xl bg-black/40 shadow-[0_0_30px_rgba(0,0,0,0.8)] overflow-hidden">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-amber-900/20 via-transparent to-black opacity-80" />
                            <img key={currentConfig.npcImage} src={currentConfig.npcImage} alt="Merchant" className="w-full h-full object-cover object-top transition-all duration-500 animate-in fade-in zoom-in-105" onError={(e) => { e.target.onerror = null; e.target.src = currentConfig.fallbackNpc; }} />
                        </div>
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-900 border border-amber-600 px-4 py-1 rounded-full shadow-lg z-10">
                            <span className="text-xs font-bold text-amber-500 uppercase tracking-widest">{mode === 'buy' ? currentConfig.label : 'Mercader General'}</span>
                        </div>
                    </div>
                    <div className="w-full max-w-sm bg-slate-900/90 border border-amber-900/50 p-4 rounded-xl backdrop-blur-md shadow-lg relative mt-2">
                        <div className="absolute -top-2 left-6 w-4 h-4 bg-slate-900 border-l border-t border-amber-900/50 transform rotate-45"></div>
                        <p className="text-slate-300 text-sm italic font-serif leading-relaxed text-center">"{currentConfig.lore}"</p>
                    </div>
                    {feedbackMsg && (<div key={feedbackKey} className={`absolute top-0 z-50 px-6 py-3 rounded-xl shadow-2xl font-bold animate-in fade-in slide-in-from-top-4 flex items-center gap-2 border-2 ${feedbackMsg.type === 'error' ? 'bg-red-900/90 border-red-500 text-white' : 'bg-yellow-900/90 border-yellow-500 text-yellow-100'}`}>{feedbackMsg.type === 'success' && <Coins size={20} />}{feedbackMsg.text}</div>)}
                </div>

                <div className="flex-1 bg-slate-900/80 border border-slate-700 rounded-xl flex flex-col shadow-2xl backdrop-blur-md overflow-hidden relative">
                    {mode === 'buy' && (
                        <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="flex border-b border-slate-700 bg-black/20 overflow-x-auto no-scrollbar">
                                {Object.entries(SHOP_CONFIG).map(([key, config]) => {
                                    if (key === 'default') return null;
                                    const Icon = config.icon;
                                    return (
                                        <button key={key} onClick={() => changeCategory(key)} className={`flex-1 min-w-[80px] py-3 flex flex-col items-center gap-1 text-[10px] font-bold uppercase transition-all relative ${activeCategory === key ? 'text-amber-400 bg-gradient-to-t from-amber-900/20 to-transparent' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>
                                            <Icon size={18} className={activeCategory === key ? "drop-shadow-[0_0_8px_rgba(245,158,11,0.8)]" : ""} />
                                            {config.label}
                                            {activeCategory === key && <div className="absolute bottom-0 w-full h-0.5 bg-amber-500 shadow-[0_0_10px_#f59e0b]" />}
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="px-4 py-2 bg-slate-950/50 border-b border-slate-800 flex justify-between items-center">
                                <span className="text-[10px] text-slate-400 uppercase">Rotación Diaria</span>
                                <button onClick={handleRefresh} disabled={refreshCost === -1 || loadingShop} className={`flex items-center gap-2 px-3 py-1 rounded text-xs font-bold border transition-all ${refreshCost === 0 ? 'bg-green-600 border-green-400 text-white hover:bg-green-500' : 'bg-slate-800 border-slate-600 text-slate-300 hover:border-purple-500 hover:text-purple-400'}`}>
                                    <RefreshCw size={12} className={loadingShop ? "animate-spin" : ""} />
                                    {refreshCost === -1 ? "Agotado" : refreshCost === 0 ? "Refresco GRATIS" : `${refreshCost} Ónix`}
                                </button>
                            </div>
                            <div className="flex-1 p-4 overflow-y-auto custom-scrollbar bg-black/20">
                                {loadingShop ? <div className="flex justify-center mt-20"><div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div></div> : 
                                 filteredShopItems.length === 0 ? <div className="text-center text-slate-500 mt-20 italic">No hay existencias de {SHOP_CONFIG[activeCategory].label} hoy.</div> : (
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                        {filteredShopItems.map((item) => {
                                            const styles = getItemStyles(item.rarity);
                                            return (
                                                <div key={item.shop_id} onMouseEnter={(e) => handleMouseEnter(item, e, 'buy')} onMouseLeave={() => setTooltipData(null)} className={`bg-slate-800 border rounded p-2 flex flex-col gap-2 hover:border-amber-500 transition-all group relative cursor-help ${styles.border} ${styles.glow}`}>
                                                    <div className="h-24 bg-black/40 rounded flex items-center justify-center p-2 relative overflow-hidden group-hover:bg-black/60 transition-colors">
                                                        <img src={item.image_url} className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-300" />
                                                        <span className={`absolute top-1 right-1 text-[9px] px-1 rounded border ${item.rarity === 'rare' ? 'bg-blue-900/80 border-blue-500 text-blue-200' : 'bg-slate-900 border-slate-700 text-slate-400'}`}>Lvl {item.min_level}</span>
                                                    </div>
                                                    <div className="flex-1">
                                                        <h4 className={`text-xs font-bold line-clamp-1 ${styles.text}`}>{item.name}</h4>
                                                        <p className="text-[10px] text-slate-500 line-clamp-1">{item.type}</p>
                                                    </div>
                                                    <button onClick={(e) => { e.stopPropagation(); handleBuy(item); }} className="w-full py-1.5 bg-amber-700 hover:bg-amber-600 text-white text-xs font-bold rounded flex items-center justify-center gap-1 shadow-md active:scale-95 transition-transform cursor-pointer">
                                                        <span className="text-[9px] text-slate-300 mr-1">Compra:</span>
                                                        <span className="text-yellow-200">{formatCurrency(item.buy_price)}</span>
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    {mode === 'sell' && (
                        <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="p-3 bg-green-900/10 border-b border-green-900/30 flex justify-between items-center"><span className="text-green-400 font-bold text-xs uppercase tracking-wider flex items-center gap-2"><DollarSign size={14} /> Tu Inventario</span><span className="text-[10px] text-slate-500 bg-slate-950/50 px-2 py-1 rounded border border-slate-800">Click para vender</span></div>
                            <div className="flex-1 p-4 overflow-y-auto custom-scrollbar bg-black/20">
                                <div className="grid grid-cols-5 md:grid-cols-6 lg:grid-cols-7 gap-3">
                                    {inventory.filter(i => !i.is_equipped).map((item) => {
                                        const canSell = item.price_copper > 0;
                                        return (
                                            <div key={item.id} onClick={() => canSell && initiateSell(item)} onMouseEnter={(e) => handleMouseEnter(item, e, 'sell')} onMouseLeave={() => setTooltipData(null)} className={`aspect-square rounded border relative group transition-all duration-200 ${canSell ? 'bg-slate-800 border-slate-600 cursor-pointer hover:border-green-500 hover:bg-green-900/20 hover:scale-105' : 'bg-slate-900/50 border-slate-800 opacity-60 cursor-not-allowed'}`}>
                                                <img src={item.image_url} className="w-full h-full object-contain p-1.5 pointer-events-none" />
                                                {item.quantity > 1 && <span className="absolute bottom-0 right-0 bg-black/90 text-[9px] text-white px-1.5 font-mono border-tl border-slate-700 rounded-tl shadow-sm">{item.quantity}</span>}
                                                {canSell && <div className="absolute inset-0 flex items-center justify-center bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity z-10 rounded backdrop-blur-[1px]"><div className="text-center"><p className="text-[9px] text-slate-300 uppercase mb-0.5">Vender</p><p className="text-xs font-bold text-yellow-400">{formatCurrency(item.price_copper)}</p></div></div>}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {itemToSell && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-slate-900 border-2 border-red-500 rounded-xl p-6 max-w-sm w-full shadow-[0_0_50px_rgba(220,38,38,0.3)]">
                        <div className="flex justify-center mb-4"><div className="p-3 bg-red-900/30 rounded-full border border-red-500/50"><AlertTriangle className="text-red-500" size={32} /></div></div>
                        <h3 className="text-center text-lg font-bold text-slate-200 mb-2">¿Vender Objeto Valioso?</h3>
                        <p className="text-center text-slate-400 text-xs mb-6">Estás a punto de vender <span className={`font-bold ${itemToSell.rarity === 'rare' ? 'text-blue-400' : 'text-purple-400'}`}>{itemToSell.name}</span>.<br/>Esta acción no se puede deshacer.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setItemToSell(null)} className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-bold text-xs uppercase border border-slate-600">Cancelar</button>
                            <button onClick={() => performSell(itemToSell)} className="flex-1 py-2 bg-red-700 hover:bg-red-600 text-white rounded font-bold text-xs uppercase border border-red-500 shadow-lg">Sí, Vender</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Market;