import { createElement, useEffect, useMemo, useState } from 'react';
import {
    Activity,
    Backpack,
    Banknote,
    CheckCircle2,
    Clock3,
    Coins,
    Crown,
    EyeOff,
    PackageCheck,
    ScrollText,
    Shield,
    Skull,
    Sparkles,
    Swords,
    Trophy
} from 'lucide-react';
import { statisticsService } from '../services/statisticsService';

const CURRENCY_ICONS = {
    copper: '/icons/currency/copper.png',
    silver: '/icons/currency/silver.png',
    gold: '/icons/currency/gold.png',
    onix: '/icons/currency/onix.png'
};

const EMPTY_STATS = {
    summary: {},
    combat: { difficultyKills: {} },
    economy: {
        current: {},
        bank: {},
        earned: {},
        spent: {},
        stolen: {},
        lost: {}
    },
    inventory: {},
    progress: {},
    pvp: { stolen: {}, lost: {} },
    recent: {}
};

const formatNumber = (value) => new Intl.NumberFormat('es-ES').format(Number(value || 0));

const formatPercent = (value) => `${formatNumber(value)}%`;

const formatDate = (value) => {
    if (!value) return 'Sin registro';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Sin registro';

    return new Intl.DateTimeFormat('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
};

const formatCopper = (value) => {
    const safeValue = Math.max(0, Math.trunc(Number(value || 0)));
    const gold = Math.floor(safeValue / 10000);
    const rest = safeValue % 10000;
    const silver = Math.floor(rest / 100);
    const copper = rest % 100;
    const parts = [];
    if (gold > 0) parts.push(`${formatNumber(gold)} oro`);
    if (silver > 0) parts.push(`${formatNumber(silver)} plata`);
    if (copper > 0 || parts.length === 0) parts.push(`${formatNumber(copper)} cobre`);
    return parts.join(' ');
};

function StatisticsPage({ user }) {
    const [statistics, setStatistics] = useState(EMPTY_STATS);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let isMounted = true;

        statisticsService.getStatistics()
            .then((data) => {
                if (!isMounted) return;
                setStatistics({
                    ...EMPTY_STATS,
                    ...data,
                    combat: { ...EMPTY_STATS.combat, ...(data.combat || {}) },
                    economy: { ...EMPTY_STATS.economy, ...(data.economy || {}) },
                    inventory: { ...EMPTY_STATS.inventory, ...(data.inventory || {}) },
                    progress: { ...EMPTY_STATS.progress, ...(data.progress || {}) },
                    pvp: { ...EMPTY_STATS.pvp, ...(data.pvp || {}) },
                    recent: { ...EMPTY_STATS.recent, ...(data.recent || {}) }
                });
                setError(null);
            })
            .catch((requestError) => {
                if (!isMounted) return;
                setError(requestError.message || 'No se pudieron cargar las estadisticas.');
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, []);

    const summaryCards = useMemo(() => {
        const { summary = {} } = statistics;
        return [
            {
                label: 'Batallas ganadas',
                value: formatNumber(summary.battlesWon),
                icon: Trophy,
                tone: 'text-emerald-300'
            },
            {
                label: 'Batallas perdidas',
                value: formatNumber(summary.battlesLost),
                icon: Skull,
                tone: 'text-red-300'
            },
            {
                label: 'Win rate',
                value: formatPercent(summary.winRate),
                icon: Activity,
                tone: 'text-cyan-300'
            },
            {
                label: 'Riqueza total',
                value: summary.accountValue?.formatted || formatCopper(0),
                icon: Coins,
                tone: 'text-amber-200'
            },
            {
                label: 'Valor inventario',
                value: summary.inventoryValue?.formatted || formatCopper(0),
                icon: Backpack,
                tone: 'text-slate-100'
            },
            {
                label: 'Logros / fases',
                value: `${formatNumber(summary.achievementsCompleted)} / ${formatNumber(summary.achievementPhasesCompleted)}`,
                icon: Crown,
                tone: 'text-purple-200'
            }
        ];
    }, [statistics]);

    if (!user) return null;

    return (
        <div className="min-h-full text-slate-100 font-sans relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(180deg,rgba(15,23,42,0.74),rgba(2,6,23,0.96))]" />

            <div className="relative z-10 p-4 md:p-6 lg:p-8 space-y-5">
                <section className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                    <div className="min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-12 h-12 rounded-lg border border-amber-600/60 bg-black/50 flex items-center justify-center shadow-[0_0_25px_rgba(245,158,11,0.12)]">
                                <img src="/icons/sidebar/hero_stats.png" alt="" className="w-8 h-8 object-contain" />
                            </div>
                            <h2 className="text-4xl md:text-5xl font-serif font-bold text-amber-500 drop-shadow-md">
                                Estadísticas
                            </h2>
                        </div>
                        <p className="text-slate-400 text-sm md:text-base">
                            Registro de carrera y progreso acumulado
                        </p>
                    </div>
                </section>

                {error && (
                    <div className="rounded-lg border border-red-900/60 bg-red-950/30 p-4 text-sm text-red-200">
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-10 text-center text-slate-500 animate-pulse">
                        Cargando estadísticas...
                    </div>
                ) : (
                    <>
                        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3">
                            {summaryCards.map((card) => (
                                <SummaryCard key={card.label} {...card} />
                            ))}
                        </section>

                        <section className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
                            <CombatPanel combat={statistics.combat} />
                            <EconomyPanel economy={statistics.economy} />
                            <InventoryPanel inventory={statistics.inventory} />
                            <ProgressPanel progress={statistics.progress} />
                            <PvpPanel pvp={statistics.pvp} />
                            <RecentPanel recent={statistics.recent} />
                        </section>
                    </>
                )}
            </div>
        </div>
    );
}

function SummaryCard({ label, value, icon, tone }) {
    return (
        <article className="rounded-lg border border-amber-900/40 bg-slate-950/85 px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.22)]">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                        {label}
                    </div>
                    <div className={`mt-1 text-xl font-black leading-tight ${tone}`}>
                        {value}
                    </div>
                </div>
                {createElement(icon, { size: 22, className: 'text-amber-500/70 shrink-0' })}
            </div>
        </article>
    );
}

function SectionPanel({ title, icon, children, aside }) {
    return (
        <section className="rounded-lg border border-slate-800 bg-slate-950/82 shadow-[0_15px_45px_rgba(0,0,0,0.28)] overflow-hidden">
            <header className="flex items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
                <div className="flex items-center gap-2">
                    {createElement(icon, { size: 18, className: 'text-amber-400' })}
                    <h3 className="font-serif text-xl font-bold text-amber-200">{title}</h3>
                </div>
                {aside}
            </header>
            <div className="p-5">
                {children}
            </div>
        </section>
    );
}

function StatGrid({ items }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {items.map((item) => (
                <div key={item.label} className="rounded-md border border-slate-800 bg-black/30 px-3 py-2">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        {item.label}
                    </div>
                    <div className={`mt-1 text-lg font-black ${item.tone || 'text-slate-100'}`}>
                        {item.value}
                    </div>
                </div>
            ))}
        </div>
    );
}

function CombatPanel({ combat }) {
    const difficulty = combat.difficultyKills || {};
    return (
        <SectionPanel title="Combate" icon={Swords}>
            <StatGrid
                items={[
                    { label: 'Batallas totales', value: formatNumber(combat.battlesTotal) },
                    { label: 'Victorias', value: formatNumber(combat.battlesWon), tone: 'text-emerald-300' },
                    { label: 'Derrotas', value: formatNumber(combat.battlesLost), tone: 'text-red-300' },
                    { label: 'Win rate', value: formatPercent(combat.winRate), tone: 'text-cyan-300' },
                    { label: 'Racha actual', value: formatNumber(combat.currentWinStreak), tone: 'text-amber-200' },
                    { label: 'Mejor racha', value: formatNumber(combat.bestWinStreak), tone: 'text-amber-200' },
                    { label: 'Mobs eliminados', value: formatNumber(combat.mobsKilled) },
                    { label: 'Jefes eliminados', value: formatNumber(combat.bossesKilled), tone: 'text-purple-200' },
                    { label: 'Ocultos eliminados', value: formatNumber(combat.hiddenMobsKilled), tone: 'text-slate-300' },
                    { label: 'Tier 1', value: formatNumber(difficulty.common) },
                    { label: 'Tier 2', value: formatNumber(difficulty.rare), tone: 'text-blue-300' },
                    { label: 'Tier 3', value: formatNumber(difficulty.legendary), tone: 'text-amber-300' }
                ]}
            />
        </SectionPanel>
    );
}

function CurrencyRow({ title, values = {}, includeOnix = false }) {
    const entries = [
        ['gold', values.gold, 'Oro'],
        ['silver', values.silver, 'Plata'],
        ['copper', values.copper, 'Cobre']
    ];

    if (includeOnix) entries.push(['onix', values.onix, 'Ónix']);

    return (
        <div className="rounded-md border border-slate-800 bg-black/30 p-3">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                {title}
            </div>
            <div className="flex flex-wrap gap-2">
                {entries.map(([key, value, label]) => (
                    <span
                        key={key}
                        className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-bold ${
                            key === 'onix'
                                ? 'border-purple-500/50 bg-purple-950/30 text-purple-200'
                                : 'border-amber-900/50 bg-slate-950 text-amber-100'
                        }`}
                        title={label}
                    >
                        <img src={CURRENCY_ICONS[key]} alt="" className="w-4 h-4 object-contain" />
                        {formatNumber(value)}
                    </span>
                ))}
            </div>
        </div>
    );
}

function EconomyPanel({ economy }) {
    return (
        <SectionPanel title="Economía" icon={Coins}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <CurrencyRow title="Monedas actuales" values={economy.current} includeOnix />
                <CurrencyRow title="Banco" values={economy.bank} />
                <CurrencyRow title="Ganado total" values={economy.earned} includeOnix />
                <CurrencyRow title="Gastado total" values={economy.spent} includeOnix />
                <CurrencyRow title="Robado" values={economy.stolen} />
                <CurrencyRow title="Perdido" values={economy.lost} />
            </div>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ValueBlock label="Mayor robo" value={formatCopper(economy.biggestRobberyCopperValue)} icon={Banknote} />
                <ValueBlock label="Mayor pérdida" value={formatCopper(economy.biggestLossCopperValue)} icon={Shield} />
            </div>
        </SectionPanel>
    );
}

function ValueBlock({ label, value, icon }) {
    return (
        <div className="rounded-md border border-slate-800 bg-black/30 px-3 py-2">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</div>
                    <div className="mt-1 text-sm font-black text-slate-100">{value}</div>
                </div>
                {createElement(icon, { size: 16, className: 'text-amber-500/70 shrink-0' })}
            </div>
        </div>
    );
}

function InventoryPanel({ inventory }) {
    return (
        <SectionPanel title="Inventario" icon={Backpack}>
            <StatGrid
                items={[
                    { label: 'Valor inventario', value: formatCopper(inventory.inventoryValueCopper), tone: 'text-amber-200' },
                    { label: 'Valor equipado', value: formatCopper(inventory.equippedValueCopper), tone: 'text-slate-100' },
                    { label: 'Objetos en bolsa', value: formatNumber(inventory.itemsCount) },
                    { label: 'Objetos equipados', value: formatNumber(inventory.equippedItemsCount) }
                ]}
            />

            <div className="mt-3 rounded-md border border-slate-800 bg-black/30 p-3">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    Objeto más valioso
                </div>
                {inventory.mostValuableItem ? (
                    <div className="mt-2 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                            <div className="truncate text-sm font-bold text-slate-100">
                                {inventory.mostValuableItem.name}
                            </div>
                            <div className="text-xs text-slate-500">
                                {inventory.mostValuableItem.formatted || formatCopper(inventory.mostValuableItem.copperValue)}
                            </div>
                        </div>
                        <PackageCheck size={18} className="text-amber-400 shrink-0" />
                    </div>
                ) : (
                    <div className="mt-2 text-sm text-slate-500">Sin objeto registrado</div>
                )}
            </div>
        </SectionPanel>
    );
}

function ProgressPanel({ progress }) {
    return (
        <SectionPanel title="Progreso" icon={ScrollText}>
            <StatGrid
                items={[
                    { label: 'Logros completados', value: formatNumber(progress.achievementsCompleted), tone: 'text-emerald-300' },
                    { label: 'Fases completadas', value: formatNumber(progress.achievementPhasesCompleted), tone: 'text-purple-200' },
                    { label: 'Puntos de logro', value: formatNumber(progress.achievementPointsTotal), tone: 'text-amber-200' },
                    { label: 'Recompensas reclamadas', value: formatNumber(progress.achievementRewardsClaimed) },
                    { label: 'Secretos descubiertos', value: formatNumber(progress.secretAchievementsDiscovered), tone: 'text-slate-300' },
                    { label: 'Bestiario descubierto', value: formatNumber(progress.bestiaryDiscovered) },
                    { label: 'Contratos completados', value: formatNumber(progress.questsCompleted) },
                    { label: 'Diarios / semanales', value: `${formatNumber(progress.dailyQuestsCompleted)} / ${formatNumber(progress.weeklyQuestsCompleted)}` },
                    { label: 'Mascotas desbloqueadas', value: formatNumber(progress.petsUnlocked) },
                    { label: 'Recetas aprendidas', value: formatNumber(progress.recipesLearnedTotal) }
                ]}
            />
        </SectionPanel>
    );
}

function PvpPanel({ pvp }) {
    return (
        <SectionPanel
            title="PvP futuro"
            icon={Shield}
            aside={(
                <span className="rounded border border-purple-500/50 bg-purple-950/30 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-purple-200">
                    Próximamente
                </span>
            )}
        >
            <StatGrid
                items={[
                    { label: 'Ataques', value: formatNumber(pvp.attacksDone) },
                    { label: 'Defensas', value: formatNumber(pvp.attacksReceived) },
                    { label: 'Victorias atacando', value: formatNumber(pvp.winsAttacking), tone: 'text-emerald-300' },
                    { label: 'Victorias defendiendo', value: formatNumber(pvp.winsDefending), tone: 'text-emerald-300' },
                    { label: 'Venganzas ganadas', value: formatNumber(pvp.revengeWins), tone: 'text-purple-200' },
                    { label: 'Venganzas perdidas', value: formatNumber(pvp.revengeLosses), tone: 'text-red-300' },
                    { label: 'Dinero robado', value: formatCopper((pvp.stolen?.gold || 0) * 10000 + (pvp.stolen?.silver || 0) * 100 + (pvp.stolen?.copper || 0)) },
                    { label: 'Dinero perdido', value: formatCopper((pvp.lost?.gold || 0) * 10000 + (pvp.lost?.silver || 0) * 100 + (pvp.lost?.copper || 0)) }
                ]}
            />
        </SectionPanel>
    );
}

function RecentPanel({ recent }) {
    return (
        <SectionPanel title="Actividad reciente" icon={Clock3}>
            <div className="space-y-2">
                <RecentRow icon={Swords} label="Última batalla" value={formatDate(recent.lastBattleAt)} />
                <RecentRow icon={CheckCircle2} label="Última victoria" value={formatDate(recent.lastWinAt)} />
                <RecentRow icon={Skull} label="Última derrota" value={formatDate(recent.lastLossAt)} />
                <RecentRow icon={Crown} label="Último jefe" value={formatDate(recent.lastBossKillAt)} />
                <RecentRow icon={EyeOff} label="Último oculto" value={formatDate(recent.lastHiddenKillAt)} />
                <RecentRow icon={ScrollText} label="Última misión" value={formatDate(recent.lastQuestCompletedAt)} />
                <RecentRow icon={Sparkles} label="Último logro reclamado" value={formatDate(recent.lastAchievementClaimedAt)} />
            </div>
        </SectionPanel>
    );
}

function RecentRow({ icon, label, value }) {
    return (
        <div className="flex items-center justify-between gap-3 rounded-md border border-slate-800 bg-black/30 px-3 py-2">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                {createElement(icon, { size: 14, className: 'text-amber-500/80' })}
                {label}
            </div>
            <div className="text-right text-sm font-bold text-slate-200">{value}</div>
        </div>
    );
}

export default StatisticsPage;
