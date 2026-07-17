import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Users, Shield, Swords, ArrowLeft, Check, X, Play, Skull, Trophy, Loader, Heart, Ban, Bot, LogOut, ChevronRight, Coins, Zap, ArmchairIcon as ShieldIcon, Sword, Crosshair } from 'lucide-react';
import { apiUrl } from '../constants/api';

const DIFFICULTY_COLORS = {
    easy: 'text-green-400 border-green-700 bg-green-950/40',
    normal: 'text-yellow-400 border-yellow-700 bg-yellow-950/40',
    hard: 'text-orange-400 border-orange-700 bg-orange-950/40',
    inferno: 'text-red-400 border-red-700 bg-red-950/40'
};

const DIFFICULTY_LABELS = { easy: 'Fácil', normal: 'Normal', hard: 'Difícil', inferno: 'Inferno' };

const NPC_TEMPLATES = [
    { name: 'Tanque Mercenario', role: 'Tanque', icon: '🛡️', power: 850, class: 'Guerrero', race: 'Humano' },
    { name: 'Sanadora Rúnica', role: 'Sanadora', icon: '💚', power: 720, class: 'Sacerdote', race: 'Elfo' },
    { name: 'Arquero Fantasma', role: 'DPS', icon: '🏹', power: 780, class: 'Arquero', race: 'Fantasma' },
    { name: 'Mago de Hueso', role: 'DPS', icon: '🔮', power: 810, class: 'Mago', race: 'No-muerto' },
    { name: 'Guardia Esquelético', role: 'Tanque', icon: '⚔️', power: 760, class: 'Paladín', race: 'Esqueleto' }
];

const getNpcInfo = (member, index) => {
    const seed = member?.member_id || member?.run_member_id || member?.id || index;
    const i = member?.npc_level ? (seed % NPC_TEMPLATES.length) : (index % NPC_TEMPLATES.length);
    return NPC_TEMPLATES[i] || NPC_TEMPLATES[0];
};

const roomLabel = (rn, total) => {
    if (rn === total) return 'Jefe';
    return `Sala ${rn}`;
};

const mergeRunState = (prev, next) => {
    if (!prev) return next;
    if (!next) return prev;
    return {
        ...prev,
        ...next,
        heroes: Array.isArray(next.heroes) && next.heroes.length > 0 ? next.heroes : (prev.heroes || []),
        enemies: Array.isArray(next.enemies) ? next.enemies : (prev.enemies || []),
        combatLog: Array.isArray(next.combatLog) && next.combatLog.length > 0 ? next.combatLog : (prev.combatLog || []),
        currentStageLog: Array.isArray(next.currentStageLog) ? next.currentStageLog : (prev.currentStageLog || []),
        rewards: Array.isArray(next.rewards) ? next.rewards : (prev.rewards || []),
        permissions: next.permissions || prev.permissions,
        stage: next.stage || prev.stage,
        stages: Array.isArray(next.stages) ? next.stages : (prev.stages || [])
    };
};

const groupRewardsByStage = (rewards = []) => {
    const stageMap = new Map();
    rewards.forEach((reward) => {
        const key = reward.stage_number || 0;
        if (!stageMap.has(key)) {
            stageMap.set(key, { stageNumber: key, xp: 0, copper: 0, items: [] });
        }
        const bucket = stageMap.get(key);
        if (reward.reward_type === 'xp') bucket.xp += reward.amount || 0;
        if (reward.reward_type === 'copper') bucket.copper += reward.amount || 0;
        if (reward.reward_type === 'item') bucket.items.push(reward);
    });
    return Array.from(stageMap.values()).sort((a, b) => a.stageNumber - b.stageNumber);
};

const formatLogEntry = (entry) => {
    const msg = entry.message || '';
    if (entry.entry_type === 'round') return { ...entry, display: <span className="text-slate-500 font-bold">── {msg} ──</span> };
    if (entry.entry_type === 'player_atk' || entry.entry_type === 'skill' || entry.entry_type === 'enemy_atk') return { ...entry, display: msg };
    if (entry.entry_type === 'heal') return { ...entry, display: msg };
    if (entry.entry_type === 'enemy_death') return { ...entry, display: <span className="text-yellow-300">{msg}</span> };
    if (entry.entry_type === 'member_death') return { ...entry, display: <span className="text-red-400">{msg}</span> };
    if (entry.entry_type === 'victory') return { ...entry, display: <span className="text-emerald-400 font-bold">{msg}</span> };
    if (entry.entry_type === 'defeat') return { ...entry, display: <span className="text-red-500 font-bold">{msg}</span> };
    if (entry.entry_type === 'info') return { ...entry, display: <span className="text-slate-500 italic">{msg}</span> };
    return { ...entry, display: msg };
};

