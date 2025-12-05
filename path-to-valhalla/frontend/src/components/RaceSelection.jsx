import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle, Crown } from 'lucide-react';
import { RACES } from '../constants/races';

const RaceSelection = ({ onRaceSelect }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [direction, setDirection] = useState('next');
  
  const [showWelcome, setShowWelcome] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const currentRace = RACES[currentIndex];

  // --- EFECTO: TEMPORIZADOR DE BIENVENIDA ---
  useEffect(() => {
    if (showWelcome) {
      // Esperamos 4 segundos y entramos al juego automáticamente
      const timer = setTimeout(() => {
        if (onRaceSelect) onRaceSelect(currentRace);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [showWelcome, currentRace, onRaceSelect]);

  const changeRace = (newIndex, dir) => {
    if (isAnimating || showWelcome) return;
    setIsAnimating(true);
    setDirection(dir);
    setTimeout(() => {
      setCurrentIndex(newIndex);
      setTimeout(() => setIsAnimating(false), 50); 
    }, 300);
  };

  const handleNext = () => changeRace((currentIndex + 1) % RACES.length, 'next');
  const handlePrev = () => changeRace(currentIndex === 0 ? RACES.length - 1 : currentIndex - 1, 'prev');

  const handleConfirm = async () => {
    setIsLoading(true);
    const storedUser = JSON.parse(localStorage.getItem('user'));
    
    if (!storedUser) {
        alert("Error de sesión.");
        setIsLoading(false);
        return;
    }

    try {
      const response = await fetch('http://localhost:3000/api/choose-race', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: storedUser.id, race: currentRace.id })
      });

      if (response.ok) {
        const data = await response.json();
        // Guardamos el usuario actualizado (con raza) en local
        localStorage.setItem('user', JSON.stringify(data.user));
        setShowWelcome(true); // <--- ESTO ACTIVA EL TEMPORIZADOR DEL USEEFFECT ARRIBA
      } else {
        alert("Error al confirmar linaje.");
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const getAnimationClass = () => {
    if (isAnimating) {
      return direction === 'next' 
        ? 'opacity-0 -translate-x-20 scale-95 blur-sm' 
        : 'opacity-0 translate-x-20 scale-95 blur-sm'; 
    }
    return 'opacity-100 translate-x-0 scale-100 blur-0';
  };

  // --- PANTALLA DE BIENVENIDA (AUTOMÁTICA) ---
  if (showWelcome) {
    return (
      <div className="min-h-screen relative flex items-center justify-center bg-black overflow-hidden animate-[fadeIn_1s_ease-out]">
        <div className="absolute inset-0 z-0">
            <img src={currentRace.bgImage} className="w-full h-full object-cover opacity-40 blur-sm scale-110" />
            <div className="absolute inset-0 bg-black/60" />
        </div>
        <div className="relative z-10 text-center max-w-2xl p-8 border-y-2 border-amber-500/30 bg-slate-900/80 backdrop-blur-md">
            <Crown size={64} className="text-amber-500 mx-auto mb-6 animate-pulse" />
            <h1 className="text-4xl md:text-6xl font-serif text-slate-100 mb-2 uppercase tracking-widest">Bienvenido</h1>
            <h2 className="text-2xl text-amber-500 font-bold uppercase mb-8 tracking-[0.2em]">{currentRace.name}</h2>
            <p className="text-slate-300 text-lg italic mb-2 leading-relaxed">"Tu destino ha sido sellado."</p>
            {/* Barra de carga decorativa */}
            <div className="w-full h-1 bg-slate-700 rounded-full mt-6 overflow-hidden">
                <div className="h-full bg-amber-500 animate-[width_4s_linear_forwards]" style={{ width: '0%' }}></div>
            </div>
            <p className="text-xs text-slate-500 mt-2">Entrando al mundo...</p>
        </div>
        {/* Estilo para la animación de la barra */}
        <style>{`@keyframes width { to { width: 100%; } }`}</style>
      </div>
    );
  }

  // --- PANTALLA DE SELECCIÓN ---
  const EvolutionPath = ({ title, steps }) => (
    <div className="mb-5">
      <h4 className="text-amber-500/80 text-[10px] uppercase tracking-widest mb-3 border-b border-amber-900/30 pb-1 font-bold">{title}</h4>
      <div className="grid grid-cols-3 w-full">
        {steps.map((evo, index) => (
          <div key={evo.name} className={`flex flex-col group cursor-help relative ${index === 0 ? 'items-start' : index === 2 ? 'items-end' : 'items-center'}`}>
            <div className={`w-12 h-12 md:w-14 md:h-14 rounded-full border-2 bg-slate-900 overflow-hidden relative ${evo.lv === 100 ? 'border-amber-500/80 shadow-[0_0_10px_rgba(245,158,11,0.3)]' : 'border-slate-700'}`}>
              <img src={currentRace.image} className="w-full h-full object-cover brightness-0 grayscale opacity-60" />
              <div className="absolute bottom-0 inset-x-0 bg-black/80 text-[7px] text-center text-slate-300 py-0.5">LV {evo.lv}</div>
            </div>
            <span className={`mt-2 text-[9px] w-20 leading-tight font-bold ${evo.aura} ${index === 0 ? 'text-left' : index === 2 ? 'text-right' : 'text-center'}`}>{evo.name}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen w-full relative flex flex-col items-center justify-center p-4 overflow-hidden bg-slate-950">
      <div className="absolute inset-0 z-0">
        <img key={currentRace.id} src={currentRace.bgImage} className="w-full h-full object-cover opacity-60 blur-sm scale-105 animate-[pulse_10s_ease-in-out_infinite] transition-opacity duration-1000" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/40 to-black/90" />
      </div>
      <div className="relative z-10 w-full max-w-7xl flex flex-col items-center">
        <h2 className="text-3xl md:text-5xl font-serif text-amber-500 mb-6 tracking-widest uppercase drop-shadow-[0_2px_10px_rgba(245,158,11,0.5)]">Elige tu Linaje</h2>
        <div className="flex items-center gap-2 w-full">
          <button onClick={handlePrev} className="p-2 md:p-3 rounded-full border border-slate-700 hover:border-amber-500 transition-all bg-slate-900/80"><ChevronLeft size={24} /></button>
          <div className={`flex-1 flex flex-col lg:flex-row items-center justify-center gap-6 lg:gap-16 min-h-[500px] transition-all duration-500 ease-out transform ${getAnimationClass()}`}>
            <div className="relative group">
               <div className="absolute -inset-2 border border-slate-800 rotate-2 transition-transform" />
               <div className="w-64 h-[400px] lg:w-80 lg:h-[550px] bg-slate-900 overflow-hidden shadow-lg relative rounded-sm border-2 border-slate-800">
                  <img src={currentRace.image} className="w-full h-full object-cover" />
                  <div className="absolute bottom-0 inset-x-0 h-48 bg-gradient-to-t from-black via-black/90 to-transparent flex flex-col justify-end p-6">
                    <h3 className="text-3xl font-bold text-white uppercase">{currentRace.name}</h3>
                    <p className="text-amber-500 text-sm font-mono mt-2 tracking-widest pt-2 border-t border-amber-500/30 inline-block">{currentRace.id.toUpperCase()}</p>
                  </div>
               </div>
            </div>
            <div className="flex-1 max-w-xl space-y-6">
                <div className="bg-slate-900/60 p-5 rounded border-l-2 border-amber-600 backdrop-blur-md shadow-lg"><p className="text-base text-slate-200 italic">"{currentRace.description}"</p></div>
                <div className="grid grid-cols-6 gap-2">
                    {Object.entries(currentRace.stats).map(([stat, val]) => (
                        <div key={stat} className="flex flex-col items-center bg-slate-800/60 p-2 rounded border border-slate-700/50"><span className="text-[10px] text-slate-500 font-bold">{stat}</span><span className="text-lg text-amber-500 font-mono">{val}</span></div>
                    ))}
                </div>
                <div className="bg-slate-900/60 p-5 rounded border border-slate-800/80 backdrop-blur-sm">
                    <EvolutionPath title="Senda 1 (Fuerza)" steps={currentRace.evolutions.path1} />
                    <EvolutionPath title="Senda 2 (Estrategia)" steps={currentRace.evolutions.path2} />
                </div>
                <button onClick={handleConfirm} disabled={isLoading} className="w-full bg-gradient-to-r from-amber-800 to-amber-700 text-white font-bold py-3.5 rounded border border-amber-500/40 uppercase tracking-[0.2em] transition-all hover:scale-[1.02] flex items-center justify-center gap-3 mt-2 disabled:opacity-50">
                    {isLoading ? 'Forjando...' : <><CheckCircle size={20} className="text-amber-300" />Confirmar Linaje</>}
                </button>
            </div>
          </div>
          <button onClick={handleNext} className="p-2 md:p-3 rounded-full border border-slate-700 hover:border-amber-500 transition-all bg-slate-900/80"><ChevronRight size={24} /></button>
        </div>
      </div>
    </div>
  );
};

export default RaceSelection;