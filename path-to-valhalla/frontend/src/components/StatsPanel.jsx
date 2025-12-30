import React, { useState, useEffect, useMemo } from 'react';
import { Check, RefreshCw, ArrowRight } from 'lucide-react'; // Solo iconos de utilidad (botones)

// --- CONFIGURACIÓN: DEFINICIÓN DE IMÁGENES Y DESCRIPCIONES ---
const STAT_CONFIG = {
    strength: { 
        label: 'Fuerza', 
        iconPath: '/icons/stats/strength.png', 
        desc: '1 Punto = +2 Daño Físico' 
    },
    dexterity: { 
        label: 'Destreza', 
        iconPath: '/icons/stats/dexterity.png', 
        desc: '1 Punto = +0.25% Crítico (Max 25%)' 
    },
    constitution: { 
        label: 'Constitución', 
        iconPath: '/icons/stats/constitution.png', 
        desc: '1 Punto = +20 Vida y +0.5 Defensa' 
    },
    intelligence: { 
        label: 'Inteligencia', 
        iconPath: '/icons/stats/intelligence.png', 
        desc: '1 Punto = +0.5% Curación y +0.25% Skill Dmg' 
    },
    luck: { 
        label: 'Suerte', 
        iconPath: '/icons/stats/luck.png', 
        desc: '1 Punto = +0.25% Bloqueo (Max 25%)' 
    },
    charisma: { 
        label: 'Carisma', 
        iconPath: '/icons/stats/charisma.png', 
        desc: 'Mejora precios y eventos' 
    }
};

