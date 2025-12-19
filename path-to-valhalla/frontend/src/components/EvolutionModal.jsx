import React, { useEffect, useState } from 'react';
import { X, ChevronRight, Award, ShieldAlert, Sword, Shield, Zap, Heart, Crosshair } from 'lucide-react';
import { apiUrl } from '../constants/api';

const EvolutionModal = ({ user, onClose, onEvolveSuccess }) => {
    const [options, setOptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedOption, setSelectedOption] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetch(apiUrl('/api/evolution/options'), {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        })
            .then(res => res.json())
            .then(data => {
                if (data.available) {
                    setOptions(data.options);
                } else {
                    setError(data.message);
                }
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setError("Error conectando con el destino.");
                setLoading(false);
            });
    }, []);

    const handleConfirm = async () => {
        if (!selectedOption) return;
        try {
            const res = await fetch(apiUrl('/api/evolution/confirm'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ targetClassId: selectedOption.id })
            });
            const data = await res.json();
            if (data.success) {
                onEvolveSuccess(data.user);
                onClose();
            } else {
                setError(data.message);
            }
        } catch (err) {
            setError("Error al realizar el ritual.");
        }
    };

    const getClassImage = (dbPath) => {
        if (!dbPath) return null;
        const genderSuffix = user.gender === 'female' ? '_female' : '_male';
        const lastDotIndex = dbPath.lastIndexOf('.');
        if (lastDotIndex === -1) return dbPath + genderSuffix;
        const path = dbPath.substring(0, lastDotIndex);
        const ext = dbPath.substring(lastDotIndex);
        return `${path}${genderSuffix}${ext}`;
    };

    // --- HELPER: ETIQUETAS DE ROL AUTOMÁTICAS ---
    // Analiza los stats para decirte qué "Rol" cumple la clase
    const getRoleBadge = (stats) => {
        const s = stats || {};
        if (s.constitution > 18) return { label: "TANQUE PURO", icon: Shield, color: "text-blue-400 border-blue-500/50" };
        if (s.intelligence > 18) return { label: "DAÑO MÁGICO / AOE", icon: Zap, color: "text-purple-400 border-purple-500/50" };
        if (s.strength > 18) return { label: "DAÑO FÍSICO", icon: Sword, color: "text-red-400 border-red-500/50" };
        if (s.dexterity > 18) return { label: "DPS VELOZ / CRÍTICO", icon: Crosshair, color: "text-yellow-400 border-yellow-500/50" };
        if (s.luck > 18) return { label: "LOOT / BLOQUEO", icon: Award, color: "text-green-400 border-green-500/50" };
        return { label: "EQUILIBRADO", icon: Award, color: "text-slate-400 border-slate-500/50" };
    };

    if (!user) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in duration-500">
            {/* Contenedor Principal Más Alto */}
            <div className="bg-slate-950 border border-amber-900/50 rounded-lg max-w-6xl w-full h-[90vh] flex flex-col shadow-[0_0_100px_rgba(245,158,11,0.1)] relative overflow-hidden">

                {/* Background Decorativo */}
                <div className="absolute inset-0 bg-[url('/bg-pattern.png')] opacity-5 pointer-events-none"></div>

                {/* Header */}
                <div className="p-6 border-b border-white/10 flex justify-between items-center z-10 bg-slate-900/80 backdrop-blur">
                    <div>
                        <h2 className="text-4xl font-serif text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-600 uppercase tracking-widest flex items-center gap-3 drop-shadow-sm">
                            <Award size={36} className="text-amber-500" /> Ascensión de Héroe
                        </h2>
                        <p className="text-slate-400 text-sm mt-1 tracking-wide">Elige tu destino, guerrero. Esta decisión forjará tu leyenda.</p>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full"><X size={32} /></button>
                </div>

                {/* Contenido Central */}
                <div className="flex-1 overflow-y-auto p-4 lg:p-8 relative z-10">
                    {loading ? (
                        <div className="flex h-full items-center justify-center text-amber-500 animate-pulse text-xl font-serif">Consultando a los oráculos...</div>
                    ) : error ? (
                        <div className="flex flex-col h-full items-center justify-center text-red-400 gap-4">
                            <ShieldAlert size={64} />
                            <p className="text-2xl font-serif">{error}</p>
                            <button onClick={onClose} className="px-8 py-3 bg-slate-800 rounded border border-slate-700 hover:bg-slate-700 text-white uppercase tracking-widest">Regresar</button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
                            {options.map((opt) => {
                                const isSelected = selectedOption?.id === opt.id;
                                const stats = opt.base_stats || {};
                                const role = getRoleBadge(stats);
                                const RoleIcon = role.icon;

                                return (
                                    <div
                                        key={opt.id}
                                        onClick={() => setSelectedOption(opt)}
                                        className={`relative group cursor-pointer rounded-xl border-2 transition-all duration-500 h-full flex flex-col overflow-hidden bg-slate-900
                                        ${isSelected
                                                ? 'border-amber-500 shadow-[0_0_40px_rgba(245,158,11,0.2)] scale-[1.01]'
                                                : 'border-slate-800 hover:border-slate-600 hover:shadow-xl'}`}
                                    >
                                        {/* --- IMAGEN EXPANDIDA (Corrección del problema de recorte) --- */}
                                        <div className="h-[50%] lg:h-[60%] overflow-hidden relative">
                                            {/* Gradiente inferior para mezclar imagen con texto */}
                                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/20 to-transparent z-10" />

                                            {/* Badge de Rol Flotante */}
                                            <div className={`absolute top-4 left-4 z-20 px-3 py-1 bg-black/80 backdrop-blur rounded border ${role.color} flex items-center gap-2 text-xs font-bold uppercase tracking-widest shadow-lg`}>
                                                <RoleIcon size={14} /> {role.label}
                                            </div>

                                            <img
                                                src={getClassImage(opt.image_url)}
                                                alt={opt.name}
                                                // KEY FIX: object-top asegura que se vea la cabeza, h-full llena el espacio
                                                className="w-full h-full object-cover object-top transition-transform duration-1000 group-hover:scale-105"
                                                onError={(e) => { e.target.src = "https://via.placeholder.com/400x600?text=Arte+Pendiente"; }}
                                            />

                                            {/* Nombre sobre la imagen */}
                                            <div className="absolute bottom-0 left-0 right-0 p-6 z-20">
                                                <h3 className={`text-3xl font-black uppercase font-serif tracking-tight drop-shadow-lg ${isSelected ? 'text-amber-400' : 'text-white'}`}>
                                                    {opt.name}
                                                </h3>
                                            </div>
                                        </div>

                                        {/* --- DESCRIPCIÓN Y LORE (Más espacio) --- */}
                                        <div className="p-6 flex-1 flex flex-col gap-4 bg-slate-950">
                                            {/* Lore Text */}
                                            <div className="relative pl-4 border-l-2 border-amber-600/50">
                                                <p className="text-slate-300 text-sm leading-relaxed italic font-serif opacity-90">
                                                    "{opt.description}"
                                                </p>
                                            </div>

                                            {/* Stats Grid */}
                                            <div className="mt-auto">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <div className="h-[1px] flex-1 bg-slate-800"></div>
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Bonificaciones de Ascensión</span>
                                                    <div className="h-[1px] flex-1 bg-slate-800"></div>
                                                </div>
                                                <div className="grid grid-cols-3 gap-2">
                                                    {Object.entries(stats).map(([key, val]) => {
                                                        // Solo mostramos stats relevantes (>5) para no saturar
                                                        if (val < 5) return null;
                                                        return (
                                                            <div key={key} className="bg-slate-900 px-3 py-2 rounded border border-slate-800 flex flex-col items-center justify-center">
                                                                <span className="text-[10px] text-slate-500 uppercase tracking-wider">{key.substring(0, 3)}</span>
                                                                <span className={`text-sm font-bold font-mono ${isSelected ? 'text-green-400' : 'text-slate-300'}`}>+{val}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Indicador de Selección */}
                                        {isSelected && (
                                            <div className="absolute top-4 right-4 bg-amber-500 text-black p-3 rounded-full shadow-[0_0_20px_rgba(245,158,11,0.6)] animate-in zoom-in spin-in-12">
                                                <Award size={28} />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {!loading && !error && (
                    <div className="p-6 border-t border-white/10 bg-slate-900 flex justify-between items-center z-20">
                        <div className="text-xs text-slate-500 hidden md:block">
                            * Al evolucionar, tus puntos de atributo serán reseteados y devueltos.
                        </div>
                        <div className="flex gap-4 w-full md:w-auto">
                            <button onClick={onClose} className="flex-1 md:flex-none px-6 py-3 rounded border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 font-bold uppercase text-xs tracking-widest transition-colors">
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirm}
                                disabled={!selectedOption}
                                className={`flex-1 md:flex-none px-10 py-3 rounded font-bold uppercase text-xs tracking-widest flex items-center justify-center gap-3 transition-all
                                ${selectedOption
                                        ? 'bg-gradient-to-r from-amber-600 to-orange-700 text-white shadow-[0_0_30px_rgba(245,158,11,0.3)] hover:shadow-[0_0_50px_rgba(245,158,11,0.5)] hover:scale-105'
                                        : 'bg-slate-800 text-slate-600 cursor-not-allowed'}`}
                            >
                                Confirmar Linaje <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EvolutionModal;