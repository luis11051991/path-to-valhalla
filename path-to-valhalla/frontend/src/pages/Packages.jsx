import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Package, ArrowRight, Clock, Archive, Lock } from 'lucide-react';
import { apiUrl } from '../constants/api';

// --- DICCIONARIO DE ICONOS ---
const STAT_ICONS = {
    strength: '💪', dexterity: '⚡', constitution: '❤️', intelligence: '🧠',
    wisdom: '✨', charisma: '🎭', luck: '🍀', defense: '🛡️', block: '🚫', crit: '🎯'
};

const Packages = ({ user: propUser, onUpdateUser: propOnUpdateUser }) => {
    // --- SOPORTE HÍBRIDO ---
    const contextData = useOutletContext();
    const user = propUser || (contextData ? contextData[0] : null);
    const onUpdateUser = propOnUpdateUser || (contextData ? contextData[1] : null);
    const token = localStorage.getItem('token');

    const [packages, setPackages] = useState([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(false);
    
    const [activeBag, setActiveBag] = useState(1);
    const [tooltipData, setTooltipData] = useState(null);
    const [draggedPackage, setDraggedPackage] = useState(null);
    const inventory = user?.real_inventory || [];

    // --- API CALLS ---
    const fetchPackages = useCallback(async (pageNum) => {
        setLoading(true);
        try {
            const res = await fetch(apiUrl(`/api/packages/my-packages?page=${pageNum}`), {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setPackages(data.packages);
                setTotalPages(data.pagination.totalPages);
                setPage(data.pagination.page);
            }
        } catch (err) { console.error(err); } finally { setLoading(false); }
    }, [token]);

    useEffect(() => {
        const timer = setTimeout(() => {
            void fetchPackages(page);
        }, 0);
        return () => clearTimeout(timer);
    }, [fetchPackages, page]);

    const handleClaim = async (packageId, targetSlot = null) => {
        try {
            const res = await fetch(apiUrl('/api/packages/claim'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ packageId, targetSlot })
            });
            const data = await res.json();
            if (data.success) {
                setPackages(prev => prev.filter(p => p.id !== packageId));
                if (onUpdateUser) onUpdateUser({ ...user, real_inventory: data.inventory });
            }
        } catch (err) { console.error("Error claim:", err); }
    };

    // --- DRAG & DROP & HELPERS ---
    const handleDragStart = (e, pkg) => {
        setDraggedPackage(pkg);
        setTooltipData(null);
        e.dataTransfer.effectAllowed = "copy";
        e.dataTransfer.setData("application/json", JSON.stringify({ type: 'package', id: pkg.id }));
    };
    const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; };
    const handleDrop = (e, slotIndex) => {
        e.preventDefault();
        if (draggedPackage) {
            handleClaim(draggedPackage.id, ((activeBag - 1) * 40) + slotIndex);
            setDraggedPackage(null);
        }
    };

    const handleMouseEnter = (item, e, side) => {
        if (!item) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const normalizedItem = {
            ...item,
            base_stats: item.base_stats || item.data || {},
            durability_current: item.durability_current ?? 100,
            durability_max: item.durability_max ?? 100
        };
        setTooltipData({ item: normalizedItem, rect, side });
    };

    const calculateTimeLeft = (expiresAt) => {
        const diff = new Date(expiresAt) - new Date();
        if (diff <= 0) return "Expirado";
        const days = Math.floor(diff / (86400000));
        const hours = Math.floor((diff % 86400000) / 3600000);
        return days > 0 ? `${days}d ${hours}h` : `${hours}h ${(Math.floor((diff % 3600000) / 60000))}m`;
    };

    const isBagUnlocked = (n) => n <= 2 || (n === 3 && user.level >= 20) || (n >= 4 && user.rented_bags?.some(b => b.bag_number === n));
    const getBagItem = (i) => inventory.find(x => !x.is_equipped && x.bag_slot === ((activeBag - 1) * 40) + i);
    const getFreeSlotsCount = () => 40 - inventory.filter(x => !x.is_equipped && x.bag_slot >= (activeBag-1)*40 && x.bag_slot < activeBag*40).length;
    
    const formatCurrency = (c) => {
        if (!c) return <span className="text-orange-700 font-bold">0c</span>;
        return <span className="flex items-center gap-1 justify-end">{Math.floor(c/10000) > 0 && <span className="text-yellow-500 font-bold">{Math.floor(c/10000)}g</span>} {(Math.floor(c%10000/100)) > 0 && <span className="text-slate-300 font-bold">{Math.floor(c%10000/100)}s</span>} <span className="text-orange-700 font-bold">{c%100}c</span></span>;
    };

    const globalTooltip = tooltipData ? (() => {
        const { item, rect, side } = tooltipData;
        const isBroken = item.durability_current === 0;
        const style = { position: 'fixed', zIndex: 9999, top: rect.top };
        if (side === 'left') style.left = rect.right + 10; else style.right = (window.innerWidth - rect.left) + 10;

        return (
            <div style={style} className="bg-slate-950 border-2 border-amber-600 p-3 rounded shadow-xl min-w-[200px] pointer-events-none animate-in fade-in max-w-[250px]">
                <p className={`font-bold text-sm ${item.rarity === 'rare' ? 'text-blue-400' : item.rarity === 'epic' ? 'text-purple-400' : 'text-slate-200'}`}>{item.name}</p>
                <p className="text-[10px] text-slate-500 uppercase mb-2 border-b border-white/10 pb-1">{item.type} • {item.rarity}</p>
                <div className="mb-2 text-[10px] font-bold text-center border-b border-white/5 pb-1"> {item.is_bound ? <span className="text-red-500">🔒 VINCULADO</span> : <span className="text-green-500">✨ TRADEABLE</span>} </div>
                <div className="space-y-1 mb-2">
                    {item.base_stats.damage_min && <p className={`text-xs ${isBroken?'text-slate-600 line-through':'text-slate-300'}`}>⚔️ {item.base_stats.damage_min}-{item.base_stats.damage_max}</p>}
                    {item.base_stats.armor && <p className={`text-xs ${isBroken?'text-slate-600 line-through':'text-slate-300'}`}>🛡️ {item.base_stats.armor}</p>}
                    {Object.entries(item.base_stats).map(([k, v]) => {
                        if(['damage_min','damage_max','armor'].includes(k) || v <= 0) return null;
                        return <p key={k} className="text-xs text-green-400 capitalize">{STAT_ICONS[k]||'🍀'} {k}: +{v}</p>;
                    })}
                </div>
                {item.description && <p className="text-[10px] text-slate-400 italic border-t border-white/10 pt-1 mb-2">{item.description}</p>}
                {item.price_copper !== undefined && <div className="text-[10px] mt-2 text-right border-t border-white/10 pt-1 flex justify-between"> <span className="text-slate-500">Valor:</span> {formatCurrency(item.price_copper)} </div>}
            </div>
        );
    })() : null;

    if (!user) return null;

    return (
        <div className="h-full p-4 md:p-6 overflow-hidden flex flex-col font-sans select-none relative">
            {globalTooltip}
            <h2 className="text-xl font-serif font-bold text-amber-500 mb-4 flex items-center gap-2"><Package className="text-amber-400" size={24} /> Logística & Almacén</h2>
            <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden">
                {/* IZQUIERDA: PAQUETES */}
                <div className="w-full lg:w-96 bg-slate-900/90 border border-slate-700 rounded flex flex-col shadow-lg overflow-hidden shrink-0">
                    <div className="px-3 py-2 bg-slate-950 border-b border-slate-700 flex justify-between"><span className="text-xs font-bold text-slate-300 uppercase">Envíos Pendientes</span><span className="text-[10px] text-slate-500">Arrastra a la derecha</span></div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-black/20 custom-scrollbar">
                        {loading ? <p className="text-center text-slate-500 mt-10 text-xs">Cargando...</p> : packages.length === 0 ? <div className="flex flex-col items-center justify-center h-full text-slate-500 opacity-60"><Archive size={32} className="mb-2"/><p className="text-xs">Bandeja vacía.</p></div> : packages.map(pkg => (
                            <div key={pkg.id} draggable={true} onDragStart={(e) => handleDragStart(e, pkg)} onMouseEnter={(e) => handleMouseEnter(pkg, e, 'left')} onMouseLeave={() => setTooltipData(null)} className="bg-slate-800/60 border border-slate-700/50 hover:border-amber-500/50 p-2 rounded flex items-center gap-3 cursor-grab active:cursor-grabbing">
                                <div className="w-10 h-10 shrink-0 rounded bg-black border border-slate-600 relative overflow-hidden pointer-events-none"><img src={pkg.image_url} className="w-full h-full object-contain p-1"/><span className="absolute bottom-0 right-0 bg-black/80 text-white text-[9px] px-1 font-bold border-tl border-slate-700">x{pkg.quantity}</span></div>
                                <div className="flex-1 min-w-0 pointer-events-none"><h4 className="font-bold text-xs truncate text-slate-200">{pkg.name}</h4><div className="flex justify-between items-center mt-1"><span className="text-[9px] text-slate-500 uppercase bg-slate-950 px-1 rounded">{pkg.type}</span><div className="flex items-center gap-1 text-[9px] text-amber-700 font-mono"><Clock size={8} /> {calculateTimeLeft(pkg.expires_at)}</div></div></div>
                                <button onClick={() => handleClaim(pkg.id)} className="p-1.5 bg-slate-900 hover:bg-amber-900/40 text-slate-400 hover:text-amber-400 rounded"><ArrowRight size={14} /></button>
                            </div>
                        ))}
                    </div>
                    {totalPages > 1 && <div className="p-1.5 border-t border-slate-700 bg-slate-950 flex justify-center gap-2"><button disabled={page===1} onClick={()=>setPage(p=>p-1)} className="px-2 py-0.5 bg-slate-800 text-[10px] text-slate-300 rounded disabled:opacity-30">Anterior</button><span className="text-[10px] text-slate-400 self-center">{page}/{totalPages}</span><button disabled={page===totalPages} onClick={()=>setPage(p=>p+1)} className="px-2 py-0.5 bg-slate-800 text-[10px] text-slate-300 rounded disabled:opacity-30">Siguiente</button></div>}
                </div>
                {/* DERECHA: MOCHILA */}
                <div className="flex-1 bg-slate-900/90 border border-slate-700 rounded flex flex-col shadow-lg overflow-hidden">
                    <div className="bg-slate-950 p-2 border-b border-slate-700"><div className="flex gap-1 overflow-x-auto no-scrollbar">{[1,2,3,4,5,6].map(num => (<button key={num} onClick={() => setActiveBag(num)} className={`px-4 py-2 text-xs font-bold uppercase rounded-t border-b-2 transition-all relative whitespace-nowrap ${activeBag===num ? 'bg-slate-800 text-amber-400 border-amber-500' : 'bg-slate-900 text-slate-500 border-transparent hover:bg-slate-800'}`}>Mochila {num} {!isBagUnlocked(num) && <Lock size={10} className="absolute top-1 right-1 text-red-500" />}</button>))}</div></div>
                    <div className="flex-1 bg-black/40 p-6 overflow-y-auto relative custom-scrollbar">
                        {!isBagUnlocked(activeBag) ? <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10 text-center"><Lock size={48} className="text-slate-600 mb-4" /><h3 className="text-slate-200 font-bold mb-2">Espacio Bloqueado</h3></div> : 
                        <div className="grid grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3">{Array.from({ length: 40 }).map((_, i) => { const item = getBagItem(i); return (<div key={i} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, i)} onMouseEnter={(e) => handleMouseEnter(item, e, 'right')} onMouseLeave={() => setTooltipData(null)} className={`aspect-square rounded border relative group transition-colors ${item ? 'bg-slate-800 border-amber-900/60 shadow-inner' : 'bg-slate-900/30 border-slate-800 hover:bg-slate-800/50'} ${draggedPackage && !item ? 'animate-pulse border-amber-500/40' : ''}`}>{item && <><img src={item.image_url} className="w-full h-full object-contain p-2 rounded pointer-events-none" />{item.quantity > 1 && <span className="absolute bottom-0 right-0 bg-black/90 text-[10px] text-white px-1.5 font-mono border-tl border-slate-700 rounded-tl">{item.quantity}</span>}</>}</div>); })}</div>}
                    </div>
                    <div className="bg-slate-950 p-2 flex justify-between px-6 border-t border-slate-800 text-xs"><span className="text-slate-500">Capacidad Total: 40</span>{isBagUnlocked(activeBag) ? <span className="text-slate-500">Libres: <span className="text-green-400 font-bold">{getFreeSlotsCount()}</span></span> : <span className="text-red-500 font-bold">Bloqueado</span>}</div>
                </div>
            </div>
        </div>
    );
};

export default Packages;