const StatsPanel = ({ stats, bonuses, availablePoints, onSave, maxHp = 0 }) => {
    // Estado temporal (lo que estás modificando antes de confirmar)
    const [pendingStats, setPendingStats] = useState(stats);
    const [spentPoints, setSpentPoints] = useState(0);

    // Reiniciar si el usuario sube de nivel externamente
    useEffect(() => {
        setPendingStats(stats);
        setSpentPoints(0);
    }, [stats]);

    // --- CÁLCULO DE LA "PREDICCIÓN" (Cuadro Fantasma) ---
    const preview = useMemo(() => {
        // Sumamos: Base + Puntos Nuevos + Bonos Verdes
        const totalStr = pendingStats.strength + (bonuses.strength || 0);
        const totalDex = pendingStats.dexterity + (bonuses.dexterity || 0);
        const totalCon = pendingStats.constitution + (bonuses.constitution || 0);
        const totalInt = pendingStats.intelligence + (bonuses.intelligence || 0);
        const totalLuk = pendingStats.luck + (bonuses.luck || 0);

        // Calculamos resultados (sin recalcular HP local)
        const damageMin = (bonuses.damage_min || 0) + (totalStr * 2);
        const damageMax = (bonuses.damage_max || 0) + (totalStr * 2);
        const defense = (bonuses.armor || 0) + Math.floor(totalCon / 2);
        
        // Aplicamos Topes (Caps)
        const critChance = Math.min(totalDex * 0.25, 25);
        const blockChance = Math.min(totalLuk * 0.25, 25);
        const healPower = Math.min(totalInt * 0.5, 25);
        const skillDmg = Math.min(totalInt * 0.25, 25);
        const backendMaxHp = maxHp || 0;

        return { maxHp: backendMaxHp, damageMin, damageMax, defense, critChance, blockChance, healPower, skillDmg };
    }, [pendingStats, bonuses]);

    // Botones + y -
    const handleIncrease = (key) => {
        if (availablePoints - spentPoints > 0) {
            setPendingStats(prev => ({ ...prev, [key]: prev[key] + 1 }));
            setSpentPoints(prev => prev + 1);
        }
    };

    const handleDecrease = (key) => {
        if (pendingStats[key] > stats[key]) {
            setPendingStats(prev => ({ ...prev, [key]: prev[key] - 1 }));
            setSpentPoints(prev => prev - 1);
        }
    };

    const handleReset = () => {
        setPendingStats(stats);
        setSpentPoints(0);
    };

    return (
        <div className="bg-slate-900/80 border border-slate-700 rounded-lg p-4 mb-4 relative transition-all duration-300">
            
            {/* SECCIÓN 1: CABECERA Y PUNTOS DISPONIBLES */}
            <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                <h3 className="text-amber-500 font-bold uppercase tracking-widest text-sm">Entrenamiento</h3>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Puntos Disponibles:</span>
                    <span className={`font-mono font-bold text-lg ${availablePoints - spentPoints > 0 ? 'text-green-400 animate-pulse' : 'text-slate-500'}`}>
                        {availablePoints - spentPoints}
                    </span>
                </div>
            </div>

            {/* SECCIÓN 2: LISTA DE ATRIBUTOS (Aquí está el bucle inteligente) */}
            <div className="space-y-2 mb-4">
                {Object.entries(STAT_CONFIG).map(([key, config]) => {
                    const base = stats[key];
                    const added = pendingStats[key] - base; // Puntos que estás sumando ahora
                    const bonus = bonuses[key] || 0;        // Puntos verdes de items

                    return (
                        <div key={key} className="flex items-center justify-between group h-8">
                            {/* Nombre e Icono */}
                            <div className="flex items-center gap-2 w-5/12" title={config.desc}>
                                {/* REEMPLAZO: Imagen PNG en lugar de Componente Lucide */}
                                <img src={config.iconPath} alt={config.label} className="w-4 h-4 object-contain" />
                                
                                <span className="text-xs font-bold text-slate-300">{config.label}</span>
                                {/* Descripción flotante al pasar el mouse */}
                                <span className="text-[9px] text-slate-500 hidden group-hover:inline opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                                    {config.desc}
                                </span>
                            </div>

                            {/* Números: Base + (Agregado) + (Bono Verde) */}
                            <div className="flex items-center gap-1 font-mono text-xs w-3/12 justify-center">
                                <span className="text-white">{base}</span>
                                {added > 0 && <span className="text-amber-400 font-bold animate-pulse">+{added}</span>}
                                {bonus > 0 && <span className="text-emerald-600 text-[10px]">(+{bonus})</span>}
                            </div>

                            {/* Controles */}
                            <div className="flex items-center bg-slate-800 rounded border border-slate-600 overflow-hidden h-6">
                                <button onClick={() => handleDecrease(key)} disabled={added === 0} className="px-2 hover:bg-slate-700 text-slate-400 disabled:opacity-30">-</button>
                                <div className="w-px bg-slate-600 h-full"></div>
                                <button onClick={() => handleIncrease(key)} disabled={availablePoints - spentPoints === 0} className="px-2 hover:bg-green-900/30 text-green-400 disabled:opacity-30">+</button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* SECCIÓN 3: CUADRO FANTASMA DEL MEDIO (SOLO APARECE SI MODIFICAS PUNTOS) */}
            {spentPoints > 0 && (
                <div className="animate-in slide-in-from-top-4 fade-in duration-300 mt-4 border-t border-amber-500/30 pt-4">
                    <div className="bg-gradient-to-r from-slate-900 to-black border border-amber-500 rounded-lg p-3 shadow-[0_0_15px_rgba(245,158,11,0.2)] relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-amber-500 animate-pulse"></div>
                        
                        <h4 className="text-amber-500 text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                            <ArrowRight size={12} /> Resultado al Confirmar
                        </h4>
                        
                        {/* Grid de Previsualización */}
                        <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs mb-4">
                            <div className="flex justify-between border-b border-white/5 pb-1">
                                <span className="text-slate-400">Vida Máx</span>
                                <span className="text-white font-mono">{preview.maxHp} <span className="text-amber-400 text-[10px]">(Nuevo)</span></span>
                            </div>
                            <div className="flex justify-between border-b border-white/5 pb-1">
                                <span className="text-slate-400">Daño</span>
                                <span className="text-white font-mono">{preview.damageMin} - {preview.damageMax}</span>
                            </div>
                            <div className="flex justify-between border-b border-white/5 pb-1">
                                <span className="text-slate-400">Crítico</span>
                                <span className={preview.critChance >= 25 ? "text-red-500 font-bold" : "text-white"}>
                                    {preview.critChance.toFixed(1)}% {preview.critChance >= 25 && "(MAX)"}
                                </span>
                            </div>
                            <div className="flex justify-between border-b border-white/5 pb-1">
                                <span className="text-slate-400">Bloqueo</span>
                                <span className={preview.blockChance >= 25 ? "text-red-500 font-bold" : "text-white"}>
                                    {preview.blockChance.toFixed(1)}% {preview.blockChance >= 25 && "(MAX)"}
                                </span>
                            </div>
                        </div>

                        {/* Botones de Confirmación */}
                        <div className="flex gap-2">
                            <button 
                                onClick={handleReset}
                                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded text-xs font-bold transition-colors"
                            >
                                <RefreshCw size={12} className="inline mr-1" /> CANCELAR
                            </button>
                            <button 
                                onClick={() => onSave(pendingStats, spentPoints)}
                                className="flex-[2] bg-green-700 hover:bg-green-600 text-white py-2 rounded text-xs font-bold shadow-lg transition-all hover:scale-105 flex items-center justify-center gap-2"
                            >
                                <Check size={14} /> CONFIRMAR
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StatsPanel;
