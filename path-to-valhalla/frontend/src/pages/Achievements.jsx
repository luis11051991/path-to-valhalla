import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowUpRight,
    Award,
    BookOpen,
    Check,
    CheckCircle2,
    Coins,
    Compass,
    EyeOff,
    Gem,
    Gift,
    HelpCircle,
    Lock,
    PackageCheck,
    PawPrint,
    Search,
    Skull,
    Sparkles,
    Swords,
    Trophy
} from 'lucide-react';
import { achievementService } from '../services/achievementService';

const CURRENCY_ICONS = {
    copper: '/icons/currency/copper.png',
    silver: '/icons/currency/silver.png',
    gold: '/icons/currency/gold.png',
    onix: '/icons/currency/onix.png',
    onyx: '/icons/currency/onix.png'
};

const FILTERS = [
    'Todos',
    'Combate',
    'Bestiario',
    'Grimorio',
    'Mascotas',
    'Expediciones',
    'Economía',
    'Secretos',
    'Reclamables',
    'Completados'
];

const SORT_OPTIONS = [
    'Más cercanos',
    'Recompensa mayor',
    'Recientes',
    'Categoría',
    'Rareza'
];

const STATUS_STYLES = {
    Bloqueado: 'border-red-900/60 bg-red-950/40 text-red-300',
    'En progreso': 'border-blue-800/60 bg-blue-950/40 text-blue-300',
    Completado: 'border-green-800/60 bg-green-950/40 text-green-300',
    Reclamable: 'border-amber-500/70 bg-amber-900/30 text-amber-200',
    Reclamado: 'border-green-700/60 bg-green-900/25 text-green-300',
    Oculto: 'border-slate-700 bg-slate-900/70 text-slate-400'
};

const RARITY_STYLES = {
    'ComÃºn': 'border-slate-600/70 bg-slate-800/70 text-slate-200',
    'Común': 'border-slate-600/70 bg-slate-800/70 text-slate-200',
    Raro: 'border-blue-500/50 bg-blue-900/30 text-blue-300',
    'Ã‰pico': 'border-purple-500/60 bg-purple-900/35 text-purple-200',
    'Épico': 'border-purple-500/60 bg-purple-900/35 text-purple-200',
    Legendario: 'border-amber-500/70 bg-amber-900/35 text-amber-200',
    Oculta: 'border-slate-700 bg-slate-900 text-slate-500'
};

const RARITY_ORDER = {
    'ComÃºn': 1,
    'Común': 1,
    Raro: 2,
    'Ã‰pico': 3,
    'Épico': 3,
    Legendario: 4
};

const ROUTES_BY_LABEL = {
    'Ir a Bestiario': '/bestiary',
    'Ver Expediciones': '/expeditions',
    'Ir a Grimorio': '/grimoire',
    'Ir a Mascotas': '/hero',
    'Ir al Mercado': '/market'
};

const getProgressPercent = (achievement) => {
    if (!achievement.target) return 0;
    return Math.min(100, Math.round((achievement.progress / achievement.target) * 100));
};

const isHiddenAchievement = (achievement) => achievement.status === 'Oculto';

const getDisplayName = (achievement) => (
    isHiddenAchievement(achievement) ? '???' : achievement.name
);

const getDisplayDescription = (achievement) => (
    isHiddenAchievement(achievement)
        ? 'Sigue explorando para descubrir este logro.'
        : achievement.description
);

const getRewardValue = (reward = {}) => (
    (reward.gold || 0) * 10000
    + (reward.silver || 0) * 100
    + (reward.copper || 0)
    + (reward.onix || reward.onyx || 0) * 50000
    + (reward.title ? 4000 : 0)
    + (reward.item ? 2500 : 0)
    + (reward.material ? 1500 : 0)
    + (reward.cosmetic ? 7000 : 0)
);

const getCreatedTime = (achievement) => {
    const timestamp = new Date(achievement.createdAt).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
};

const formatNumber = (value) => new Intl.NumberFormat('es-ES').format(value);
const DEFAULT_SUMMARY = {
    total: 0,
    completed: 0,
    points: 0,
    pendingRewards: 0
};

