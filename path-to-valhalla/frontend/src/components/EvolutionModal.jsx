import React, { useEffect, useState } from 'react';
import { X, ChevronRight, Award, Shield, Sword, Zap, CheckCircle, Scroll, Skull, AlertTriangle, ArrowUp, Loader, RotateCcw } from 'lucide-react';
import { apiUrl } from '../constants/api';
import ConfirmModal from './common/ConfirmModal';

const EvolutionModal = ({ user, status, activeQuestData, onClose, onEvolveSuccess, onRefresh }) => {
    const [step, setStep] = useState(status === 'in_progress' ? 10 : 0); 
    
    const [options, setOptions] = useState([]);
    const [selectedOption, setSelectedOption] = useState(null);
    const [questPreview, setQuestPreview] = useState(null);
    const [error, setError] = useState(null);
    const [customAlert, setCustomAlert] = useState(null);
    const [showReconsiderConfirm, setShowReconsiderConfirm] = useState(false);

    // Cargar opciones SOLO si estamos en modo selección
    useEffect(() => {
        if (status === 'available') {
            fetch(apiUrl(`/api/evolution/options?t=${Date.now()}`), {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            })
            .then(res => res.json())
            .then(data => {
                if (data.available) {
                    setOptions(data.options);
                    setQuestPreview(data.questData);
                    setStep(1); 
                } else {
                    setError(data.message);
                }
            })
            .catch(() => setError("Los dioses guardan silencio."));
        }
    }, [status]);

    // Helper imagen
    const getClassImage = (dbPath) => {
        if (!dbPath) return "https://via.placeholder.com/400x600?text=Clase";
        if (dbPath.includes('_male') || dbPath.includes('_female')) return dbPath;
        const genderSuffix = user.gender === 'female' ? '_female' : '_male';
        const lastDotIndex = dbPath.lastIndexOf('.');
        if (lastDotIndex === -1) return dbPath + genderSuffix + ".png";
        return `${dbPath.substring(0, lastDotIndex)}${genderSuffix}${dbPath.substring(lastDotIndex)}`;
    };

    // --- ACCIONES ---
    const handleAcceptQuest = async () => {
        if (!selectedOption) return;
        try {
            const res = await fetch(apiUrl('/api/evolution/start'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({ targetClassId: selectedOption.id })
            });
            const data = await res.json();
            if (data.success) {
                setCustomAlert({ type: 'success', msg: "Destino Aceptado. Revisa tu progreso aquí mismo." });
                setTimeout(() => {
                    window.location.reload(); 
                }, 2000);
            } else {
                setCustomAlert({ type: 'error', msg: data.message });
            }
        } catch (err) { setCustomAlert({ type: 'error', msg: "Error de conexión." }); }
    };

    const handleFinishEvolution = async () => {
        if (!activeQuestData?.quest?.id) return;
        try {
            const res = await fetch(apiUrl('/api/quests/complete'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({ playerQuestId: activeQuestData.quest.id })
            });
            const data = await res.json();
            if (data.success) {
                setCustomAlert({ type: 'success', msg: data.message });
                fetch(apiUrl('/api/auth/profile'), { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
                    .then(r => r.json()).then(d => {
                        onEvolveSuccess(d.user); 
                    });
            } else {
                setCustomAlert({ type: 'error', msg: data.message });
            }
        } catch (e) { setCustomAlert({ type: 'error', msg: "Error al evolucionar." }); }
    };

    const handleReconsiderClick = () => {
        setShowReconsiderConfirm(true);
    };

    const executeReconsider = async () => {
        setShowReconsiderConfirm(false);
        try {
            const res = await fetch(apiUrl('/api/evolution/reconsider'), {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            if (data.success) {
                setCustomAlert({ type: 'success', msg: "Los dioses te conceden una nueva oportunidad." });
                setTimeout(() => {
                    onClose();
                    if (onRefresh) onRefresh();
                }, 2000);
            } else {
                setCustomAlert({ type: 'error', msg: data.message });
            }
        } catch (e) { setCustomAlert({ type: 'error', msg: "Error de conexión." }); }
    };

    // --- DIÁLOGOS DE ODÍN POR NIVEL ---
    const odinTier = options.length > 0
        ? Math.min(...options.map(o => o.min_level))
        : (user?.level >= 100 ? 100 : user?.level >= 50 ? 50 : 10);

    const FALLBACK_DIALOGUE = {
        intro: '"Los dioses te observan, mortal. Has demostrado valor, pero el verdadero camino aún se extiende ante ti."',
        sarcastic: '"¿Crees que esto es todo? Aún hay pruebas que superar, guerrero. Prepárate."',
        buttonLabel: 'Reclamar Poder'
    };

    const odinDialogues = {
        10: {
            intro: '"Al fin has llegado al nivel 10, mortal. Tu persistencia no ha pasado desapercibida ante los ojos de los dioses. Estás un paso más cerca del Valhalla."',
            sarcastic: '"¡JAJAJA! ¿Creíste que sería gratis? Gánatelo, guerrero. Te enviaré una misión suicida... Complétala y el poder será tuyo."',
            buttonLabel: 'Reclamar Poder'
        },
        50: {
            intro: '"Vaya... sigues vivo. Admito que eso ya es más de lo que esperaba. Has alcanzado el nivel 50, y tu alma empieza a pesar lo suficiente como para que los dioses la noten. No sonrías todavía, mortal: el poder verdadero siempre cobra intereses."',
            sarcastic: '"¿Querías más poder? Claro que sí. Todos los mortales quieren más poder hasta que este empieza a morderles la mano. Te daré una prueba digna de alguien que insiste en no morir."',
            buttonLabel: 'Reclamar Ascensión'
        },
        100: {
            intro: '"Nivel 100... así que la leyenda era cierta. Has caminado entre sangre, ruinas y monstruos, y aun así sigues de pie. No sé si llamarlo destino, terquedad o pésimo instinto de supervivencia. Pero hoy, mortal, los dioses inclinan la cabeza... apenas."',
            sarcastic: '"Ya no puedo enviarte una simple prueba. A este punto, si fallas, será vergonzoso para ambos. Demuestra que tu nombre merece ser pronunciado en los salones eternos."',
            buttonLabel: 'Reclamar Destino'
        }
    };
    const tierKey = odinTier >= 100 ? 100 : odinTier >= 50 ? 50 : 10;
    const dialogo = odinDialogues[tierKey] || FALLBACK_DIALOGUE;

    // --- RENDERIZADO VISUAL ---
    // Renderiza contenido seguro según step. NUNCA devuelve null/vacío.
    const renderContent = () => {
        try {
            // ERROR
            if (error) {
                return (
                    <div className="flex-1 flex items-center justify-center p-8">
                        <div className="text-center max-w-md">
                            <AlertTriangle size={48} className="text-red-400 mx-auto mb-4" />
                            <p className="text-red-300 text-lg font-serif italic mb-2">{error}</p>
                            <p className="text-slate-500 text-sm mb-6">El destino no puede ser revelado en este momento.</p>
                            <button onClick={onClose} className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold uppercase rounded tracking-widest border border-slate-700 transition-colors">
                                Cerrar
                            </button>
                        </div>
                    </div>
                );
            }

            // STEP 0 — CARGA DE OPCIONES
            if (step === 0) {
                return (
                    <div className="flex-1 flex items-center justify-center p-8">
                        <div className="text-center">
                            <Loader size={48} className="text-amber-500 mx-auto mb-6 animate-spin" />
                            <p className="text-amber-400 font-serif italic text-xl">Los dioses deliberan...</p>
                            <p className="text-slate-500 text-sm mt-2">Consultando los designios del Valhalla</p>
                        </div>
                    </div>
                );
            }

            // STEP 1 — INTRODUCCIÓN ODÍN
            if (step === 1) {
                return (
                    <div className="relative min-h-[620px] flex flex-col justify-end items-center animate-in fade-in duration-1000 overflow-hidden">
                        <div className="absolute inset-0 z-0">
                            <img src="/npcs/odin.png" className="w-full h-full object-cover object-center" alt="Odin" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/30" />
                        </div>
                        <div className="relative z-10 w-full bg-black/80 border-t-2 border-b-2 border-amber-600 px-6 py-8 md:p-10 max-w-4xl text-center backdrop-blur-sm shadow-[0_0_50px_rgba(0,0,0,0.8)]">
                            <h2 className="text-amber-500 font-serif font-bold text-xl uppercase tracking-[0.35em] mb-4 drop-shadow-md">Odín, Padre de Todo</h2>
                            <p className="text-xl md:text-2xl font-serif italic text-slate-200 leading-relaxed drop-shadow-md max-w-3xl mx-auto">
                                {dialogo.intro}
                            </p>
                            <button onClick={() => setStep(2)} className="mt-8 px-10 py-3 bg-amber-700 hover:bg-amber-600 text-white font-bold rounded uppercase tracking-widest shadow-[0_0_20px_rgba(245,158,11,0.6)] flex items-center gap-2 mx-auto transition-transform hover:scale-105">
                                {dialogo.buttonLabel} <ChevronRight />
                            </button>
                        </div>
                    </div>
                );
            }

            // STEP 2 — RISA SARCÁSTICA
            if (step === 2) {
                return (
                    <div className="relative min-h-[620px] flex flex-col justify-end items-center animate-in zoom-in duration-300 overflow-hidden">
                        <div className="absolute inset-0 z-0">
                            <img src="/npcs/odin.png" className="w-full h-full object-cover object-center scale-110 transition-transform duration-[10s]" alt="Odin Laughing" />
                            <div className="absolute inset-0 bg-gradient-to-t from-red-950/80 via-black/20 to-transparent mix-blend-multiply" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
                        </div>
                        <div className="relative z-10 w-full bg-black/80 border-t-2 border-b-2 border-red-600 px-6 py-8 md:p-10 max-w-4xl text-center backdrop-blur-sm">
                            <h2 className="text-red-500 font-serif font-bold text-xl uppercase tracking-[0.35em] mb-4 animate-pulse">Odín</h2>
                            <p className="text-xl md:text-2xl font-serif italic text-red-100 leading-relaxed max-w-3xl mx-auto">
                                {dialogo.sarcastic}
                            </p>
                            <button onClick={() => setStep(3)} className="mt-8 px-10 py-3 bg-red-800 hover:bg-red-700 text-white font-bold rounded uppercase tracking-widest shadow-[0_0_20px_rgba(220,38,38,0.6)] flex items-center gap-2 mx-auto transition-transform hover:scale-105">
                                Acepto el Reto <Skull size={18} />
                            </button>
                        </div>
                    </div>
                );
            }

            // STEP 3 — SELECCIÓN DE SENDA (soporta 1 o 2 opciones)
            if (step === 3) {
                if (!Array.isArray(options) || options.length === 0) {
                    return (
                        <div className="flex-1 flex items-center justify-center p-8">
                            <div className="text-center">
                                <Skull size={48} className="text-slate-600 mx-auto mb-4" />
                                <h3 className="text-2xl text-slate-400 font-serif mb-2">No hay caminos disponibles</h3>
                                <p className="text-slate-500 text-sm">Los dioses aún no han revelado un destino para ti en este nivel.</p>
                                <button onClick={onClose} className="mt-6 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold uppercase rounded tracking-widest border border-slate-700 transition-colors">
                                    Regresar
                                </button>
                            </div>
                        </div>
                    );
                }
                const isSingle = options.length === 1;
                return (
                    <div className="flex-1 flex flex-col p-4 pt-8">
                        <h2 className="text-4xl text-center text-amber-500 font-serif mb-8 mt-12 uppercase tracking-[0.2em] drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]">
                            {isSingle ? 'Tu Próxima Ascensión' : 'Escoge tu Destino'}
                        </h2>
                        <div className={`${isSingle ? 'flex items-center justify-center' : 'grid grid-cols-1 md:grid-cols-2'} gap-8 flex-1 pb-8 px-4`}>
                            {options.map((opt) => (
                                <div key={opt.id} onClick={() => { setSelectedOption(opt); setStep(4); }} className="relative group cursor-pointer rounded-xl border-2 border-slate-700 hover:border-amber-500 bg-slate-900 overflow-hidden flex flex-col transition-all hover:scale-[1.02] shadow-2xl max-w-lg">
                                    <div className="h-[350px] w-full relative bg-gradient-to-b from-slate-800 to-slate-950 overflow-hidden">
                                        <div className="absolute inset-0 opacity-20 bg-[url('/patterns/hex.png')]"></div>
                                        <img 
                                            src={getClassImage(opt.image_url)} 
                                            className="w-full h-full object-contain object-center p-2 drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)] transition-transform duration-500 group-hover:scale-105" 
                                            alt={opt.name}
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
                                        <div className="absolute bottom-4 left-0 right-0 text-center">
                                            <h3 className="text-3xl font-black text-white uppercase italic tracking-wider drop-shadow-lg group-hover:text-amber-400 transition-colors">
                                                {opt.name}
                                            </h3>
                                        </div>
                                    </div>
                                    <div className="flex-1 p-6 flex flex-col bg-slate-950 relative z-10">
                                        <p className="text-slate-300 text-sm italic font-serif mb-6 text-center border-b border-slate-800 pb-4">"{opt.description}"</p>
                                        <div className="grid grid-cols-3 gap-2 mb-6">
                                            {Object.entries(opt.base_stats || {}).map(([key, val]) => (
                                                <div key={key} className="bg-slate-900 p-2 rounded border border-slate-800 flex flex-col items-center">
                                                    <span className="text-[10px] text-slate-500 uppercase font-bold">{key.substring(0,3)}</span>
                                                    <span className="text-amber-500 font-mono font-bold">+{val}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="mt-auto w-full py-3 bg-slate-800 border border-slate-600 rounded text-center text-slate-300 font-bold uppercase text-xs group-hover:bg-amber-700 group-hover:text-white group-hover:border-amber-500 transition-colors tracking-widest">
                                            {isSingle ? 'Continuar' : 'Seleccionar Senda'}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            }

            // STEP 4 — PREVIEW DE QUEST
            if (step === 4) {
                if (!selectedOption || !questPreview) {
                    return (
                        <div className="flex-1 flex items-center justify-center p-8">
                            <div className="text-center">
                                <AlertTriangle size={48} className="text-amber-400 mx-auto mb-4" />
                                <h3 className="text-2xl text-slate-300 font-serif mb-2">Preparando prueba...</h3>
                                <button onClick={() => setStep(3)} className="mt-6 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold uppercase rounded tracking-widest border border-slate-700 transition-colors">
                                    Volver
                                </button>
                            </div>
                        </div>
                    );
                }
                return (
                    <div className="flex-1 flex items-center justify-center p-8 animate-in slide-in-from-right duration-500">
                        <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-2 bg-slate-950 border-2 border-amber-600 rounded-xl overflow-hidden shadow-[0_0_100px_rgba(245,158,11,0.2)]">
                            <div className="relative h-64 md:h-auto bg-slate-900 flex items-center justify-center overflow-hidden">
                                <div className="absolute inset-0 bg-[url('/patterns/hex.png')] opacity-10"></div>
                                <img 
                                    src={getClassImage(selectedOption.image_url)} 
                                    className="w-full h-full object-contain object-center scale-100 p-4" 
                                    alt={selectedOption.name}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
                                <div className="absolute bottom-8 left-0 right-0 text-center">
                                    <h3 className="text-4xl font-black text-white uppercase tracking-widest drop-shadow-[0_5px_5px_rgba(0,0,0,1)]">{selectedOption.name}</h3>
                                    <p className="text-amber-500 text-xs font-bold uppercase tracking-[0.5em] mt-2">Tu Nuevo Destino</p>
                                </div>
                            </div>
                            <div className="p-10 flex flex-col justify-between bg-black/60 backdrop-blur-md relative">
                                <div>
                                    <h4 className="text-amber-500 font-bold text-xl uppercase tracking-widest mb-4 flex items-center gap-3 border-b border-amber-900/50 pb-2">
                                        <Scroll size={24} /> {questPreview.title}
                                    </h4>
                                    <div className="space-y-6">
                                        <p className="text-lg text-slate-200 font-serif italic leading-relaxed">"{questPreview.description}"</p>
                                        <div className="bg-slate-900/80 p-5 rounded border border-red-900/50 shadow-inner">
                                            <h5 className="text-red-500 text-xs font-bold uppercase mb-3 flex items-center gap-2">
                                                <Skull size={14} /> Requisitos del Sacrificio
                                            </h5>
                                            <ul className="space-y-2">
                                                {(questPreview.requirements || []).map((req, idx) => (
                                                    <li key={idx} className="flex justify-between text-sm text-slate-300 border-b border-white/5 pb-1">
                                                        <span>{req.name || (req.type === 'kill' ? 'Enemigos derrotados' : req.type)}</span>
                                                        <span className="text-red-400 font-mono font-bold">x{req.count}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-4 mt-8">
                                    <button onClick={() => setStep(3)} className="px-6 py-4 border border-slate-600 text-slate-400 font-bold uppercase hover:bg-slate-800 rounded transition-colors text-xs tracking-widest">Reconsiderar</button>
                                    <button onClick={handleAcceptQuest} className="flex-1 py-4 bg-gradient-to-r from-red-800 to-red-600 hover:from-red-700 hover:to-red-500 text-white font-bold uppercase shadow-[0_0_20px_rgba(220,38,38,0.4)] hover:scale-105 transition-all rounded border border-red-500 text-sm tracking-widest flex justify-center items-center gap-2">
                                        <Sword size={18} /> Aceptar Desafío
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            }

            // STEP 10 — PROGRESO DE MISIÓN
            if (step === 10) {
                return renderProgressFlow();
            }

            // FALLBACK: paso desconocido
            return (
                <div className="flex-1 flex items-center justify-center p-8">
                    <div className="text-center">
                        <AlertTriangle size={48} className="text-amber-400 mx-auto mb-4" />
                        <h3 className="text-2xl text-slate-300 font-serif mb-2">Estado de evolución inválido</h3>
                        <p className="text-slate-500 text-sm mb-6">No se pudo determinar el estado actual. Cierra e inténtalo de nuevo.</p>
                        <button onClick={onClose} className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold uppercase rounded tracking-widest border border-slate-700 transition-colors">
                            Cerrar
                        </button>
                    </div>
                </div>
            );
        } catch (renderErr) {
            console.error('[EvolutionModal render error]', renderErr);
            return (
                <div className="flex-1 flex items-center justify-center p-8">
                    <div className="text-center">
                        <AlertTriangle size={48} className="text-red-500 mx-auto mb-4" />
                        <h3 className="text-2xl text-slate-300 font-serif mb-2">Error inesperado</h3>
                        <p className="text-slate-500 text-sm mb-6">Ocurrió un error al renderizar la evolución.</p>
                        <button onClick={onClose} className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold uppercase rounded tracking-widest border border-slate-700 transition-colors">
                            Cerrar
                        </button>
                    </div>
                </div>
            );
        }
    };

    // 2. VISTA DE PROGRESO (Cuando ya tienes la misión) - MANTENIDA IGUAL
    const renderProgressFlow = () => {
        if (!activeQuestData) return <div>Cargando destino...</div>;
        const { quest, targetClass } = activeQuestData;
        
        const progressData = quest.progress || {};
        const reqs = quest.requirements || [];
        let isComplete = true;
        reqs.forEach(req => {
            const key = req.target_id || req.type;
            const current = progressData[key] || 0;
            if (current < req.count) isComplete = false;
        });

        return (
            <div className="h-full flex items-center justify-center animate-in zoom-in">
                <div className="max-w-5xl w-full bg-slate-900 border-2 border-amber-600 rounded-xl overflow-hidden shadow-[0_0_50px_rgba(245,158,11,0.2)] flex flex-col md:flex-row h-[600px]">
                    
                    {/* Panel Izquierdo: Tu Futuro */}
                    <div className="w-full md:w-5/12 relative bg-slate-950 overflow-hidden">
                         <div className="absolute inset-0 bg-[url('/patterns/hex.png')] opacity-10"></div>
                         {/* AJUSTE IMAGEN PROGRESO: object-center */}
                        <img 
                            src={getClassImage(targetClass?.image_url)} 
                            className="w-full h-full object-contain object-center opacity-80 p-4" 
                            alt={targetClass?.name}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
                        <div className="absolute bottom-8 left-0 right-0 text-center z-10">
                            <p className="text-amber-500 text-xs font-bold uppercase tracking-widest mb-1">Evolución Pendiente</p>
                            <h3 className="text-3xl font-black text-white uppercase tracking-wider">{targetClass?.name || "Guerrero"}</h3>
                        </div>
                    </div>

                    {/* Panel Derecho: Progreso */}
                    <div className="w-full md:w-7/12 p-10 bg-slate-950 flex flex-col relative border-l border-slate-800">
                        <div className="mb-6">
                            <h3 className="text-3xl font-serif text-amber-500 mb-2 uppercase tracking-widest">Prueba de Valor</h3>
                            <p className="text-slate-400 text-sm italic">"Demuestra tu fuerza eliminando a las bestias que amenazan nuestras tierras."</p>
                        </div>

                        <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                            {reqs.map((req, idx) => {
                                const key = req.target_id || req.type;
                                const current = progressData[key] || 0;
                                const reqComplete = current >= req.count;
                                const pct = Math.min((current / req.count) * 100, 100);
                                const label = req.name || (key === 'kill' ? 'Enemigos derrotados' : key);

                                return (
                                    <div key={idx} className={`p-4 rounded border transition-colors ${reqComplete ? 'bg-green-900/20 border-green-700/50' : 'bg-slate-900 border-slate-800'}`}>
                                        <div className="flex justify-between text-sm mb-2">
                                            <span className={`font-bold flex items-center gap-2 uppercase tracking-wide ${reqComplete ? 'text-green-400' : 'text-slate-300'}`}>
                                                {reqComplete ? <CheckCircle size={16}/> : <Skull size={16}/>} {label}
                                            </span>
                                            <span className="font-mono text-white font-bold">{current} / {req.count}</span>
                                        </div>
                                        <div className="h-3 bg-black rounded-full overflow-hidden border border-slate-700">
                                            <div className={`h-full transition-all duration-1000 ease-out ${reqComplete ? 'bg-green-500' : 'bg-amber-600'}`} style={{ width: `${pct}%` }}></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Botón Final */}
                        <div className="mt-8 pt-6 border-t border-slate-800 space-y-3">
                            <button 
                                onClick={handleFinishEvolution} 
                                disabled={!isComplete} 
                                className={`w-full py-5 font-black uppercase tracking-[0.2em] rounded shadow-lg transition-all
                                ${isComplete 
                                    ? 'bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 text-black animate-pulse hover:scale-[1.02] cursor-pointer shadow-[0_0_30px_rgba(245,158,11,0.5)]' 
                                    : 'bg-slate-800 text-slate-600 border border-slate-700 cursor-not-allowed opacity-50'}`}
                            >
                                {isComplete ? '¡Reclamar Evolución!' : 'Objetivos Incompletos'}
                            </button>
                            {targetClass && quest?.quest_min_level === 10 && (
                                <button
                                    onClick={handleReconsiderClick}
                                    className="w-full py-3 border border-slate-700 text-slate-400 font-bold uppercase text-xs rounded hover:bg-slate-800 hover:text-amber-400 transition-all tracking-widest flex items-center justify-center gap-2"
                                >
                                    <RotateCcw size={14} /> Reconsiderar Senda
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 p-4">
            <div className="relative w-full max-w-5xl min-h-[400px] max-h-[calc(100vh-96px)] bg-slate-950 border-2 border-amber-700 rounded-xl flex flex-col shadow-[0_0_60px_rgba(245,158,11,0.15)] overflow-hidden">
                <button onClick={onClose} className="absolute top-3 right-3 z-50 text-slate-400 hover:text-white p-2 bg-black/70 rounded-full hover:bg-red-900/70 transition-colors border border-slate-700">
                    <X size={20} />
                </button>
                
                <div className="flex-1 flex flex-col min-h-0 relative overflow-y-auto">
                    {renderContent()}
                </div>
            </div>

            {customAlert && (
                <div className="absolute inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setCustomAlert(null)}>
                    <div className={`p-8 rounded-xl border-2 text-center max-w-md bg-slate-900 shadow-2xl animate-in zoom-in ${customAlert.type === 'success' ? 'border-green-500' : 'border-red-500'}`} onClick={e => e.stopPropagation()}>
                        <div className="flex justify-center mb-4">
                            {customAlert.type === 'success' ? <Award size={48} className="text-green-500" /> : <AlertTriangle size={48} className="text-red-500" />}
                        </div>
                        <h3 className={`text-2xl font-bold mb-2 uppercase tracking-widest ${customAlert.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>{customAlert.type === 'success' ? '¡Gloria!' : 'Error'}</h3>
                        <p className="text-slate-300 mb-6 font-serif text-lg">{customAlert.msg}</p>
                        <button onClick={() => setCustomAlert(null)} className="px-8 py-2 bg-slate-800 rounded border border-slate-700 text-white font-bold uppercase hover:bg-slate-700 transition-colors">Continuar</button>
                    </div>
                </div>
            )}

            <ConfirmModal
                open={showReconsiderConfirm}
                title="Reconsiderar senda"
                message="¿Estás seguro de reconsiderar tu senda? Perderás el progreso de esta prueba, pero podrás escoger otra rama antes de completar tu primera evolución."
                confirmText="Reconsiderar"
                cancelText="Volver"
                variant="warning"
                onConfirm={executeReconsider}
                onCancel={() => setShowReconsiderConfirm(false)}
            />
        </div>
    );
};

export default EvolutionModal;