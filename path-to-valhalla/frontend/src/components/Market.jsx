import React, { useState, useEffect } from 'react';
import { ShoppingBag, Coins, Sword, Shield, Gem, Scroll, FlaskConical, DollarSign, Store, Lock } from 'lucide-react';
import { apiUrl } from '../constants/api';

// Categorías mapeadas a los tipos de tu base de datos
const SHOP_CATEGORIES = [
    { id: 'weapon', label: 'Armas', icon: Sword },
    { id: 'armor', label: 'Armaduras', icon: Shield },
    { id: 'accessory', label: 'Joyería', icon: Gem }, // Asumiendo que usas 'accessory' o similar
    { id: 'consumable', label: 'Pociones', icon: FlaskConical },
    { id: 'material', label: 'Materiales', icon: Scroll },
];

const Market = ({ user, onUpdateUser }) => {
    const [mode, setMode] = useState('sell'); // 'buy' o 'sell'
    const [activeCategory, setActiveCategory] = useState('weapon');
    const [feedbackMsg, setFeedbackMsg] = useState(null);
    
    // Estados de datos
    const [shopItems, setShopItems] = useState([]);
    const [inventory, setInventory] = useState(user.real_inventory || []);
    const [loadingShop, setLoadingShop] = useState(false);

    useEffect(() => {
        setInventory(user.real_inventory || []);
    }, [user.real_inventory]);

    // Cargar stock de la tienda al entrar
    useEffect(() => {
        if (mode === 'buy' && shopItems.length === 0) {
            setLoadingShop(true);
            fetch(apiUrl('/api/shop/items'), {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) setShopItems(data.items);
                setLoadingShop(false);
            })
            .catch(err => {
                console.error(err);
                setLoadingShop(false);
            });
        }
    }, [mode]);

    // --- ACCIONES ---
    const handleBuy = async (item) => {
        try {
            const res = await fetch(apiUrl('/api/shop/buy'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({ templateId: item.id, quantity: 1 })
            });
            const data = await res.json();

            if (data.success) {
                onUpdateUser({ ...user, ...data.newMoney, real_inventory: data.inventory });
                showFeedback(`Comprado: ${item.name}`, "success");
            } else {
                showFeedback(data.message, "error");
            }
        } catch (error) { showFeedback("Error al comprar", "error"); }
    };

    const handleSell = async (item) => {
        try {
            const res = await fetch(apiUrl('/api/shop/sell'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({ itemId: item.id, quantity: 1 })
            });
            const data = await res.json();

            if (data.success) {
                onUpdateUser({ ...user, ...data.newMoney, real_inventory: data.inventory });
                showFeedback(`Vendido: ${item.name}`, "success");
            } else {
                showFeedback(data.message, "error");
            }
        } catch (error) { showFeedback("Error al vender", "error"); }
    };

    const showFeedback = (msg, type) => {
        setFeedbackMsg({ text: msg, type });
        setTimeout(() => setFeedbackMsg(null), 2000);
    };

    // Helper visual de moneda
    const formatCurrency = (totalCopper) => {
        const gold = Math.floor(totalCopper / 10000);
        const remainder = totalCopper % 10000;
        const silver = Math.floor(remainder / 100);
        const copper = remainder % 100;
        return (
            <div className="flex items-center gap-2 text-xs font-mono bg-black/60 px-3 py-1.5 rounded-full border border-amber-900/50 shadow-inner">
                {gold > 0 && <span className="text-yellow-400 font-bold drop-shadow-sm">{gold}g</span>}
                {silver > 0 && <span className="text-slate-300 font-bold drop-shadow-sm">{silver}s</span>}
                <span className="text-orange-500 font-bold drop-shadow-sm">{copper}c</span>
            </div>
        );
    };

    // Filtrar items de la tienda por categoría
    const filteredShopItems = shopItems.filter(item => {
        // Mapeo simple: si la categoría es 'accessory', busca items tipo 'ring', 'neck', etc.
        if (activeCategory === 'jewelry') return ['ring', 'neck', 'earring'].includes(item.type) || item.type === 'accessory';
        return item.type === activeCategory;
    });

    return (
        <div className="h-full flex flex-col relative overflow-hidden bg-slate-950">
            {/* FONDO */}
            <div className="absolute inset-0 z-0">
                <img src="/backgrounds/city/shop_interior.png" className="w-full h-full object-cover opacity-20" onError={(e) => e.target.style.display='none'} />
                <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-transparent to-slate-950/90" />
            </div>

            {/* HEADER */}
            <div className="relative z-20 flex justify-between items-center p-4 border-b border-amber-900/30 bg-slate-900/80 backdrop-blur-md shadow-lg">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-900/20 rounded-lg border border-amber-700/50"><Store className="text-amber-500" size={24} /></div>
                    <div><h2 className="text-xl font-serif font-bold text-amber-100 tracking-wide">Mercado General</h2><p className="text-[10px] text-amber-500/60 uppercase tracking-widest">Compra y Venta</p></div>
                </div>
                
                <div className="flex bg-black/40 rounded-lg p-1 border border-slate-700 shadow-inner">
                    <button onClick={() => setMode('buy')} className={`px-6 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all ${mode === 'buy' ? 'bg-amber-700 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>Comprar</button>
                    <button onClick={() => setMode('sell')} className={`px-6 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all ${mode === 'sell' ? 'bg-green-700 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>Vender</button>
                </div>

                <div className="flex flex-col items-end">
                    <span className="text-[9px] text-slate-400 uppercase tracking-widest mb-1">Tu Bolsa</span>
                    {formatCurrency((user.gold * 10000) + (user.silver * 100) + user.copper)}
                </div>
            </div>

            {/* CONTENIDO */}
            <div className="relative z-20 flex-1 flex overflow-hidden p-4 lg:p-6 gap-6">
                
                {/* IZQUIERDA: NPC */}
                <div className="hidden lg:flex flex-col w-1/3 h-full items-center justify-end relative pointer-events-none">
                    {feedbackMsg && (<div className={`absolute top-20 z-50 px-6 py-3 rounded-xl shadow-2xl font-bold animate-bounce flex items-center gap-2 border-2 ${feedbackMsg.type === 'error' ? 'bg-red-900/90 border-red-500 text-white' : 'bg-yellow-900/90 border-yellow-500 text-yellow-100'}`}>{feedbackMsg.type === 'success' && <Coins size={20} />}{feedbackMsg.text}</div>)}
                    <img src="/npcs/merchant_viking.png" alt="Merchant" className="max-h-[95%] w-auto object-contain drop-shadow-[0_0_50px_rgba(0,0,0,0.5)] transition-all duration-700 hover:scale-105" onError={(e) => e.target.style.display = 'none'} />
                </div>

                {/* DERECHA: INTERFAZ */}
                <div className="flex-1 bg-slate-900/80 border border-slate-700 rounded-xl flex flex-col shadow-2xl backdrop-blur-md overflow-hidden relative">
                    
                    {/* MODO COMPRAR */}
                    {mode === 'buy' && (
                        <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="flex border-b border-slate-700 bg-black/20 overflow-x-auto">
                                {SHOP_CATEGORIES.map(cat => (
                                    <button key={cat.id} onClick={() => setActiveCategory(cat.id)} className={`flex-1 min-w-[80px] py-3 flex flex-col items-center gap-1 text-[10px] font-bold uppercase transition-colors border-b-2 ${activeCategory === cat.id ? 'border-amber-500 text-amber-500 bg-amber-500/10' : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>
                                        <cat.icon size={16} />{cat.label}
                                    </button>
                                ))}
                            </div>
                            
                            <div className="flex-1 p-4 overflow-y-auto custom-scrollbar bg-black/20">
                                {loadingShop ? <div className="text-center text-slate-500 mt-10">Cargando mercancía...</div> : 
                                 filteredShopItems.length === 0 ? <div className="text-center text-slate-500 mt-10">No hay {SHOP_CATEGORIES.find(c=>c.id===activeCategory)?.label} disponibles.</div> : (
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                        {filteredShopItems.map((item) => (
                                            <div key={item.id} className="bg-slate-800 border border-slate-600 rounded p-2 flex flex-col gap-2 hover:border-amber-500 transition-all group relative">
                                                <div className="h-24 bg-black/40 rounded flex items-center justify-center p-2 relative overflow-hidden">
                                                    <img src={item.image_url} className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-300" />
                                                    <span className="absolute top-1 right-1 text-[9px] bg-slate-900 text-slate-400 px-1 rounded border border-slate-700">Lvl {item.min_level}</span>
                                                </div>
                                                <div className="flex-1">
                                                    <h4 className="text-xs font-bold text-slate-200 line-clamp-1">{item.name}</h4>
                                                    <p className="text-[10px] text-slate-500 line-clamp-2 leading-tight h-6">{item.description}</p>
                                                </div>
                                                <button onClick={() => handleBuy(item)} className="w-full py-1.5 bg-amber-700 hover:bg-amber-600 text-white text-xs font-bold rounded flex items-center justify-center gap-1 shadow-md active:scale-95 transition-transform">
                                                    <span className="text-yellow-200">{item.buy_price}c</span> <ShoppingBag size={12} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* MODO VENDER */}
                    {mode === 'sell' && (
                        <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="p-3 bg-green-900/10 border-b border-green-900/30 flex justify-between items-center">
                                <span className="text-green-400 font-bold text-xs uppercase tracking-wider flex items-center gap-2"><DollarSign size={14} /> Tu Inventario</span>
                                <span className="text-[10px] text-slate-500 bg-slate-950/50 px-2 py-1 rounded border border-slate-800">Click para vender</span>
                            </div>
                            
                            <div className="flex-1 p-4 overflow-y-auto custom-scrollbar bg-black/20">
                                <div className="grid grid-cols-5 md:grid-cols-6 lg:grid-cols-7 gap-3">
                                    {inventory.filter(i => !i.is_equipped).map((item) => {
                                        const canSell = item.price_copper > 0;
                                        return (
                                            <div key={item.id} onClick={() => canSell && handleSell(item)} className={`aspect-square rounded border relative group transition-all duration-200 ${canSell ? 'bg-slate-800 border-slate-600 cursor-pointer hover:border-green-500 hover:bg-green-900/20 hover:scale-105' : 'bg-slate-900/50 border-slate-800 opacity-60 cursor-not-allowed'}`}>
                                                <img src={item.image_url} className="w-full h-full object-contain p-1.5 pointer-events-none" />
                                                {item.quantity > 1 && <span className="absolute bottom-0 right-0 bg-black/90 text-[9px] text-white px-1.5 font-mono border-tl border-slate-700 rounded-tl shadow-sm">{item.quantity}</span>}
                                                {canSell && <div className="absolute inset-0 flex items-center justify-center bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity z-10 rounded backdrop-blur-[1px]"><div className="text-center"><p className="text-[9px] text-slate-300 uppercase mb-0.5">Vender</p><p className="text-xs font-bold text-yellow-400 flex items-center justify-center gap-0.5">{item.price_copper}<span className="text-[8px] text-orange-500">c</span></p></div></div>}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Market;