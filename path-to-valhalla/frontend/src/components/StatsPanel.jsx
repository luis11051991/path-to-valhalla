import React, { useState, useEffect } from 'react';

const StatsPanel = ({ stats, availablePoints = 0, onSave }) => {
  const safeAvailablePoints = Number(availablePoints) || 0;
  const [currentStats, setCurrentStats] = useState(stats || {});
  const [pointsSpent, setPointsSpent] = useState(0);

  useEffect(() => {
    if (stats) {
      setCurrentStats(stats);
      setPointsSpent(0);
    }
  }, [stats, availablePoints]);

  const pointsRemaining = safeAvailablePoints - pointsSpent;

  // --- CONFIGURACIÓN DE ATRIBUTOS Y DESCRIPCIONES ---
  const attributesList = [
    { 
        key: 'strength', 
        label: 'Fuerza', 
        icon: '🗡️',
        desc: 'Aumenta el Daño físico.\nCada 10 puntos = +1 Daño Mín/Máx.\nNecesario para usar armas pesadas.'
    },
    { 
        key: 'dexterity', 
        label: 'Destreza', 
        icon: '⚡',
        desc: 'Aumenta la probabilidad de golpear.\nReduce la probabilidad de que el enemigo esquive.\nVital para arqueros y asesinos.'
    },
    { 
        key: 'constitution', 
        label: 'Constitución', 
        icon: '🛡️',
        desc: 'Aumenta la Vida Máxima y la Regeneración.\n1 Constitución = 20 Puntos de Vida.\nRegeneras más vida por hora.'
    },
    { 
        key: 'charisma', 
        label: 'Carisma', 
        icon: '👑',
        desc: 'Reduce el tiempo de espera en Mazmorras.\nMejora los precios en el Mercado.\nAumenta la probabilidad de doble golpe.'
    },
    { 
        key: 'intelligence', 
        label: 'Inteligencia', 
        icon: '🧠',
        desc: 'Aumenta el Daño Mágico y Maná.\nMejora la efectividad de las pociones.\nNecesario para bastones y hechizos.'
    },
    { 
        key: 'luck', 
        label: 'Suerte', 
        icon: '🍀',
        desc: 'Aumenta la probabilidad de Golpe Crítico.\nMejora la calidad de los objetos encontrados.\nAumenta el oro ganado en misiones.'
    }
  ];

  const handleIncrement = (key) => {
    if (pointsRemaining > 0) {
      setCurrentStats(prev => ({ ...prev, [key]: (prev[key] || 0) + 1 }));
      setPointsSpent(prev => prev + 1);
    }
  };

  const handleDecrement = (key) => {
    if (currentStats[key] > stats[key]) {
      setCurrentStats(prev => ({ ...prev, [key]: prev[key] - 1 }));
      setPointsSpent(prev => prev - 1);
    }
  };

  if (!stats) return <div className="text-gray-500">Cargando atributos...</div>;

  return (
    <div className="bg-slate-900/80 backdrop-blur-md p-6 rounded-lg border border-amber-900/30 shadow-lg relative">
      
      <div className="flex justify-between items-center mb-6 border-b border-amber-900/30 pb-2">
        <h2 className="text-lg font-serif font-bold text-amber-500 tracking-wider">ATRIBUTOS</h2>
        <div className="text-xs font-mono">
          <span className="text-slate-400">Puntos: </span>
          <span className={`font-bold text-sm ${pointsRemaining > 0 ? "text-green-400 animate-pulse" : "text-slate-500"}`}>
            {pointsRemaining}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {attributesList.map(({ key, label, icon, desc }) => {
          const originalValue = stats[key] || 0;
          const currentValue = currentStats[key] || 0;
          const isIncreased = currentValue > originalValue;

          return (
            <div key={key} className="flex items-center justify-between group h-10 hover:bg-white/5 rounded px-2 transition-colors relative">
              
              {/* --- TOOLTIP DE ESTADÍSTICAS --- */}
              <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 bg-black/95 border border-amber-500/50 p-3 rounded shadow-xl z-50 pointer-events-none">
                  <h4 className="text-amber-500 font-bold text-xs mb-1">{label}</h4>
                  <p className="text-[10px] text-slate-300 whitespace-pre-line leading-relaxed">{desc}</p>
                  {/* Flechita decorativa del tooltip */}
                  <div className="absolute top-full left-4 -mt-1 border-4 border-transparent border-t-amber-500/50"></div>
              </div>

              <div className="flex items-center gap-3 w-32 cursor-help">
                <span className="opacity-60 grayscale group-hover:grayscale-0 transition-all">{icon}</span>
                <span className="text-slate-300 font-medium text-sm group-hover:text-amber-200 transition-colors">{label}</span>
              </div>

              <div className="flex items-center gap-2 bg-slate-950/50 rounded border border-slate-800 px-1 py-0.5">
                <span className={`w-8 text-center font-bold font-mono ${isIncreased ? 'text-green-400' : 'text-slate-200'}`}>
                  {currentValue}
                </span>
                <div className="flex flex-col gap-[1px]">
                  <button 
                    onClick={() => handleIncrement(key)}
                    disabled={pointsRemaining <= 0}
                    className={`w-5 h-3 flex items-center justify-center text-[8px] rounded-sm transition-colors ${pointsRemaining > 0 ? 'bg-slate-700 hover:bg-green-600 text-white' : 'bg-slate-800 text-slate-600 cursor-not-allowed'}`}
                  >▲</button>
                  <button 
                    onClick={() => handleDecrement(key)}
                    disabled={!isIncreased}
                    className={`w-5 h-3 flex items-center justify-center text-[8px] rounded-sm transition-colors ${isIncreased ? 'bg-slate-700 hover:bg-red-600 text-white' : 'bg-slate-800 text-slate-600 cursor-not-allowed'}`}
                  >▼</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {pointsSpent > 0 && (
        <div className="mt-6 pt-2 border-t border-amber-900/30">
          <button onClick={() => onSave(currentStats, pointsSpent)} className="w-full py-2 bg-gradient-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white font-bold text-xs uppercase tracking-widest rounded shadow-[0_0_15px_rgba(217,119,6,0.4)] transition-all transform hover:scale-[1.02]">
            Confirmar Entrenamiento
          </button>
        </div>
      )}
    </div>
  );
};

export default StatsPanel;