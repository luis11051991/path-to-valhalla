import React, { useEffect, useMemo } from 'react';
import { RACES } from '../constants/races';
import { Crown, Sword } from 'lucide-react';

const WelcomeBack = ({ user, onComplete }) => {
  
  const raceData = useMemo(() => {
    return RACES.find(r => r.id === user.race) || RACES[0];
  }, [user.race]);

  // CAMBIO 1: Reducido a 2000ms (2 segundos)
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 2000); 
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-black overflow-hidden animate-[fadeIn_0.5s_ease-out]">
      
      {/* FONDO */}
      <div className="absolute inset-0 z-0">
        <img 
            src={raceData.bgImage} 
            alt="Background" 
            className="w-full h-full object-cover opacity-50 blur-sm scale-110 animate-[pulse_8s_ease-in-out_infinite]" 
        />
        <div className="absolute inset-0 bg-black/60" />
      </div>

      {/* CONTENIDO */}
      <div className="relative z-10 text-center max-w-2xl p-10 border-y-2 border-slate-600/50 bg-slate-900/80 backdrop-blur-md shadow-2xl">
        
        <div className="flex justify-center mb-6">
            <Sword size={50} className="text-amber-500 animate-bounce" />
        </div>

        <h2 className="text-xl md:text-2xl font-serif text-slate-400 mb-2 uppercase tracking-widest">
            El Valhalla te saluda
        </h2>
        
        <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 uppercase tracking-wide drop-shadow-lg">
            {user.username}
        </h1>

        <p className="text-amber-500/80 text-sm font-mono tracking-[0.3em] uppercase mb-8 border-t border-b border-amber-500/20 py-2 inline-block">
            {raceData.name} • Nivel {user.level}
        </p>

        {/* BARRA DE CARGA */}
        <div className="w-full max-w-md mx-auto">
            <div className="flex justify-between text-xs text-slate-500 mb-1 uppercase">
                <span>Sincronizando alma...</span>
                <span>100%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                {/* CAMBIO 2: La animación ahora dura 1.5s para llenarse justo antes del cambio */}
                <div className="h-full bg-gradient-to-r from-amber-700 to-amber-500 animate-[width_1.5s_ease-in-out_forwards]" style={{ width: '0%' }}></div>
            </div>
        </div>

      </div>

      <style>{`
        @keyframes width { 
            0% { width: 0%; } 
            20% { width: 10%; }
            50% { width: 40%; }
            80% { width: 80%; }
            100% { width: 100%; } 
        }
      `}</style>
    </div>
  );
};

export default WelcomeBack;