function AchievementsPage({ user, onUpdateUser }) {
    const navigate = useNavigate();
    const [achievements, setAchievements] = useState([]);
    const [summary, setSummary] = useState(DEFAULT_SUMMARY);
    const [activeFilter, setActiveFilter] = useState('Todos');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortMode, setSortMode] = useState('Más cercanos');
    const [selectedAchievementId, setSelectedAchievementId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [claiming, setClaiming] = useState(false);
    const [feedback, setFeedback] = useState(null);

    useEffect(() => {
        if (!feedback) return undefined;
        const timeoutId = setTimeout(() => setFeedback(null), 2600);
        return () => clearTimeout(timeoutId);
    }, [feedback]);

    useEffect(() => {
        let isMounted = true;

        achievementService.getAchievements()
            .then((data) => {
                if (!isMounted) return;
                setAchievements(data.achievements || []);
                setSummary(data.summary || DEFAULT_SUMMARY);
                setError(null);
            })
            .catch((requestError) => {
                if (!isMounted) return;
                setError(requestError.message || 'No se pudieron cargar los logros.');
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, []);

    const refreshAchievements = async () => {
        const data = await achievementService.getAchievements();
        setAchievements(data.achievements || []);
        setSummary(data.summary || DEFAULT_SUMMARY);
        setError(null);
    };

    const pendingCount = summary.pendingRewards || 0;

    const filteredAchievements = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLocaleLowerCase('es');

        return achievements
            .filter((achievement) => {
                if (activeFilter === 'Reclamables') return achievement.status === 'Reclamable';
                if (activeFilter === 'Completados') {
                    return ['Completado', 'Reclamable', 'Reclamado'].includes(achievement.status);
                }
                if (activeFilter !== 'Todos') return achievement.category === activeFilter;
                return true;
            })
            .filter((achievement) => {
                if (!normalizedSearch) return true;
                const searchableText = [
                    getDisplayName(achievement),
                    getDisplayDescription(achievement),
                    achievement.category,
                    isHiddenAchievement(achievement) ? '' : achievement.rarity
                ].join(' ').toLocaleLowerCase('es');
                return searchableText.includes(normalizedSearch);
            })
            .sort((left, right) => {
                if (sortMode === 'Recompensa mayor') {
                    return getRewardValue(right.reward) - getRewardValue(left.reward);
                }
                if (sortMode === 'Recientes') {
                    return getCreatedTime(right) - getCreatedTime(left);
                }
                if (sortMode === 'Categoría') {
                    return left.category.localeCompare(right.category, 'es');
                }
                if (sortMode === 'Rareza') {
                    return (RARITY_ORDER[right.rarity] || 0) - (RARITY_ORDER[left.rarity] || 0);
                }

                const rightRatio = getProgressPercent(right);
                const leftRatio = getProgressPercent(left);
                const rightClaimable = right.status === 'Reclamable' ? 200 : 0;
                const leftClaimable = left.status === 'Reclamable' ? 200 : 0;
                return (rightRatio + rightClaimable) - (leftRatio + leftClaimable);
            });
    }, [achievements, activeFilter, searchTerm, sortMode]);

    const selectedAchievement = useMemo(() => {
        return achievements.find((achievement) => achievement.id === selectedAchievementId)
            || filteredAchievements[0]
            || achievements[0];
    }, [achievements, filteredAchievements, selectedAchievementId]);

    const almostCompleted = useMemo(() => {
        return achievements
            .filter((achievement) => (
                achievement.status === 'En progreso'
                && !isHiddenAchievement(achievement)
                && achievement.target > achievement.progress
            ))
            .sort((left, right) => getProgressPercent(right) - getProgressPercent(left))
            .slice(0, 3);
    }, [achievements]);

    const updateUserCurrency = (userCurrency) => {
        if (!userCurrency) return;

        onUpdateUser?.({
            copper: userCurrency.copper,
            silver: userCurrency.silver,
            gold: userCurrency.gold,
            onix: userCurrency.onix
        });
    };

    const handleClaimAchievement = async (achievementId) => {
        if (claiming) return;

        const achievement = achievements.find((item) => item.id === achievementId);
        if (!achievement || achievement.status !== 'Reclamable') return;

        setClaiming(true);
        try {
            const result = await achievementService.claimAchievement(achievementId);
            updateUserCurrency(result.userCurrency);
            await refreshAchievements();
            setFeedback(result.message || `Recompensa reclamada: ${achievement.name}`);
        } catch (claimError) {
            setFeedback(claimError.message || 'No se pudo reclamar la recompensa.');
        } finally {
            setClaiming(false);
        }
    };

    const handleClaimAll = async () => {
        if (claiming || pendingCount === 0) return;

        setClaiming(true);
        try {
            const result = await achievementService.claimAllAchievements();
            updateUserCurrency(result.userCurrency);
            await refreshAchievements();
            setFeedback(`${result.claimedCount || 0} recompensas reclamadas`);
        } catch (claimError) {
            setFeedback(claimError.message || 'No se pudieron reclamar las recompensas.');
        } finally {
            setClaiming(false);
        }
    };

    const handleNavigate = (label) => {
        const route = ROUTES_BY_LABEL[label];
        if (route) navigate(route);
    };

    if (!user) return null;

    return (
        <div className="min-h-full text-slate-100 font-sans relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(180deg,rgba(15,23,42,0.7),rgba(2,6,23,0.95))]" />

            <div className="relative z-10 p-4 md:p-6 lg:p-8 space-y-5">
                <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
                    <div className="min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-12 h-12 rounded-lg border border-amber-600/60 bg-black/50 flex items-center justify-center shadow-[0_0_25px_rgba(245,158,11,0.12)]">
                                <img src="/icons/sidebar/hero_achievements.png" alt="" className="w-8 h-8 object-contain" />
                            </div>
                            <h2 className="text-4xl md:text-5xl font-serif font-bold text-amber-500 drop-shadow-md">
                                Logros
                            </h2>
                        </div>
                        <p className="text-slate-400 text-sm md:text-base max-w-2xl">
                            Completa desafíos, gana recompensas y demuestra tu progreso en Valhallus.
                        </p>
                    </div>

                    <div className="flex flex-col gap-3">
                        <AchievementSummaryCards summary={summary} />
                        <button
                            type="button"
                            onClick={handleClaimAll}
                            disabled={pendingCount === 0 || claiming || loading}
                            className={`inline-flex items-center justify-center gap-2 rounded-lg border px-5 py-3 text-xs font-black uppercase tracking-widest transition-all ${
                                pendingCount > 0 && !claiming && !loading
                                    ? 'border-amber-400/70 bg-gradient-to-r from-purple-800 via-purple-700 to-amber-700 text-white shadow-[0_0_25px_rgba(168,85,247,0.28)] hover:scale-[1.02] hover:border-amber-300'
                                    : 'border-slate-700 bg-slate-900/70 text-slate-600 cursor-not-allowed'
                            }`}
                        >
                            <PackageCheck size={16} />
                            {claiming ? 'Reclamando...' : 'Reclamar todo'}
                        </button>
                    </div>
                </section>

                <AchievementFilters
                    activeFilter={activeFilter}
                    onFilterChange={setActiveFilter}
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    sortMode={sortMode}
                    onSortChange={setSortMode}
                />

                {error && (
                    <div className="rounded-lg border border-red-900/60 bg-red-950/30 p-4 text-sm text-red-200">
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-10 text-center text-slate-500 animate-pulse">
                        Cargando logros...
                    </div>
                ) : (
                    <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-5 items-start">
                        <AchievementList
                            achievements={filteredAchievements}
                            selectedAchievementId={selectedAchievement?.id}
                            onSelect={setSelectedAchievementId}
                            onClaim={handleClaimAchievement}
                        />

                        <AchievementDetailPanel
                            achievement={selectedAchievement}
                            almostCompleted={almostCompleted}
                            onClaim={handleClaimAchievement}
                            onNavigate={handleNavigate}
                        />
                    </section>
                )}
            </div>

            {feedback && (
                <div className="fixed bottom-5 right-5 z-[80] max-w-sm rounded-lg border border-amber-500/60 bg-slate-950/95 px-4 py-3 text-sm text-amber-100 shadow-[0_0_30px_rgba(245,158,11,0.18)]">
                    {feedback}
                </div>
            )}
        </div>
    );
}

function AchievementSummaryCards({ summary }) {
    const pendingCount = summary.pendingRewards || 0;
    const cards = [
        {
            label: 'Progreso total',
            value: `${formatNumber(summary.completed || 0)} / ${formatNumber(summary.total || 0)}`,
            icon: Trophy,
            tone: 'text-amber-300'
        },
        {
            label: 'Puntos de logro',
            value: formatNumber(summary.points || 0),
            icon: Award,
            tone: 'text-slate-100'
        },
        {
            label: 'Recompensas pendientes',
            value: pendingCount,
            icon: Gift,
            tone: pendingCount > 0 ? 'text-purple-200' : 'text-slate-500'
        }
    ];

    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-3 gap-2 min-w-0 xl:min-w-[560px]">
            {cards.map((card) => {
                const Icon = card.icon;
                return (
                    <div
                        key={card.label}
                        className="rounded-lg border border-amber-900/40 bg-slate-950/80 px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
                    >
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                                    {card.label}
                                </div>
                                <div className={`text-xl font-black mt-1 ${card.tone}`}>
                                    {card.value}
                                </div>
                            </div>
                            <Icon size={22} className="text-amber-500/70 shrink-0" />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function AchievementFilters({
    activeFilter,
    onFilterChange,
    searchTerm,
    onSearchChange,
    sortMode,
    onSortChange
}) {
    return (
        <section className="rounded-lg border border-slate-800 bg-slate-950/75 p-3 shadow-inner">
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                {FILTERS.map((filter) => {
                    const isActive = filter === activeFilter;
                    return (
                        <button
                            key={filter}
                            type="button"
                            onClick={() => onFilterChange(filter)}
                            className={`whitespace-nowrap rounded-md border px-3 py-2 text-[11px] font-bold uppercase tracking-wider transition-all ${
                                isActive
                                    ? 'border-amber-500 bg-amber-900/35 text-amber-200 shadow-[0_0_16px_rgba(245,158,11,0.15)]'
                                    : 'border-slate-800 bg-slate-900/80 text-slate-400 hover:border-amber-800 hover:text-slate-100'
                            }`}
                        >
                            {filter}
                        </button>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_240px] gap-3 pt-2 border-t border-slate-800/80">
                <label className="relative block">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                        value={searchTerm}
                        onChange={(event) => onSearchChange(event.target.value)}
                        placeholder="Buscar logro..."
                        className="w-full rounded-md border border-slate-700 bg-black/40 py-2.5 pl-9 pr-3 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:border-amber-500"
                    />
                </label>

                <select
                    value={sortMode}
                    onChange={(event) => onSortChange(event.target.value)}
                    className="rounded-md border border-slate-700 bg-black/40 px-3 py-2.5 text-sm text-slate-200 outline-none transition-colors focus:border-amber-500"
                >
                    {SORT_OPTIONS.map((option) => (
                        <option key={option} value={option} className="bg-slate-950 text-slate-100">
                            {option}
                        </option>
                    ))}
                </select>
            </div>
        </section>
    );
}

function AchievementList({ achievements, selectedAchievementId, onSelect, onClaim }) {
    if (achievements.length === 0) {
        return (
            <div className="rounded-lg border-2 border-dashed border-slate-800 bg-slate-950/50 p-10 text-center text-slate-500">
                No hay logros para estos filtros.
            </div>
        );
    }

    return (
        <div className="space-y-3 pb-6">
            {achievements.map((achievement) => (
                <AchievementCard
                    key={achievement.id}
                    achievement={achievement}
                    isSelected={achievement.id === selectedAchievementId}
                    onSelect={() => onSelect(achievement.id)}
                    onClaim={() => onClaim(achievement.id)}
                />
            ))}
        </div>
    );
}

function CategoryGlyph({ category, hidden, size }) {
    if (hidden) return <HelpCircle size={size} />;

    switch (category) {
        case 'Combate':
            return <Swords size={size} />;
        case 'Bestiario':
            return <Skull size={size} />;
        case 'Grimorio':
            return <BookOpen size={size} />;
        case 'Mascotas':
            return <PawPrint size={size} />;
        case 'Expediciones':
            return <Compass size={size} />;
        case 'Economía':
        case 'EconomÃ­a':
            return <Coins size={size} />;
        case 'Secretos':
            return <EyeOff size={size} />;
        default:
            return <Award size={size} />;
    }
}

function StatusGlyph({ status, size }) {
    switch (status) {
        case 'Bloqueado':
            return <Lock size={size} />;
        case 'En progreso':
            return <Compass size={size} />;
        case 'Completado':
            return <CheckCircle2 size={size} />;
        case 'Reclamable':
            return <Gift size={size} />;
        case 'Reclamado':
            return <Check size={size} />;
        case 'Oculto':
            return <HelpCircle size={size} />;
        default:
            return <Award size={size} />;
    }
}

function AchievementCard({ achievement, isSelected, onSelect, onClaim }) {
    const hidden = isHiddenAchievement(achievement);

    return (
        <article
            onClick={onSelect}
            className={`group cursor-pointer rounded-lg border bg-slate-950/85 p-4 transition-all ${
                isSelected
                    ? 'border-amber-500 shadow-[0_0_24px_rgba(245,158,11,0.16)]'
                    : 'border-slate-800 hover:border-amber-800/80 hover:bg-slate-900/90'
            } ${hidden ? 'opacity-85' : ''}`}
        >
            <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-4 lg:grid-cols-[82px_minmax(0,1fr)_170px]">
                <div className={`h-[72px] w-[72px] lg:h-[82px] lg:w-[82px] rounded-lg border flex items-center justify-center shrink-0 ${
                    hidden
                        ? 'border-slate-700 bg-slate-900 text-slate-500'
                        : 'border-amber-700/50 bg-black/50 text-amber-400'
                }`}>
                    <CategoryGlyph category={achievement.category} hidden={hidden} size={34} />
                </div>

                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className={`font-serif text-xl font-bold truncate ${
                            hidden ? 'text-slate-500' : 'text-slate-100 group-hover:text-amber-100'
                        }`}>
                            {getDisplayName(achievement)}
                        </h3>
                        <span className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${RARITY_STYLES[hidden ? 'Oculta' : achievement.rarity]}`}>
                            {hidden ? 'Oculta' : achievement.rarity}
                        </span>
                    </div>

                    <div className="text-[11px] uppercase tracking-widest text-amber-500/80 font-bold mb-2">
                        Categoría: {achievement.category}
                    </div>

                    <p className="text-sm text-slate-400 line-clamp-2 min-h-[2.5rem]">
                        {getDisplayDescription(achievement)}
                    </p>

                    <div className="mt-3">
                        <AchievementProgressBar achievement={achievement} />
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                        <span className="text-slate-400 font-mono">
                            Progreso:{' '}
                            <strong className="text-slate-100">
                                {hidden ? '? / ?' : `${formatNumber(achievement.progress)} / ${formatNumber(achievement.target)}`}
                            </strong>
                        </span>
                        <AchievementRewardDisplay reward={achievement.reward} hidden={hidden} compact />
                    </div>
                </div>

                <div className="col-span-2 lg:col-span-1 flex lg:flex-col items-center lg:items-end justify-between gap-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${STATUS_STYLES[achievement.status]}`}>
                        <StatusGlyph status={achievement.status} size={13} />
                        {achievement.status}
                    </span>
                    <AchievementActionButton achievement={achievement} onClaim={onClaim} />
                </div>
            </div>
        </article>
    );
}

function AchievementActionButton({ achievement, onClaim }) {
    if (achievement.status === 'Reclamable') {
        return (
            <button
                type="button"
                onClick={(event) => {
                    event.stopPropagation();
                    onClaim();
                }}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-amber-400/70 bg-gradient-to-r from-purple-800 to-amber-700 px-4 py-2 text-xs font-black uppercase tracking-wider text-white shadow-[0_0_18px_rgba(168,85,247,0.25)] transition-transform hover:scale-[1.03]"
            >
                <Gift size={14} />
                Reclamar
            </button>
        );
    }

    if (achievement.status === 'Reclamado') {
        return (
            <button
                type="button"
                disabled
                className="inline-flex items-center justify-center gap-2 rounded-md border border-green-900/60 bg-green-950/25 px-4 py-2 text-xs font-bold uppercase tracking-wider text-green-400"
            >
                <Check size={14} />
                Reclamado
            </button>
        );
    }

    if (achievement.status === 'Bloqueado' || achievement.status === 'Oculto') {
        return (
            <span className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-800 bg-slate-900/70 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                <Lock size={14} />
                No disponible
            </span>
        );
    }

    return (
        <span className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-800 bg-slate-900/70 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-400">
            {achievement.status}
        </span>
    );
}

function AchievementDetailPanel({ achievement, almostCompleted, onClaim, onNavigate }) {
    if (!achievement) return null;

    const hidden = isHiddenAchievement(achievement);
    const navigationLabels = hidden ? [] : achievement.routeLabels || [];

    return (
        <aside className="rounded-lg border border-amber-900/50 bg-slate-950/90 shadow-[0_15px_45px_rgba(0,0,0,0.32)] xl:sticky xl:top-4">
            <div className="border-b border-amber-900/40 p-5">
                <div className="flex items-start gap-4">
                    <div className={`w-20 h-20 rounded-lg border-2 flex items-center justify-center shrink-0 ${
                        hidden
                            ? 'border-slate-700 bg-slate-900 text-slate-500'
                            : 'border-amber-500/70 bg-black/60 text-amber-300 shadow-[0_0_24px_rgba(245,158,11,0.13)]'
                    }`}>
                        <CategoryGlyph category={achievement.category} hidden={hidden} size={42} />
                    </div>

                    <div className="min-w-0">
                        <h3 className={`text-2xl font-serif font-bold leading-tight ${hidden ? 'text-slate-500' : 'text-amber-200'}`}>
                            {getDisplayName(achievement)}
                        </h3>
                        <div className="mt-2 flex flex-wrap gap-2">
                            <span className="rounded border border-amber-900/50 bg-amber-950/30 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                                {achievement.category}
                            </span>
                            <span className={`rounded border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${RARITY_STYLES[hidden ? 'Oculta' : achievement.rarity]}`}>
                                {hidden ? 'Rareza oculta' : achievement.rarity}
                            </span>
                        </div>
                    </div>
                </div>

                <p className="mt-5 text-sm leading-relaxed text-slate-300">
                    {hidden ? 'Este logro permanece oculto hasta que cumplas una condición especial.' : achievement.fullDescription}
                </p>
            </div>

            <div className="p-5 space-y-5">
                <div>
                    <div className="mb-2 flex justify-between text-xs font-bold uppercase tracking-widest text-slate-500">
                        <span>Progreso</span>
                        <span className="text-slate-200">
                            {hidden ? '? / ?' : `${formatNumber(achievement.progress)} / ${formatNumber(achievement.target)}`}
                        </span>
                    </div>
                    <AchievementProgressBar achievement={achievement} large />
                </div>

                <div>
                    <h4 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-amber-500">
                        Recompensas
                    </h4>
                    <AchievementRewardDisplay reward={achievement.reward} hidden={hidden} />
                </div>

                <div className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${STATUS_STYLES[achievement.status]}`}>
                    <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
                        <StatusGlyph status={achievement.status} size={14} />
                        Estado
                    </span>
                    <span className="text-sm font-black">{achievement.status}</span>
                </div>

                <div className="rounded-lg border border-slate-800 bg-black/30 p-4">
                    <h4 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-500">
                        Consejo
                    </h4>
                    <p className="text-sm leading-relaxed text-slate-300">
                        {hidden ? 'Explora zonas poco comunes y revisa nuevas pistas del personaje.' : achievement.advice}
                    </p>
                </div>

                <div className="flex flex-wrap gap-2">
                    {achievement.status === 'Reclamable' && (
                        <button
                            type="button"
                            onClick={() => onClaim(achievement.id)}
                            className="inline-flex items-center justify-center gap-2 rounded-md border border-amber-400/70 bg-gradient-to-r from-purple-800 to-amber-700 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white transition-transform hover:scale-[1.02]"
                        >
                            <Gift size={14} />
                            Reclamar
                        </button>
                    )}

                    {navigationLabels.map((label) => (
                        <button
                            key={label}
                            type="button"
                            onClick={() => onNavigate(label)}
                            className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-200 transition-colors hover:border-amber-500 hover:text-amber-200"
                        >
                            {label}
                            <ArrowUpRight size={13} />
                        </button>
                    ))}
                </div>
            </div>

            <div className="border-t border-slate-800 p-5">
                <h4 className="mb-3 text-sm font-serif font-bold text-amber-400">
                    Logros casi completados
                </h4>
                <div className="space-y-3">
                    {almostCompleted.map((item) => (
                        <div key={item.id} className="rounded-md border border-slate-800 bg-slate-900/50 p-3">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="truncate text-sm font-bold text-slate-200">{item.name}</div>
                                    <div className="mt-0.5 text-[11px] text-slate-500">
                                        {formatNumber(item.progress)} / {formatNumber(item.target)}
                                    </div>
                                </div>
                                <AchievementRewardDisplay reward={item.reward} compact />
                            </div>
                            <div className="mt-2">
                                <AchievementProgressBar achievement={item} small />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </aside>
    );
}

function AchievementProgressBar({ achievement, large = false, small = false }) {
    const hidden = isHiddenAchievement(achievement);
    const percent = hidden ? 0 : getProgressPercent(achievement);
    const colorClass = achievement.status === 'Reclamable'
        ? 'from-purple-500 via-amber-400 to-amber-300'
        : achievement.status === 'Reclamado' || achievement.status === 'Completado'
            ? 'from-green-600 to-green-300'
            : achievement.status === 'Bloqueado' || hidden
                ? 'from-slate-700 to-slate-600'
                : 'from-blue-600 to-cyan-300';

    const heightClass = large ? 'h-4' : small ? 'h-1.5' : 'h-3';

    return (
        <div className={`${heightClass} w-full overflow-hidden rounded-full border border-slate-700 bg-black/60 shadow-inner`}>
            <div
                className={`h-full rounded-full bg-gradient-to-r ${colorClass} transition-all duration-500`}
                style={{ width: `${percent}%` }}
            />
        </div>
    );
}

function AchievementRewardDisplay({ reward = {}, hidden = false, compact = false }) {
    if (hidden) {
        return (
            <span className="inline-flex items-center gap-1 rounded border border-slate-800 bg-slate-900 px-2 py-1 text-[11px] font-bold text-slate-500">
                <HelpCircle size={12} />
                Recompensa oculta
            </span>
        );
    }

    const entries = [
        ['gold', reward.gold, 'Oro'],
        ['silver', reward.silver, 'Plata'],
        ['copper', reward.copper, 'Cobre'],
        ['onix', reward.onix || reward.onyx, 'Ónix']
    ].filter(([, value]) => value);

    const textRewards = [
        reward.title && { icon: Sparkles, label: `Título: ${reward.title}`, color: 'text-amber-200' },
        reward.item && { icon: PackageCheck, label: reward.item, color: 'text-slate-100' },
        reward.material && { icon: PackageCheck, label: reward.material, color: 'text-slate-100' },
        reward.cosmetic && { icon: Gem, label: reward.cosmetic, color: 'text-purple-200' }
    ].filter(Boolean);

    if (entries.length === 0 && textRewards.length === 0) {
        return (
            <span className="inline-flex items-center gap-1 rounded border border-slate-800 bg-slate-900 px-2 py-1 text-[11px] font-bold text-slate-500">
                Sin recompensa visible
            </span>
        );
    }

    return (
        <div className={`flex flex-wrap gap-1.5 ${compact ? 'text-[11px]' : 'text-xs'}`}>
            {entries.map(([key, value, label]) => (
                <span
                    key={key}
                    className={`inline-flex items-center gap-1 rounded border px-2 py-1 font-bold ${
                        key === 'onix'
                            ? 'border-purple-500/50 bg-purple-950/30 text-purple-200'
                            : 'border-amber-900/50 bg-black/35 text-amber-100'
                    }`}
                    title={label}
                >
                    <img src={CURRENCY_ICONS[key]} alt="" className="w-4 h-4 object-contain" />
                    {formatNumber(value)}
                </span>
            ))}

            {textRewards.map((item) => {
                const Icon = item.icon;
                return (
                    <span
                        key={item.label}
                        className={`inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 font-bold ${item.color}`}
                    >
                        <Icon size={12} />
                        {item.label}
                    </span>
                );
            })}
        </div>
    );
}

export default AchievementsPage;
