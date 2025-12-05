import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react';
import { RACES } from '../constants/races';

const RaceSelection = ({ onRaceSelect }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [direction, setDirection] = useState('next'); 

  const currentRace = RACES[currentIndex];

  const changeRace = (newIndex, dir) => {
    if (isAnimating) return;
    setIsAnimating(true);
    setDirection(dir);

    setTimeout(() => {
      setCurrentIndex(newIndex);
      setTimeout(() => setIsAnimating(false), 50); 
    }, 300);
  };

  const handleNext = () => {
    const nextIndex = (currentIndex + 1) % RACES.length;
    changeRace(nextIndex, 'next');
  };

  const handlePrev = () => {
    const prevIndex = currentIndex === 0 ? RACES.length - 1 : currentIndex - 1;
    changeRace(prevIndex, 'prev');
  };

  const handleConfirm = () => {
    if (onRaceSelect) onRaceSelect(currentRace);
  };

  const getAnimationClass = () => {
    if (isAnimating) {
      return direction === 'next' 
        ? 'opacity-0 -translate-x-20 scale-95 blur-sm' 
        : 'opacity-0 translate-x-20 scale-95 blur-sm'; 
    } else {
      return 'opacity-100 translate-x-0 scale-100 blur-0';
    }
  };

  // --- COMPONENTE EVOLUTION PATH (Arreglado con GRID) ---
  const EvolutionPath = ({ title, steps }) => (
    <div className="mb-5">
      <h4 className="text-amber-500/80 text-[10px] uppercase tracking-widest mb-3 border-b border-amber-900/30 pb-1 font-bold">
        {title}
      </h4>
      
      {/* CORRECCIÓN 2: Usamos GRID de 3 columnas para ocupar todo el ancho equitativamente */}
      <div className="grid grid-cols-3 w-full">
        {steps.map((evo, index) => (
          // Alineamos el primero a la izquierda, el del medio al centro, y el último a la derecha
          <div key={evo.name} className={`flex flex-col group cursor-help relative
            ${index === 0 ? 'items-start' : index === 2 ? 'items-end' : 'items-center'}
          `}>
            
            <div className={`
              w-12 h-12 md:w-14 md:h-14 rounded-full border-2 bg-slate-900 overflow-hidden relative transition-all duration-500
              ${evo.lv === 100 ? 'border-amber-500/80 shadow-[0_0_10px_rgba(245,158,11,0.3)]' : 'border-slate-700 group-hover:border-slate-500'}
            `}>
              <img 
                src={currentRace.image} 
                alt="Evolucion"
                className={`w-full h-full object-cover brightness-0 grayscale opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500
                  ${evo.lv === 100 ? 'drop-shadow-[0_0_5px_rgba(245,158,11,0.8)]' : ''}
                `}
              />
              <div className="absolute bottom-0 inset-x-0 bg-black/80 text-[7px] text-center text-slate-300 py-0.5 font-mono">
                LVL {evo.lv}
              </div>
            </div>
            
            {/* Texto centrado respecto al círculo */}
            <span className={`mt-2 text-[9px] w-20 leading-tight font-bold ${evo.aura} 
              ${index === 0 ? 'text-left' : index === 2 ? 'text-right' : 'text-center'}
            `}>
              {evo.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    // CORRECCIÓN 1: Quitamos 'bg-black' del contenedor principal y usamos 'relative'
    // para que la imagen de fondo (z-0) se vea detrás del contenido (z-10)
    <div className="min-h-screen w-full relative flex flex-col items-center justify-center p-4 overflow-hidden bg-slate-950">
      
      {/* --- CAPA DE FONDO (BACKGROUND LAYER) --- */}
      <div className="absolute inset-0 z-0">
        <img 
          key={currentRace.id} 
          src={currentRace.bgImage} 
          alt="Background Class"
          // Quitamos opacidad excesiva, ahora se verá mucho más claro
          className="w-full h-full object-cover transition-opacity duration-1000 animate-[pulse_10s_ease-in-out_infinite]"
        />
        {/* Overlay degradado para que el texto sea legible sobre el fondo */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/40 to-black/90" />
      </div>

      {/* --- CAPA DE CONTENIDO (CONTENT LAYER) --- */}
      <div className="relative z-10 w-full max-w-7xl flex flex-col items-center">
        
        <h2 className="text-3xl md:text-5xl font-serif text-amber-500 mb-6 tracking-widest uppercase drop-shadow-[0_2px_10px_rgba(245,158,11,0.5)]">
          Elige tu Linaje
        </h2>

        <div className="flex items-center gap-2 w-full">
          
          <button onClick={handlePrev} className="p-2 md:p-3 rounded-full border border-slate-700 hover:border-amber-500 hover:text-amber-500 transition-all hover:scale-110 bg-slate-900/80 backdrop-blur-sm shadow-lg group">
            <ChevronLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
          </button>

          {/* TARJETA PRINCIPAL */}
          <div 
            className={`flex-1 flex flex-col lg:flex-row items-center justify-center gap-6 lg:gap-16 min-h-[500px] transition-all duration-500 ease-out transform ${getAnimationClass()}`}
          >
            
            {/* IMAGEN IZQUIERDA */}
            <div className="relative group">
               <div className="absolute -inset-2 border border-slate-800 rotate-2 group-hover:rotate-3 transition-transform duration-700" />
               <div className="w-64 h-[400px] lg:w-80 lg:h-[550px] bg-slate-900 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] relative rounded-sm border-2 border-slate-800">
                  <img 
                    src={currentRace.image} 
                    alt={currentRace.name}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute bottom-0 inset-x-0 h-48 bg-gradient-to-t from-black via-black/90 to-transparent flex flex-col justify-end p-6">
                    <h3 className="text-3xl font-bold text-white uppercase leading-none drop-shadow-md">{currentRace.name}</h3>
                    <p className="text-amber-500 text-sm font-mono mt-2 tracking-widest border-t border-amber-500/30 pt-2 inline-block">
                      {currentRace.id.toUpperCase()}
                    </p>
                  </div>
               </div>
            </div>

            {/* DATOS DERECHA */}
            <div className="flex-1 max-w-xl space-y-6">
              
              <div className="bg-slate-900/60 p-5 rounded border-l-2 border-amber-600 backdrop-blur-md shadow-lg">
                <p className="text-base text-slate-200 italic font-light">"{currentRace.description}"</p>
              </div>

              <div className="grid grid-cols-6 gap-2">
                {Object.entries(currentRace.stats).map(([stat, val]) => (
                  <div key={stat} className="flex flex-col items-center bg-slate-800/60 p-2 rounded border border-slate-700/50 hover:border-amber-500/50 transition-colors">
                    <span className="text-[10px] text-slate-500 font-bold">{stat}</span>
                    <span className="text-lg text-amber-500 font-mono leading-none">{val}</span>
                  </div>
                ))}
              </div>

              <div className="bg-slate-900/60 p-5 rounded border border-slate-800/80 backdrop-blur-sm">
                <EvolutionPath title="Senda 1 (Fuerza)" steps={currentRace.evolutions.path1} />
                <EvolutionPath title="Senda 2 (Estrategia)" steps={currentRace.evolutions.path2} />
              </div>

              <button 
                onClick={handleConfirm}
                className="w-full bg-gradient-to-r from-amber-800 to-amber-700 hover:from-amber-700 hover:to-amber-600 text-white font-bold py-3.5 rounded border border-amber-500/40 shadow-[0_0_30px_rgba(180,83,9,0.3)] uppercase tracking-[0.2em] transition-all transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3 mt-2"
              >
                <CheckCircle size={20} className="text-amber-300" />
                Confirmar Linaje
              </button>

            </div>
          </div>

          <button onClick={handleNext} className="p-2 md:p-3 rounded-full border border-slate-700 hover:border-amber-500 hover:text-amber-500 transition-all hover:scale-110 bg-slate-900/80 backdrop-blur-sm shadow-lg group">
            <ChevronRight size={24} className="group-hover:translate-x-1 transition-transform" />
          </button>

        </div>
      </div>

    </div>
  );
};

export default RaceSelection;