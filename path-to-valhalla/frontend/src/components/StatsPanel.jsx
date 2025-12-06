import React, { useState, useEffect } from 'react';

const StatsPanel = ({ stats, availablePoints = 0, onSave }) => {
  // Aseguramos que availablePoints sea un número (evita el NaN)
  const safeAvailablePoints = Number(availablePoints) || 0;

  const [currentStats, setCurrentStats] = useState(stats || {});
  const [pointsSpent, setPointsSpent] = useState(0);

  // Actualizamos cuando llegan datos nuevos desde el Dashboard
  useEffect(() => {
    if (stats) {
      setCurrentStats(stats);
      setPointsSpent(0);
    }
  }, [stats, availablePoints]);

  const pointsRemaining = safeAvailablePoints - pointsSpent;

  // Lista ordenada para mantener tu diseño original (Fuerza primero, etc.)
  // "key" debe coincidir EXACTAMENTE con lo que vi en tu consola (inglés minúsculas)
  const attributesList = [
    { key: 'strength', label: 'Fuerza', icon: '🗡️' },
    { key: 'dexterity', label: 'Destreza', icon: '⚡' },
    { key: 'constitution', label: 'Constitución', icon: '🛡️' },
    { key: 'charisma', label: 'Carisma', icon: '👑' },
    { key: 'intelligence', label: 'Inteligencia', icon: '🧠' },
    { key: 'luck', label: 'Suerte', icon: '🍀' }
  ];

  const handleIncrement = (key) => {
    if (pointsRemaining > 0) {
      setCurrentStats(prev => ({ ...prev, [key]: (prev[key] || 0) + 1 }));
      setPointsSpent(prev => prev + 1);
    }
  };

  const handleDecrement = (key) => {
    // Solo permitimos bajar si hemos gastado puntos en esta sesión
    if (currentStats[key] > stats[key]) {
      setCurrentStats(prev => ({ ...prev, [key]: prev[key] - 1 }));
      setPointsSpent(prev => prev - 1);
    }
  };

  if (!stats) return <div className="text-gray-500">Cargando atributos...</div>;

  return (
    <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-700">
      {/* Encabezado */}
      <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-2">
        <h2 className="text-xl font-bold text-amber-500">ATRIBUTOS</h2>
        <div className="text-sm">
          <span className="text-gray-400">Puntos disponibles: </span>
          <span className={`font-bold ${pointsRemaining > 0 ? "text-green-400" : "text-gray-500"}`}>
            {pointsRemaining}
          </span>
        </div>
      </div>

      {/* Lista de Stats */}
      <div className="space-y-4">
        {attributesList.map(({ key, label, icon }) => {
          const originalValue = stats[key] || 0;
          const currentValue = currentStats[key] || 0;
          const isIncreased = currentValue > originalValue;

          return (
            <div key={key} className="flex items-center justify-between group">
              {/* Nombre e Icono */}
              <div className="flex items-center w-32">
                <span className="w-6 text-center opacity-50 mr-2">{icon}</span>
                <span className="text-gray-300 font-medium">{label}</span>
              </div>

              {/* Controles */}
              <div className="flex items-center space-x-3 bg-gray-800 rounded px-2 py-1 border border-gray-700">
                 {/* Valor Actual */}
                <span className={`w-8 text-center font-bold text-lg ${
                  isIncreased ? 'text-green-400' : 'text-white'
                }`}>
                  {currentValue}
                </span>

                {/* Botones Pequeños */}
                <div className="flex flex-col space-y-px">
                  {/* Botón Subir */}
                  <button 
                    onClick={() => handleIncrement(key)}
                    disabled={pointsRemaining <= 0}
                    className={`w-6 h-4 flex items-center justify-center text-[10px] rounded-t ${
                      pointsRemaining > 0 
                      ? 'bg-gray-700 hover:bg-green-600 text-white' 
                      : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                    }`}
                  >
                    ▲
                  </button>
                  
                  {/* Botón Bajar */}
                  <button 
                    onClick={() => handleDecrement(key)}
                    disabled={!isIncreased}
                    className={`w-6 h-4 flex items-center justify-center text-[10px] rounded-b ${
                      isIncreased 
                      ? 'bg-gray-700 hover:bg-red-600 text-white' 
                      : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                    }`}
                  >
                    ▼
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Botón Guardar - Solo aparece si hay cambios */}
      {pointsSpent > 0 && (
        <div className="mt-8">
          <button
            onClick={() => onSave(currentStats, pointsSpent)}
            className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-black font-bold uppercase tracking-wider rounded transition-all shadow-[0_0_10px_rgba(217,119,6,0.5)]"
          >
            Confirmar Cambios
          </button>
        </div>
      )}
    </div>
  );
};

export default StatsPanel;