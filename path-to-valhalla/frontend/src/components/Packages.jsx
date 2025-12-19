import React, { useState, useEffect } from 'react';
import { Package, ArrowRight, Clock, Archive, Lock } from 'lucide-react';

const Packages = ({ user, token, onUpdateUser }) => {
    const [packages, setPackages] = useState([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(false);
    
    // Mochila activa
    const [activeBag, setActiveBag] = useState(1);
    const [localInventory, setLocalInventory] = useState(user.real_inventory || []);

    // --- DRAG & DROP ---
    const [draggedPackage, setDraggedPackage] = useState(null);

    const handleDragStart = (e, pkg) => {
        setDraggedPackage(pkg);
        e.dataTransfer.effectAllowed = "copy";
        e.dataTransfer.setData("application/json", JSON.stringify({ type: 'package', id: pkg.id }));
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
    };

    const handleDrop = (e, slotIndex) => {
        e.preventDefault();
        if (draggedPackage) {
            const realSlot = ((activeBag - 1) * 40) + slotIndex;
            handleClaim(draggedPackage.id, realSlot);
            setDraggedPackage(null);
        }
    };

    const calculateTimeLeft = (expiresAt) => {
        const now = new Date();
        const expiration = new Date(expiresAt);
        const diff = expiration - now;
        if (diff <= 0) return "Expirado";
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        if (days > 0) return `${days}d ${hours}h`;
        return `${hours}h ${(Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)))}m`;
    };

    const isBagUnlocked = (bagNumber) => {
        if (bagNumber <= 2) return true;
        if (bagNumber === 3) return user.level >= 20;
        if (bagNumber >= 4) return user.rented_bags?.some(b => b.bag_number === bagNumber);
        return false;
    };

    const getBagItem = (slotIndex) => {
        const realIndex = ((activeBag - 1) * 40) + slotIndex;
        return localInventory.find(i => !i.is_equipped && i.bag_slot === realIndex);
    };

    const getFreeSlotsCount = () => {
        const start = (activeBag - 1) * 40;
        const end = activeBag * 40;
        const itemsInBag = localInventory.filter(i => !i.is_equipped && i.bag_slot >= start && i.bag_slot < end).length;
        return 40 - itemsInBag;
    };

    const fetchPackages = async (pageNum) => {
        setLoading(true);
        try {
            const res = await fetch(`http://localhost:3000/api/packages/my-packages?page=${pageNum}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setPackages(data.packages);
                setTotalPages(data.pagination.totalPages);
                setPage(data.pagination.page);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPackages(page);
    }, [page]);

    const handleClaim = async (packageId, targetSlot = null) => {
        try {
            const res = await fetch('http://localhost:3000/api/packages/claim', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ packageId, targetSlot })
            });
            const data = await res.json();

            if (data.success) {
                setPackages(prev => prev.filter(p => p.id !== packageId));
                setLocalInventory(data.inventory);
                if (onUpdateUser) onUpdateUser({ ...user, real_inventory: data.inventory });
            } else {
                alert(data.message || "Error al reclamar");
            }
        } catch (err) {
            console.error(err);
            alert("Error de conexión");
        }
    };

    return (
        <div className="h-full p-4 md:p-6 overflow-hidden flex flex-col font-sans select-none">
            <h2 className="text-xl font-serif font-bold text-amber-500 mb-4 flex items-center gap-2">
                <Package className="text-amber-400" size={24} /> Logística & Almacén
            </h2>

            {/* CONTENEDOR PRINCIPAL */}
            <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden">
                
                {/* --- IZQUIERDA: PAQUETERÍA (AHORA PEQUEÑA) --- */}
                {/* w-full lg:w-96 fija el ancho en pantallas grandes */}
                <div className="w-full lg:w-96 bg-slate-900/90 border border-slate-700 rounded flex flex-col shadow-lg overflow-hidden shrink-0">
                    <div className="px-3 py-2 bg-slate-950 border-b border-slate-700 flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Envíos Pendientes</span>
                        <span className="text-[10px] text-slate-500">Arrastra a la derecha</span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-black/20 custom-scrollbar">
                        {loading ? (
                            <p className="text-center text-slate-500 mt-10 text-xs">Cargando...</p>
                        ) : packages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-500 opacity-60">
                                <Archive size={32} className="mb-2"/>
                                <p className="text-xs">Bandeja vacía.</p>
                            </div>
                        ) : (
                            packages.map(pkg => (
                                <div 
                                    key={pkg.id} 
                                    draggable={true}
                                    onDragStart={(e) => handleDragStart(e, pkg)}
                                    className="bg-slate-800/60 border border-slate-700/50 hover:border-amber-500/50 p-2 rounded flex items-center gap-3 transition-colors group cursor-grab active:cursor-grabbing"
                                >
                                    {/* Icono Paquete */}
                                    <div className="w-10 h-10 shrink-0 rounded bg-black border border-slate-600 relative overflow-hidden pointer-events-none">
                                        <img src={pkg.image_url} alt={pkg.name} className="w-full h-full object-cover"/>
                                        <span className="absolute bottom-0 right-0 bg-black/80 text-white text-[9px] px-1 font-bold border-tl border-slate-700">
                                            x{pkg.quantity}
                                        </span>
                                    </div>

                                    <div className="flex-1 min-w-0 pointer-events-none">
                                        <h4 className={`font-bold text-xs truncate ${
                                            pkg.rarity === 'legendary' ? 'text-orange-400' : 
                                            pkg.rarity === 'epic' ? 'text-purple-400' : 
                                            pkg.rarity === 'rare' ? 'text-blue-400' : 'text-slate-200'
                                        }`}>
                                            {pkg.name}
                                        </h4>
                                        <div className="flex justify-between items-center mt-1">
                                            <span className="text-[9px] text-slate-500 uppercase bg-slate-950 px-1 rounded">{pkg.type}</span>
                                            <div className="flex items-center gap-1 text-[9px] text-amber-700 font-mono">
                                                <Clock size={8} /> {calculateTimeLeft(pkg.expires_at)}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <button 
                                        onClick={() => handleClaim(pkg.id)}
                                        className="p-1.5 bg-slate-900 hover:bg-amber-900/40 text-slate-400 hover:text-amber-400 rounded transition-colors"
                                        title="Reclamar Rápido"
                                    >
                                        <ArrowRight size={14} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Paginación Paquetes */}
                    {totalPages > 1 && (
                        <div className="p-1.5 border-t border-slate-700 bg-slate-950 flex justify-center gap-2">
                            <button disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="px-2 py-0.5 bg-slate-800 text-[10px] text-slate-300 rounded disabled:opacity-30">Anterior</button>
                            <span className="text-[10px] text-slate-400 self-center">{page} / {totalPages}</span>
                            <button disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="px-2 py-0.5 bg-slate-800 text-[10px] text-slate-300 rounded disabled:opacity-30">Siguiente</button>
                        </div>
                    )}
                </div>

                {/* --- DERECHA: MOCHILA (AHORA GRANDE / FLEX-1) --- */}
                <div className="flex-1 bg-slate-900/90 border border-slate-700 rounded flex flex-col shadow-lg overflow-hidden">
                    
                    {/* Header Tabs */}
                    <div className="bg-slate-950 p-2 border-b border-slate-700">
                        <div className="flex gap-1 overflow-x-auto no-scrollbar">
                            {[1, 2, 3, 4, 5, 6].map((num) => {
                                const unlocked = isBagUnlocked(num);
                                return (
                                    <button 
                                        key={num} 
                                        onClick={() => setActiveBag(num)} 
                                        className={`
                                            px-4 py-2 text-xs font-bold uppercase rounded-t border-b-2 transition-all relative whitespace-nowrap
                                            ${activeBag === num 
                                                ? 'bg-slate-800 text-amber-400 border-amber-500' 
                                                : 'bg-slate-900 text-slate-500 border-transparent hover:bg-slate-800'
                                            }
                                        `}
                                    >
                                        Mochila {num}
                                        {!unlocked && <Lock size={10} className="absolute top-1 right-1 text-red-500" />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Grid Expandido */}
                    <div className="flex-1 bg-black/40 p-6 overflow-y-auto relative custom-scrollbar">
                        {!isBagUnlocked(activeBag) ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-10 text-center">
                                <Lock size={48} className="text-slate-600 mb-4" />
                                <h3 className="text-slate-200 font-bold mb-2">Espacio Bloqueado</h3>
                                <p className="text-slate-400 text-xs max-w-xs mx-auto">Esta sección del inventario no está disponible. Sube de nivel o desbloquéala con Ónix.</p>
                            </div>
                        ) : (
                            /* GRID-COLS-8 para aprovechar el ancho */
                            <div className="grid grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3">
                                {Array.from({ length: 40 }).map((_, i) => {
                                    const item = getBagItem(i);
                                    return (
                                        <div 
                                            key={i}
                                            onDragOver={handleDragOver}
                                            onDrop={(e) => handleDrop(e, i)}
                                            className={`
                                                aspect-square rounded border relative group transition-colors
                                                ${item 
                                                    ? 'bg-slate-800 border-amber-900/60 shadow-inner' 
                                                    : 'bg-slate-900/30 border-slate-800 hover:bg-slate-800/50 hover:border-amber-500/30'
                                                }
                                                ${draggedPackage && !item ? 'animate-pulse border-amber-500/40' : ''}
                                            `}
                                        >
                                            {item && (
                                                <>
                                                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover p-0.5 rounded pointer-events-none" />
                                                    {item.quantity > 1 && (
                                                        <span className="absolute bottom-0 right-0 bg-black/90 text-[10px] text-white px-1.5 font-mono border-tl border-slate-700 rounded-tl">
                                                            {item.quantity}
                                                        </span>
                                                    )}
                                                    {/* Tooltip Hover */}
                                                    <div className="absolute opacity-0 group-hover:opacity-100 bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none transition-opacity">
                                                        <div className="bg-slate-950 border border-amber-700 text-slate-200 text-xs px-2 py-1 rounded shadow-xl whitespace-nowrap">
                                                            {item.name}
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Footer Stats */}
                    <div className="bg-slate-950 p-2 flex justify-between px-6 border-t border-slate-800 text-xs">
                        <span className="text-slate-500">Capacidad Total: <span className="text-slate-300">40 slots</span></span>
                        {isBagUnlocked(activeBag) ? (
                            <span className="text-slate-500">
                                Espacios Libres: <span className="text-green-400 font-bold">{getFreeSlotsCount()}</span>
                            </span>
                        ) : (
                            <span className="text-red-500 font-bold">Bloqueado</span>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default Packages;