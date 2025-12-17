import React, { useState, useEffect, useRef } from 'react';
import { Sword, Shield, Zap, Skull, Trophy, ArrowLeft, Lock, Heart } from 'lucide-react';
// IMPORTAMOS TUS CONSTANTES DE RAZA PARA MOSTRAR LA IMAGEN CORRECTA
import { RACES } from '../constants/races'; 

const Expeditions = ({ user, onUpdateUser }) => {
    // ESTADOS
    const [view, setView] = useState('MAP'); 
    const [selectedZone, setSelectedZone] = useState(null);
    const [zones, setZones] = useState([]);
    const [enemies, setEnemies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [battleResult, setBattleResult] = useState(null);
    const [isBattling, setIsBattling] = useState(false);

    // CARGAR MAPA
    useEffect(() => {
        fetch('http://localhost:3000/api/expeditions', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) setZones(data.expeditions);
            setLoading(false);
        })
        .catch(err => console.error(err));
    }, []);

    // SELECCIONAR ZONA
    const handleSelectZone = (zone) => {
        if (user.level < zone.level_req) return;
        setSelectedZone(zone);
        setLoading(true);

        fetch(`http://localhost:3000/api/expeditions/${zone.id}/enemies`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                setEnemies(data.enemies);
                setView('ENEMIES');
            }
            setLoading(false);
        })
        .catch(err => { console.error(err); setLoading(false); });
    };

    // ATAQUE
    const handleAttack = async (enemy) => {
        if (user.energy < 5) { alert("¡Necesitas 5 de Energía!"); return; }
        if (user.current_hp <= 5) { alert("¡Estás muy herido!"); return; }

        setIsBattling(true);

        try {
            const res = await fetch('http://localhost:3000/api/expeditions/start', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ 
                    userId: user.id, 
                    enemyId: enemy.id, 
                    zoneId: selectedZone.id 
                })
            });

            const data = await res.json();

            if (data.success) {
                setBattleResult(data.combatResult);
                setView('BATTLE');
                
                // Actualizar datos del usuario en segundo plano
                fetch('http://localhost:3000/api/auth/profile', {
                     headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                }).then(r=>r.json()).then(d=> { if(d.user) onUpdateUser(d.user); });
            } else {
                alert(data.message);
            }
        } catch (error) {
            console.error(error);
            alert("Error de conexión.");
        } finally {
            setIsBattling(false);
        }
    };

    const handleBackToMap = () => {
        setView('MAP');
        setSelectedZone(null);
        setEnemies([]);
    };

    // Helper para obtener la imagen correcta del jugador desde races.js
    const getPlayerImage = () => {
        if (!user || !user.race) return null;
        // Buscamos la raza en el archivo de constantes
        const raceConfig = RACES.find(r => r.id === user.race);
        if (raceConfig && raceConfig.images) {
            return raceConfig.images[user.gender] || raceConfig.images.male;
        }
        return null;
    };

    if (loading && view === 'MAP') return <div className="text-center mt-20 text-slate-500 animate-pulse">Cargando mapa...</div>;

    return (
        <div className="h-full relative overflow-hidden">
            {/* VISTA 1: MAPA */}
            {view === 'MAP' && (
                <div className="p-6 h-full overflow-y-auto pb-20 custom-scrollbar">
                    <h2 className="text-3xl font-serif text-amber-500 mb-6 border-b border-amber-900/30 pb-2 flex items-center gap-3">
                        <Sword size={32} /> Mapa de Expediciones
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {zones.map(zone => {
                            const isLocked = user.level < zone.level_req;
                            return (
                                <div key={zone.id} onClick={() => handleSelectZone(zone)} className={`relative group border-2 rounded-xl overflow-hidden transition-all h-48 cursor-pointer ${isLocked ? 'border-red-900/30 grayscale opacity-60' : 'border-slate-700 hover:border-amber-500 hover:scale-[1.02] shadow-lg'}`}>
                                    <img src={zone.image_url} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                                    <div className="absolute bottom-0 left-0 p-4">
                                        <h3 className="text-xl font-bold text-white drop-shadow-md flex items-center gap-2">
                                            {zone.name} {isLocked && <Lock size={16} className="text-red-500" />}
                                        </h3>
                                        <p className="text-xs text-slate-300">Nivel Req: <span className={isLocked ? "text-red-400 font-bold" : "text-green-400 font-bold"}>{zone.level_req}</span></p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* VISTA 2: ENEMIGOS */}
            {view === 'ENEMIES' && selectedZone && (
                <div className="h-full flex flex-col relative">
                    <div className="absolute inset-0 z-0">
                        <img src={selectedZone.image_url} className="w-full h-full object-cover opacity-30 blur-sm" />
                        <div className="absolute inset-0 bg-slate-950/80" />
                    </div>
                    <div className="relative z-10 p-6 flex flex-col h-full overflow-y-auto custom-scrollbar">
                        <button onClick={handleBackToMap} className="self-start mb-4 flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
                            <ArrowLeft size={20} /> Volver al Mapa
                        </button>
                        <h2 className="text-3xl font-serif text-amber-500 mb-8 text-center drop-shadow-lg">
                            {selectedZone.name}
                        </h2>
                        {loading ? <div className="text-center text-slate-400">Explorando zona...</div> : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 px-4 pb-20">
                                {enemies.map((enemy) => (
                                    <EnemyCard key={enemy.id} enemy={enemy} user={user} onAttack={() => handleAttack(enemy)} disabled={isBattling} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* VISTA 3: BATALLA */}
            {view === 'BATTLE' && battleResult && (
                <BattleModal 
                    result={battleResult} 
                    user={user}
                    playerImage={getPlayerImage()} // Pasamos la imagen correcta aquí
                    onClose={() => { setView('ENEMIES'); setBattleResult(null); }} 
                />
            )}
        </div>
    );
};

// Componente Carta de Enemigo
const EnemyCard = ({ enemy, user, onAttack, disabled }) => {
    const levelDiff = enemy.min_level - user.level;
    let difficultyColor = "text-green-400";
    if (levelDiff > 2) difficultyColor = "text-red-500";
    else if (levelDiff >= 0) difficultyColor = "text-yellow-400";

    return (
        <div className={`relative bg-slate-900 border transition-all group overflow-hidden flex flex-col ${enemy.is_boss ? 'border-red-600/60 shadow-[0_0_20px_rgba(220,38,38,0.3)]' : 'border-slate-700 hover:border-amber-500'} rounded-xl`}>
            {enemy.is_boss && <div className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg z-20 shadow-md">JEFE</div>}
            <div className="h-40 overflow-hidden relative bg-black/50">
                <img 
                    src={enemy.image_url} 
                    alt={enemy.name} 
                    className="w-full h-full object-contain p-2 group-hover:scale-110 transition-transform duration-500" 
                    onError={(e) => {
                        e.target.onerror = null; 
                        e.target.src = "https://via.placeholder.com/150?text=Monstruo"; // Fallback por si la imagen no carga
                    }} 
                />
            </div>
            <div className="p-4 flex-1 flex flex-col">
                <h3 className={`font-bold text-lg leading-tight mb-1 ${enemy.is_boss ? 'text-red-400' : 'text-slate-200'}`}>{enemy.name}</h3>
                <div className="text-xs text-slate-500 mb-4 flex justify-between">
                    <span>Nvl {enemy.min_level}-{enemy.max_level}</span>
                    <span className={difficultyColor}>{levelDiff > 2 ? 'Mortal' : levelDiff >= 0 ? 'Difícil' : 'Fácil'}</span>
                </div>
                <div className="mt-auto">
                    <button onClick={onAttack} disabled={disabled} className={`w-full py-2 rounded font-bold uppercase text-xs tracking-wider flex items-center justify-center gap-2 transition-all ${disabled ? 'bg-slate-800 text-slate-600 cursor-wait' : 'bg-amber-700 hover:bg-amber-600 text-white shadow-lg'}`}>
                        {disabled ? '...' : <><Sword size={14} /> Atacar (5E)</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Componente Modal de Batalla
const BattleModal = ({ result, onClose, user, playerImage }) => {
    const [visibleLines, setVisibleLines] = useState([]);
    const [isFinished, setIsFinished] = useState(false);
    const scrollRef = useRef(null);

    // Efecto Máquina de Escribir (CORREGIDO Y BLINDADO)
    useEffect(() => {
        let currentLine = 0;
        const fullLog = result.log || []; // Protección contra null

        const interval = setInterval(() => {
            if (currentLine < fullLog.length) {
                const lineToAdd = fullLog[currentLine];
                // Verificar que la línea existe antes de agregarla (Evita el crash)
                if (lineToAdd) {
                    setVisibleLines(prev => [...prev, lineToAdd]);
                }
                currentLine++;
                // Auto-scroll
                if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            } else {
                setIsFinished(true);
                clearInterval(interval);
            }
        }, 500); // Velocidad: 0.5s por línea

        return () => clearInterval(interval);
    }, [result]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-lg shadow-2xl flex flex-col max-h-[85vh]">
                
                {/* CABECERA BATALLA */}
                <div className="flex items-center justify-between p-4 bg-black/40 border-b border-slate-800 shrink-0">
                    {/* JUGADOR */}
                    <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-full bg-slate-800 border-2 border-amber-500 overflow-hidden shadow-[0_0_15px_rgba(245,158,11,0.3)]">
                            {playerImage ? (
                                <img src={playerImage} className="w-full h-full object-cover" alt="Hero" />
                            ) : (
                                <div className="w-full h-full bg-amber-900/50 flex items-center justify-center text-amber-500 font-bold text-2xl">
                                    {user.username.charAt(0).toUpperCase()}
                                </div>
                            )}
                        </div>
                        <div>
                            <div className="text-sm font-bold text-amber-500">{user.username}</div>
                            <div className="text-xs text-slate-400">HP: {result.finalPlayerHp}</div>
                        </div>
                    </div>

                    <div className="text-slate-600 font-bold italic text-xl">VS</div>

                    {/* ENEMIGO */}
                    <div className="flex items-center gap-3 text-right">
                        <div>
                            <div className="text-sm font-bold text-red-400">{result.enemyName}</div>
                            <div className="text-xs text-slate-500">Enemigo</div>
                        </div>
                        <div className="w-14 h-14 rounded-full bg-slate-800 border-2 border-red-900 overflow-hidden shadow-[0_0_15px_rgba(220,38,38,0.3)]">
                            <img 
                                src={result.enemyImage} 
                                className="w-full h-full object-cover" 
                                alt="Enemy" 
                                onError={(e)=>{e.target.src="https://via.placeholder.com/64?text=?"}} 
                            />
                        </div>
                    </div>
                </div>

                {/* LOG */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-xs md:text-sm bg-slate-950/50">
                    {visibleLines.map((line, idx) => {
                        // --- PROTECCIÓN CRÍTICA ---
                        if (!line) return null; 
                        
                        return (
                            <div key={idx} className={`py-1 px-2 rounded animate-in slide-in-from-left-2 duration-300 ${getLogStyle(line.type)}`}>
                                {line.text || line.msg}
                            </div>
                        );
                    })}
                    
                    {isFinished && (
                        <div className="mt-6 p-4 text-center border-t border-slate-800 animate-in zoom-in duration-500 bg-black/20">
                            {result.isWin ? (
                                <div className="text-green-400 font-bold text-xl uppercase tracking-widest flex flex-col items-center gap-2">
                                    <Trophy size={40} className="text-yellow-400 drop-shadow-lg" /> ¡VICTORIA!
                                </div>
                            ) : (
                                <div className="text-red-500 font-bold text-xl uppercase tracking-widest flex flex-col items-center gap-2">
                                    <Skull size={40} className="text-red-600 drop-shadow-lg" /> DERROTA
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* FOOTER */}
                {isFinished && (
                    <div className="p-4 bg-slate-900 border-t border-slate-700 shrink-0 animate-in slide-in-from-bottom duration-500">
                        {result.isWin && (
                            <div className="mb-4">
                                <h4 className="text-xs text-amber-500 uppercase font-bold mb-2">Recompensas:</h4>
                                <div className="flex flex-wrap gap-2">
                                    <span className="bg-slate-800 px-3 py-1 rounded text-xs text-purple-300 border border-slate-700">
                                        +{result.rewards.xp} XP
                                    </span>
                                    <span className="bg-slate-800 px-3 py-1 rounded text-xs text-yellow-300 border border-slate-700">
                                        +{result.rewards.copper} Cobre
                                    </span>
                                    {result.rewards.items && result.rewards.items.map((item, i) => (
                                        <span key={i} className="bg-slate-800 px-3 py-1 rounded text-xs text-white border border-slate-600 flex items-center gap-1">
                                            <div className="w-2 h-2 rounded-full bg-green-500"></div> {item.qty}x {item.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                        <button onClick={onClose} className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold uppercase rounded transition-colors shadow-lg border border-amber-400">
                            {result.isWin ? 'Recoger Botín' : 'Huir'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

const getLogStyle = (type) => {
    switch (type) {
        case 'round': return "text-slate-500 font-bold border-b border-slate-800 mt-2 mb-1";
        case 'player_atk': return "text-blue-300 bg-blue-900/10 border-l-2 border-blue-500";
        case 'enemy_atk': return "text-red-300 bg-red-900/10 border-l-2 border-red-500";
        case 'info': return "text-yellow-500 italic text-[10px] opacity-80";
        default: return "text-slate-300";
    }
};

export default Expeditions;