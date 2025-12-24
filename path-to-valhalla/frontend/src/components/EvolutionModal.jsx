import React, { useEffect, useState } from 'react';
import { X, ChevronRight, Award, Shield, Sword, Zap, CheckCircle, Scroll, Skull, AlertTriangle } from 'lucide-react';
import { apiUrl } from '../constants/api';

const EvolutionModal = ({ user, status, activeQuestData, onClose, onEvolveSuccess }) => {
    // Si status es 'in_progress', empezamos directo en el paso de visualización
    const [step, setStep] = useState(status === 'in_progress' ? 10 : 0); 
    
    const [options, setOptions] = useState([]);
    const [selectedOption, setSelectedOption] = useState(null);
    const [questPreview, setQuestPreview] = useState(null);
    const [error, setError] = useState(null);
    const [customAlert, setCustomAlert] = useState(null); // Alerta bonita

    // Cargar opciones SOLO si estamos en modo selección (CON FIX DE CACHÉ)
    useEffect(() => {
        if (status === 'available') {
            fetch(apiUrl(`/api/evolution/options?t=${Date.now()}`), {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            })
            .then(res => res.json())
            .then(data => {
                if (data.available) {
                    setOptions(data.options);
                    setStep(1); // Intro Odín
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
                // En lugar de cerrar, recargamos la página o cambiamos estado local para mostrar progreso
                // Por simplicidad y seguridad, cerramos para que el dashboard actualice el botón
                setCustomAlert({ type: 'success', msg: "Destino Aceptado. Revisa tu progreso aquí mismo." });
                setTimeout(() => {
                    window.location.reload(); // Forzar actualización completa del estado
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
                // Actualizar usuario en App
                fetch(apiUrl('/api/auth/profile'), { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
                    .then(r => r.json()).then(d => {
                        onEvolveSuccess(d.user); 
                    });
            } else {
                setCustomAlert({ type: 'error', msg: data.message });
            }
        } catch (e) { setCustomAlert({ type: 'error', msg: "Error al evolucionar." }); }
    };

    // --- RENDERIZADO ---

    // 1. VISTA DE ODÍN (Selección) - Igual que antes
    const renderOdinFlow = () => (
        <div className="h-full flex flex-col relative z-10">
            {step === 1 && (
                <div className="flex flex-col items-center justify-center h-full animate-in fade-in zoom-in">
                    <img src="/npcs/odin.png" className="w-48 h-48 rounded-full border-4 border-amber-500 shadow-[0_0_50px_rgba(245,158,11,0.5)] mb-6 bg-slate-900 object-cover" />
                    <div className="bg-slate-900/90 border-2 border-amber-600 p-6 rounded-xl max-w-2xl text-center relative shadow-2xl">
                        <p className="text-xl font-serif italic text-slate-200">"Oh mortal, tu persistencia te ha traído aquí. Elige tu destino."</p>
                    </div>
                    <button onClick={() => setStep(2)} className="mt-8 px-8 py-3 bg-amber-700 hover:bg-amber-600 text-white font-bold rounded uppercase tracking-widest shadow-lg flex items-center gap-2 animate-bounce">Siguiente <ChevronRight /></button>
                </div>
            )}
            
            {step === 2 && (
                <div className="h-full flex flex-col">
                    <h2 className="text-3xl text-center text-amber-500 font-serif mb-4 uppercase tracking-widest">Escoge tu Senda</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full pb-4 overflow-y-auto">
                        {options.map((opt) => (
                            <div key={opt.id} onClick={() => { setSelectedOption(opt); setStep(3); }} className="relative group cursor-pointer rounded-xl border-2 border-slate-700 hover:border-amber-500 bg-slate-900 overflow-hidden flex flex-col transition-all hover:scale-[1.02]">
                                <img src={getClassImage(opt.image_url)} className="h-64 w-full object-cover object-top opacity-80 group-hover:opacity-100 transition-opacity" />
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
                                <div className="p-4 relative z-10 mt-auto">
                                    <h3 className="text-2xl font-black text-white uppercase italic">{opt.name}</h3>
                                    <p className="text-slate-300 text-xs italic font-serif mt-2">"{opt.description}"</p>
                                    <div className="w-full py-2 bg-amber-900/20 border border-amber-900/50 rounded text-center text-amber-500 font-bold uppercase text-xs mt-4 group-hover:bg-amber-600 group-hover:text-white transition-colors">Seleccionar Senda</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {step === 3 && selectedOption && (
                <div className="h-full flex items-center justify-center animate-in slide-in-from-right">
                    <div className="max-w-4xl w-full bg-slate-900 border-2 border-amber-600 rounded-xl overflow-hidden shadow-2xl flex flex-col md:flex-row">
                        <div className="w-full md:w-1/2 relative h-64 md:h-auto">
                            <img src={getClassImage(selectedOption.image_url)} className="w-full h-full object-cover object-top" />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><h3 className="text-3xl font-black text-white uppercase tracking-widest drop-shadow-lg px-4 text-center">{selectedOption.name}</h3></div>
                        </div>
                        <div className="p-8 w-full md:w-1/2 bg-black/60 flex flex-col justify-between">
                            <div>
                                <h4 className="text-amber-500 font-bold uppercase tracking-widest mb-2 flex items-center gap-2"><Scroll size={20} /> Desafío Divino</h4>
                                <p className="text-slate-300 italic mb-4 text-sm">"Para obtener este poder, tráeme las cabezas de mis enemigos."</p>
                                <div className="bg-slate-800/50 p-4 rounded-lg border-l-4 border-red-500 mb-6 space-y-2">
                                    <div className="flex justify-between text-sm text-red-300 font-mono border-b border-white/5 pb-1"><span>• Lobo de Tundra</span><span className="font-bold">x10</span></div>
                                    <div className="flex justify-between text-sm text-red-300 font-mono border-b border-white/5 pb-1"><span>• Rata Escarcha</span><span className="font-bold">x10</span></div>
                                    <div className="flex justify-between text-sm text-red-300 font-mono border-b border-white/5 pb-1"><span>• Esqueleto Vikingo</span><span className="font-bold">x1</span></div>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <button onClick={() => setStep(2)} className="flex-1 py-3 border border-slate-600 text-slate-400 font-bold uppercase hover:bg-slate-800 rounded">Volver</button>
                                <button onClick={handleAcceptQuest} className="flex-1 py-3 bg-gradient-to-r from-red-700 to-orange-700 text-white font-bold uppercase shadow-lg hover:scale-105 transition-transform rounded border border-orange-500">Aceptar Desafío</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    // 2. VISTA DE PROGRESO (Cuando ya tienes la misión)
    const renderProgressFlow = () => {
        if (!activeQuestData) return <div>Cargando destino...</div>;
        const { quest, targetClass } = activeQuestData;
        
        // Calcular si está completo
        let isComplete = true;
        quest.requirements.forEach(req => {
            const current = quest.progress?.[req.target_id] || 0;
            if (current < req.count) isComplete = false;
        });

        return (
            <div className="h-full flex items-center justify-center animate-in zoom-in">
                <div className="max-w-5xl w-full bg-slate-900 border-2 border-amber-600 rounded-xl overflow-hidden shadow-[0_0_50px_rgba(245,158,11,0.2)] flex flex-col md:flex-row h-[500px]">
                    
                    {/* Panel Izquierdo: Tu Futuro */}
                    <div className="w-full md:w-5/12 relative bg-black">
                        <img src={getClassImage(targetClass?.image_url)} className="w-full h-full object-cover object-top opacity-70" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
                        <div className="absolute bottom-8 left-0 right-0 text-center">
                            <p className="text-amber-500 text-xs font-bold uppercase tracking-widest mb-1">Destino Elegido</p>
                            <h3 className="text-3xl font-black text-white uppercase tracking-wider">{targetClass?.name || "Guerrero"}</h3>
                        </div>
                    </div>

                    {/* Panel Derecho: Progreso */}
                    <div className="w-full md:w-7/12 p-8 bg-slate-950 flex flex-col relative">
                        <h3 className="text-2xl font-serif text-amber-500 mb-2">Prueba de Valor</h3>
                        <p className="text-slate-400 text-sm italic mb-6">"Demuestra tu fuerza eliminando a las bestias que amenazan nuestras tierras."</p>

                        <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                            {quest.requirements.map((req, idx) => {
                                const current = quest.progress?.[req.target_id] || 0;
                                const reqComplete = current >= req.count;
                                const pct = Math.min((current / req.count) * 100, 100);

                                return (
                                    <div key={idx} className="bg-slate-900 p-3 rounded border border-slate-800">
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className={`font-bold flex items-center gap-2 ${reqComplete ? 'text-green-400' : 'text-slate-300'}`}>
                                                {reqComplete ? <CheckCircle size={14}/> : <Skull size={14}/>} {req.name}
                                            </span>
                                            <span className="font-mono text-slate-400">{current} / {req.count}</span>
                                        </div>
                                        <div className="h-2 bg-black rounded-full overflow-hidden border border-slate-700">
                                            <div className={`h-full transition-all duration-700 ${reqComplete ? 'bg-green-500' : 'bg-amber-600'}`} style={{ width: `${pct}%` }}></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Botón Final */}
                        <div className="mt-6 pt-6 border-t border-slate-800">
                            {/* BOTÓN DESACTIVADO SI NO ESTÁ COMPLETO */}
                            <button onClick={handleFinishEvolution} disabled={!isComplete} className={`w-full py-4 font-black uppercase tracking-widest rounded shadow-lg transition-all ${isComplete ? 'bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 text-black animate-pulse hover:scale-[1.02] cursor-pointer' : 'bg-slate-800 text-slate-600 border border-slate-700 cursor-not-allowed'}`}>
                                {isComplete ? '¡Reclamar Evolución!' : 'Objetivos Incompletos'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-md p-4">
            <div className="absolute inset-0 bg-[url('/backgrounds/valhalla_stars.png')] opacity-20 pointer-events-none"></div>
            
            <div className="bg-slate-950 border border-amber-900/50 rounded-lg max-w-6xl w-full h-[90vh] flex flex-col shadow-[0_0_100px_rgba(245,158,11,0.1)] relative overflow-hidden">
                <button onClick={onClose} className="absolute top-4 right-4 z-50 text-slate-500 hover:text-white p-2 bg-black/50 rounded-full"><X size={24} /></button>
                
                <div className="flex-1 p-6 relative z-10">
                    {step === 10 ? renderProgressFlow() : renderOdinFlow()}
                </div>
            </div>

            {/* Custom Alert Overlay */}
            {customAlert && (
                <div className="absolute inset-0 z-[300] flex items-center justify-center bg-black/80">
                    <div className={`p-8 rounded-xl border-2 text-center max-w-md bg-slate-900 shadow-2xl animate-in zoom-in ${customAlert.type === 'success' ? 'border-green-500' : 'border-red-500'}`}>
                        <h3 className={`text-2xl font-bold mb-2 ${customAlert.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>{customAlert.type === 'success' ? '¡Éxito!' : 'Error'}</h3>
                        <p className="text-white mb-6">{customAlert.msg}</p>
                        <button onClick={() => setCustomAlert(null)} className="px-6 py-2 bg-slate-800 rounded border border-slate-700 text-white font-bold uppercase">Entendido</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EvolutionModal;