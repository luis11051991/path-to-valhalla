import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Shield, Clock, Plus, Search, DoorOpen, Lock, Unlock, Swords, Info, AlertTriangle, ArrowRight } from 'lucide-react';
import { apiUrl } from '../constants/api';

const DIFFICULTY_COLORS = {
    easy: 'text-green-400 border-green-700 bg-green-950/40',
    normal: 'text-yellow-400 border-yellow-700 bg-yellow-950/40',
    hard: 'text-orange-400 border-orange-700 bg-orange-950/40',
    inferno: 'text-red-400 border-red-700 bg-red-950/40'
};

const DIFFICULTY_LABELS = {
    easy: 'Fácil',
    normal: 'Normal',
    hard: 'Difícil',
    inferno: 'Inferno'
};

const PARTY_LABELS = { 3: '4 Salas', 4: '6 Salas', 5: '8 Salas' };

const DungeonsLobby = ({ user, onUpdateUser }) => {
    const navigate = useNavigate();
    const [rooms, setRooms] = useState([]);
    const [types, setTypes] = useState([]);
    const [myActiveRoom, setMyActiveRoom] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [joinCode, setJoinCode] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [showJoinPrivate, setShowJoinPrivate] = useState(false);
    const [privateCode, setPrivateCode] = useState('');
    const [privatePassword, setPrivatePassword] = useState('');
    const [createForm, setCreateForm] = useState({
        dungeonTypeId: '',
        difficulty: 'normal',
        partySize: 3,
        isPublic: true,
        accessPassword: ''
    });

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem('token');
            const [roomsRes, typesRes, activeRes] = await Promise.all([
                fetch(apiUrl('/api/dungeons/rooms'), { headers: { 'x-auth-token': token } }),
                fetch(apiUrl('/api/dungeons/types'), { headers: { 'x-auth-token': token } }),
                fetch(apiUrl('/api/dungeons/my-active-room'), { headers: { 'x-auth-token': token } })
            ]);

            if (roomsRes.ok) {
                const data = await roomsRes.json();
                setRooms(data.rooms || []);
            }
            if (typesRes.ok) {
                const data = await typesRes.json();
                setTypes(data.types || []);
                if (data.types?.length > 0 && !createForm.dungeonTypeId) {
                    setCreateForm(prev => ({ ...prev, dungeonTypeId: data.types[0].id }));
                }
            }
            if (activeRes.ok) {
                const data = await activeRes.json();
                setMyActiveRoom(data.room || null);
            }
        } catch (err) {
            setError('Error al cargar datos.');
        } finally {
            setLoading(false);
        }
    }, [createForm.dungeonTypeId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleCreateRoom = async (e) => {
        e.preventDefault();
        setError(null);
        try {
            const token = localStorage.getItem('token');
            const body = { ...createForm };
            if (body.isPublic) {
                delete body.accessPassword;
            }
            const res = await fetch(apiUrl('/api/dungeons/rooms'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (data.success) {
                navigate(`/dungeons/${data.room.code}`);
            } else {
                setError(data.message || 'Error al crear sala.');
            }
        } catch (err) {
            setError('Error al crear sala.');
        }
    };

    const handleJoinByCode = () => {
        if (joinCode.trim().length < 4) return;
        setPrivateCode(joinCode.trim().toUpperCase());
        setPrivatePassword('');
        setShowJoinPrivate(true);
    };

    const handleJoinPrivate = async () => {
        if (privateCode.length < 4) return;
        setError(null);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(apiUrl(`/api/dungeons/rooms/${privateCode}/join`), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
                body: JSON.stringify({ accessPassword: privatePassword })
            });
            const data = await res.json();
            if (data.success) {
                setShowJoinPrivate(false);
                navigate(`/dungeons/${privateCode}`);
            } else {
                setError(data.message || 'Error al unirse.');
            }
        } catch (err) {
            setError('Error al unirse a la sala.');
        }
    };

    const handleJoinRoom = async (code, isPublic) => {
        if (!isPublic) {
            setPrivateCode(code);
            setPrivatePassword('');
            setShowJoinPrivate(true);
            return;
        }
        setError(null);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(apiUrl(`/api/dungeons/rooms/${code}/join`), {
                method: 'POST',
                headers: { 'x-auth-token': token }
            });
            const data = await res.json();
            if (data.success) {
                navigate(`/dungeons/${code}`);
            } else {
                setError(data.message || 'Error al unirse.');
            }
        } catch (err) {
            setError('Error al unirse a la sala.');
        }
    };

    const handleEnterActiveRoom = () => {
        if (myActiveRoom) {
            navigate(`/dungeons/${myActiveRoom.code}`);
        }
    };

    const selectedType = types.find(t => t.id === createForm.dungeonTypeId);

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-4 md:p-6">
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-gradient-to-br from-amber-900/40 to-amber-950/40 rounded-lg border border-amber-700/30">
                        <Swords className="w-6 h-6 text-amber-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-amber-100">Mazmorras</h1>
                        <p className="text-sm text-slate-400">Modo cooperativo multijugador</p>
                    </div>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-950/60 border border-red-800/50 rounded-lg text-red-300 text-sm">{error}</div>
                )}

                {myActiveRoom && (
                    <div className="mb-4 p-4 bg-amber-900/20 border border-amber-700/40 rounded-xl">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <AlertTriangle className="w-5 h-5 text-amber-400" />
                                <div>
                                    <p className="text-sm font-semibold text-amber-200">Tienes una mazmorra activa</p>
                                    <p className="text-xs text-amber-400/70">{myActiveRoom.dungeon_name} — {myActiveRoom.code}</p>
                                </div>
                            </div>
                            <button
                                onClick={handleEnterActiveRoom}
                                className="flex items-center gap-1.5 px-4 py-2 bg-amber-700/40 hover:bg-amber-700/60 text-amber-300 text-sm font-bold rounded-lg border border-amber-700/50 transition-colors"
                            >
                                Ir a la Sala <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-xs text-amber-500/60 mt-2">Debes salir de la mazmorra actual antes de crear o unirte a otra.</p>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                    <div className="lg:col-span-2">
                        <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                                    <DoorOpen className="w-4 h-4 text-amber-500" />
                                    Salas Públicas
                                </h2>
                                <button
                                    onClick={() => setShowCreate(!showCreate)}
                                    disabled={!!myActiveRoom}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-700/30 hover:bg-amber-700/50 disabled:opacity-40 disabled:cursor-not-allowed text-amber-300 text-xs font-semibold rounded-lg transition-colors border border-amber-700/40"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    Crear Sala
                                </button>
                            </div>

                            {loading ? (
                                <div className="flex items-center justify-center py-12 text-slate-500">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500 mr-3"></div>
                                    Cargando salas...
                                </div>
                            ) : rooms.length === 0 ? (
                                <div className="text-center py-12 text-slate-500">
                                    <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                    <p className="text-sm">No hay salas públicas disponibles.</p>
                                    <p className="text-xs text-slate-600 mt-1">Crea una nueva o usa un código para unirte.</p>
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent pr-1">
                                    {rooms.map(room => (
                                        <div key={room.id} className="flex items-center justify-between p-3 bg-slate-800/40 hover:bg-slate-800/70 rounded-lg border border-slate-700/30 transition-colors">
                                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                                <div className={`px-2 py-0.5 rounded text-[10px] font-bold border ${DIFFICULTY_COLORS[room.difficulty] || DIFFICULTY_COLORS.normal}`}>
                                                    {DIFFICULTY_LABELS[room.difficulty] || room.difficulty}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-semibold text-slate-200 truncate">{room.dungeon_name}</p>
                                                    <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{room.dungeon_description || 'Sin descripción'}</p>
                                                    <p className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                                                        <span className="flex items-center gap-1"><Users className="w-3 h-3" />{room.member_count}/{room.party_size}</span>
                                                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{room.creator_name}</span>
                                                        {room.min_level && <span>Nv.mín {room.min_level}</span>}
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleJoinRoom(room.code, room.is_public)}
                                                disabled={!!myActiveRoom}
                                                className="shrink-0 ml-2 px-3 py-1.5 bg-emerald-700/30 hover:bg-emerald-700/50 disabled:opacity-40 disabled:cursor-not-allowed text-emerald-300 text-xs font-semibold rounded-lg transition-colors border border-emerald-700/40"
                                            >
                                                {room.is_public ? 'Unirse' : <span className="flex items-center gap-1"><Lock className="w-3 h-3" />Unirse</span>}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4">
                            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2 mb-3">
                                <Search className="w-4 h-4 text-amber-500" />
                                Unirse por Código
                            </h2>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={joinCode}
                                    onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                                    placeholder="CÓDIGO"
                                    className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 uppercase placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-600/50 font-mono tracking-widest"
                                    maxLength={6}
                                />
                                <button
                                    onClick={handleJoinByCode}
                                    disabled={joinCode.trim().length < 4 || !!myActiveRoom}
                                    className="px-3 py-2 bg-amber-700/30 hover:bg-amber-700/50 disabled:opacity-40 disabled:cursor-not-allowed text-amber-300 text-sm font-semibold rounded-lg transition-colors border border-amber-700/40"
                                >
                                    Ir
                                </button>
                            </div>
                            <p className="text-[10px] text-slate-600 mt-1">Las salas privadas pedirán clave al unirse.</p>
                        </div>
                    </div>
                </div>

                {showJoinPrivate && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowJoinPrivate(false)}>
                        <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
                            <h3 className="text-lg font-bold text-amber-100 mb-1">Sala Privada</h3>
                            <p className="text-xs text-slate-400 mb-4">Ingresa la clave para unirte a <span className="font-mono text-amber-400">{privateCode}</span></p>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Clave de acceso</label>
                                    <input
                                        type="password"
                                        value={privatePassword}
                                        onChange={(e) => setPrivatePassword(e.target.value)}
                                        placeholder="••••••"
                                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-600/50"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setShowJoinPrivate(false)} className="flex-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg border border-slate-600 transition-colors">
                                        Cancelar
                                    </button>
                                    <button onClick={handleJoinPrivate} className="flex-1 px-3 py-2 bg-emerald-700/40 hover:bg-emerald-700/60 text-emerald-300 text-sm font-bold rounded-lg border border-emerald-700/50 transition-colors">
                                        Unirse
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {showCreate && !myActiveRoom && (
                    <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-5">
                        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Plus className="w-4 h-4 text-amber-500" />
                            Crear Nueva Sala
                        </h2>
                        <form onSubmit={handleCreateRoom} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Mazmorra</label>
                                <select
                                    value={createForm.dungeonTypeId}
                                    onChange={(e) => setCreateForm(p => ({ ...p, dungeonTypeId: Number(e.target.value) }))}
                                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-600/50"
                                >
                                    {types.map(t => (
                                        <option key={t.id} value={t.id}>{t.name} (Nv.{t.min_level})</option>
                                    ))}
                                </select>
                                {selectedType && (
                                    <p className="text-[10px] text-slate-500 mt-1">{selectedType.description}</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Dificultad</label>
                                <select
                                    value={createForm.difficulty}
                                    onChange={(e) => setCreateForm(p => ({ ...p, difficulty: e.target.value }))}
                                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-600/50"
                                >
                                    <option value="easy">Fácil</option>
                                    <option value="normal">Normal</option>
                                    <option value="hard">Difícil</option>
                                    <option value="inferno">Inferno</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Tamaño de Grupo</label>
                                <select
                                    value={createForm.partySize}
                                    onChange={(e) => setCreateForm(p => ({ ...p, partySize: Number(e.target.value) }))}
                                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-600/50"
                                >
                                    <option value={3}>3 Jugadores (4 Salas)</option>
                                    <option value={4}>4 Jugadores (6 Salas)</option>
                                    <option value={5}>5 Jugadores (8 Salas)</option>
                                </select>
                            </div>
                            <div className="flex flex-col gap-2">
                                <button
                                    type="button"
                                    onClick={() => setCreateForm(p => ({ ...p, isPublic: !p.isPublic, accessPassword: '' }))}
                                    className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${createForm.isPublic ? 'bg-emerald-800/30 border-emerald-700/40 text-emerald-300' : 'bg-slate-800 border-slate-600 text-slate-400'}`}
                                >
                                    {createForm.isPublic ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                                    {createForm.isPublic ? 'Pública' : 'Privada'}
                                </button>
                                {!createForm.isPublic && (
                                    <input
                                        type="text"
                                        value={createForm.accessPassword}
                                        onChange={(e) => setCreateForm(p => ({ ...p, accessPassword: e.target.value }))}
                                        placeholder="Clave de acceso"
                                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-600/50"
                                    />
                                )}
                                <button
                                    type="submit"
                                    disabled={!!myActiveRoom}
                                    className="w-full px-4 py-2 bg-amber-700/40 hover:bg-amber-700/60 disabled:opacity-40 disabled:cursor-not-allowed text-amber-300 text-sm font-bold rounded-lg transition-colors border border-amber-700/50"
                                >
                                    Crear Sala
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DungeonsLobby;
