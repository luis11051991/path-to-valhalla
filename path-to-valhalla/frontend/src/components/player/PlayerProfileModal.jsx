import { createElement, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Crown,
    Ghost,
    Info,
    BarChart3,
    Shield,
    Users,
    Swords,
    Skull,
    Crosshair,
    ScrollText,
    Scroll,
    Eye,
    Map,
    Trophy,
    Star,
    X
} from 'lucide-react';
import playerService from '../../services/playerService';

const formatNumber = (value) => new Intl.NumberFormat('es-ES').format(Number(value || 0));

const TABS = [
    { id: 'info', label: 'Información', icon: Info },
    { id: 'stats', label: 'Estadísticas', icon: BarChart3 }
];

function PlayerProfileModal({ playerId, isOpen, onClose, allianceRole, memberSince, contribution }) {
    const [activeTab, setActiveTab] = useState('info');
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const loadProfile = useCallback(async () => {
        if (!playerId) return;
        setLoading(true);
        setError(null);
        try {
            const data = await playerService.getPublicProfile(playerId);
            setProfile(data);
        } catch (requestError) {
            setError(requestError.message || 'No se pudo cargar el perfil.');
        } finally {
            setLoading(false);
        }
    }, [playerId]);

    useEffect(() => {
        if (isOpen && playerId) loadProfile();
    }, [isOpen, playerId, loadProfile]);

    if (!isOpen) return null;

    const player = profile?.player;
    const alliance = profile?.alliance;
    const statistics = profile?.statistics;

    const getAvatarUrl = (url, gender) => {
        if (!url) return null;
        if (url.includes('_male') || url.includes('_female')) return url;
        const suffix = gender === 'female' ? '_female' : '_male';
        const dotIndex = url.lastIndexOf('.');
        if (dotIndex === -1) return url + suffix;
        return url.slice(0, dotIndex) + suffix + url.slice(dotIndex);
    };

    return (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <section className="max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-amber-700/50 bg-slate-950 shadow-[0_30px_90px_rgba(0,0,0,0.65)]">
                <header className="flex items-center justify-between gap-3 border-b border-white/10 p-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded border border-amber-600/45 bg-black/35">
                            {createElement(Users, { size: 21, className: 'text-amber-300' })}
                        </div>
                        <h3 className="font-serif text-2xl font-bold text-amber-100">Perfil de Jugador</h3>
                    </div>
                    <button type="button" onClick={onClose} className="rounded border border-slate-700 bg-black/30 p-2 text-slate-400 hover:text-amber-100">
                        <X size={18} />
                    </button>
                </header>

                <div className="p-4 md:p-5">
                    {loading && (
                        <div className="rounded-lg border border-slate-800 bg-black/35 p-10 text-center text-slate-500 animate-pulse">
                            Cargando perfil...
                        </div>
                    )}

                    {error && (
                        <div className="mb-4 rounded-lg border border-red-900/60 bg-red-950/35 p-4 text-sm text-red-200">
                            {error}
                        </div>
                    )}

                    {!loading && !error && player && (
                        <>
                            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center">
                                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border border-amber-500/55 bg-slate-950 shadow-[0_0_35px_rgba(245,158,11,0.16)]">
                                    {player.avatarUrl ? (
                                        <img
                                            src={getAvatarUrl(player.avatarUrl, player.gender)}
                                            alt=""
                                            className="h-16 w-16 object-contain"
                                            onError={(event) => {
                                                event.currentTarget.style.display = 'none';
                                                event.currentTarget.nextSibling.style.display = 'flex';
                                            }}
                                        />
                                    ) : (
                                        <Ghost size={48} className="text-amber-300" />
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <h2 className="font-serif text-3xl font-black text-amber-100">{player.username}</h2>
                                    <p className="mt-1 text-sm text-amber-300/80">
                                        Nivel {formatNumber(player.level)}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        {player.className || 'Sin clase'} · {player.race || 'Sin raza'}
                                    </p>
                                </div>
                            </div>

                            <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
                                {TABS.map((tab) => {
                                    const Icon = tab.icon;
                                    const isActive = activeTab === tab.id;
                                    return (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            onClick={() => setActiveTab(tab.id)}
                                            className={`inline-flex whitespace-nowrap items-center gap-2 rounded border px-3 py-2 text-[11px] font-bold uppercase tracking-widest transition-colors ${
                                                isActive
                                                    ? 'border-amber-500 bg-amber-900/35 text-amber-100'
                                                    : 'border-slate-700 bg-black/30 text-slate-400 hover:border-amber-800 hover:text-slate-100'
                                            }`}
                                        >
                                            <Icon size={14} />
                                            {tab.label}
                                        </button>
                                    );
                                })}
                            </div>

                            {activeTab === 'info' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <InfoPill icon={Shield} label="Raza" value={player.race || 'Desconocida'} />
                                        <InfoPill icon={Swords} label="Clase" value={player.className || 'Sin clase'} />
                                        <InfoPill icon={Star} label="Nivel" value={formatNumber(player.level)} />
                                        <InfoPill icon={Eye} label="Última conexión" value={
                                            player.lastLogin
                                                ? new Date(player.lastLogin).toLocaleDateString('es-ES')
                                                : 'Desconocida'
                                        } />
                                    </div>

                                    {alliance ? (
                                        <Link
                                            to={`/alliance/${alliance.id}`}
                                            onClick={onClose}
                                            className="flex items-center gap-3 rounded-lg border border-amber-900/40 bg-black/35 p-4 transition-colors hover:border-amber-600/45"
                                        >
                                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded border border-amber-500/45 bg-slate-950">
                                                {alliance.logoUrl ? (
                                                    <img src={alliance.logoUrl} alt="" className="h-8 w-8 object-contain" />
                                                ) : (
                                                    <Shield size={26} className="text-amber-300" />
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-amber-100">{alliance.name}</p>
                                                <p className="text-xs text-slate-500">
                                                    {alliance.tag || 'SIN TAG'}
                                                    {alliance.role && ` · ${alliance.role === 'leader' ? 'Líder' : alliance.role === 'admin' ? 'Administrador' : 'Miembro'}`}
                                                </p>
                                            </div>
                                            <span className="ml-auto text-xs text-amber-400/60">&rarr;</span>
                                        </Link>
                                    ) : (
                                        <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-black/25 p-4 opacity-70">
                                            <Shield size={26} className="text-slate-600" />
                                            <p className="text-sm text-slate-500">Sin alianza</p>
                                        </div>
                                    )}

                                    {allianceRole && (
                                        <div className="rounded-lg border border-white/10 bg-black/25 p-4">
                                            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Contexto de alianza</p>
                                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                                {allianceRole && <InfoPill label="Rol en alianza" value={allianceRole} />}
                                                {memberSince && (
                                                    <InfoPill label="Miembro desde" value={new Date(memberSince).toLocaleDateString('es-ES')} />
                                                )}
                                                {contribution && <InfoPill label="Contribución" value={contribution} />}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'stats' && statistics && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                        <StatCard icon={Swords} label="Batallas totales" value={formatNumber(statistics.battlesTotal)} />
                                        <StatCard icon={Trophy} label="Batallas ganadas" value={formatNumber(statistics.battlesWon)} color="win" />
                                        <StatCard icon={Skull} label="Batallas perdidas" value={formatNumber(statistics.battlesLost)} color="loss" />
                                        <StatCard icon={Crosshair} label="Win rate" value={`${formatNumber(statistics.winRate)}%`} />
                                        <StatCard icon={Map} label="Mazmorras" value={formatNumber(statistics.dungeonsCompleted)} />
                                        <StatCard icon={Skull} label="Jefes derrotados" value={formatNumber(statistics.bossesKilled)} />
                                        <StatCard icon={ScrollText} label="Logros" value={`${formatNumber(statistics.achievementsCompleted)} / ${formatNumber(statistics.achievementsTotal)}`} />
                                        <StatCard icon={Scroll} label="Fases de logros" value={formatNumber(statistics.achievementPhasesCompleted)} />
                                        <StatCard icon={Eye} label="Bestiario" value={formatNumber(statistics.bestiaryDiscovered)} />
                                        <StatCard icon={Map} label="Misiones completadas" value={formatNumber(statistics.questsCompleted)} />
                                    </div>
                                </div>
                            )}

                            {!loading && !error && !player && (
                                <div className="rounded-lg border border-slate-800 bg-black/35 p-8 text-center text-slate-500">
                                    <Ghost size={40} className="mx-auto mb-3 text-slate-600" />
                                    <p className="font-serif text-lg font-bold text-slate-300">Jugador no encontrado.</p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </section>
        </div>
    );
}

function InfoPill({ icon: Icon, label, value }) {
    return (
        <div className="rounded border border-white/10 bg-black/30 p-3">
            <div className="flex items-center gap-2">
                {Icon && createElement(Icon, { size: 14, className: 'text-amber-300 shrink-0' })}
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</span>
            </div>
            <p className="mt-1 truncate text-sm font-bold text-slate-100">{value}</p>
        </div>
    );
}

function StatCard({ icon: Icon, label, value, color = 'normal' }) {
    const palette = color === 'win'
        ? 'border-emerald-800/40 bg-emerald-950/10 text-emerald-100'
        : color === 'loss'
            ? 'border-red-900/40 bg-red-950/10 text-red-100'
            : 'border-amber-900/35 bg-amber-950/10 text-amber-100';
    return (
        <div className={`rounded-lg border p-4 ${palette}`}>
            <div className="flex items-center gap-2">
                {createElement(Icon, { size: 16, className: 'shrink-0 opacity-80' })}
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">{label}</p>
            </div>
            <p className="mt-2 text-2xl font-black">{value}</p>
        </div>
    );
}

export default PlayerProfileModal;
