import { createElement, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
    AlertTriangle,
    ArrowRight,
    Banknote,
    Building2,
    Check,
    Coins,
    Crown,
    DoorOpen,
    Edit3,
    Gem,
    Hammer,
    HandCoins,
    Landmark,
    Lock,
    MessageSquare,
    Search,
    Shield,
    Sparkles,
    Scale,
    Swords,
    Trash2,
    UserPlus,
    Users,
    X
} from 'lucide-react';
import { ALLIANCE_JOIN_LABELS as JOIN_LABELS, ALLIANCE_JOIN_OPTIONS, OFFICIAL_ALLIANCE_EMBLEMS } from '../constants/alliance';
import { allianceService } from '../services/allianceService';
import { formatBuildingEffect, formatUnlockRequirement } from '../utils/allianceFormatters';
import PlayerProfileModal from '../components/player/PlayerProfileModal';

const CURRENCY_ICONS = {
    copper: '/icons/currency/copper.png',
    silver: '/icons/currency/silver.png',
    gold: '/icons/currency/gold.png',
    onix: '/icons/currency/onix.png'
};

const ROLE_LABELS = {
    leader: 'Líder',
    admin: 'Administrador',
    member: 'Miembro'
};

const TABS = [
    { id: 'home', label: 'Inicio', icon: Crown },
    { id: 'buildings', label: 'Edificios', icon: Building2 },
    { id: 'members', label: 'Miembros', icon: Users },
    { id: 'donations', label: 'Donaciones', icon: HandCoins },
    { id: 'judgement', label: 'Salón del Juicio', icon: Scale },
    { id: 'applications', label: 'Solicitudes', icon: UserPlus },
    { id: 'admin', label: 'Administración', icon: Edit3 }
];

const formatNumber = (value) => new Intl.NumberFormat('es-ES').format(Number(value || 0));

const emptyMoney = { copper: 0, silver: 0, gold: 0, onix: 0 };

function CurrencyPills({ money = emptyMoney, compact = false }) {
    const entries = [
        ['gold', money.gold, 'Oro'],
        ['silver', money.silver, 'Plata'],
        ['copper', money.copper, 'Cobre'],
        ['onix', money.onix, 'Ónix']
    ];

    return (
        <div className="flex flex-wrap gap-2">
            {entries.map(([key, value, label]) => (
                <span
                    key={key}
                    title={label}
                    className={`inline-flex items-center gap-1.5 rounded border font-bold ${
                        compact ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-xs'
                    } ${
                        key === 'onix'
                            ? 'border-purple-500/45 bg-purple-950/30 text-purple-100'
                            : 'border-amber-800/45 bg-black/45 text-amber-100'
                    }`}
                >
                    <img src={CURRENCY_ICONS[key]} alt="" className="h-4 w-4 object-contain" />
                    {formatNumber(value)}
                </span>
            ))}
        </div>
    );
}

function AlliancePage({ user, onUpdateUser }) {
    const [myAlliance, setMyAlliance] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const loadMyAlliance = useCallback(async () => {
        setLoading(true);
        try {
            const data = await allianceService.getMyAlliance();
            setMyAlliance(data);
            setError(null);
        } catch (requestError) {
            setError(requestError.message || 'No se pudo cargar Alianza.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (user) loadMyAlliance();
    }, [user, loadMyAlliance]);

    if (!user) return null;

    return (
        <div className="relative min-h-full overflow-hidden bg-[#07090d] text-slate-100">
            <img
                src="/backgrounds/throne_room.png"
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-[0.12] saturate-[0.75]"
                onError={(event) => {
                    event.currentTarget.style.display = 'none';
                }}
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,7,13,0.66),rgba(2,6,12,0.96))]" />

            <div className="relative z-10 p-4 md:p-6 lg:p-8">
                {error && (
                    <div className="mb-4 rounded-lg border border-red-900/60 bg-red-950/35 p-4 text-sm text-red-200">
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="rounded-lg border border-amber-900/35 bg-black/55 p-10 text-center text-slate-400 animate-pulse">
                        Cargando alianzas...
                    </div>
                ) : myAlliance?.hasAlliance ? (
                    <AllianceInternal
                        data={myAlliance}
                        user={user}
                        onRefresh={loadMyAlliance}
                        onUpdateUser={onUpdateUser}
                    />
                ) : (
                    <AllianceDirectory onJoined={loadMyAlliance} />
                )}
            </div>
        </div>
    );
}

function Panel({ children, className = '' }) {
    return (
        <section className={`rounded-lg border border-amber-900/40 bg-slate-950/85 shadow-[0_18px_50px_rgba(0,0,0,0.34)] ${className}`}>
            {children}
        </section>
    );
}