const logTypeStyle = (type) => {
    switch (type) {
        case 'round': return 'text-slate-500 bg-slate-800/30 text-center text-xs py-1';
        case 'player_atk': return 'text-amber-300';
        case 'skill': return 'text-blue-300';
        case 'heal': return 'text-green-300';
        case 'enemy_atk': return 'text-red-300';
        case 'enemy_death': return 'text-yellow-300 font-bold';
        case 'member_death': return 'text-red-400 font-bold';
        case 'victory': return 'text-emerald-400 font-bold text-sm';
        case 'defeat': return 'text-red-500 font-bold';
        case 'info': return 'text-slate-500 italic';
        default: return 'text-slate-400';
    }
};

const HPBar = ({ current, max, size = 'sm', color = 'red' }) => {
    const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
    const barColor = color === 'red' ? 'bg-red-500' : color === 'green' ? 'bg-green-500' : 'bg-amber-500';
    const height = size === 'lg' ? 'h-3' : 'h-2';
    return (
        <div className={`w-full ${height} bg-slate-700 rounded-full overflow-hidden`}>
            <div className={`${height} ${barColor} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
        </div>
    );
};

const HeroCard = ({ member, isMasterUser, roomMembers }) => {
    if (!member) return null;
    const npcInfo = getNpcInfo(member, 0);
    const isNpc = member.is_npc;
    const name = isNpc ? npcInfo.name : (member.username || 'Jugador');
    const className = isNpc ? npcInfo.class : (member.class_name || '?');
    const race = isNpc ? npcInfo.race : (member.race || '?');
    const level = isNpc ? (member.level || member.npc_level || '?') : (member.level || member.player_level || '?');
    const hp = member.current_hp ?? member.final_hp ?? member.initial_hp ?? 100;
    const maxHp = member.max_hp ?? member.initial_hp ?? 100;
    const isDead = member.status === 'dead';

    return (
        <div className={`p-3 rounded-xl border transition-all ${isDead ? 'bg-red-950/20 border-red-800/30 opacity-60' : 'bg-slate-800/50 border-slate-700/40 hover:border-amber-700/40'}`}>
            <div className="flex items-center gap-2 mb-2">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${isNpc ? 'bg-slate-700 text-slate-300' : 'bg-amber-900/60 text-amber-300'}`}>
                    {isNpc ? npcInfo.icon : (name[0] || '?')}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                        <p className="text-sm font-bold text-slate-100 truncate">{name}</p>
                        {isNpc && <span className="text-[9px] px-1 py-0.5 bg-slate-700/60 rounded text-slate-400 font-mono">NPC</span>}
                        {isMasterUser && <span className="text-[9px] px-1 py-0.5 bg-amber-800/40 rounded text-amber-400 font-mono">Maestro</span>}
                    </div>
                    <p className="text-[10px] text-slate-500">{className} · {race} · Nv.{level}</p>
                </div>
            </div>
            <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                    <span className="flex items-center gap-1 text-red-400"><Heart className="w-3 h-3" />{Math.floor(hp)}/{Math.floor(maxHp)}</span>
                    {isDead && <span className="text-red-400 font-bold">MUERTO</span>}
                </div>
                <HPBar current={hp} max={maxHp} color={isDead ? 'red' : 'green'} />
            </div>
        </div>
    );
};

const EnemyCard = ({ enemy }) => {
    if (!enemy) return null;
    const isBoss = enemy.is_boss;
    const isElite = enemy.is_elite;
    const isDead = enemy.status === 'defeated' || !enemy.alive || enemy.is_defeated;
    const hp = enemy.current_hp ?? enemy.hp_current ?? enemy.hp ?? 0;
    const maxHp = enemy.max_hp ?? enemy.hp_max ?? hp;
    const typeLabel = isBoss ? 'Jefe' : isElite ? 'Élite' : 'Mob';
    const typeColor = isBoss ? 'text-red-400 bg-red-950/40 border-red-800/40' : isElite ? 'text-purple-400 bg-purple-950/40 border-purple-800/40' : 'text-slate-400 bg-slate-800/40 border-slate-700/40';

    return (
        <div className={`p-3 rounded-xl border transition-all ${isDead ? 'bg-slate-900/40 border-slate-800/30 opacity-40' : 'bg-slate-800/50 border-slate-700/40 hover:border-red-700/40'}`}>
            <div className="flex items-center gap-2 mb-2">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base shrink-0 ${isBoss ? 'bg-red-900/50 text-red-400' : isElite ? 'bg-purple-900/40 text-purple-400' : 'bg-slate-700/60 text-slate-400'}`}>
                    {isBoss ? '👑' : isElite ? '⭐' : '💀'}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                        <p className="text-sm font-bold text-slate-100 truncate">{enemy.name}</p>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded border font-mono ${typeColor}`}>{typeLabel}</span>
                    </div>
                    {enemy.level && <p className="text-[10px] text-slate-500">Nv.{enemy.level}</p>}
                </div>
            </div>
            <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                    <span className="flex items-center gap-1 text-red-400"><Heart className="w-3 h-3" />{Math.floor(hp)}/{Math.floor(maxHp)}</span>
                    {isDead && <span className="text-slate-500 font-bold">DERROTADO</span>}
                </div>
                <HPBar current={hp} max={maxHp} color={isDead ? 'slate' : 'red'} />
            </div>
        </div>
    );
};

