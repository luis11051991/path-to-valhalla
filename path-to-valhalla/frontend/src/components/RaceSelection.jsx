import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle, Crown, User, Sword, Shield, Zap, Loader2 } from 'lucide-react';
import { RACES } from '../constants/races';

const RaceSelection = ({ onRaceSelect }) => {
  // Estados de Selección
  const [currentIndex, setCurrentIndex] = useState(0);
  const [gender, setGender] = useState('male');
  
  // Estados de Transición e Interfaz
  const [isTransitioning, setIsTransitioning] = useState(false); // Para bloquear clics rápidos
  const [showWelcome, setShowWelcome] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Usuario actualizado (para mostrar el nombre en la bienvenida)
  const [updatedUser, setUpdatedUser] = useState(null); 

  // Referencias a la raza actual
  const currentRace = RACES[currentIndex];

  // --- SOLUCIÓN AL PANTALLAZO NEGRO (PRECARGA SILENCIOSA) ---
  // Precargamos las imágenes siguientes en el caché del navegador para que al cambiar sea instantáneo
  useEffect(() => {
    const nextIndex = (currentIndex + 1) % RACES.length;
    const prevIndex = (currentIndex - 1 + RACES.length) % RACES.length;
    
    const preloadImages = [
        RACES[nextIndex].images[gender],
        RACES[nextIndex].bgImage,
        RACES[prevIndex].images[gender],
        RACES[prevIndex].bgImage
    ];

    preloadImages.forEach(src => {
        const img = new Image();
        img.src = src;
    });
  }, [currentIndex, gender]);

  // Manejo de cambio de raza (Animación suave)
  const changeRace = (newIndex) => {
    if (isSaving || showWelcome || isTransitioning) return;
    
    setIsTransitioning(true);
    // Pequeño delay para permitir que la animación CSS de salida ocurra si quisieras ponerla
    // Pero para evitar el negro, cambiamos el índice inmediatamente y dejamos que CSS haga el fade
    setCurrentIndex(newIndex);
    
    // Desbloqueamos la interacción rápidamente
    setTimeout(() => setIsTransitioning(false), 300);
  };

  const handleNext = () => changeRace((currentIndex + 1) % RACES.length);
  const handlePrev = () => changeRace(currentIndex === 0 ? RACES.length - 1 : currentIndex - 1);

  const handleConfirm = async () => {
    setIsSaving(true);
    const storedUser = JSON.parse(localStorage.getItem('user'));
    
    if (!storedUser) { alert("Error de sesión."); setIsSaving(false); return; }

    try {
      const response = await fetch('http://localhost:3000/api/choose-race', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            userId: storedUser.id, 
            race: currentRace.id,
            stats: currentRace.stats,
            gender: gender
        })
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('user', JSON.stringify(data.user));
        setUpdatedUser(data.user); // Guardamos el usuario para mostrar su nombre
        setShowWelcome(true);
      } else {
        alert("Error al confirmar linaje.");
        setIsSaving(false);
      }
    } catch (error) { console.error(error); setIsSaving(false); }
  };

  // PANTALLA DE BIENVENIDA (Ahora usa el NICKNAME)
  if (showWelcome && updatedUser) {
    return (
        <WelcomeScreenDisplay 
            raceName={currentRace.name}
            username={updatedUser.username} // Pasamos el nombre del usuario
            bgImage={currentRace.bgImage}
            onFinish={() => { if(onRaceSelect) onRaceSelect(updatedUser); }} 
        />
    );
  }

  // Componente interno para las evoluciones
  const EvolutionPath = ({ title, steps }) => (
    <div className="mb-4">
      <h4 className="text-amber-500/80 text-xs uppercase tracking-[0.2em] mb-3 border-b border-amber-900/30 pb-1 font-bold">{title}</h4>
      <div className="flex justify-between gap-4">
        {steps.map((evo) => (
          <div key={evo.name} className="flex flex-col items-center group cursor-help relative">
            <div className={`w-16 h-16 xl:w-20 xl:h-20 rounded-full border-2 bg-slate-900 overflow-hidden relative transition-all duration-500 ${evo.lv === 100 ? 'border-amber-500/80 shadow-[0_0_15px_rgba(245,158,11,0.4)]' : 'border-slate-700 group-hover:border-slate-500'}`}>
              <img src={currentRace.images[gender]} className={`w-full h-full object-cover brightness-0 grayscale opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500 ${evo.lv === 100 ? 'drop-shadow-[0_0_8px_rgba(245,158,11,0.8)]' : ''}`} />
              <div className="absolute bottom-0 inset-x-0 bg-black/80 text-[9px] text-center text-slate-300 py-0.5">LV {evo.lv}</div>
            </div>
            <span className={`mt-2 text-[10px] text-center w-20 leading-tight font-bold ${evo.aura}`}>{evo.name}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="h-screen w-full relative flex flex-col items-center justify-center overflow-hidden bg-slate-950 font-sans">
      
      {/* FONDO (Con Key para forzar re-render suave, pero sin ocultar el contenedor padre) */}
      <div className="absolute inset-0 z-0 bg-black">
        <img 
          key={currentRace.id} // El key ayuda a React a entender que la imagen cambió
          src={currentRace.bgImage} 
          alt="Background Class"
          className="w-full h-full object-cover opacity-40 blur-sm scale-105 animate-[fadeIn_1s_ease-out]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/40 to-black/90" />
      </div>

      <div className="absolute top-8 left-0 right-0 text-center z-20">
        <h2 className="text-4xl md:text-6xl font-serif text-amber-500 tracking-[0.15em] uppercase drop-shadow-[0_4px_15px_rgba(0,0,0,0.8)]">Elige tu Linaje</h2>
      </div>

      <div className="relative z-10 w-full max-w-[90%] 2xl:max-w-[1600px] flex items-center justify-between px-4 h-full pt-20">
        
        <button onClick={handlePrev} disabled={isTransitioning} className="p-4 rounded-full border-2 border-slate-700 hover:border-amber-500 hover:text-amber-500 transition-all bg-slate-900/50 backdrop-blur-md shadow-2xl group hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed">
          <ChevronLeft size={40} className="group-hover:-translate-x-1 transition-transform" />
        </button>

        {/* CONTENEDOR PRINCIPAL */}
        <div className="flex flex-col lg:flex-row items-center justify-center gap-12 xl:gap-24 animate-[fadeIn_0.5s_ease-out]">
          
          {/* --- IMAGEN Y GÉNERO --- */}
          <div className="flex flex-col items-center gap-6">
              <div className="relative group shrink-0">
                  <div className="absolute -inset-3 border-2 border-slate-800 rotate-2 group-hover:rotate-3 transition-transform duration-700" />
                  <div className="w-[300px] h-[450px] xl:w-[450px] xl:h-[650px] bg-slate-900 overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.6)] relative rounded border-2 border-slate-700">
                    {/* IMAGEN PRINCIPAL */}
                    <img 
                        key={`${currentRace.id}-${gender}`} // Key única para forzar fade-in al cambiar
                        src={currentRace.images[gender]} 
                        alt={currentRace.name}
                        className="w-full h-full object-contain bg-black/20 transition-transform duration-700 group-hover:scale-105 animate-[fadeIn_0.5s_ease-out]"
                    />
                    
                    <div className="absolute bottom-0 inset-x-0 h-48 bg-gradient-to-t from-black via-black/80 to-transparent flex flex-col justify-end p-8">
                      <h3 className="text-4xl xl:text-5xl font-bold text-white uppercase leading-none drop-shadow-xl">{currentRace.name}</h3>
                      <p className="text-amber-500 text-sm xl:text-base font-mono mt-2 tracking-[0.3em] border-t border-amber-500/50 pt-2 inline-block">{currentRace.id.toUpperCase()}</p>
                    </div>
                  </div>
              </div>

              {/* SELECTOR DE GÉNERO */}
              <div className="flex gap-4 bg-black/60 p-2 rounded-full border border-slate-700 backdrop-blur-md shadow-lg pointer-events-auto">
                <button onClick={() => setGender('male')} className={`px-6 py-2 rounded-full text-sm font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${gender === 'male' ? 'bg-blue-900/80 text-blue-200 border border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>
                    <User size={16} /> Masculino
                </button>
                <button onClick={() => setGender('female')} className={`px-6 py-2 rounded-full text-sm font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${gender === 'female' ? 'bg-pink-900/80 text-pink-200 border border-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.5)]' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>
                    <User size={16} /> Femenino
                </button>
            </div>
          </div>

          {/* --- DATOS --- */}
          <div className="flex-1 max-w-2xl space-y-6 xl:space-y-8">
            <div className="bg-slate-900/70 p-6 rounded border-l-4 border-amber-600 backdrop-blur-md shadow-xl">
              <p className="text-lg xl:text-xl text-slate-200 italic font-light leading-relaxed">"{currentRace.description}"</p>
            </div>

            <div className="grid grid-cols-6 gap-3">
              {Object.entries(currentRace.stats).map(([stat, val]) => (
                <div key={stat} className="flex flex-col items-center bg-slate-800/60 p-3 rounded border border-slate-700/50 hover:border-amber-500/50 transition-colors">
                  <span className="text-[10px] xl:text-xs text-slate-400 font-bold uppercase">{stat.substring(0,3)}</span>
                  <span className="text-2xl xl:text-3xl text-amber-500 font-mono leading-none mt-1">{val}</span>
                </div>
              ))}
            </div>

            <div className="bg-slate-900/50 p-6 rounded border border-slate-700/80 backdrop-blur-sm">
              <EvolutionPath title="Senda 1 (Fuerza)" steps={currentRace.evolutions.path1} />
              <div className="h-px bg-white/5 my-4"></div>
              <EvolutionPath title="Senda 2 (Estrategia)" steps={currentRace.evolutions.path2} />
            </div>

            <button onClick={handleConfirm} disabled={isSaving} className="w-full bg-gradient-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white font-bold py-5 rounded border border-amber-400 shadow-[0_0_40px_rgba(180,83,9,0.3)] uppercase tracking-[0.3em] text-lg transition-all transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-wait">
              {isSaving ? 'Forjando Destino...' : (<><CheckCircle size={24} className="text-amber-200" />Confirmar Linaje</>)}
            </button>
          </div>
        </div>

        <button onClick={handleNext} disabled={isTransitioning} className="p-4 rounded-full border-2 border-slate-700 hover:border-amber-500 hover:text-amber-500 transition-all bg-slate-900/50 backdrop-blur-md shadow-2xl group hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed">
          <ChevronRight size={40} className="group-hover:translate-x-1 transition-transform" />
        </button>

      </div>
    </div>
  );
};

// PANTALLA DE BIENVENIDA ACTUALIZADA
const WelcomeScreenDisplay = ({ raceName, username, bgImage, onFinish }) => {
    React.useEffect(() => { const timer = setTimeout(onFinish, 4000); return () => clearTimeout(timer); }, [onFinish]);
    return (
        <div className="min-h-screen relative flex items-center justify-center bg-black overflow-hidden animate-[fadeIn_1s_ease-out]">
            <div className="absolute inset-0 z-0">
                <img src={bgImage} className="w-full h-full object-cover opacity-40 blur-sm scale-110" />
                <div className="absolute inset-0 bg-black/60" />
            </div>
            <div className="relative z-10 text-center max-w-4xl p-12 border-y-2 border-amber-500/30 bg-slate-900/80 backdrop-blur-md shadow-2xl">
                <Crown size={80} className="text-amber-500 mx-auto mb-8 animate-pulse" />
                
                {/* --- AQUÍ ESTÁ EL CAMBIO DE TEXTO --- */}
                <h1 className="text-4xl md:text-6xl font-serif text-slate-100 mb-4 uppercase tracking-widest text-shadow-lg">
                    Bienvenido a la Aventura
                </h1>
                <h2 className="text-3xl md:text-5xl text-amber-500 font-bold uppercase mb-10 tracking-[0.2em] drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]">
                    {username}
                </h2>
                {/* ---------------------------------- */}

                <div className="w-full h-2 bg-slate-700 rounded-full mt-8 overflow-hidden"><div className="h-full bg-amber-500 animate-[width_4s_linear_forwards]" style={{ width: '0%' }}></div></div>
            </div>
            <style>{`@keyframes width { to { width: 100%; } }`}</style>
        </div>
    );
};

export default RaceSelection;