function SectionTitle({ icon: Icon, title, subtitle, action }) {
    return (
        <div className="flex flex-col gap-3 border-b border-white/10 p-4 md:flex-row md:items-center md:justify-between md:p-5">
            <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-amber-600/40 bg-black/35">
                    {createElement(Icon, { size: 23, className: 'text-amber-300' })}
                </div>
                <div className="min-w-0">
                    <h2 className="font-serif text-2xl font-bold text-amber-100">{title}</h2>
                    {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
                </div>
            </div>
            {action}
        </div>
    );
}

function AllianceDirectory({ onJoined }) {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('available');
    const [alliances, setAlliances] = useState([]);
    const [pagination, setPagination] = useState(null);
    const [filters, setFilters] = useState({
        search: '',
        joinType: '',
        onlyAvailable: true,
        sortBy: 'level'
    });
    const [loading, setLoading] = useState(true);
    const [feedback, setFeedback] = useState(null);
    const [applyTarget, setApplyTarget] = useState(null);

    const loadAlliances = useCallback(async () => {
        setLoading(true);
        try {
            const data = await allianceService.listAlliances({
                ...filters,
                onlyAvailable: filters.onlyAvailable ? 'true' : '',
                page: 1,
                limit: 24
            });
            setAlliances(data.alliances || []);
            setPagination(data.pagination || null);
        } catch (requestError) {
            setFeedback(requestError.message || 'No se pudieron cargar alianzas.');
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        loadAlliances();
    }, [loadAlliances]);

    const visibleAlliances = activeTab === 'requests'
        ? alliances.filter((alliance) => alliance.hasPendingApplication)
        : alliances;

    return (
        <div className="space-y-5">
            <Panel>
                <SectionTitle
                    icon={Shield}
                    title="Alianzas"
                    subtitle="Juramentos, fortalezas y tesoros compartidos."
                    action={(
                        <button
                            type="button"
                            onClick={() => navigate('/alliance/create')}
                            className="inline-flex items-center justify-center gap-2 rounded border border-amber-500/60 bg-amber-700/25 px-4 py-2 text-xs font-black uppercase tracking-widest text-amber-100 transition-colors hover:bg-amber-700/40"
                        >
                            <Crown size={15} />
                            Crear alianza
                        </button>
                    )}
                />

                <div className="p-4 md:p-5">
                    <div className="mb-4 flex flex-wrap gap-2">
                        {[
                            ['available', 'Alianzas disponibles'],
                            ['create', 'Crear alianza'],
                            ['requests', 'Mis solicitudes']
                        ].map(([id, label]) => (
                            <button
                                key={id}
                                type="button"
                                onClick={() => (id === 'create' ? navigate('/alliance/create') : setActiveTab(id))}
                                className={`rounded border px-3 py-2 text-[11px] font-bold uppercase tracking-widest transition-colors ${
                                    activeTab === id
                                        ? 'border-amber-500 bg-amber-900/35 text-amber-100'
                                        : 'border-slate-700 bg-black/30 text-slate-400 hover:border-amber-800 hover:text-slate-100'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_auto]">
                        <label className="relative block">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                value={filters.search}
                                onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
                                placeholder="Buscar por nombre, tag o descripcion..."
                                className="w-full rounded border border-slate-700 bg-black/45 py-2.5 pl-9 pr-3 text-sm text-slate-100 outline-none focus:border-amber-500"
                            />
                        </label>
                        <select
                            value={filters.joinType}
                            onChange={(event) => setFilters((prev) => ({ ...prev, joinType: event.target.value }))}
                            className="rounded border border-slate-700 bg-black/45 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-amber-500"
                        >
                            <option value="">Ingreso: todos</option>
                            <option value="open">Abierta</option>
                            <option value="request">Por solicitud</option>
                            <option value="closed">Cerrada</option>
                        </select>
                        <select
                            value={filters.sortBy}
                            onChange={(event) => setFilters((prev) => ({ ...prev, sortBy: event.target.value }))}
                            className="rounded border border-slate-700 bg-black/45 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-amber-500"
                        >
                            <option value="level">Nivel</option>
                            <option value="members">Miembros</option>
                            <option value="newest">Recientes</option>
                            <option value="name">Nombre</option>
                        </select>
                        <label className="inline-flex items-center gap-2 rounded border border-slate-700 bg-black/35 px-3 py-2.5 text-xs font-bold uppercase tracking-widest text-slate-300">
                            <input
                                type="checkbox"
                                checked={filters.onlyAvailable}
                                onChange={(event) => setFilters((prev) => ({ ...prev, onlyAvailable: event.target.checked }))}
                                className="accent-amber-500"
                            />
                            Con cupo
                        </label>
                    </div>

                    {feedback && (
                        <div className="mb-4 rounded border border-amber-700/40 bg-amber-950/25 px-3 py-2 text-sm text-amber-100">
                            {feedback}
                        </div>
                    )}

                    {loading ? (
                        <div className="rounded-lg border border-slate-800 bg-black/35 p-10 text-center text-slate-500 animate-pulse">
                            Explorando estandartes...
                        </div>
                    ) : visibleAlliances.length === 0 ? (
                        <div className="rounded-lg border-2 border-dashed border-slate-800 bg-black/25 p-10 text-center text-slate-500">
                            No hay alianzas para estos filtros.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                            {visibleAlliances.map((alliance) => (
                                <AllianceCard
                                    key={alliance.id}
                                    alliance={alliance}
                                    onApply={() => setApplyTarget(alliance)}
                                />
                            ))}
                        </div>
                    )}

                    {pagination && (
                        <div className="mt-4 text-right text-xs text-slate-600">
                            {formatNumber(pagination.total)} alianzas encontradas
                        </div>
                    )}
                </div>
            </Panel>

            {applyTarget && (
                <ApplyModal
                    alliance={applyTarget}
                    onClose={() => setApplyTarget(null)}
                    onApplied={async (result) => {
                        setApplyTarget(null);
                        setFeedback(result.message || 'Solicitud enviada.');
                        await loadAlliances();
                        if (result.joined) onJoined?.();
                    }}
                />
            )}
        </div>
    );
}

function AllianceCard({ alliance, onApply }) {
    return (
        <article className="overflow-hidden rounded-lg border border-amber-900/35 bg-black/35 shadow-[0_14px_34px_rgba(0,0,0,0.24)] transition-colors hover:border-amber-600/45">
            <div className="h-16 bg-[linear-gradient(135deg,rgba(120,53,15,0.34),rgba(30,41,59,0.35))]" />
            <div className="p-4">
                <div className="-mt-12 mb-3 flex items-end justify-between gap-3">
                    <div className="flex min-w-0 items-end gap-3">
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-amber-500/50 bg-slate-950">
                            {alliance.logoUrl ? (
                                <img src={alliance.logoUrl} alt="" className="h-12 w-12 object-contain" />
                            ) : (
                                <Shield size={34} className="text-amber-300" />
                            )}
                        </div>
                        <div className="min-w-0 pb-1">
                            <h3 className="truncate font-serif text-2xl font-bold text-amber-100">{alliance.name}</h3>
                            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                                {alliance.tag || 'SIN TAG'} · Nivel {formatNumber(alliance.level)}
                            </p>
                        </div>
                    </div>
                    <span className="rounded border border-slate-700 bg-slate-950/80 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-300">
                        {JOIN_LABELS[alliance.joinType] || alliance.joinType}
                    </span>
                </div>

                <p className="min-h-[3rem] text-sm leading-6 text-slate-400 line-clamp-2">
                    {alliance.description || 'Sin descripcion.'}
                </p>

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <InfoPill label="Líder" value={alliance.leaderName || 'Desconocido'} />
                    <InfoPill label="Miembros" value={`${formatNumber(alliance.membersCount)} / ${formatNumber(alliance.maxMembers)}`} />
                    <InfoPill label="Nivel mínimo" value={formatNumber(alliance.minLevelRequired)} />
                    <InfoPill label="Poder mínimo" value={formatNumber(alliance.minPowerRequired)} />
                </div>

                <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <Link
                        to={`/alliance/${alliance.id}`}
                        className="inline-flex items-center gap-2 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-200 transition-colors hover:border-amber-500 hover:text-amber-100"
                    >
                        Ver alianza
                        <ArrowRight size={13} />
                    </Link>
                    <button
                        type="button"
                        onClick={onApply}
                        disabled={!alliance.canApply}
                        title={alliance.applyBlockedReason || ''}
                        className={`inline-flex items-center gap-2 rounded border px-3 py-2 text-xs font-black uppercase tracking-wider transition-colors ${
                            alliance.canApply
                                ? 'border-amber-500/60 bg-amber-700/25 text-amber-100 hover:bg-amber-700/40'
                                : 'cursor-not-allowed border-slate-800 bg-slate-900/60 text-slate-600'
                        }`}
                    >
                        <UserPlus size={13} />
                        {alliance.hasPendingApplication ? 'Pendiente' : 'Aplicar'}
                    </button>
                </div>
            </div>
        </article>
    );
}

function InfoPill({ label, value }) {
    return (
        <div className="rounded border border-white/10 bg-black/30 px-3 py-2">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</div>
            <div className="mt-0.5 truncate font-bold text-slate-100">{value}</div>
        </div>
    );
}

function AllianceInternal({ data, user, onRefresh, onUpdateUser }) {
    const [searchParams, setSearchParams] = useSearchParams();
    const tabFromUrl = searchParams.get('tab') || '';
    const activeTab = TABS.some((t) => t.id === tabFromUrl) ? tabFromUrl : 'home';
    const [feedback, setFeedback] = useState(null);
    const [confirmDialog, setConfirmDialog] = useState(null);
    const [judgementDraftMember, setJudgementDraftMember] = useState(null);
    const [profilePlayerId, setProfilePlayerId] = useState(null);
    const { alliance, permissions, role } = data;
    const canAccessAdmin = permissions.editMessage
        || permissions.editAlliance
        || permissions.transferLeadership
        || permissions.disbandAlliance;
    const visibleTabs = TABS.filter((tab) => {
        if (tab.id === 'applications') return permissions.manageApplications;
        if (tab.id === 'admin') return canAccessAdmin;
        return true;
    });

    const handleTab = (tabId) => {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set('tab', tabId);
            return next;
        });
    };

    const handleLeave = async () => {
        try {
            const result = await allianceService.leaveAlliance();
            setFeedback(result.message || 'Has salido de la alianza.');
            await onRefresh();
        } catch (requestError) {
            setFeedback(requestError.message || 'No se pudo salir de la alianza.');
        }
    };

    const requestLeave = () => {
        setConfirmDialog({
            title: 'Salir de la alianza',
            message: 'Las donaciones no se devuelven. Esta accion te retirara de la alianza.',
            confirmText: 'Salir',
            variant: 'danger',
            onConfirm: handleLeave
        });
    };

    const confirmCurrentAction = async () => {
        const action = confirmDialog?.onConfirm;
        setConfirmDialog(null);
        if (action) await action();
    };

    return (
        <div className="space-y-5">
            <Panel className="overflow-hidden">
                <div className="h-24 bg-[linear-gradient(135deg,rgba(120,53,15,0.34),rgba(30,41,59,0.38))]" />
                <div className="p-4 md:p-5">
                    <div className="-mt-16 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                        <div className="flex min-w-0 items-end gap-4">
                            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border border-amber-500/55 bg-slate-950 shadow-[0_0_35px_rgba(245,158,11,0.16)]">
                                {alliance.logoUrl ? (
                                    <img src={alliance.logoUrl} alt="" className="h-16 w-16 object-contain" />
                                ) : (
                                    <Shield size={52} className="text-amber-300" />
                                )}
                            </div>
                            <div className="min-w-0 pb-1">
                                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-400/80">
                                    {alliance.tag || 'VALHALLUS'} · {ROLE_LABELS[role] || role}
                                </p>
                                <h1 className="font-serif text-4xl font-bold text-amber-100 md:text-5xl">{alliance.name}</h1>
                                <p className="mt-1 text-sm text-slate-400">{alliance.description}</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={requestLeave}
                                className="inline-flex items-center gap-2 rounded border border-red-900/55 bg-red-950/25 px-3 py-2 text-xs font-bold uppercase tracking-widest text-red-200 hover:bg-red-950/40"
                            >
                                <DoorOpen size={14} />
                                Salir
                            </button>
                        </div>
                    </div>

                    {feedback && (
                        <div className="mt-4 rounded border border-amber-700/40 bg-amber-950/25 px-3 py-2 text-sm text-amber-100">
                            {feedback}
                        </div>
                    )}

                    <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
                        {visibleTabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => handleTab(tab.id)}
                                    className={`inline-flex whitespace-nowrap items-center gap-2 rounded border px-3 py-2 text-[11px] font-bold uppercase tracking-widest transition-colors ${
                                        isActive
                                            ? 'border-amber-500 bg-amber-900/35 text-amber-100'
                                            : 'border-slate-700 bg-black/30 text-slate-400 hover:border-amber-800 hover:text-slate-100'
                                    }`}
                                >
                                    <Icon size={14} />
                                    {tab.label}
                                    {tab.id === 'applications' && data.pendingApplicationsCount > 0 && (
                                        <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[9px] text-white">
                                            {data.pendingApplicationsCount}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </Panel>

            {activeTab === 'home' && <AllianceHome data={data} />}
            {activeTab === 'buildings' && (
                <AllianceBuildings
                    alliance={alliance}
                    buildings={data.buildings || []}
                    permissions={permissions}
                    onRefresh={onRefresh}
                    onFeedback={setFeedback}
                />
            )}
            {activeTab === 'members' && (
                <AllianceMembers
                    user={user}
                    permissions={permissions}
                    onFeedback={setFeedback}
                    onOpenProfile={setProfilePlayerId}
                    onOpenJudgement={(member) => {
                        setJudgementDraftMember(member);
                        setSearchParams((prev) => {
                            const next = new URLSearchParams(prev);
                            next.set('tab', 'judgement');
                            return next;
                        });
                    }}
                />
            )}
            {activeTab === 'donations' && (
                <AllianceDonationsPanel
                    onUpdateUser={onUpdateUser}
                    onRefresh={onRefresh}
                />
            )}
            {activeTab === 'judgement' && (
                <AllianceJudgementPanel
                    user={user}
                    permissions={permissions}
                    initialAccused={judgementDraftMember}
                    onConsumedInitial={() => setJudgementDraftMember(null)}
                    onRefresh={onRefresh}
                    onOpenProfile={setProfilePlayerId}
                />
            )}
            {activeTab === 'applications' && (
                <AllianceApplicationsPanel
                    allianceId={alliance.id}
                    permissions={permissions}
                    pendingCount={data.pendingApplicationsCount}
                    onRefresh={onRefresh}
                    onOpenProfile={setProfilePlayerId}
                />
            )}
            {activeTab === 'admin' && (
                <AllianceAdminPanel
                    data={data}
                    onRefresh={onRefresh}
                    onFeedback={setFeedback}
                />
            )}
            <ConfirmDialog
                isOpen={Boolean(confirmDialog)}
                title={confirmDialog?.title}
                message={confirmDialog?.message}
                confirmText={confirmDialog?.confirmText}
                cancelText={confirmDialog?.cancelText}
                variant={confirmDialog?.variant}
                onConfirm={confirmCurrentAction}
                onCancel={() => setConfirmDialog(null)}
            />
            <PlayerProfileModal
                playerId={profilePlayerId}
                isOpen={Boolean(profilePlayerId)}
                onClose={() => setProfilePlayerId(null)}
            />
        </div>
    );
}

function AllianceHome({ data }) {
    const { alliance, buildings = [], bonuses = {}, recentActivity = [], membersPreview = [], topDonors = [] } = data;
    const mainBuildings = buildings.slice(0, 4);

    return (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-5">
                <Panel className="overflow-hidden">
                    <div className="relative min-h-[260px] border-b border-amber-900/35 bg-[linear-gradient(135deg,rgba(120,53,15,0.36),rgba(15,23,42,0.78))] p-5 md:p-6">
                        <img
                            src={alliance.bannerUrl || '/backgrounds/throne_room.png'}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover opacity-25"
                            onError={(event) => {
                                event.currentTarget.style.display = 'none';
                            }}
                        />
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.18),transparent_36%),linear-gradient(180deg,rgba(0,0,0,0.25),rgba(0,0,0,0.78))]" />
                        <div className="relative flex min-h-[215px] flex-col justify-end gap-5 md:flex-row md:items-end md:justify-between">
                            <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end">
                                <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-lg border border-amber-500/55 bg-slate-950/90 shadow-[0_0_35px_rgba(245,158,11,0.18)]">
                                    {alliance.logoUrl ? (
                                        <img src={alliance.logoUrl} alt="" className="h-20 w-20 object-contain" />
                                    ) : (
                                        <Shield size={58} className="text-amber-300" />
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-amber-300/85">{alliance.tag || 'VALHALLUS'}</p>
                                    <h2 className="font-serif text-4xl font-black text-amber-100 md:text-5xl">{alliance.name}</h2>
                                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{alliance.description || 'Sin descripción.'}</p>
                                </div>
                            </div>
                            <div className="rounded border border-amber-700/35 bg-black/45 p-3">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-300/80">Mensaje del día</p>
                                <p className="mt-1 max-w-sm text-sm leading-6 text-slate-200">{alliance.messageOfTheDay || 'Sin mensaje del día.'}</p>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-3 xl:grid-cols-6 md:p-5">
                        <StatBox icon={Shield} label="Nivel" value={formatNumber(alliance.level)} />
                        <StatBox icon={Users} label="Miembros" value={`${formatNumber(alliance.membersCount)} / ${formatNumber(alliance.maxMembers)}`} />
                        <StatBox icon={Landmark} label="Ingreso" value={JOIN_LABELS[alliance.joinType] || alliance.joinType} />
                        <StatBox icon={Crown} label="Líder" value={alliance.leaderName || 'Desconocido'} />
                        <StatBox icon={Coins} label="Tesoro" value={`${formatNumber(alliance.treasury?.gold)} oro`} />
                        <StatBox icon={Sparkles} label="Fundada" value={alliance.createdAt ? new Date(alliance.createdAt).toLocaleDateString('es-ES') : 'Sin registro'} />
                    </div>
                </Panel>

                <Panel>
                    <SectionTitle icon={Sparkles} title="Bonos activos" />
                    <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 md:p-5">
                        <BonusBox label="Atributos" value={`+${formatNumber(bonuses.statsPercent)}%`} />
                        <BonusBox label="Experiencia" value={`+${formatNumber(bonuses.expPercent)}%`} />
                        <BonusBox label="Miembros máx." value={formatNumber(bonuses.maxMembers || alliance.maxMembers)} />
                        <BonusBox label="Ocultos" value={`+${formatNumber(bonuses.hiddenFindPercent)}%`} />
                        <BonusBox label="Taller" value={`-${formatNumber(bonuses.workshopDiscountPercent)}%`} />
                        <BonusBox label="Tesoro" value={`+${formatNumber(bonuses.treasuryCapacityBonusPercent)}%`} />
                    </div>
                </Panel>

                <Panel>
                    <SectionTitle icon={Building2} title="Edificios principales" />
                    <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 md:p-5">
                        {mainBuildings.map((building) => (
                            <BuildingMiniCard key={building.id} building={building} />
                        ))}
                    </div>
                </Panel>
            </div>

            <div className="space-y-5">
                <Panel>
                    <SectionTitle icon={Coins} title="Tesoro" />
                    <div className="p-4 md:p-5">
                        <CurrencyPills money={alliance.treasury} />
                    </div>
                </Panel>

                <Panel>
                    <SectionTitle icon={Users} title="Miembros destacados" />
                    <div className="space-y-2 p-4 md:p-5">
                        {membersPreview.map((member) => (
                            <MemberLine key={member.playerId} member={member} />
                        ))}
                    </div>
                </Panel>

                <Panel>
                    <SectionTitle icon={HandCoins} title="Top donadores" />
                    <div className="space-y-2 p-4 md:p-5">
                        {topDonors.length === 0 ? (
                            <p className="text-sm text-slate-500">Sin donaciones registradas.</p>
                        ) : topDonors.map((donor) => (
                            <div key={donor.playerId} className="rounded border border-white/10 bg-black/30 p-3">
                                <div className="mb-2 flex justify-between gap-3">
                                    <span className="font-bold text-slate-100">{donor.username}</span>
                                    <span className="text-xs text-slate-500">Nivel {formatNumber(donor.level)}</span>
                                </div>
                                <CurrencyPills money={donor.donated} compact />
                            </div>
                        ))}
                    </div>
                </Panel>

                <Panel>
                    <SectionTitle icon={MessageSquare} title="Actividad reciente" />
                    <div className="space-y-2 p-4 md:p-5">
                        {recentActivity.length === 0 ? (
                            <p className="text-sm text-slate-500">Sin actividad reciente.</p>
                        ) : recentActivity.map((item) => (
                            <div key={item.id} className="rounded border border-white/10 bg-black/30 p-3">
                                <p className="text-sm text-slate-200">{item.message}</p>
                                <p className="mt-1 text-[11px] text-slate-600">{new Date(item.createdAt).toLocaleString('es-ES')}</p>
                            </div>
                        ))}
                    </div>
                </Panel>
            </div>
        </div>
    );
}

function StatBox({ icon: Icon, label, value }) {
    return (
        <div className="rounded-lg border border-white/10 bg-black/30 p-4">
            {createElement(Icon, { size: 20, className: 'mb-3 text-amber-300' })}
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
            <p className="mt-1 text-xl font-black text-slate-100">{value}</p>
        </div>
    );
}

function BonusBox({ label, value }) {
    return (
        <div className="rounded-lg border border-amber-900/35 bg-amber-950/10 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-300/80">{label}</p>
            <p className="mt-1 text-2xl font-black text-amber-100">{value}</p>
        </div>
    );
}

function BuildingMiniCard({ building }) {
    return (
        <div className={`rounded-lg border p-4 ${building.isUnlocked ? 'border-white/10 bg-black/30' : 'border-slate-800 bg-slate-950/70 opacity-65'}`}>
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="font-serif text-lg font-bold text-amber-100">{building.name}</p>
                    <p className="text-xs text-slate-500">Nivel {formatNumber(building.level)} / {formatNumber(building.maxLevel)}</p>
                </div>
                {building.isUnlocked ? <Building2 size={20} className="text-amber-300" /> : <Lock size={20} className="text-slate-600" />}
            </div>
        </div>
    );
}

function MemberLine({ member }) {
    return (
        <div className="flex items-center justify-between gap-3 rounded border border-white/10 bg-black/30 px-3 py-2">
            <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-100">{member.username}</p>
                <p className="text-[11px] text-slate-500">{ROLE_LABELS[member.role] || member.role}</p>
            </div>
            <span className="text-xs font-bold text-amber-200">Nvl {formatNumber(member.level)}</span>
        </div>
    );
}

function AllianceBuildings({ alliance, buildings, permissions, onRefresh, onFeedback }) {
    const [upgradingId, setUpgradingId] = useState(null);
    const [confirmBuilding, setConfirmBuilding] = useState(null);

    const handleUpgrade = async (building) => {
        setUpgradingId(building.id);
        try {
            const result = await allianceService.upgradeBuilding(building.id);
            onFeedback(result.message || 'Edificio mejorado.');
            await onRefresh();
        } catch (requestError) {
            onFeedback(requestError.message || 'No se pudo mejorar el edificio.');
        } finally {
            setUpgradingId(null);
        }
    };
    const nextLevel = confirmBuilding ? Number(confirmBuilding.level || 0) + 1 : 0;

    return (
        <Panel>
            <SectionTitle icon={Building2} title="Edificios" subtitle="Mejoras permanentes de la fortaleza." />
            <div className="border-b border-white/10 p-4 md:p-5">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Tesoro de alianza</p>
                <CurrencyPills money={alliance.treasury} />
            </div>
            <div className="space-y-4 p-4 md:p-5">
                {buildings.map((building) => (
                    <BuildingUpgradeRow
                        key={building.id}
                        building={building}
                        canUpgrade={permissions.upgradeBuildings}
                        isUpgrading={upgradingId === building.id}
                        onUpgrade={() => setConfirmBuilding(building)}
                    />
                ))}
            </div>
            <ConfirmDialog
                isOpen={Boolean(confirmBuilding)}
                title="Mejorar edificio"
                message={confirmBuilding && (
                    <div className="space-y-3 text-left">
                        <p>Se consumiran fondos del tesoro de la alianza.</p>
                        <div className="rounded border border-white/10 bg-black/30 p-3">
                            <p className="font-serif text-xl font-bold text-amber-100">{confirmBuilding.name}</p>
                            <p className="text-sm text-slate-400">
                                Nivel {formatNumber(confirmBuilding.level)} -&gt; {formatNumber(nextLevel)}
                            </p>
                        </div>
                        <div>
                            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Costo</p>
                            <CurrencyPills money={confirmBuilding.nextUpgradeCost} compact />
                        </div>
                        <EffectBlock title="Beneficio actual" effect={confirmBuilding.currentEffect} />
                        <EffectBlock title="Siguiente beneficio" effect={confirmBuilding.nextEffect} empty="Nivel máximo" />
                    </div>
                )}
                confirmText={upgradingId ? 'Mejorando...' : 'Mejorar'}
                variant="warning"
                onConfirm={async () => {
                    const building = confirmBuilding;
                    setConfirmBuilding(null);
                    if (building) await handleUpgrade(building);
                }}
                onCancel={() => setConfirmBuilding(null)}
            />
        </Panel>
    );
}

function BuildingImage({ src, alt, locked = false }) {
    const [hasError, setHasError] = useState(false);

    if (!src || hasError) {
        return locked
            ? <Lock size={46} className="text-slate-600" />
            : <Building2 size={46} className="text-amber-300" />;
    }

    return (
        <img
            src={src}
            alt={alt}
            className="h-20 w-20 object-contain drop-shadow-[0_0_18px_rgba(245,158,11,0.18)]"
            onError={() => setHasError(true)}
        />
    );
}

function BuildingUpgradeRow({ building, canUpgrade, isUpgrading, onUpgrade }) {
    const progress = building.maxLevel > 0 ? Math.min(100, (Number(building.level || 0) / Number(building.maxLevel || 1)) * 100) : 0;
    const requirementEntries = Object.entries(building.unlockRequirements || {});
    const upgradeEnabled = canUpgrade && building.isUnlocked && building.nextUpgradeCost && !isUpgrading;
    const currentImage = building.levelImages?.[building.level]
        || building.levelImages?.[String(building.level)]
        || building.imageUrl;

    return (
        <article
            className={`relative overflow-hidden rounded-lg border p-4 ${
            building.isUnlocked ? 'border-amber-900/40 bg-black/35' : 'border-slate-800 bg-slate-950/80'
        }`}
            style={building.backgroundUrl ? {
                backgroundImage: `linear-gradient(90deg, rgba(2,6,12,0.92), rgba(2,6,12,0.78)), url(${building.backgroundUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
            } : undefined}
        >
            {!building.isUnlocked && <div className="absolute inset-0 bg-black/20" />}
            <div className="relative grid grid-cols-1 gap-4 lg:grid-cols-[120px_minmax(0,1fr)_240px] lg:items-start">
                <div className={`flex h-28 w-full items-center justify-center rounded border ${
                    building.isUnlocked ? 'border-amber-700/45 bg-amber-950/10' : 'border-slate-800 bg-black/40'
                }`}>
                    <BuildingImage
                        src={currentImage}
                        alt={building.name}
                        locked={!building.isUnlocked}
                    />
                </div>

                <div className="min-w-0">
                    <div className="mb-2 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div>
                            <h3 className="font-serif text-2xl font-bold text-amber-100">{building.name}</h3>
                            <p className="mt-1 text-sm leading-6 text-slate-400">{building.description}</p>
                        </div>
                        <span className={`inline-flex w-fit items-center gap-2 rounded border px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${
                            building.isUnlocked ? 'border-emerald-700/45 bg-emerald-950/20 text-emerald-200' : 'border-slate-700 bg-slate-900/70 text-slate-500'
                        }`}>
                            {building.isUnlocked ? <Hammer size={12} /> : <Lock size={12} />}
                            {building.isUnlocked ? 'Desbloqueado' : 'Bloqueado'}
                        </span>
                    </div>

                    <div className="mb-3">
                        <div className="mb-1 flex justify-between text-xs font-bold text-slate-500">
                            <span>Nivel {formatNumber(building.level)} / {formatNumber(building.maxLevel)}</span>
                            <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full border border-slate-800 bg-black/60">
                            <div className="h-full bg-[linear-gradient(90deg,#92400e,#f59e0b,#fde68a)]" style={{ width: `${progress}%` }} />
                        </div>
                    </div>

                    {!building.isUnlocked && requirementEntries.length > 0 && (
                        <div className="mb-3 rounded border border-red-900/40 bg-red-950/15 p-3">
                            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-red-300">Requisito</p>
                            {requirementEntries.map(([code, level]) => (
                                <p key={code} className="text-sm text-red-100">{formatUnlockRequirement(code, level)}</p>
                            ))}
                        </div>
                    )}

                    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                        <EffectBlock title="Beneficio actual" effect={building.currentEffect} />
                        <EffectBlock title="Siguiente beneficio" effect={building.nextEffect} empty="Nivel máximo" />
                    </div>
                </div>

                <div className="rounded-lg border border-white/10 bg-black/25 p-3">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Costo de mejora</p>
                    {building.nextUpgradeCost ? (
                        <CurrencyPills money={building.nextUpgradeCost} compact />
                    ) : (
                        <p className="text-sm text-slate-500">Sin mejora disponible</p>
                    )}
                    {canUpgrade && (
                        <button
                            type="button"
                            disabled={!upgradeEnabled}
                            onClick={onUpgrade}
                            className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded border px-4 py-2.5 text-xs font-black uppercase tracking-widest ${
                                upgradeEnabled
                                    ? 'border-amber-500/60 bg-amber-700/25 text-amber-100 hover:bg-amber-700/40'
                                    : 'cursor-not-allowed border-slate-800 bg-slate-900/70 text-slate-600'
                            }`}
                        >
                            <Hammer size={14} />
                            {isUpgrading ? 'Mejorando...' : 'Mejorar'}
                        </button>
                    )}
                </div>
            </div>
        </article>
    );
}

function EffectBlock({ title, effect, empty = 'Sin beneficio' }) {
    const entries = formatBuildingEffect(effect);
    return (
        <div className="mt-3 rounded border border-white/10 bg-black/25 p-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">{title}</p>
            {entries.length === 0 ? (
                <p className="text-sm text-slate-500">{empty}</p>
            ) : (
                <div className="flex flex-wrap gap-2">
                    {entries.map((entry) => (
                        <span key={entry} className="rounded border border-amber-800/35 bg-amber-950/15 px-2 py-1 text-xs font-bold text-amber-100">
                            {entry}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

function AllianceMembers({ user, permissions, onFeedback, onOpenJudgement, onOpenProfile }) {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [selectedId, setSelectedId] = useState(null);

    const loadMembers = useCallback(async () => {
        setLoading(true);
        try {
            const data = await allianceService.getMembers();
            setMembers(data.members || []);
            setSelectedId((previous) => previous || data.members?.[0]?.playerId || null);
        } catch (requestError) {
            onFeedback(requestError.message || 'No se pudieron cargar miembros.');
        } finally {
            setLoading(false);
        }
    }, [onFeedback]);

    useEffect(() => {
        loadMembers();
    }, [loadMembers]);

    const filteredMembers = useMemo(() => {
        const normalized = search.trim().toLocaleLowerCase('es');
        return members.filter((member) => {
            if (roleFilter && member.role !== roleFilter) return false;
            if (!normalized) return true;
            return member.username.toLocaleLowerCase('es').includes(normalized);
        });
    }, [members, roleFilter, search]);

    const selected = members.find((member) => member.playerId === selectedId) || filteredMembers[0] || members[0];

    const runMemberAction = async (action, member) => {
        try {
            const result = await action(member.playerId);
            onFeedback(result.message || 'Accion realizada.');
            await loadMembers();
        } catch (requestError) {
            onFeedback(requestError.message || 'No se pudo realizar la accion.');
        }
    };

    const canProposeJudgement = (member) => {
        if (!permissions.manageMembers || !member) return false;
        if (String(member.playerId) === String(user.id)) return false;
        return member.role !== 'leader';
    };

    return (
        <Panel>
            <SectionTitle icon={Users} title="Miembros" subtitle="Escuadra juramentada de la alianza." />
            <div className="grid grid-cols-1 gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_360px] md:p-5">
                <div>
                    <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
                        <label className="relative block">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Buscar miembro..."
                                className="w-full rounded border border-slate-700 bg-black/45 py-2.5 pl-9 pr-3 text-sm text-slate-100 outline-none focus:border-amber-500"
                            />
                        </label>
                        <select
                            value={roleFilter}
                            onChange={(event) => setRoleFilter(event.target.value)}
                            className="rounded border border-slate-700 bg-black/45 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-amber-500"
                        >
                            <option value="">Todos los roles</option>
                            <option value="leader">Líder</option>
                            <option value="admin">Administradores</option>
                            <option value="member">Miembros</option>
                        </select>
                    </div>

                    {loading ? (
                        <div className="rounded border border-slate-800 bg-black/30 p-8 text-center text-slate-500 animate-pulse">
                            Cargando miembros...
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredMembers.map((member) => (
                                <button
                                    key={member.playerId}
                                    type="button"
                                    onClick={() => {
                                        setSelectedId(member.playerId);
                                        onOpenProfile?.(member.playerId);
                                    }}
                                    className={`grid w-full grid-cols-[minmax(0,1fr)_80px_120px] items-center gap-3 rounded border px-3 py-3 text-left transition-colors ${
                                        selected?.playerId === member.playerId
                                            ? 'border-amber-500/60 bg-amber-950/20'
                                            : 'border-white/10 bg-black/30 hover:border-amber-800/45'
                                    }`}
                                >
                                    <div className="min-w-0">
                                        <p className="flex items-center gap-2 truncate font-bold text-slate-100">
                                            {member.role === 'leader' && <Crown size={13} className="shrink-0 text-amber-300" />}
                                            <span
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    onOpenProfile?.(member.playerId);
                                                }}
                                                role="button"
                                                tabIndex={0}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Enter' || event.key === ' ') {
                                                        event.preventDefault();
                                                        onOpenProfile?.(member.playerId);
                                                    }
                                                }}
                                                className="hover:text-amber-200 transition-colors cursor-pointer"
                                            >
                                                {member.username}
                                            </span>
                                        </p>
                                        <p className="text-[11px] text-amber-300/80">{ROLE_LABELS[member.role] || member.role}</p>
                                    </div>
                                    <span className="text-xs font-bold text-amber-200">Nvl {formatNumber(member.level)}</span>
                                    <span className="text-right text-xs text-slate-500">Poder {member.power ?? 'Pendiente'}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <aside className="rounded-lg border border-amber-900/40 bg-[linear-gradient(180deg,rgba(146,64,14,0.12),rgba(0,0,0,0.32))] p-4">
                    {selected ? (
                        <>
                            <div className="mb-4 flex items-start justify-between gap-3">
                                <div>
                                    <h3 className="font-serif text-2xl font-bold text-amber-100">{selected.username}</h3>
                                    <p className="text-sm text-slate-500">{ROLE_LABELS[selected.role] || selected.role}</p>
                                </div>
                                <Crown size={24} className={selected.role === 'leader' ? 'text-amber-300' : 'text-slate-600'} />
                            </div>
                            <div className="space-y-2">
                                <InfoPill label="Nivel" value={formatNumber(selected.level)} />
                                <InfoPill label="Poder" value={selected.power ?? 'Pendiente'} />
                                <InfoPill label="Ingreso" value={selected.joinedAt ? new Date(selected.joinedAt).toLocaleDateString('es-ES') : 'Sin registro'} />
                                <InfoPill label="Última actividad" value={selected.lastSeenAt ? new Date(selected.lastSeenAt).toLocaleString('es-ES') : 'Sin registro'} />
                            </div>
                            <div className="mt-4">
                                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Contribución</p>
                                <CurrencyPills money={selected.donated} compact />
                            </div>
                            <div className="mt-5 grid grid-cols-1 gap-2">
                                {permissions.promoteMembers && selected.role === 'member' && (
                                    <button
                                        type="button"
                                        onClick={() => runMemberAction(allianceService.promoteMember, selected)}
                                        className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold uppercase tracking-widest text-slate-200 hover:border-amber-800 hover:text-amber-100"
                                    >
                                        Promover
                                    </button>
                                )}
                                {permissions.demoteMembers && selected.role === 'admin' && (
                                    <button
                                        type="button"
                                        onClick={() => runMemberAction(allianceService.demoteMember, selected)}
                                        className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold uppercase tracking-widest text-slate-200 hover:border-amber-800 hover:text-amber-100"
                                    >
                                        Degradar
                                    </button>
                                )}
                                {canProposeJudgement(selected) && (
                                    <button
                                        type="button"
                                        onClick={() => onOpenJudgement?.(selected)}
                                        className="inline-flex items-center justify-center gap-2 rounded border border-red-900/60 bg-red-950/25 px-3 py-2 text-xs font-bold uppercase tracking-widest text-red-200 hover:bg-red-950/40"
                                    >
                                        <Scale size={14} />
                                        Proponer juicio
                                    </button>
                                )}
                            </div>
                        </>
                    ) : (
                        <p className="text-sm text-slate-500">Selecciona un miembro.</p>
                    )}
                </aside>
            </div>
        </Panel>
    );
}

function ApplyModal({ alliance, onClose, onApplied }) {
    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const submit = async () => {
        setSubmitting(true);
        try {
            const result = await allianceService.applyToAlliance(alliance.id, message);
            await onApplied(result);
        } catch (requestError) {
            setError(requestError.message || 'No se pudo aplicar.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <ModalFrame title={`Aplicar a ${alliance.name}`} icon={UserPlus} onClose={onClose}>
            <p className="mb-4 text-sm leading-6 text-slate-300">
                Escribe un mensaje breve para los líderes de la alianza.
            </p>
            <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={5}
                className="w-full rounded border border-slate-700 bg-black/45 p-3 text-sm text-slate-100 outline-none focus:border-amber-500"
                placeholder="Juro aportar espada, oro y lealtad..."
            />
            {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
            <button
                type="button"
                onClick={submit}
                disabled={submitting}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded border border-amber-500/60 bg-amber-700/25 px-4 py-3 text-xs font-black uppercase tracking-widest text-amber-100 hover:bg-amber-700/40 disabled:opacity-50"
            >
                <UserPlus size={15} />
                {submitting ? 'Enviando...' : alliance.joinType === 'open' ? 'Unirme' : 'Enviar solicitud'}
            </button>
        </ModalFrame>
    );
}

function AllianceDonationsPanel({ onUpdateUser, onRefresh }) {
    const [info, setInfo] = useState(null);
    const [amounts, setAmounts] = useState(emptyMoney);
    const [feedback, setFeedback] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const wallet = info?.userCurrency || emptyMoney;
    const treasury = info?.treasury || info?.treasure || emptyMoney;
    const totalAmount = Object.values(amounts).reduce((sum, value) => sum + Number(value || 0), 0);

    const loadInfo = useCallback(async () => {
        try {
            setInfo(await allianceService.getDonationInfo());
        } catch (requestError) {
            setFeedback(requestError.message || 'No se pudieron cargar donaciones.');
        }
    }, []);

    useEffect(() => {
        loadInfo();
    }, [loadInfo]);

    const setCurrency = (key, value) => {
        const parsed = Math.max(0, Number.parseInt(value || 0, 10) || 0);
        setAmounts((prev) => ({ ...prev, [key]: Math.min(parsed, Number(wallet[key] || 0)) }));
    };

    const addCurrency = (key, value) => {
        setCurrency(key, Number(amounts[key] || 0) + value);
    };

    const donate = async () => {
        setSubmitting(true);
        try {
            const result = await allianceService.donate(amounts);
            onUpdateUser?.(result.userCurrency);
            setFeedback(result.message || 'Donación registrada.');
            setAmounts(emptyMoney);
            await loadInfo();
            await onRefresh();
        } catch (requestError) {
            setFeedback(requestError.message || 'No se pudo donar.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Panel>
            <SectionTitle
                icon={HandCoins}
                title="Donaciones de la Alianza"
                subtitle="Fortalece el tesoro de tu hermandad."
            />
            <div className="grid grid-cols-1 gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_360px] md:p-5">
                <div className="space-y-4">
                    <div className="rounded border border-amber-900/35 bg-black/30 p-4">
                        <p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                            <Banknote size={14} />
                            Tesoro actual
                        </p>
                        <CurrencyPills money={treasury} />
                    </div>
                    <div className="rounded border border-slate-800 bg-black/30 p-4">
                        <p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                            <Gem size={14} />
                            Mis monedas disponibles
                        </p>
                        <CurrencyPills money={wallet} />
                    </div>
                    <div className="rounded border border-red-900/45 bg-red-950/20 p-3 text-sm text-red-200">
                        Las donaciones no pueden retirarse.
                    </div>
                    {['gold', 'silver', 'copper', 'onix'].map((key) => (
                        <div key={key} className="rounded border border-white/10 bg-black/25 p-3">
                            <div className="mb-2 flex items-center justify-between gap-3">
                                <span className="inline-flex items-center gap-2 text-sm font-bold capitalize text-slate-200">
                                    <img src={CURRENCY_ICONS[key]} alt="" className="h-5 w-5" />
                                    {key === 'onix' ? 'Ónix' : key}
                                </span>
                                <span className="text-xs text-slate-500">Disponible: {formatNumber(wallet[key])}</span>
                            </div>
                            <input
                                type="number"
                                min="0"
                                value={amounts[key]}
                                onChange={(event) => setCurrency(key, event.target.value)}
                                className="mb-2 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-500"
                            />
                            <div className="flex gap-2">
                                {(key === 'onix' ? [1, 10] : [10, 100]).map((value) => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => addCurrency(key, value)}
                                        className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] font-bold text-slate-300"
                                    >
                                        +{value}
                                    </button>
                                ))}
                                <button
                                    type="button"
                                    onClick={() => setCurrency(key, wallet[key])}
                                    className="rounded border border-amber-800/45 bg-amber-950/20 px-2 py-1 text-[11px] font-bold text-amber-100"
                                >
                                    MAX
                                </button>
                            </div>
                        </div>
                    ))}
                    {feedback && <p className="text-sm text-amber-200">{feedback}</p>}
                    <button
                        type="button"
                        onClick={donate}
                        disabled={submitting || totalAmount <= 0}
                        className="inline-flex w-full items-center justify-center gap-2 rounded border border-amber-500/60 bg-amber-700/25 px-4 py-3 text-xs font-black uppercase tracking-widest text-amber-100 hover:bg-amber-700/40 disabled:opacity-50"
                    >
                        <HandCoins size={15} />
                        {submitting ? 'Donando...' : 'Donar a la alianza'}
                    </button>
                </div>

                <div className="space-y-4">
                    <div className="rounded border border-white/10 bg-black/25 p-4">
                        <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">Top donadores</p>
                        <div className="space-y-2">
                            {(info?.topDonors || []).map((donor) => (
                                <div key={donor.playerId} className="rounded border border-white/10 bg-black/30 p-3">
                                    <div className="mb-2 flex justify-between">
                                        <span className="font-bold text-slate-100">{donor.username}</span>
                                        <span className="text-xs text-slate-500">Nvl {formatNumber(donor.level)}</span>
                                    </div>
                                    <CurrencyPills money={donor.donated} compact />
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="rounded border border-white/10 bg-black/25 p-4">
                        <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">Historial reciente</p>
                        <div className="space-y-2">
                            {(info?.recentDonations || []).map((donation) => (
                                <div key={donation.id} className="rounded border border-white/10 bg-black/30 p-3">
                                    <div className="mb-2 flex justify-between">
                                        <span className="font-bold text-slate-100">{donation.username}</span>
                                        <span className="text-[11px] text-slate-600">{new Date(donation.createdAt).toLocaleDateString('es-ES')}</span>
                                    </div>
                                    <CurrencyPills money={donation} compact />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </Panel>
    );
}

function AllianceJudgementPanel({ user, permissions, initialAccused, onConsumedInitial, onRefresh, onOpenProfile }) {
    const [data, setData] = useState(null);
    const [eligibleMembers, setEligibleMembers] = useState([]);
    const [form, setForm] = useState({ accusedPlayerId: '', reason: '' });
    const [feedback, setFeedback] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState(null);
    const canManageJudgements = Boolean(permissions.manageMembers);

    const loadJudgements = useCallback(async () => {
        setLoading(true);
        try {
            const result = await allianceService.getJudgements();
            setData(result);
            if (canManageJudgements) {
                const eligible = await allianceService.getEligibleJudgementMembers();
                setEligibleMembers(eligible.members || []);
            }
            setFeedback(null);
        } catch (requestError) {
            setFeedback(requestError.message || 'No se pudo cargar el Salon del Juicio.');
        } finally {
            setLoading(false);
        }
    }, [canManageJudgements]);

    useEffect(() => {
        loadJudgements();
    }, [loadJudgements]);

    useEffect(() => {
        if (!initialAccused) return;
        setForm((prev) => ({
            ...prev,
            accusedPlayerId: initialAccused.playerId,
            reason: prev.reason || `Se solicita juicio contra ${initialAccused.username}.`
        }));
        onConsumedInitial?.();
    }, [initialAccused, onConsumedInitial]);

    const startJudgement = async () => {
        setSubmitting(true);
        try {
            const result = await allianceService.startJudgement(form);
            setFeedback(result.message || 'Juicio proclamado.');
            setForm({ accusedPlayerId: '', reason: '' });
            await loadJudgements();
            await onRefresh?.();
        } catch (requestError) {
            setFeedback(requestError.message || 'No se pudo iniciar juicio.');
        } finally {
            setSubmitting(false);
        }
    };

    const vote = async (voteValue) => {
        if (!data?.activeJudgement) return;
        setSubmitting(true);
        try {
            const result = await allianceService.voteJudgement(data.activeJudgement.id, voteValue);
            setFeedback(result.message || 'Voto registrado.');
            if (result.judgement?.status !== 'active') {
                await loadJudgements();
                await onRefresh?.();
            } else {
                setData((prev) => ({ ...prev, activeJudgement: result.judgement }));
            }
        } catch (requestError) {
            setFeedback(requestError.message || 'No se pudo registrar el voto.');
        } finally {
            setSubmitting(false);
        }
    };

    const resolve = async () => {
        if (!data?.activeJudgement) return;
        setSubmitting(true);
        try {
            const result = await allianceService.resolveJudgement(data.activeJudgement.id);
            setFeedback(result.message || 'Juicio resuelto.');
            await loadJudgements();
            await onRefresh?.();
        } catch (requestError) {
            setFeedback(requestError.message || 'No se pudo resolver el juicio.');
        } finally {
            setSubmitting(false);
        }
    };

    const requestStart = () => {
        const selected = eligibleMembers.find((member) => String(member.playerId) === String(form.accusedPlayerId));
        setConfirmDialog({
            title: 'Proclamar juicio',
            message: `Se iniciara un juicio de 1 hora contra ${selected?.username || 'este miembro'}.`,
            confirmText: 'Proclamar juicio',
            variant: 'warning',
            onConfirm: startJudgement
        });
    };

    const requestVote = (voteValue) => {
        setConfirmDialog({
            title: voteValue === 'expel' ? 'Votar expulsar' : 'Votar mantener',
            message: voteValue === 'expel'
                ? 'Tu voto apoyara la expulsion del acusado. No podras cambiarlo.'
                : 'Tu voto apoyara conservar al acusado. No podras cambiarlo.',
            confirmText: voteValue === 'expel' ? 'Votar expulsar' : 'Votar mantener',
            variant: voteValue === 'expel' ? 'danger' : 'normal',
            onConfirm: () => vote(voteValue)
        });
    };

    const confirmCurrentAction = async () => {
        const action = confirmDialog?.onConfirm;
        setConfirmDialog(null);
        if (action) await action();
    };

    const active = data?.activeJudgement;
    const canStart = Boolean(data?.canStartJudgement && canManageJudgements && !active);
    const selectedOptionExists = eligibleMembers.some((member) => String(member.playerId) === String(form.accusedPlayerId));

    return (
        <Panel className="overflow-hidden">
            <div className="relative border-b border-red-900/35 bg-[linear-gradient(135deg,rgba(127,29,29,0.36),rgba(15,23,42,0.82))] p-5 md:p-6">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.16),transparent_36%)]" />
                <div className="relative flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-red-200/80">Tribunal de la hermandad</p>
                        <h2 className="font-serif text-4xl font-black text-amber-100 md:text-5xl">Salon del Juicio</h2>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                            Aqui la alianza decide el destino de sus miembros mediante votacion.
                        </p>
                    </div>
                    <div className="flex h-16 w-16 items-center justify-center rounded border border-amber-600/45 bg-black/35">
                        <Scale size={34} className="text-amber-300" />
                    </div>
                </div>
            </div>

            <div className="space-y-5 p-4 md:p-5">
                {feedback && (
                    <div className="rounded border border-amber-700/40 bg-amber-950/25 px-3 py-2 text-sm text-amber-100">
                        {feedback}
                    </div>
                )}

                {loading ? (
                    <div className="rounded border border-slate-800 bg-black/30 p-8 text-center text-slate-500 animate-pulse">
                        Convocando al tribunal...
                    </div>
                ) : active ? (
                    <ActiveJudgementCard
                        judgement={active}
                        user={user}
                        submitting={submitting}
                        onVote={requestVote}
                        onResolve={resolve}
                        onOpenProfile={onOpenProfile}
                    />
                ) : (
                    <div className="rounded-lg border border-white/10 bg-black/30 p-6 text-center">
                        <Scale size={34} className="mx-auto mb-3 text-slate-600" />
                        <h3 className="font-serif text-2xl font-bold text-amber-100">No hay juicios activos.</h3>
                        <p className="mt-2 text-sm text-slate-500">La sala permanece en silencio.</p>
                    </div>
                )}

                {canStart && (
                    <div className="rounded-lg border border-amber-900/35 bg-black/30 p-4">
                        <div className="mb-4 flex items-center gap-2">
                            <Scale size={18} className="text-amber-300" />
                            <h3 className="font-serif text-2xl font-bold text-amber-100">Iniciar juicio</h3>
                        </div>
                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[280px_minmax(0,1fr)]">
                            <label className="block">
                                <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Miembro acusado</span>
                                <select
                                    value={form.accusedPlayerId}
                                    onChange={(event) => setForm((prev) => ({ ...prev, accusedPlayerId: event.target.value }))}
                                    className="w-full rounded border border-slate-700 bg-black/45 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-amber-500"
                                >
                                    <option value="">Selecciona miembro</option>
                                    {!selectedOptionExists && form.accusedPlayerId && initialAccused && (
                                        <option value={initialAccused.playerId}>{initialAccused.username}</option>
                                    )}
                                    {eligibleMembers.map((member) => (
                                        <option key={member.playerId} value={member.playerId}>
                                            {member.username} · Nivel {formatNumber(member.level)} · {ROLE_LABELS[member.role] || member.role}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <TextAreaField
                                label="Motivo"
                                value={form.reason}
                                onChange={(value) => setForm((prev) => ({ ...prev, reason: value }))}
                            />
                        </div>
                        <button
                            type="button"
                            disabled={submitting || !form.accusedPlayerId || !form.reason.trim()}
                            onClick={requestStart}
                            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded border border-red-900/60 bg-red-950/25 px-4 py-3 text-xs font-black uppercase tracking-widest text-red-200 hover:bg-red-950/40 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <Scale size={15} />
                            Proclamar juicio
                        </button>
                    </div>
                )}

                <JudgementHistory history={data?.history || []} />
            </div>

            <ConfirmDialog
                isOpen={Boolean(confirmDialog)}
                title={confirmDialog?.title}
                message={confirmDialog?.message}
                confirmText={confirmDialog?.confirmText}
                cancelText={confirmDialog?.cancelText}
                variant={confirmDialog?.variant}
                onConfirm={confirmCurrentAction}
                onCancel={() => setConfirmDialog(null)}
            />
        </Panel>
    );
}

function ActiveJudgementCard({ judgement, user, submitting, onVote, onResolve, onOpenProfile }) {
    const accused = judgement.accusedPlayer || {};
    const isAccused = String(accused.id) === String(user.id);

    return (
        <div className="rounded-lg border border-red-900/45 bg-[linear-gradient(135deg,rgba(127,29,29,0.18),rgba(0,0,0,0.35))] p-4">
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-red-200/80">En votacion</p>
                    <h3 className="font-serif text-3xl font-black text-amber-100">Juicio en curso</h3>
                </div>
                <span className="rounded border border-amber-700/45 bg-black/35 px-3 py-2 text-xs font-bold uppercase tracking-widest text-amber-100">
                    {formatRemaining(judgement.remainingSeconds)}
                </span>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px_minmax(0,1fr)] xl:items-stretch">
                <VoteColumn title="Votos a favor" value={judgement.votesExpel} color="red" label="Expulsar" />

                <div className="rounded-lg border border-amber-600/45 bg-black/45 p-5 text-center shadow-[0_0_35px_rgba(127,29,29,0.22)]">
                    <div className="mx-auto mb-4 flex h-28 w-28 items-center justify-center rounded-full border border-red-900/50 bg-slate-950">
                        {accused.avatarUrl ? (
                            <img
                                src={accused.avatarUrl}
                                alt=""
                                className="h-20 w-20 object-contain"
                                onError={(event) => {
                                    event.currentTarget.style.display = 'none';
                                }}
                            />
                        ) : (
                            <Users size={48} className="text-amber-300" />
                        )}
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-red-200/80">Acusado</p>
                    <h4
                        className="font-serif text-3xl font-black text-amber-100 hover:text-amber-200 transition-colors cursor-pointer"
                        role="button"
                        tabIndex={0}
                        onClick={() => onOpenProfile?.(accused.id)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                onOpenProfile?.(accused.id);
                            }
                        }}
                    >
                        {accused.username}
                    </h4>
                    <p className="mt-1 text-sm text-slate-400">
                        Nivel {formatNumber(accused.level)} · {ROLE_LABELS[accused.role] || accused.role || 'Miembro'}
                    </p>
                    {accused.joinedAt && (
                        <p className="mt-1 text-xs text-slate-500">Ingreso: {new Date(accused.joinedAt).toLocaleDateString('es-ES')}</p>
                    )}
                    <div className="mt-4 rounded border border-white/10 bg-black/35 p-3 text-left">
                        <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Motivo</p>
                        <p className="text-sm leading-6 text-slate-200">{judgement.reason}</p>
                    </div>
                    <p className="mt-3 text-xs text-slate-500">Propuesto por {judgement.proposedBy?.username || 'Desconocido'}</p>
                </div>

                <VoteColumn title="Votos en contra" value={judgement.votesKeep} color="amber" label="Mantener" />
            </div>

            <div className="mt-4 rounded border border-white/10 bg-black/25 p-4">
                {isAccused ? (
                    <p className="text-sm text-red-200">Estas siendo juzgado. No puedes votar en tu propio juicio.</p>
                ) : judgement.myVote ? (
                    <p className="text-sm text-amber-100">
                        Tu voto fue registrado: {judgement.myVote === 'expel' ? 'Expulsar' : 'Mantener'}.
                    </p>
                ) : judgement.canVote ? (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <button
                            type="button"
                            disabled={submitting}
                            onClick={() => onVote('expel')}
                            className="rounded border border-red-800/70 bg-red-950/35 px-4 py-3 text-xs font-black uppercase tracking-widest text-red-100 hover:bg-red-900/35 disabled:opacity-50"
                        >
                            Votar expulsar
                        </button>
                        <button
                            type="button"
                            disabled={submitting}
                            onClick={() => onVote('keep')}
                            className="rounded border border-amber-600/55 bg-amber-950/20 px-4 py-3 text-xs font-black uppercase tracking-widest text-amber-100 hover:bg-amber-900/30 disabled:opacity-50"
                        >
                            Votar mantener
                        </button>
                    </div>
                ) : (
                    <p className="text-sm text-slate-400">{judgement.cannotVoteReason || 'No puedes votar en este juicio.'}</p>
                )}

                {judgement.canResolve && (
                    <button
                        type="button"
                        disabled={submitting}
                        onClick={onResolve}
                        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded border border-amber-600/55 bg-amber-950/20 px-4 py-3 text-xs font-black uppercase tracking-widest text-amber-100 hover:bg-amber-900/30 disabled:opacity-50"
                    >
                        <Check size={15} />
                        Resolver juicio
                    </button>
                )}
            </div>
        </div>
    );
}

function VoteColumn({ title, value, color, label }) {
    const palette = color === 'red'
        ? 'border-red-900/50 bg-red-950/20 text-red-100'
        : 'border-amber-800/45 bg-amber-950/15 text-amber-100';
    return (
        <div className={`flex flex-col items-center justify-center rounded-lg border p-5 text-center ${palette}`}>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-80">{title}</p>
            <p className="mt-3 font-serif text-6xl font-black">{formatNumber(value)}</p>
            <p className="mt-2 text-xs font-bold uppercase tracking-widest">{label}</p>
        </div>
    );
}

function JudgementHistory({ history }) {
    return (
        <div className="rounded-lg border border-white/10 bg-black/25 p-4">
            <div className="mb-3 flex items-center gap-2">
                <MessageSquare size={18} className="text-amber-300" />
                <h3 className="font-serif text-2xl font-bold text-amber-100">Historial</h3>
            </div>
            {history.length === 0 ? (
                <p className="text-sm text-slate-500">No hay juicios resueltos.</p>
            ) : (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {history.map((judgement) => (
                        <div key={judgement.id} className="rounded border border-white/10 bg-black/30 p-3">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="font-bold text-slate-100">{judgement.accusedPlayer?.username}</p>
                                    <p className="text-xs text-slate-500">Propuesto por {judgement.proposedBy?.username || 'Desconocido'}</p>
                                </div>
                                <span className={`rounded border px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${
                                    judgement.status === 'expelled'
                                        ? 'border-red-900/55 bg-red-950/25 text-red-200'
                                        : 'border-emerald-700/45 bg-emerald-950/20 text-emerald-200'
                                }`}>
                                    {judgement.status === 'expelled' ? 'Expulsado' : 'Permanece'}
                                </span>
                            </div>
                            <p className="mt-2 text-xs text-slate-500">
                                Expulsar {formatNumber(judgement.votesExpel)} · Mantener {formatNumber(judgement.votesKeep)}
                            </p>
                            <p className="mt-1 text-[11px] text-slate-600">
                                {judgement.resolvedAt ? new Date(judgement.resolvedAt).toLocaleString('es-ES') : 'Sin resolver'}
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function formatRemaining(seconds = 0) {
    const safe = Math.max(0, Number(seconds || 0));
    const minutes = Math.floor(safe / 60);
    const secs = safe % 60;
    return `${minutes}m ${String(secs).padStart(2, '0')}s restantes`;
}

function AllianceApplicationsPanel({ allianceId, permissions, pendingCount = 0, onRefresh, onOpenProfile }) {
    const [applications, setApplications] = useState([]);
    const [feedback, setFeedback] = useState(null);
    const canManageApplications = Boolean(permissions.manageApplications);

    const loadApplications = useCallback(async () => {
        if (!canManageApplications) return;
        try {
            const data = await allianceService.getApplications(allianceId);
            setApplications(data.applications || []);
        } catch (requestError) {
            setFeedback(requestError.message || 'No se pudieron cargar solicitudes.');
        }
    }, [allianceId, canManageApplications]);

    useEffect(() => {
        void Promise.resolve().then(loadApplications);
    }, [loadApplications]);

    const review = async (application, action) => {
        try {
            const result = action === 'accept'
                ? await allianceService.acceptApplication(application.applicationId)
                : await allianceService.rejectApplication(application.applicationId);
            setFeedback(result.message || 'Solicitud revisada.');
            await loadApplications();
            await onRefresh();
        } catch (requestError) {
            setFeedback(requestError.message || 'No se pudo revisar solicitud.');
        }
    };

    if (!canManageApplications) {
        return (
            <BlockedPanel
                icon={UserPlus}
                title="Solicitudes de Alianza"
                message="Solo lideres y administradores pueden revisar solicitudes."
            />
        );
    }

    return (
        <Panel>
            <SectionTitle
                icon={UserPlus}
                title="Solicitudes de Alianza"
                subtitle="Aspirantes que esperan juramento."
                action={(
                    <span className="inline-flex items-center rounded border border-red-900/50 bg-red-950/25 px-3 py-2 text-xs font-bold uppercase tracking-widest text-red-200">
                        {formatNumber(pendingCount || applications.length)} pendientes
                    </span>
                )}
            />
            <div className="space-y-3 p-4 md:p-5">
                {feedback && (
                    <div className="rounded border border-amber-700/40 bg-amber-950/25 px-3 py-2 text-sm text-amber-100">
                        {feedback}
                    </div>
                )}
                {applications.length === 0 ? (
                    <div className="rounded border border-slate-800 bg-black/30 p-8 text-center text-slate-500">
                        No hay solicitudes pendientes.
                    </div>
                ) : applications.map((application) => (
                    <div key={application.applicationId} className="rounded-lg border border-white/10 bg-black/30 p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div>
                                <h3
                                    className="font-serif text-xl font-bold text-amber-100 hover:text-amber-200 transition-colors cursor-pointer"
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => onOpenProfile?.(application.player?.id)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault();
                                            onOpenProfile?.(application.player?.id);
                                        }
                                    }}
                                >
                                    {application.player?.username || 'Aspirante'}
                                </h3>
                                <p className="text-xs text-slate-500">
                                    Nivel {formatNumber(application.level)} · Poder {application.power ?? 'Pendiente'} · {new Date(application.createdAt).toLocaleString('es-ES')}
                                </p>
                                <p className="mt-3 text-sm leading-6 text-slate-300">{application.message || 'Sin mensaje.'}</p>
                            </div>
                            <div className="flex shrink-0 gap-2">
                                <button
                                    type="button"
                                    onClick={() => review(application, 'accept')}
                                    className="inline-flex items-center gap-2 rounded border border-emerald-500/45 bg-emerald-950/25 px-3 py-2 text-xs font-bold uppercase tracking-widest text-emerald-200"
                                >
                                    <Check size={14} />
                                    Aceptar
                                </button>
                                <button
                                    type="button"
                                    onClick={() => review(application, 'reject')}
                                    className="inline-flex items-center gap-2 rounded border border-red-900/55 bg-red-950/25 px-3 py-2 text-xs font-bold uppercase tracking-widest text-red-200"
                                >
                                    <X size={14} />
                                    Rechazar
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </Panel>
    );
}

function AllianceAdminPanel({ data, onRefresh, onFeedback }) {
    const { alliance, permissions, membersPreview = [] } = data;
    const [members, setMembers] = useState(membersPreview);
    const [form, setForm] = useState({
        description: alliance.description || '',
        messageOfTheDay: alliance.messageOfTheDay || '',
        logoUrl: alliance.logoUrl || '',
        bannerUrl: alliance.bannerUrl || '',
        minLevelRequired: alliance.minLevelRequired || 1,
        minPowerRequired: alliance.minPowerRequired || 0,
        joinType: alliance.joinType || 'request'
    });
    const [feedback, setFeedback] = useState(null);
    const [confirmDialog, setConfirmDialog] = useState(null);

    useEffect(() => {
        if (!permissions.transferLeadership) return undefined;
        let isMounted = true;
        void Promise.resolve().then(async () => {
            try {
                const result = await allianceService.getMembers();
                if (isMounted) setMembers(result.members || []);
            } catch (requestError) {
                if (isMounted) setFeedback(requestError.message || 'No se pudieron cargar miembros.');
            }
        });
        return () => {
            isMounted = false;
        };
    }, [permissions.transferLeadership]);

    const save = async () => {
        try {
            const payload = permissions.editAlliance ? form : {
                description: form.description,
                messageOfTheDay: form.messageOfTheDay
            };
            const result = await allianceService.updateSettings(payload);
            setFeedback(result.message || 'Alianza actualizada.');
            await onRefresh();
        } catch (requestError) {
            setFeedback(requestError.message || 'No se pudo actualizar.');
        }
    };

    const transfer = async (playerId) => {
        if (!playerId) return;
        try {
            const result = await allianceService.transferLeadership(playerId);
            onFeedback(result.message || 'Liderazgo transferido.');
            await onRefresh();
        } catch (requestError) {
            setFeedback(requestError.message || 'No se pudo transferir liderazgo.');
        }
    };

    const disband = async () => {
        try {
            const result = await allianceService.disbandAlliance();
            onFeedback(result.message || 'Alianza disuelta.');
            await onRefresh();
        } catch (requestError) {
            setFeedback(requestError.message || 'No se pudo disolver la alianza.');
        }
    };

    const requestTransfer = (playerId) => {
        if (!playerId) return;
        const member = members.find((item) => String(item.playerId) === String(playerId));
        setConfirmDialog({
            title: 'Transferir liderazgo',
            message: `El liderazgo pasara a ${member?.username || 'este miembro'}.`,
            confirmText: 'Transferir',
            variant: 'warning',
            onConfirm: () => transfer(playerId)
        });
    };

    const requestDisband = () => {
        setConfirmDialog({
            title: 'Disolver alianza',
            message: 'Disolver la alianza es irreversible. Todos los miembros perderan la alianza.',
            confirmText: 'Disolver',
            variant: 'danger',
            onConfirm: disband
        });
    };

    const confirmCurrentAction = async () => {
        const action = confirmDialog?.onConfirm;
        setConfirmDialog(null);
        if (action) await action();
    };

    const canAccessAdmin = permissions.editMessage
        || permissions.editAlliance
        || permissions.transferLeadership
        || permissions.disbandAlliance;

    if (!canAccessAdmin) {
        return (
            <BlockedPanel
                icon={Edit3}
                title="Administración"
                message="Solo líderes y administradores pueden administrar la alianza."
            />
        );
    }

    return (
        <Panel>
            <SectionTitle
                icon={Edit3}
                title="Administración"
                subtitle="Gestión interna de la hermandad."
            />
            <div className="grid grid-cols-1 gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_360px] md:p-5">
                <div className="space-y-4">
                    <AdminSection title="Información general" icon={Shield}>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <InfoPill label="Nombre" value={alliance.name} />
                            <InfoPill label="Tag" value={alliance.tag || 'SIN TAG'} />
                        </div>
                        <div className="rounded border border-white/10 bg-black/25 p-3">
                            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">Emblema oficial</p>
                            <div className="mb-3 flex items-center gap-3">
                                <div className="flex h-16 w-16 items-center justify-center rounded border border-amber-700/45 bg-slate-950">
                                    {form.logoUrl ? (
                                        <img src={form.logoUrl} alt="" className="h-11 w-11 object-contain" />
                                    ) : (
                                        <Shield size={34} className="text-amber-300" />
                                    )}
                                </div>
                                <p className="text-xs leading-5 text-slate-500">Subida personalizada próximamente.</p>
                            </div>
                            <EmblemSelector
                                value={form.logoUrl}
                                disabled={!permissions.editAlliance}
                                onChange={(logoUrl) => setForm((prev) => ({ ...prev, logoUrl }))}
                            />
                        </div>
                        <TextAreaField label="Descripción" value={form.description} onChange={(value) => setForm((prev) => ({ ...prev, description: value }))} />
                        <TextAreaField label="Mensaje del día" value={form.messageOfTheDay} onChange={(value) => setForm((prev) => ({ ...prev, messageOfTheDay: value }))} />
                    </AdminSection>

                    <AdminSection title="Requisitos de ingreso" icon={UserPlus}>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                            <InputField label="Nivel mínimo" type="number" value={form.minLevelRequired} disabled={!permissions.editAlliance} onChange={(value) => setForm((prev) => ({ ...prev, minLevelRequired: value }))} />
                            <InputField label="Poder mínimo" type="number" value={form.minPowerRequired} disabled={!permissions.editAlliance} onChange={(value) => setForm((prev) => ({ ...prev, minPowerRequired: value }))} />
                            <label className="block">
                                <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Tipo de ingreso</span>
                                <select
                                    value={form.joinType}
                                    disabled={!permissions.editAlliance}
                                    onChange={(event) => setForm((prev) => ({ ...prev, joinType: event.target.value }))}
                                    className="w-full rounded border border-slate-700 bg-black/45 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-amber-500 disabled:opacity-50"
                                >
                                    {ALLIANCE_JOIN_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </label>
                        </div>
                    </AdminSection>

                    <AdminSection title="Permisos y opciones" icon={Swords}>
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                            <DisabledOption label="Alianza visible en listado" checked />
                            <DisabledOption label="Permitir invitaciones" />
                            <DisabledOption label="Participación en guerras" tag="Próximamente" />
                            <DisabledOption label="Mazmorras de alianza" tag="Próximamente" />
                        </div>
                    </AdminSection>

                    {feedback && (
                        <div className="rounded border border-amber-700/40 bg-amber-950/25 px-3 py-2 text-sm text-amber-100">
                            {feedback}
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={save}
                        className="inline-flex w-full items-center justify-center gap-2 rounded border border-amber-500/60 bg-amber-700/25 px-4 py-3 text-xs font-black uppercase tracking-widest text-amber-100 hover:bg-amber-700/40"
                    >
                        <Check size={15} />
                        Guardar cambios
                    </button>
                </div>

                <div className="space-y-4">
                    <AdminSection title="Liderazgo" icon={Crown}>
                        {permissions.transferLeadership ? (
                            <label className="block">
                                <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Transferir liderazgo</span>
                                <select
                                    defaultValue=""
                                    onChange={(event) => requestTransfer(event.target.value)}
                                    className="w-full rounded border border-slate-700 bg-black/45 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-500"
                                >
                                    <option value="">Selecciona miembro</option>
                                    {members.filter((member) => member.role !== 'leader').map((member) => (
                                        <option key={member.playerId} value={member.playerId}>{member.username}</option>
                                    ))}
                                </select>
                            </label>
                        ) : (
                            <p className="text-sm text-slate-500">Solo el líder puede transferir el liderazgo.</p>
                        )}
                    </AdminSection>

                    <AdminSection title="Zona peligrosa" icon={AlertTriangle} danger>
                        <p className="mb-3 text-sm leading-6 text-red-200/80">
                            Disolver la alianza es irreversible y requiere confirmación.
                        </p>
                        {permissions.disbandAlliance ? (
                            <button
                                type="button"
                                onClick={requestDisband}
                                className="inline-flex w-full items-center justify-center gap-2 rounded border border-red-900/60 bg-red-950/25 px-4 py-3 text-xs font-black uppercase tracking-widest text-red-200 hover:bg-red-950/40"
                            >
                                <Trash2 size={15} />
                                Disolver alianza
                            </button>
                        ) : (
                            <p className="text-sm text-slate-500">Solo el lider puede disolver la alianza.</p>
                        )}
                    </AdminSection>
                </div>
            </div>
            <ConfirmDialog
                isOpen={Boolean(confirmDialog)}
                title={confirmDialog?.title}
                message={confirmDialog?.message}
                confirmText={confirmDialog?.confirmText}
                cancelText={confirmDialog?.cancelText}
                variant={confirmDialog?.variant}
                onConfirm={confirmCurrentAction}
                onCancel={() => setConfirmDialog(null)}
            />
        </Panel>
    );
}

function AdminSection({ title, icon: Icon, children, danger = false }) {
    return (
        <section className={`rounded-lg border p-4 ${
            danger ? 'border-red-900/50 bg-red-950/15' : 'border-white/10 bg-black/25'
        }`}>
            <div className="mb-3 flex items-center gap-2">
                {createElement(Icon, { size: 18, className: danger ? 'text-red-300' : 'text-amber-300' })}
                <h3 className={`font-serif text-xl font-bold ${danger ? 'text-red-100' : 'text-amber-100'}`}>{title}</h3>
            </div>
            <div className="space-y-3">{children}</div>
        </section>
    );
}

function EmblemSelector({ value, onChange, disabled = false }) {
    return (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {OFFICIAL_ALLIANCE_EMBLEMS.map((emblem) => (
                <button
                    key={emblem}
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange(emblem)}
                    className={`flex aspect-square items-center justify-center rounded border bg-black/35 transition-colors ${
                        value === emblem ? 'border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.2)]' : 'border-slate-700 hover:border-amber-800'
                    } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                    <img src={emblem} alt="" className="h-9 w-9 object-contain" />
                </button>
            ))}
        </div>
    );
}

function DisabledOption({ label, checked = false, tag = 'Futuro' }) {
    return (
        <div className="flex items-center justify-between gap-3 rounded border border-slate-800 bg-slate-950/50 px-3 py-2 opacity-70">
            <label className="inline-flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={checked} disabled className="accent-amber-500" readOnly />
                {label}
            </label>
            <span className="rounded border border-slate-700 bg-black/35 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                {tag}
            </span>
        </div>
    );
}

function BlockedPanel({ icon: Icon, title, message }) {
    return (
        <Panel>
            <SectionTitle icon={Icon} title={title} subtitle="Acceso restringido." />
            <div className="p-4 md:p-5">
                <div className="rounded-lg border border-slate-800 bg-black/35 p-8 text-center">
                    <Lock size={30} className="mx-auto mb-3 text-slate-600" />
                    <p className="font-serif text-xl font-bold text-slate-300">{message}</p>
                    <p className="mt-2 text-sm text-slate-500">Tu rol actual no tiene este permiso.</p>
                </div>
            </div>
        </Panel>
    );
}

function InputField({ label, value, onChange, type = 'text', disabled = false }) {
    return (
        <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</span>
            <input
                type={type}
                value={value}
                disabled={disabled}
                onChange={(event) => onChange(event.target.value)}
                className="w-full rounded border border-slate-700 bg-black/45 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-amber-500 disabled:opacity-50"
            />
        </label>
    );
}

function TextAreaField({ label, value, onChange }) {
    return (
        <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</span>
            <textarea
                value={value}
                onChange={(event) => onChange(event.target.value)}
                rows={5}
                className="w-full rounded border border-slate-700 bg-black/45 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-amber-500"
            />
        </label>
    );
}

function ConfirmDialog({
    isOpen,
    title,
    message,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    variant = 'normal',
    onConfirm,
    onCancel
}) {
    if (!isOpen) return null;
    const isDanger = variant === 'danger';
    const isWarning = variant === 'warning';
    const borderClass = isDanger ? 'border-red-800/70' : isWarning ? 'border-amber-600/70' : 'border-amber-800/50';
    const buttonClass = isDanger
        ? 'border-red-800/70 bg-red-950/35 text-red-100 hover:bg-red-900/35'
        : 'border-amber-500/60 bg-amber-700/25 text-amber-100 hover:bg-amber-700/40';

    return (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <section className={`w-full max-w-lg rounded-lg border ${borderClass} bg-slate-950 shadow-[0_30px_90px_rgba(0,0,0,0.65)]`}>
                <header className="flex items-start gap-3 border-b border-white/10 p-4">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded border ${borderClass} bg-black/35`}>
                        <AlertTriangle size={22} className={isDanger ? 'text-red-300' : 'text-amber-300'} />
                    </div>
                    <div>
                        <h3 className="font-serif text-2xl font-bold text-amber-100">{title}</h3>
                        <div className="mt-2 text-sm leading-6 text-slate-300">
                            {message}
                        </div>
                    </div>
                </header>
                <div className="flex flex-col-reverse gap-2 p-4 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="rounded border border-slate-700 bg-black/30 px-4 py-2 text-xs font-bold uppercase tracking-widest text-slate-300 hover:border-slate-500 hover:text-slate-100"
                    >
                        {cancelText}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className={`rounded border px-4 py-2 text-xs font-black uppercase tracking-widest ${buttonClass}`}
                    >
                        {confirmText}
                    </button>
                </div>
            </section>
        </div>
    );
}

function ModalFrame({ title, icon: Icon, onClose, children, wide = false }) {
    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <section className={`max-h-[92vh] w-full overflow-y-auto rounded-lg border border-amber-700/50 bg-slate-950 shadow-[0_30px_90px_rgba(0,0,0,0.65)] ${wide ? 'max-w-5xl' : 'max-w-lg'}`}>
                <header className="flex items-center justify-between gap-3 border-b border-white/10 p-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded border border-amber-600/45 bg-black/35">
                            {createElement(Icon, { size: 21, className: 'text-amber-300' })}
                        </div>
                        <h3 className="font-serif text-2xl font-bold text-amber-100">{title}</h3>
                    </div>
                    <button type="button" onClick={onClose} className="rounded border border-slate-700 bg-black/30 p-2 text-slate-400 hover:text-amber-100">
                        <X size={18} />
                    </button>
                </header>
                <div className="p-4 md:p-5">{children}</div>
            </section>
        </div>
    );
}

export default AlliancePage;