const DungeonRoom = ({ user }) => {
    const { code: paramCode } = useParams();
    const navigate = useNavigate();
    const [room, setRoom] = useState(null);
    const [run, setRun] = useState(null);
    const [runId, setRunId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [combatResult, setCombatResult] = useState(null);
    const [combatLoading, setCombatLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('log');
    const [showTransition, setShowTransition] = useState(false);
    const roomPollRef = useRef(null);
    const runPollRef = useRef(null);
    const logContainerRef = useRef(null);

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
            } else {
                setError(data.message || 'Sala no encontrada.');
            }
        } catch (err) {
            setError('Error al cargar sala.');
        } finally {
            setLoading(false);
        }
    }, [effectiveCode]);

    const fetchRunState = useCallback(async () => {
        if (!runId) return;
        try {
            const token = localStorage.getItem('token');
            const detailRes = await fetch(apiUrl(`/api/dungeons/runs/${runId}`), {
                headers: { 'x-auth-token': token }
            });
            const detailData = await detailRes.json();
            if (detailData.success) {
                setRun(detailData.run);
                setRoom((prev) => detailData.room ? { ...(prev || {}), ...detailData.room } : prev);
                setCombatResult((prev) => mergeRunState(prev, detailData));
                setError(null);
            } else {
                setError(detailData.message || 'No se pudo cargar la run.');
            }
        } catch (err) {
            console.error('Error fetching run state:', err);
            setError('Error al cargar el estado de la mazmorra.');
        }
    }, [runId]);

    useEffect(() => {
        fetchRoom();
    }, [fetchRoom]);

    useEffect(() => {
        if (!runId) return;
        fetchRunState();
    }, [runId, fetchRunState]);

    // Poll room data while in lobby or active dungeon
    useEffect(() => {
        if (room && ['waiting', 'ready', 'in_progress'].includes(room.status)) {
            roomPollRef.current = setInterval(fetchRoom, 3000);
        }
        return () => {
            if (roomPollRef.current) {
                clearInterval(roomPollRef.current);
                roomPollRef.current = null;
            }
        };
    }, [room?.status, fetchRoom]);

    // Poll run data while run is active or after completion/failure to keep both clients synchronized.
    useEffect(() => {
        if (runId && ['active', 'completed', 'failed'].includes(run?.status || '')) {
            runPollRef.current = setInterval(fetchRunState, 3000);
        }
        return () => {
            if (runPollRef.current) {
                clearInterval(runPollRef.current);
                runPollRef.current = null;
            }
        };
    }, [runId, run?.status, fetchRunState]);

    // Discover runId from room data once
    useEffect(() => {
        if (!room) return;
        if (['in_progress', 'completed', 'failed'].includes(room.status) && !runId) {
            if (room.latest_run_id) {
                setRunId(room.latest_run_id);
                return;
            }
            (async () => {
                try {
                    const token = localStorage.getItem('token');
                    const runRes = await fetch(apiUrl('/api/dungeons/my-runs'), {
                        headers: { 'x-auth-token': token }
                    });
                    const runData = await runRes.json();
                    if (runData.success && runData.runs.length > 0) {
                        const activeRun = runData.runs.find(r => r.room_id === room.id);
                        if (activeRun) {
                            setRunId(activeRun.id);
                        }
                    }
                } catch (err) {
                    console.error('Error discovering run:', err);
                }
            })();
        }
    }, [room?.status, room?.id, runId]);

    // Only auto-scroll log container if user is near bottom (within 100px), never scroll window
    useEffect(() => {
        const el = logContainerRef.current;
        if (!el) return;
        const threshold = 100;
        const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
        if (isNearBottom) {
            el.scrollTop = el.scrollHeight;
        }
    }, [combatResult?.currentStageLog]);

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
                setRunId(data.run.id);
                setTimeout(() => {
                    setShowTransition(false);
                    setRun(data.run);
                    setRoom((prev) => ({ ...prev, ...data.room }));
                    setCombatResult((prev) => mergeRunState(prev, data));
                }, 3000);
            } else {
                setError(data.message);
            }
        } catch (err) { console.error(err); }
    };

    const handleAttack = async () => {
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
                setRunId(data.run.id);
                setRun(data.run);
                setRoom((prev) => ({ ...prev, ...data.room }));
                setCombatResult((prev) => mergeRunState(prev, data));
                setActiveTab('log');
            } else {
                setError(data.message);
            }
        } catch (err) {
            setError('Error al atacar.');
        } finally {
            setCombatLoading(false);
        }
    };

    const handleContinue = async () => {
        if (!run) return;
        setCombatLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(apiUrl(`/api/dungeons/runs/${run.id}/continue`), {
                method: 'POST',
                headers: { 'x-auth-token': token }
            });
            const data = await res.json();
            if (data.success) {
                setRunId(data.run.id);
                setRun(data.run);
                setRoom((prev) => ({ ...prev, ...data.room }));
                setCombatResult((prev) => mergeRunState(prev, data));
            } else {
                setError(data.message);
            }
        } catch (err) {
            setError('Error al continuar.');
        } finally {
            setCombatLoading(false);
        }
    };

    const handleKickMember = async (memberId) => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(apiUrl(`/api/dungeons/rooms/${effectiveCode}/kick`), {
                method: 'POST',
                headers: { 'x-auth-token': token, 'Content-Type': 'application/json' },
                body: JSON.stringify({ memberId })
            });
            const data = await res.json();
            if (data.success) {
                setRoom(data.room);
            } else {
                setError(data.message);
            }
        } catch (err) {
            setError('Error al expulsar.');
        }
    };

    const isMaster = combatResult?.permissions?.isMaster ?? room?.members?.some(m => m.is_master && m.player_id === user?.id);
    const allReady = room?.members?.filter(m => !m.is_npc).every(m => m.is_ready);
    const humanCount = room?.members?.filter(m => !m.is_npc).length || 0;
    const totalCount = room?.members?.length || 0;
    const partyFull = totalCount >= (room?.party_size || 0);
    const missingSlots = (room?.party_size || 0) - totalCount;

    const groupedLog = useMemo(() => {
        const stageLog = combatResult?.currentStageLog || [];
        if (!stageLog.length) return [];
        const groups = [];
        let currentRound = null;
        for (const entry of stageLog) {
            const fmt = formatLogEntry(entry);
            if (entry.entry_type === 'round') {
                currentRound = { round: entry.round_number || 0, entries: [fmt] };
                groups.push(currentRound);
            } else if (currentRound) {
                currentRound.entries.push(fmt);
            } else {
                groups.push({ round: 0, entries: [fmt] });
            }
        }
        return groups;
    }, [combatResult?.currentStageLog]);

    const rewardGroups = useMemo(() => groupRewardsByStage(combatResult?.rewards || []), [combatResult?.rewards]);
    const totalXp = useMemo(() => (combatResult?.rewards || []).filter((reward) => reward.reward_type === 'xp').reduce((sum, reward) => sum + (reward.amount || 0), 0), [combatResult?.rewards]);
    const totalCopper = useMemo(() => (combatResult?.rewards || []).filter((reward) => reward.reward_type === 'copper').reduce((sum, reward) => sum + (reward.amount || 0), 0), [combatResult?.rewards]);
    const killCount = useMemo(() => (combatResult?.enemies || []).filter((enemy) => enemy.status === 'defeated').length, [combatResult?.enemies]);

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

    const roomStageIndex = run ? run.current_room_number : 0;
    const roomTotal = run ? run.total_rooms : (room ? 4 : 0);

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
            {/* BACK BUTTON */}
            <div className="max-w-6xl mx-auto px-4 md:px-6 pt-4">
                <button onClick={() => navigate('/dungeons')} className="flex items-center gap-1.5 text-slate-400 hover:text-amber-300 text-sm mb-4 transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Volver al Vestíbulo
                </button>
            </div>

            {room && room.status === 'waiting' && (
                <div className="max-w-5xl mx-auto px-4 md:px-6 pb-8">
                    <div className="bg-slate-900/70 border border-slate-700/50 rounded-xl p-5">
                        {/* HEADER */}
                        <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
                            <div>
                                <h1 className="text-2xl font-bold text-amber-100">{room.dungeon_name}</h1>
                                {room.dungeon_description && <p className="text-xs text-slate-500 mt-1">{room.dungeon_description}</p>}
                                <div className="flex items-center gap-2 mt-2 flex-wrap text-xs text-slate-400">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${DIFFICULTY_COLORS[room.difficulty] || DIFFICULTY_COLORS.normal}`}>
                                        {DIFFICULTY_LABELS[room.difficulty] || room.difficulty}
                                    </span>
                                    <span>Código: <span className="font-mono text-amber-400 font-bold tracking-widest">{room.code}</span></span>
                                    {room.min_level && <span>Nv.mín {room.min_level}</span>}
                                    <span>{room.party_size} plazas</span>
                                </div>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                                {isMaster && !partyFull && (
                                    <button onClick={handleFillNPCs} className="flex items-center gap-1.5 px-3 py-2 bg-purple-700/30 hover:bg-purple-700/50 text-purple-300 text-xs font-semibold rounded-lg border border-purple-700/40 transition-colors">
                                        <Bot className="w-3.5 h-3.5" /> Completar con NPC
                                    </button>
                                )}
                                {isMaster && (
                                    <button onClick={handleStart} disabled={!partyFull || !allReady || humanCount < 1}
                                        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700/40 hover:bg-emerald-700/60 disabled:opacity-40 disabled:cursor-not-allowed text-emerald-300 text-sm font-bold rounded-lg border border-emerald-700/50 transition-colors">
                                        <Play className="w-4 h-4" /> Iniciar
                                    </button>
                                )}
                                {isMaster ? (
                                    <button onClick={handleCancel} className="flex items-center gap-1.5 px-3 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-300 text-sm rounded-lg border border-red-800/40 transition-colors">
                                        <Ban className="w-3.5 h-3.5" /> Cancelar Sala
                                    </button>
                                ) : (
                                    <button onClick={handleLeave} className="flex items-center gap-1.5 px-3 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-300 text-sm rounded-lg border border-red-800/40 transition-colors">
                                        <LogOut className="w-3.5 h-3.5" /> Salir
                                    </button>
                                )}
                            </div>
                        </div>

                        {error && <div className="mb-3 p-2 bg-red-950/60 border border-red-800/50 rounded text-red-300 text-xs">{error}</div>}

                        {!partyFull && (
                            <div className="mb-3 p-2 bg-amber-950/40 border border-amber-800/30 rounded text-amber-300/70 text-xs">
                                Faltan {missingSlots} miembro{missingSlots !== 1 ? 's' : ''}. {isMaster ? 'Usa "Completar con NPC" o espera jugadores.' : 'Esperando que se unan más jugadores...'}
                            </div>
                        )}
                        {partyFull && !allReady && (
                            <div className="mb-3 p-2 bg-blue-950/40 border border-blue-800/30 rounded text-blue-300/70 text-xs">
                                Todos los slots están ocupados. Esperando que todos marquen "Listo".
                            </div>
                        )}

                        <div>
                            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Grupo ({totalCount}/{room.party_size})</h2>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                                {slots.map((member, i) => (
                                    <div key={i}>
                                        {!member ? (
                                            <div className="flex flex-col items-center justify-center p-4 bg-slate-800/20 border border-dashed border-slate-700/30 rounded-xl min-h-[120px]">
                                                <div className="w-10 h-10 rounded-full bg-slate-800/40 border border-slate-700/30 flex items-center justify-center mb-2">
                                                    <Bot className="w-5 h-5 text-slate-600" />
                                                </div>
                                                <p className="text-xs text-slate-600">Vacío</p>
                                            </div>
                                        ) : (
                                            <div className="relative">
                                                <HeroCard member={member} isMasterUser={member.is_master && member.player_id === user?.id} />
                                                {member.is_ready && !member.is_npc && (
                                                    <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-emerald-700/60 rounded text-[9px] text-emerald-200 font-bold">✓ LISTO</div>
                                                )}
                                                {member.player_id === user?.id && !member.is_master && (
                                                    <button
                                                        onClick={handleToggleReady}
                                                        className={`mt-1 w-full text-[10px] font-bold py-1 rounded border transition-colors ${
                                                            member.is_ready
                                                                ? 'bg-red-900/30 border-red-800/40 text-red-300 hover:bg-red-900/50'
                                                                : 'bg-emerald-800/30 border-emerald-700/40 text-emerald-300 hover:bg-emerald-800/50'
                                                        }`}
                                                    >
                                                        {member.is_ready ? 'Cancelar Listo' : 'Marcar Listo'}
                                                    </button>
                                                )}
                                                {isMaster && !member.is_master && !member.is_npc && (
                                                    <button
                                                        onClick={() => handleKickMember(member.id)}
                                                        className="mt-1 w-full text-[10px] font-bold py-1 rounded border border-red-800/40 bg-red-900/20 text-red-400 hover:bg-red-900/40 transition-colors"
                                                    >
                                                        Expulsar
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
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
                <div className="max-w-6xl mx-auto px-4 md:px-6 pb-8">
                    {/* EPIC HEADER */}
                    <div className="bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-slate-900/90 border border-slate-700/50 rounded-xl p-5 mb-4">
                        <div className="flex items-start justify-between flex-wrap gap-3">
                            <div>
                                <div className="flex items-center gap-3">
                                    <h1 className="text-2xl font-bold text-amber-100">{room.dungeon_name}</h1>
                                    {run && (
                                        <span className="text-lg font-semibold text-amber-400">
                                            {roomLabel(roomStageIndex, roomTotal)} de {roomTotal}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 mt-1 text-xs text-slate-400 flex-wrap">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${DIFFICULTY_COLORS[room.difficulty] || DIFFICULTY_COLORS.normal}`}>
                                        {DIFFICULTY_LABELS[room.difficulty] || room.difficulty}
                                    </span>
                                    {room.min_level && <span>Nv.{room.min_level}</span>}
                                    <span>Grupo {room.party_size}</span>
                                    {room.status === 'completed' && <span className="text-emerald-400 font-semibold">✓ Completada</span>}
                                    {room.status === 'failed' && <span className="text-red-400 font-semibold">✗ Fallida</span>}
                                </div>
                            </div>
                            {run?.status === 'active' && combatResult?.permissions?.canAttack && (
                                <button onClick={handleAttack} disabled={combatLoading}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-700/50 to-red-600/30 hover:from-red-600/60 hover:to-red-500/40 disabled:opacity-40 disabled:cursor-not-allowed text-red-300 text-sm font-bold rounded-lg border border-red-700/50 transition-all shadow-lg shadow-red-900/20">
                                    {combatLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Swords className="w-4 h-4" />}
                                    {combatLoading ? 'Combatiendo...' : 'Atacar'}
                                </button>
                            )}
                            {run?.status === 'active' && combatResult?.permissions?.canContinue && (
                                <button onClick={handleContinue} disabled={combatLoading}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-700/50 to-amber-600/30 hover:from-amber-600/60 hover:to-amber-500/40 disabled:opacity-40 disabled:cursor-not-allowed text-amber-300 text-sm font-bold rounded-lg border border-amber-700/50 transition-all shadow-lg shadow-amber-900/20">
                                    {combatLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                                    {combatLoading ? 'Avanzando...' : 'Continuar a la siguiente sala'}
                                </button>
                            )}
                            {run?.status === 'active' && combatResult?.permissions?.canFinish && (
                                <button onClick={handleContinue} disabled={combatLoading}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-700/50 to-emerald-600/30 hover:from-emerald-600/60 hover:to-emerald-500/40 disabled:opacity-40 disabled:cursor-not-allowed text-emerald-300 text-sm font-bold rounded-lg border border-emerald-700/50 transition-all shadow-lg shadow-emerald-900/20">
                                    <Trophy className="w-4 h-4" />
                                    {combatLoading ? 'Finalizando...' : 'Terminar Mazmorra'}
                                </button>
                            )}
                            {run?.status === 'active' && !isMaster && (
                                <p className="text-xs text-slate-500 italic flex items-center gap-1"><Loader className="w-3 h-3 animate-spin" /> Esperando a que el maestro avance...</p>
                            )}
                        </div>

                        {/* PROGRESS */}
                        {run && (
                            <div className="flex items-center gap-2 mt-4">
                                {Array.from({ length: roomTotal }, (_, i) => {
                                    const rn = i + 1;
                                    const stage = combatResult?.stages?.find(s => s.room_number === rn);
                                    const isCurrent = rn === roomStageIndex && run.status === 'active';
                                    const isCompleted = stage?.status === 'completed';
                                    const isFailed = stage?.status === 'failed';
                                    const isBoss = rn === roomTotal;
                                    return (
                                        <div key={rn} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                            isCompleted ? 'bg-emerald-900/40 border-emerald-700/50 text-emerald-300' :
                                            isFailed ? 'bg-red-900/40 border-red-700/50 text-red-300' :
                                            isCurrent ? 'bg-amber-900/40 border-amber-700/50 text-amber-300 ring-1 ring-amber-500/30' :
                                            'bg-slate-800/60 border-slate-700/40 text-slate-500'
                                        }`}>
                                            {isCompleted ? <Check className="w-3.5 h-3.5" /> : isFailed ? <X className="w-3.5 h-3.5" /> : isBoss ? '👑' : rn}
                                            <span className="hidden sm:inline">{isBoss ? 'Jefe' : `Sala ${rn}`}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {error && <div className="mb-3 p-2 bg-red-950/60 border border-red-800/50 rounded text-red-300 text-xs">{error}</div>}

                    {/* COMBAT ARENA */}
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
                        {/* HEROES */}
                        <div className="lg:col-span-2 bg-slate-900/60 border border-slate-700/40 rounded-xl p-4">
                            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <ShieldIcon className="w-3.5 h-3.5 text-amber-400" /> Héroes ({combatResult?.heroes?.length || 0}/{room?.party_size || 0})
                            </h2>
                            <div className="space-y-2">
                                {combatResult?.heroes?.length > 0 ? combatResult.heroes.map(member => (
                                    <HeroCard key={member.run_member_id || member.member_id} member={member} isMasterUser={member.is_master && member.player_id === user?.id} />
                                )) : (
                                    <p className="text-slate-500 text-xs text-center py-4">Cargando héroes...</p>
                                )}
                            </div>
                        </div>

                        {/* VS DIVIDER */}
                        <div className="hidden lg:flex items-center justify-center">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-900/60 to-amber-900/60 border border-red-700/40 flex items-center justify-center">
                                <Swords className="w-6 h-6 text-red-400" />
                            </div>
                        </div>

                        {/* ENEMIES */}
                        <div className="lg:col-span-2 bg-slate-900/60 border border-slate-700/40 rounded-xl p-4">
                            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <Skull className="w-3.5 h-3.5 text-red-400" /> Enemigos ({combatResult?.enemies?.length || 0})
                                {combatResult?.enemies?.some(e => e.is_boss) && <span className="text-[9px] text-red-400 font-bold bg-red-950/40 px-1.5 py-0.5 rounded border border-red-800/40">JEFE</span>}
                            </h2>
                            <div className="space-y-2">
                                {combatResult?.enemies?.length > 0 ? combatResult.enemies.map(enemy => (
                                    <EnemyCard key={enemy.stage_enemy_id || enemy.id} enemy={enemy} />
                                )) : (
                                    <div className="text-center py-8 text-slate-500">
                                        <Skull className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                        <p className="text-xs">Esperando enemigos persistidos de esta sala.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* COMBAT LOG + REWARDS TABS */}
                    <div className="bg-slate-900/60 border border-slate-700/40 rounded-xl p-4 mb-4">
                        <div className="flex items-center gap-3 mb-3">
                            <h2 className="text-sm font-semibold text-slate-300">Combate</h2>
                            <div className="flex gap-1">
                                <button onClick={() => setActiveTab('log')} className={`px-3 py-1 rounded text-xs font-semibold border transition-colors ${activeTab === 'log' ? 'bg-amber-800/30 border-amber-700/40 text-amber-300' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'}`}>⚔️ Log</button>
                                <button onClick={() => setActiveTab('rewards')} className={`px-3 py-1 rounded text-xs font-semibold border transition-colors ${activeTab === 'rewards' ? 'bg-amber-800/30 border-amber-700/40 text-amber-300' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'}`}>🎁 Recompensas</button>
                            </div>
                        </div>

                        {activeTab === 'log' && (
                            <div className="max-h-[500px] overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent font-mono text-xs" ref={logContainerRef}>
                                {groupedLog.length > 0 ? groupedLog.map((group, gi) => (
                                    <div key={gi} className="mb-2">
                                        {group.entries.map((entry, ei) => (
                                            <div key={ei} className={`px-3 py-0.5 rounded ${logTypeStyle(entry.entry_type)}`}>
                                                {entry.display}
                                            </div>
                                        ))}
                                    </div>
                                )) : (
                                    <p className="text-slate-500 text-center py-8 text-sm">Sin registro de combate.</p>
                                )}
                                {combatLoading && (
                                    <div className="flex items-center gap-2 px-3 py-2 text-amber-400 text-sm">
                                        <Loader className="w-4 h-4 animate-spin" /> Desarrollando combate...
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'rewards' && (
                            <div>
                                {rewardGroups.length > 0 ? (
                                    <div className="space-y-3">
                                        {rewardGroups.map((reward, ri) => (
                                            <div key={ri} className="p-4 bg-slate-800/40 rounded-xl border border-slate-700/30">
                                                <div className="flex items-center gap-4 mb-2">
                                                    <div className="flex items-center gap-1.5 text-amber-400 font-bold text-sm">
                                                        <Zap className="w-4 h-4" /> {reward.xp} XP
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-yellow-400 font-bold text-sm">
                                                        <Coins className="w-4 h-4" /> {reward.copper} monedas
                                                    </div>
                                                    <div className="text-[10px] text-slate-500">Sala {reward.stageNumber}</div>
                                                </div>
                                                {reward.items?.length > 0 && (
                                                    <div className="flex flex-wrap gap-2">
                                                        {reward.items.map((item, ii) => (
                                                            <span key={ii} className="px-2 py-1 bg-slate-700/40 rounded text-xs text-slate-300 border border-slate-600/40">
                                                                {item.item_name || 'Objeto'}
                                                                {item.item_rarity && <span className="ml-1 text-[10px] text-amber-400">[{item.item_rarity}]</span>}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                                {reward.items.length === 0 && (
                                                    <p className="text-[10px] text-slate-500 italic">Sin objetos en esta sala.</p>
                                                )}
                                            </div>
                                        ))}
                                        <div className="p-3 bg-blue-950/30 border border-blue-800/30 rounded-lg text-xs text-blue-300/70 text-center">
                                            Todos los miembros reciben EXP y monedas. Objetos raros+ requieren tirada de Codicia.
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-slate-500">
                                        <Coins className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                        <p className="text-sm">Sin recompensas aún.</p>
                                        <p className="text-xs text-slate-600 mt-1">Completa salas para obtener recompensas.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* END SCREEN */}
                    {(room.status === 'completed' || room.status === 'failed') && (
                        <div className="text-center py-8">
                            <div className={`inline-flex flex-col items-center gap-4 px-8 py-6 rounded-2xl border ${
                                room.status === 'completed' ? 'bg-gradient-to-b from-emerald-900/30 to-emerald-950/20 border-emerald-700/40 text-emerald-300' : 'bg-gradient-to-b from-red-900/30 to-red-950/20 border-red-700/40 text-red-300'
                            }`}>
                                {room.status === 'completed' ? (
                                    <>
                                        <Trophy className="w-16 h-16 text-emerald-400" />
                                        <div>
                                            <p className="text-2xl font-bold">¡Mazmorra Completada!</p>
                                            <p className="text-sm opacity-70 mt-1">Has superado todas las salas. ¡Grandioso!</p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 mt-2 text-sm">
                                            <div className="bg-emerald-900/30 rounded-xl p-3 border border-emerald-700/30">
                                                <p className="text-emerald-400 font-bold text-lg">{run?.current_room_number || '?'}/{run?.total_rooms || '?'}</p>
                                                <p className="text-[10px] opacity-70">Salas superadas</p>
                                            </div>
                                            <div className="bg-emerald-900/30 rounded-xl p-3 border border-emerald-700/30">
                                                <p className="text-emerald-400 font-bold text-lg">{totalXp}</p>
                                                <p className="text-[10px] opacity-70">XP total</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 mt-2 text-sm w-full">
                                            <div className="bg-emerald-900/30 rounded-xl p-3 border border-emerald-700/30">
                                                <p className="text-yellow-400 font-bold text-lg">{totalCopper}</p>
                                                <p className="text-[10px] opacity-70">Monedas totales</p>
                                            </div>
                                            <div className="bg-emerald-900/30 rounded-xl p-3 border border-emerald-700/30">
                                                <p className="text-red-400 font-bold text-lg">{killCount}</p>
                                                <p className="text-[10px] opacity-70">Enemigos derrotados</p>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <Skull className="w-16 h-16 text-red-400" />
                                        <div>
                                            <p className="text-2xl font-bold">Mazmorra Fallida</p>
                                            <p className="text-sm opacity-70 mt-1">El grupo ha caído. Mejor suerte la próxima vez.</p>
                                        </div>
                                    </>
                                )}
                                <div className="flex gap-3 mt-4">
                                    <button onClick={() => navigate('/dungeons')} className="px-6 py-2.5 bg-amber-700/40 hover:bg-amber-700/60 text-amber-300 text-sm font-bold rounded-lg border border-amber-700/50 transition-colors">
                                        Volver al Vestíbulo
                                    </button>
                                    <button onClick={() => navigate('/inventory')} className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-lg border border-slate-600 transition-colors">
                                        Ver Inventario
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {room && ['cancelled', 'expired'].includes(room.status) && (
                <div className="max-w-5xl mx-auto px-4 md:px-6 pb-8">
                    <div className="text-center py-12 bg-slate-900/40 border border-slate-700/30 rounded-xl">
                        {room.status === 'cancelled' ? <Ban className="w-12 h-12 text-slate-600 mx-auto mb-3" /> : <Shield className="w-12 h-12 text-slate-600 mx-auto mb-3" />}
                        <p className="text-slate-400">{room.status === 'cancelled' ? 'Esta sala fue cancelada.' : 'Esta sala ha expirado.'}</p>
                        <button onClick={() => navigate('/dungeons')} className="mt-4 px-4 py-2 bg-amber-700/30 text-amber-300 rounded-lg text-sm border border-amber-700/40">
                            Volver al Vestíbulo
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DungeonRoom;
