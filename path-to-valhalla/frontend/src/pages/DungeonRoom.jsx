import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Users, Shield, Swords, ArrowLeft, Check, X, Play, Skull, Trophy, Loader, ChevronRight, Heart, Zap, User, Plus, LogOut, Ban, Bot } from 'lucide-react';
import { apiUrl } from '../constants/api';

const DIFFICULTY_COLORS = {
    easy: 'text-green-400 border-green-700 bg-green-950/40',
    normal: 'text-yellow-400 border-yellow-700 bg-yellow-950/40',
    hard: 'text-orange-400 border-orange-700 bg-orange-950/40',
    inferno: 'text-red-400 border-red-700 bg-red-950/40'
};

const DIFFICULTY_LABELS = { easy: 'Fácil', normal: 'Normal', hard: 'Difícil', inferno: 'Inferno' };

const NPC_TEMPLATES = [
    { name: 'Tanque Mercenario', role: 'Tanque', icon: '🛡️', power: 850 },
    { name: 'Sanadora Rúnica', role: 'Sanadora', icon: '💚', power: 720 },
    { name: 'Arquero Fantasma', role: 'DPS', icon: '🏹', power: 780 },
    { name: 'Mago de Hueso', role: 'DPS', icon: '🔮', power: 810 },
    { name: 'Guardia Esquelético', role: 'Tanque', icon: '⚔️', power: 760 }
];

const SlotCard = ({ member, index, isMaster, isMe, userLevel, onToggleReady, myMember, onClickMember }) => {
    const empty = !member;
    const isNpc = member?.is_npc;
    const npcIndex = member?.npc_level ? (member.id % NPC_TEMPLATES.length) : index % NPC_TEMPLATES.length;
    const npcInfo = NPC_TEMPLATES[npcIndex] || NPC_TEMPLATES[0];

    if (empty) {
        return (
            <div className="flex flex-col items-center justify-center p-4 bg-slate-800/20 border border-dashed border-slate-700/30 rounded-xl min-h-[120px]">
                <div className="w-10 h-10 rounded-full bg-slate-800/40 border border-slate-700/30 flex items-center justify-center mb-2">
                    <Plus className="w-5 h-5 text-slate-600" />
                </div>
                <p className="text-xs text-slate-600">Slot vacío</p>
            </div>
        );
    }

    if (isNpc) {
        return (
            <div className="flex flex-col items-center p-4 bg-slate-800/30 border border-slate-700/20 rounded-xl min-h-[120px]">
                <div className="w-10 h-10 rounded-full bg-slate-700/50 border border-slate-600/30 flex items-center justify-center mb-2 text-lg">
                    {npcInfo.icon}
                </div>
                <p className="text-xs font-semibold text-slate-300 text-center">{npcInfo.name}</p>
                <p className="text-[10px] text-slate-500">{npcInfo.role} — Nv.{member.npc_level || '?'}</p>
                <p className="text-[10px] text-amber-400/70">Poder {npcInfo.power + (member.npc_level || 0) * 10}</p>
                <span className="mt-1 px-2 py-0.5 bg-slate-700/40 rounded text-[10px] text-slate-400 font-mono">NPC</span>
            </div>
        );
    }

    return (
        <div
            className={`flex flex-col items-center p-4 rounded-xl min-h-[120px] cursor-pointer transition-colors ${
                member.is_ready
                    ? 'bg-emerald-900/15 border border-emerald-700/30'
                    : 'bg-slate-800/40 border border-slate-700/30'
            } ${member.status === 'dead' ? 'opacity-50 bg-red-900/20 border-red-800/30' : ''}`}
            onClick={() => onClickMember(member)}
        >
            <div className="w-10 h-10 rounded-full bg-amber-900/50 border border-amber-700/30 flex items-center justify-center mb-2 text-sm font-bold text-amber-300">
                {member.username?.[0] || '?'}
            </div>
            <p className="text-xs font-semibold text-slate-200 text-center truncate max-w-full">
                {member.username || `Jugador`}
                {member.is_master && <span className="text-[10px] text-amber-500 ml-1">(M)</span>}
            </p>
            <p className="text-[10px] text-slate-500">Nv.{member.player_level || userLevel || '?'}</p>
            {member.is_ready && <span className="mt-1 px-2 py-0.5 bg-emerald-800/30 border border-emerald-700/40 rounded text-[10px] text-emerald-300 font-mono">Listo</span>}
            {!member.is_ready && isMe && (
                <button
                    onClick={(e) => { e.stopPropagation(); onToggleReady(); }}
                    className="mt-1 px-2 py-0.5 bg-slate-800 border border-slate-600 rounded text-[10px] text-slate-400 hover:text-slate-200"
                >
                    Marcar listo
                </button>
            )}
            {!member.is_ready && !isMe && (
                <span className="mt-1 px-2 py-0.5 bg-slate-800/40 rounded text-[10px] text-slate-500">Esperando...</span>
            )}
            {member.status === 'dead' && <span className="mt-1 text-[10px] text-red-400 font-bold">MUERTO</span>}
        </div>
    );
};

const MemberDetail = ({ member, onClose }) => {
    if (!member || member.is_npc) return null;
    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-amber-900/50 border border-amber-700/30 flex items-center justify-center text-lg font-bold text-amber-300">
                        {member.username?.[0] || '?'}
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-amber-100">{member.username}</h3>
                        {member.is_master && <span className="text-xs text-amber-500">Maestro de sala</span>}
                    </div>
                </div>
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between py-1 border-b border-slate-700/30">
                        <span className="text-slate-400">Nivel</span>
                        <span className="text-slate-200 font-semibold">{member.player_level || '?'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-700/30">
                        <span className="text-slate-400">Estado</span>
                        <span className={member.is_ready ? 'text-emerald-400' : 'text-slate-400'}>{member.is_ready ? 'Listo' : 'Esperando'}</span>
                    </div>
                </div>
                <button onClick={onClose} className="w-full mt-4 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg border border-slate-600 transition-colors">
                    Cerrar
                </button>
            </div>
        </div>
    );
};

const DungeonRoom = ({ user }) => {
    const { code: paramCode } = useParams();
    const navigate = useNavigate();
    const [room, setRoom] = useState(null);
    const [run, setRun] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [combatResult, setCombatResult] = useState(null);
    const [combatLoading, setCombatLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('log');
    const [showTransition, setShowTransition] = useState(false);
    const [selectedMember, setSelectedMember] = useState(null);
    const pollingRef = useRef(null);

    const effectiveCode = paramCode;

    const fetchRoom = useCallback(async () => {
        if (!effectiveCode) return;
        setError(null);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(apiUrl(`/api/dungeons/rooms/${effectiveCode}`), {
                headers: { 'x-auth-token': token }
            });
            const data = await res.json();
            if (data.success) {
                setRoom(data.room);
                if (data.room.status === 'in_progress' || data.room.status === 'completed' || data.room.status === 'failed') {
                    fetchRunState(data.room);
                }
            } else {
                setError(data.message || 'Sala no encontrada.');
            }
        } catch (err) {
            setError('Error al cargar sala.');
        } finally {
            setLoading(false);
        }
    }, [effectiveCode]);

    const fetchRunState = async (roomData) => {
        try {
            const token = localStorage.getItem('token');
            const roomId = roomData?.id || room?.id;
            const runRes = await fetch(apiUrl('/api/dungeons/my-runs'), {
                headers: { 'x-auth-token': token }
            });
            const runData = await runRes.json();
            if (runData.success && runData.runs.length > 0) {
                const activeRun = runData.runs.find(r => r.room_id === roomId);
                if (activeRun) {
                    const detailRes = await fetch(apiUrl(`/api/dungeons/runs/${activeRun.id}`), {
                        headers: { 'x-auth-token': token }
                    });
                    const detailData = await detailRes.json();
                    if (detailData.success) {
                        setRun(detailData.run);
                        setCombatResult(detailData);
                    }
                }
            }
        } catch (err) {
            console.error('Error fetching run state:', err);
        }
    };

    useEffect(() => {
        fetchRoom();
    }, [fetchRoom]);

    useEffect(() => {
        if (room && ['waiting', 'ready', 'in_progress', 'resting'].includes(room.status)) {
            pollingRef.current = setInterval(() => {
                fetchRoom();
            }, 3000);
        }
        return () => {
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
        };
    }, [room?.status, fetchRoom]);

    const handleToggleReady = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(apiUrl(`/api/dungeons/rooms/${effectiveCode}/ready`), {
                method: 'POST',
                headers: { 'x-auth-token': token }
            });
            const data = await res.json();
            if (data.success) setRoom(data.room);
        } catch (err) { console.error(err); }
    };

    const handleLeave = async () => {
        try {
            const token = localStorage.getItem('token');
            await fetch(apiUrl(`/api/dungeons/rooms/${effectiveCode}/leave`), {
                method: 'POST',
                headers: { 'x-auth-token': token }
            });
            navigate('/dungeons');
        } catch (err) { console.error(err); }
    };

    const handleCancel = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(apiUrl(`/api/dungeons/rooms/${effectiveCode}/cancel`), {
                method: 'POST',
                headers: { 'x-auth-token': token }
            });
            const data = await res.json();
            if (data.success) {
                navigate('/dungeons');
            } else {
                setError(data.message);
            }
        } catch (err) { console.error(err); }
    };

    const handleFillNPCs = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(apiUrl(`/api/dungeons/rooms/${effectiveCode}/fill-npcs`), {
                method: 'POST',
                headers: { 'x-auth-token': token }
            });
            const data = await res.json();
            if (data.success) {
                setRoom(data.room);
            } else {
                setError(data.message);
            }
        } catch (err) { console.error(err); }
    };

    const handleStart = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(apiUrl(`/api/dungeons/rooms/${effectiveCode}/start`), {
                method: 'POST',
                headers: { 'x-auth-token': token }
            });
            const data = await res.json();
            if (data.success) {
                setShowTransition(true);
                setTimeout(() => {
                    setShowTransition(false);
                    setRun(data.run);
                    setRoom(prev => ({ ...prev, status: 'in_progress' }));
                    fetchRoom();
                }, 3000);
            } else {
                setError(data.message);
            }
        } catch (err) { console.error(err); }
    };

    const handleAdvance = async () => {
        if (!run) return;
        setCombatLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(apiUrl(`/api/dungeons/runs/${run.id}/advance`), {
                method: 'POST',
                headers: { 'x-auth-token': token }
            });
            const data = await res.json();
            if (data.success) {
                setRun(data.run);
                setCombatResult(data);
                setActiveTab('log');

                if (data.run.status === 'completed') {
                    setRoom(prev => ({ ...prev, status: 'completed' }));
                } else if (data.run.status === 'failed') {
                    setRoom(prev => ({ ...prev, status: 'failed' }));
                }
            } else {
                setError(data.message);
            }
        } catch (err) {
            setError('Error al avanzar.');
        } finally {
            setCombatLoading(false);
        }
    };

    const isMaster = room?.members?.some(m => m.is_master && m.player_id === user?.id);
    const myMember = room?.members?.find(m => m.player_id === user?.id);
    const allReady = room?.members?.filter(m => !m.is_npc).every(m => m.is_ready);
    const humanCount = room?.members?.filter(m => !m.is_npc).length || 0;
    const totalCount = room?.members?.length || 0;
    const partyFull = totalCount >= (room?.party_size || 0);
    const missingSlots = (room?.party_size || 0) - totalCount;

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="flex items-center gap-3 text-slate-400">
                    <Loader className="w-5 h-5 animate-spin text-amber-500" />
                    <span>Cargando...</span>
                </div>
            </div>
        );
    }

    if (error && !room) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
                <Shield className="w-16 h-16 text-slate-700" />
                <p className="text-slate-400">{error}</p>
                <button onClick={() => navigate('/dungeons')} className="px-4 py-2 bg-amber-700/30 text-amber-300 rounded-lg text-sm border border-amber-700/40">
                    Volver al Vestíbulo
                </button>
            </div>
        );
    }

    const slots = [];
    if (room) {
        for (let i = 0; i < room.party_size; i++) {
            slots.push(room.members[i] || null);
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-4 md:p-6">
            <div className="max-w-5xl mx-auto">
                <button onClick={() => navigate('/dungeons')} className="flex items-center gap-1.5 text-slate-400 hover:text-amber-300 text-sm mb-4 transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Volver al Vestíbulo
                </button>

                {room && room.status === 'waiting' && (
                    <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-5">
                        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                            <div>
                                <h1 className="text-xl font-bold text-amber-100">{room.dungeon_name}</h1>
                                <p className="text-xs text-slate-400 mt-1">
                                    {room.dungeon_description && <span className="text-slate-500 mr-3">{room.dungeon_description}</span>}
                                    Código: <span className="font-mono text-amber-400 font-bold tracking-widest">{room.code}</span>
                                    <span className={`ml-3 px-2 py-0.5 rounded text-[10px] font-bold border ${DIFFICULTY_COLORS[room.difficulty] || DIFFICULTY_COLORS.normal}`}>
                                        {DIFFICULTY_LABELS[room.difficulty] || room.difficulty}
                                    </span>
                                    <span className="ml-2 text-slate-500">{room.party_size} plazas</span>
                                    {room.min_level && <span className="ml-2 text-slate-500">Nv.mín {room.min_level}</span>}
                                </p>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                                {isMaster && !partyFull && (
                                    <button
                                        onClick={handleFillNPCs}
                                        className="flex items-center gap-1.5 px-3 py-2 bg-purple-700/30 hover:bg-purple-700/50 text-purple-300 text-xs font-semibold rounded-lg border border-purple-700/40 transition-colors"
                                    >
                                        <Bot className="w-3.5 h-3.5" /> Completar con NPC
                                    </button>
                                )}
                                {isMaster && (
                                    <button
                                        onClick={handleStart}
                                        disabled={!partyFull || !allReady || humanCount < 1}
                                        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700/40 hover:bg-emerald-700/60 disabled:opacity-40 disabled:cursor-not-allowed text-emerald-300 text-sm font-bold rounded-lg border border-emerald-700/50 transition-colors"
                                    >
                                        <Play className="w-4 h-4" /> Iniciar
                                    </button>
                                )}
                                {isMaster ? (
                                    <button onClick={handleCancel} className="flex items-center gap-1.5 px-3 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-300 text-sm rounded-lg border border-red-800/40 transition-colors">
                                        <Ban className="w-3.5 h-3.5" /> Cancelar Sala
                                    </button>
                                ) : (
                                    <button onClick={handleLeave} className="flex items-center gap-1.5 px-3 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-300 text-sm rounded-lg border border-red-800/40 transition-colors">
                                        <LogOut className="w-3.5 h-3.5" /> Salir de Sala
                                    </button>
                                )}
                            </div>
                        </div>

                        {error && (
                            <div className="mb-3 p-2 bg-red-950/60 border border-red-800/50 rounded text-red-300 text-xs">{error}</div>
                        )}

                        {!partyFull && (
                            <div className="mb-3 p-2 bg-amber-950/40 border border-amber-800/30 rounded text-amber-300/70 text-xs">
                                Faltan {missingSlots} miembro{missingSlots !== 1 ? 's' : ''}. {isMaster ? 'Usa "Completar con NPC" o espera jugadores.' : 'Esperando que se unan más jugadores...'}
                            </div>
                        )}

                        {partyFull && !allReady && (
                            <div className="mb-3 p-2 bg-blue-950/40 border border-blue-800/30 rounded text-blue-300/70 text-xs">
                                Todos los slots están ocupados. Esperando que todos los jugadores marquen "Listo".
                            </div>
                        )}

                        <div className="mb-4">
                            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                                Grupo ({totalCount}/{room.party_size})
                            </h2>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                                {slots.map((member, i) => (
                                    <SlotCard
                                        key={i}
                                        member={member}
                                        index={i}
                                        isMaster={isMaster}
                                        isMe={member?.player_id === user?.id}
                                        userLevel={user?.level}
                                        onToggleReady={handleToggleReady}
                                        myMember={myMember}
                                        onClickMember={setSelectedMember}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {showTransition && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                        <div className="text-center">
                            <Loader className="w-12 h-12 animate-spin text-amber-500 mx-auto mb-4" />
                            <p className="text-2xl font-bold text-amber-300">Preparando mazmorra...</p>
                            <p className="text-sm text-slate-400 mt-2">Todos los jugadores están siendo sincronizados.</p>
                        </div>
                    </div>
                )}

                {(room?.status === 'in_progress' || room?.status === 'completed' || room?.status === 'failed') && (
                    <div className="space-y-4">
                        <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-5">
                            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                                <div>
                                    <div className="flex items-center gap-3">
                                        <h1 className="text-xl font-bold text-amber-100">{room.dungeon_name}</h1>
                                        {run && (
                                            <span className="text-sm text-slate-400">
                                                Sala {run.current_room_number}/{run.total_rooms}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">
                                        Dificultad: <span className={`font-semibold ${DIFFICULTY_COLORS[room.difficulty]?.split(' ')[0]}`}>{DIFFICULTY_LABELS[room.difficulty]}</span>
                                        {room.status === 'completed' && <span className="ml-3 text-emerald-400 font-semibold">✓ Completada</span>}
                                        {room.status === 'failed' && <span className="ml-3 text-red-400 font-semibold">✗ Fallida</span>}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    {(room.status === 'completed' || room.status === 'failed') && (
                                        <button onClick={() => navigate('/dungeons')} className="flex items-center gap-1.5 px-3 py-2 bg-amber-700/30 hover:bg-amber-700/50 text-amber-300 text-sm rounded-lg border border-amber-700/40 transition-colors">
                                            Volver al Vestíbulo
                                        </button>
                                    )}
                                </div>
                            </div>

                            {error && (
                                <div className="mb-3 p-2 bg-red-950/60 border border-red-800/50 rounded text-red-300 text-xs">{error}</div>
                            )}

                            {run && (
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {Array.from({ length: run.total_rooms }, (_, i) => i + 1).map(rn => {
                                        const stage = combatResult?.stages?.find(s => s.room_number === rn);
                                        const isCurrent = rn === run.current_room_number && run.status === 'active';
                                        const isCompleted = stage?.status === 'completed';
                                        const isFailed = stage?.status === 'failed';
                                        const isBoss = rn === run.total_rooms;
                                        return (
                                            <div key={rn} className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                                                isCompleted ? 'bg-emerald-900/30 border-emerald-700/40 text-emerald-300' :
                                                isFailed ? 'bg-red-900/30 border-red-700/40 text-red-300' :
                                                isCurrent ? 'bg-amber-900/30 border-amber-700/40 text-amber-300 animate-pulse' :
                                                'bg-slate-800 border-slate-700 text-slate-500'
                                            }`}>
                                                {isCompleted ? <Check className="w-3 h-3" /> : isFailed ? <X className="w-3 h-3" /> : isBoss ? 'B' : rn}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {run?.status === 'active' && isMaster && (
                                <button
                                    onClick={handleAdvance}
                                    disabled={combatLoading}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-amber-700/40 hover:bg-amber-700/60 disabled:opacity-40 disabled:cursor-not-allowed text-amber-300 text-sm font-bold rounded-lg border border-amber-700/50 transition-colors"
                                >
                                    {combatLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Swords className="w-4 h-4" />}
                                    {combatLoading ? 'Combatiendo...' : 'Avanzar Siguiente Sala'}
                                </button>
                            )}
                            {run?.status === 'active' && !isMaster && (
                                <p className="text-xs text-slate-500 italic">Esperando a que el maestro avance la mazmorra...</p>
                            )}
                        </div>

                        {combatResult?.enemies?.length > 0 && (
                            <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4">
                                <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                                    <Skull className="w-4 h-4 text-red-400" />
                                    Enemigos {combatResult.enemies.some(e => e.is_boss) && <span className="text-[10px] text-red-400 font-bold bg-red-950/40 px-1.5 py-0.5 rounded">BOSS</span>}
                                </h2>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                    {combatResult.enemies.map(enemy => (
                                        <div key={enemy.id} className={`p-3 rounded-lg border ${
                                            !enemy.alive ? 'bg-slate-800/30 border-slate-700/20 opacity-50' :
                                            'bg-slate-800/50 border-slate-700/40'
                                        }`}>
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-xs font-semibold text-slate-200 truncate">{enemy.name}</span>
                                                {enemy.is_boss && <span className="text-[10px] text-red-400 font-bold">BOSS</span>}
                                                {enemy.is_elite && !enemy.is_boss && <span className="text-[10px] text-purple-400 font-bold">ÉLITE</span>}
                                            </div>
                                            <div className="text-[10px] text-slate-400">
                                                <span className="flex items-center gap-1">
                                                    <Heart className="w-3 h-3 text-red-400" /> {enemy.hp_current}/{enemy.hp_max}
                                                </span>
                                                {enemy.level && <span className="ml-2">Nv.{enemy.level}</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {!combatResult?.enemies?.length && run?.status === 'active' && (
                            <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4 text-center">
                                <Skull className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                                <p className="text-sm text-slate-500">Presiona "Avanzar Siguiente Sala" para enfrentar a los enemigos.</p>
                            </div>
                        )}

                        {combatResult?.members?.length > 0 && (
                            <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4">
                                <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                                    <Users className="w-4 h-4 text-amber-400" />
                                    Grupo
                                </h2>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                    {combatResult.members.map(member => (
                                        <div key={member.id} className={`p-2.5 rounded-lg border ${
                                            member.status === 'dead' ? 'bg-red-900/20 border-red-800/30 opacity-60' :
                                            'bg-slate-800/50 border-slate-700/40'
                                        }`}>
                                            <p className="text-xs font-semibold text-slate-200 truncate">
                                                {member.is_npc ? `NPC Nv.${member.npc_level}` : member.username || `Jugador`}
                                            </p>
                                            <p className="text-[10px] text-slate-400">
                                                {member.status === 'dead' ? 'Muerto' : `HP ${member.final_hp || member.initial_hp || '?'}`}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4">
                            <div className="flex items-center gap-3 mb-3">
                                <h2 className="text-sm font-semibold text-slate-300">Combate</h2>
                                <div className="flex gap-1">
                                    <button onClick={() => setActiveTab('log')} className={`px-2.5 py-1 rounded text-[10px] font-semibold border transition-colors ${activeTab === 'log' ? 'bg-amber-800/30 border-amber-700/40 text-amber-300' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>Log</button>
                                    <button onClick={() => setActiveTab('rewards')} className={`px-2.5 py-1 rounded text-[10px] font-semibold border transition-colors ${activeTab === 'rewards' ? 'bg-amber-800/30 border-amber-700/40 text-amber-300' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>Recompensas</button>
                                </div>
                            </div>

                            {activeTab === 'log' && (
                                <div className="max-h-[400px] overflow-y-auto space-y-0.5 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent font-mono text-xs">
                                    {combatResult?.log?.length > 0 ? combatResult.log.map((entry, i) => (
                                        <div key={i} className={`px-2 py-1 rounded ${
                                            entry.entry_type === 'round' ? 'text-slate-500 bg-slate-800/30' :
                                            entry.entry_type === 'player_atk' ? 'text-emerald-300' :
                                            entry.entry_type === 'skill' ? 'text-blue-300' :
                                            entry.entry_type === 'heal' ? 'text-green-300' :
                                            entry.entry_type === 'enemy_atk' ? 'text-red-300' :
                                            entry.entry_type === 'enemy_death' || entry.entry_type === 'victory' ? 'text-yellow-300 font-bold' :
                                            entry.entry_type === 'member_death' || entry.entry_type === 'defeat' ? 'text-red-400 font-bold' :
                                            entry.entry_type === 'info' ? 'text-slate-400' :
                                            'text-slate-400'
                                        }`}>
                                            {entry.message}
                                        </div>
                                    )) : (
                                        <p className="text-slate-500 text-center py-4">Sin registro de combate.</p>
                                    )}
                                </div>
                            )}

                            {activeTab === 'rewards' && (
                                <div>
                                    {combatResult?.rewards?.length > 0 ? (
                                        <div className="space-y-2">
                                            {combatResult.rewards.map((reward, i) => (
                                                <div key={i} className="p-3 bg-slate-800/40 rounded-lg border border-slate-700/30">
                                                    <p className="text-xs text-slate-300">
                                                        <span className="text-amber-400 font-bold">{reward.xp_total} XP</span>
                                                        <span className="mx-2 text-slate-600">|</span>
                                                        <span className="text-yellow-400 font-bold">{reward.copper_total} Cobre</span>
                                                    </p>
                                                    {reward.items_json?.length > 0 && (
                                                        <p className="text-[10px] text-slate-400 mt-1">
                                                            Objetos: {reward.items_json.map(i => i.name || i.item_name).join(', ')}
                                                        </p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-6 text-slate-500">
                                            <p className="text-sm">Sin recompensas aún.</p>
                                            <p className="text-xs text-slate-600 mt-1">Completa salas para obtener recompensas.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="bg-slate-900/40 border border-slate-700/30 rounded-xl p-3 text-center">
                            <p className="text-xs text-slate-500">
                                Entradas diarias: <span className="text-amber-400 font-bold">3/3</span>
                                <span className="mx-2 text-slate-600">|</span>
                                Comprar entrada extra con Onix — <span className="text-amber-500/60">Próximamente</span>
                            </p>
                        </div>

                        {(room.status === 'completed' || room.status === 'failed') && (
                            <div className="text-center py-8">
                                <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-xl border ${
                                    room.status === 'completed' ? 'bg-emerald-900/20 border-emerald-700/40 text-emerald-300' : 'bg-red-900/20 border-red-700/40 text-red-300'
                                }`}>
                                    {room.status === 'completed' ? <Trophy className="w-8 h-8" /> : <Skull className="w-8 h-8" />}
                                    <div className="text-left">
                                        <p className="text-lg font-bold">{room.status === 'completed' ? '¡Mazmorra Completada!' : 'Mazmorra Fallida'}</p>
                                        <p className="text-xs opacity-70">{room.status === 'completed' ? 'Revisa tus recompensas en el inventario.' : 'Mejor suerte la próxima vez.'}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {room && room.status === 'cancelled' && (
                    <div className="text-center py-12">
                        <Ban className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                        <p className="text-slate-400">Esta sala fue cancelada.</p>
                        <button onClick={() => navigate('/dungeons')} className="mt-4 px-4 py-2 bg-amber-700/30 text-amber-300 rounded-lg text-sm border border-amber-700/40">
                            Volver al Vestíbulo
                        </button>
                    </div>
                )}

                {room && room.status === 'expired' && (
                    <div className="text-center py-12">
                        <Shield className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                        <p className="text-slate-400">Esta sala ha expirado.</p>
                        <button onClick={() => navigate('/dungeons')} className="mt-4 px-4 py-2 bg-amber-700/30 text-amber-300 rounded-lg text-sm border border-amber-700/40">
                            Volver al Vestíbulo
                        </button>
                    </div>
                )}

                <MemberDetail member={selectedMember} onClose={() => setSelectedMember(null)} />
            </div>
        </div>
    );
};

export default DungeonRoom;
