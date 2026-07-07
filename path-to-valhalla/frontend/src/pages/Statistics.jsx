import { createElement, useCallback, useEffect, useMemo, useState } from 'react';
import {
    Award,
    Backpack,
    Banknote,
    BookOpen,
    CheckCircle2,
    ChevronDown,
    Clock3,
    Coins,
    Crown,
    EyeOff,
    Flame,
    Gem,
    HandCoins,
    Landmark,
    LockKeyhole,
    PackageCheck,
    ScrollText,
    Shield,
    Skull,
    Sparkles,
    Swords,
    Target,
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
    const [sections, setSections] = useState({
        pvp: true,
        pve: true,
        economy: true,
        inventory: false,
        progress: false,
        recent: false
    });

    const toggleSection = useCallback((id) => {
        setSections((prev) => ({ ...prev, [id]: !prev[id] }));
    }, []);

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
                setError(requestError.message || 'No se pudieron cargar las estadísticas.');
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, []);

    const pvpStats = useMemo(() => {
        const pvp = statistics.pvp || {};
        const wins = (pvp.winsAttacking || 0) + (pvp.winsDefending || 0);
        const losses = (pvp.lossesAttacking || 0) + (pvp.lossesDefending || 0);
        const total = wins + losses;
        return {
            wins,
            losses,
            total,
            winRate: total > 0 ? Math.round((wins / total) * 100) : 0
        };
    }, [statistics]);

    const summaryCards = useMemo(() => {
        const { summary = {} } = statistics;
        return [
            {
                label: 'Victorias PvP',
                value: formatNumber(pvpStats.wins),
                icon: Trophy,
                tone: 'text-emerald-200',
                accent: 'from-emerald-500/25'
            },
            {
                label: 'Derrotas PvP',
                value: formatNumber(pvpStats.losses),
                icon: Skull,
                tone: 'text-red-200',
                accent: 'from-red-500/20'
            },
            {
                label: 'Win Rate PvP',
                value: formatPercent(pvpStats.winRate),
                icon: Crown,
                tone: 'text-cyan-100',
                accent: 'from-cyan-500/20'
            },
            {
                label: 'Riqueza total',
                value: summary.accountValue?.formatted || formatCopper(0),
                icon: Coins,
                tone: 'text-amber-100',
                accent: 'from-amber-500/25'
            },
            {
                label: 'Valor inventario',
                value: summary.inventoryValue?.formatted || formatCopper(0),
                icon: Backpack,
                tone: 'text-slate-100',
                accent: 'from-slate-300/15'
            },
            {
                label: 'Logros / fases',
                value: `${formatNumber(summary.achievementsCompleted)} / ${formatNumber(summary.achievementPhasesCompleted)}`,
                icon: Award,
                tone: 'text-purple-100',
                accent: 'from-purple-500/20'
            }
        ];
    }, [statistics, pvpStats]);

    if (!user) return null;

    return (
        <div className="min-h-full text-slate-100 font-sans relative overflow-hidden bg-[#07090d]">
            <img
                src="/backgrounds/throne_room.png"
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-[0.16] saturate-[0.75]"
                onError={(event) => {
                    event.currentTarget.style.display = 'none';
                }}
            />
            <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(180deg,rgba(5,7,11,0.62),rgba(7,9,13,0.92)_42%,rgba(2,6,10,0.98))]" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/70 to-transparent" />

            <div className="relative z-10 p-4 md:p-6 lg:p-8 space-y-5">
                <section className="rounded-lg border border-amber-900/45 bg-black/45 shadow-[0_18px_55px_rgba(0,0,0,0.42)] overflow-hidden">
                    <div className="flex flex-col gap-4 px-4 py-5 md:flex-row md:items-center md:justify-between md:px-6">
                        <div className="flex min-w-0 items-center gap-4">
                            <div className="h-16 w-16 shrink-0 rounded-lg border border-amber-500/45 bg-[linear-gradient(145deg,rgba(120,53,15,0.34),rgba(2,6,23,0.9))] flex items-center justify-center shadow-[0_0_28px_rgba(245,158,11,0.16)]">
                                <img src="/icons/sidebar/hero_stats.png" alt="" className="h-10 w-10 object-contain drop-shadow-[0_0_12px_rgba(245,158,11,0.65)]" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-amber-500/75">
                                    Crónica de Valhallus
                                </p>
                                <h2 className="mt-1 text-4xl md:text-5xl font-serif font-bold text-amber-200 drop-shadow-[0_2px_18px_rgba(245,158,11,0.18)]">
                                    Estadísticas
                                </h2>
                                <p className="mt-1 text-sm text-slate-400">
                                    Registro de carrera y progreso acumulado
                                </p>
                            </div>
                        </div>

                        <div className="inline-flex w-fit items-center gap-2 rounded border border-amber-700/35 bg-amber-950/20 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-amber-100/80">
                            <Sparkles size={14} className="text-amber-400" />
                            Archivo del héroe
                        </div>
                    </div>
                </section>

                {error && (
                    <div className="rounded-lg border border-red-900/60 bg-red-950/35 p-4 text-sm text-red-200">
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="rounded-lg border border-amber-900/35 bg-black/55 p-10 text-center text-slate-400 animate-pulse shadow-[0_18px_55px_rgba(0,0,0,0.36)]">
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
                            <PvPCombatPanel
                                pvp={statistics.pvp}
                                isOpen={sections.pvp}
                                onToggle={() => toggleSection('pvp')}
                            />
                            <PvECombatPanel
                                combat={statistics.combat}
                                isOpen={sections.pve}
                                onToggle={() => toggleSection('pve')}
                            />
                            <EconomyPanel
                                economy={statistics.economy}
                                isOpen={sections.economy}
                                onToggle={() => toggleSection('economy')}
                            />
                            <InventoryPanel
                                inventory={statistics.inventory}
                                isOpen={sections.inventory}
                                onToggle={() => toggleSection('inventory')}
                            />
                            <ProgressPanel
                                progress={statistics.progress}
                                isOpen={sections.progress}
                                onToggle={() => toggleSection('progress')}
                            />
                            <RecentPanel
                                recent={statistics.recent}
                                isOpen={sections.recent}
                                onToggle={() => toggleSection('recent')}
                            />
                        </section>
                    </>
                )}
            </div>
        </div>
    );
}

function SummaryCard({ label, value, icon, tone, accent }) {
    return (
        <article className="group relative min-h-[148px] overflow-hidden rounded-lg border border-amber-800/35 bg-[linear-gradient(145deg,rgba(15,23,42,0.9),rgba(3,7,18,0.96))] p-4 shadow-[0_16px_38px_rgba(0,0,0,0.34)] transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-500/45 hover:shadow-[0_20px_45px_rgba(0,0,0,0.42)]">
            <div className={`absolute inset-0 bg-gradient-to-br ${accent} via-transparent to-transparent opacity-75`} />
            <div className="absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/70 to-transparent" />
            <div className="relative flex h-full flex-col justify-between gap-5">
                <div className="flex items-start justify-between gap-3">
                    <div className="rounded-lg border border-amber-700/35 bg-black/35 p-2 shadow-[inset_0_0_18px_rgba(245,158,11,0.08)]">
                        {createElement(icon, { size: 30, className: 'text-amber-300 drop-shadow-[0_0_10px_rgba(245,158,11,0.35)]' })}
                    </div>
                    <div className="h-8 w-8 rounded-full border border-amber-900/35 bg-black/25 opacity-60" aria-hidden />
                </div>
                <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                        {label}
                    </div>
                    <div className={`mt-2 break-words text-2xl font-black leading-tight ${tone}`}>
                        {value}
                    </div>
                </div>
            </div>
        </article>
    );
}

function SectionPanel({ title, icon, children, aside, subtitle, locked = false, isOpen = true, onToggle }) {
    const isCollapsible = onToggle !== undefined;

    return (
        <section className={`relative overflow-hidden rounded-lg border bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(2,6,23,0.94))] shadow-[0_18px_50px_rgba(0,0,0,0.34)] ${locked ? 'border-purple-800/40' : 'border-amber-900/40'}`}>
            <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent ${locked ? 'via-purple-500/70' : 'via-amber-500/75'} to-transparent`} />
            <header
                className={`flex items-start justify-between gap-3 border-b border-white/10 px-4 py-4 md:px-5 ${isCollapsible ? 'cursor-pointer select-none hover:bg-white/[0.02]' : ''}`}
                onClick={isCollapsible ? onToggle : undefined}
            >
                <div className="flex min-w-0 items-center gap-3">
                    <div className={`h-11 w-11 shrink-0 rounded-lg border flex items-center justify-center bg-black/35 shadow-[inset_0_0_18px_rgba(245,158,11,0.07)] ${locked ? 'border-purple-500/35' : 'border-amber-600/40'}`}>
                        {createElement(icon, { size: 24, className: locked ? 'text-purple-300' : 'text-amber-300' })}
                    </div>
                    <div className="min-w-0">
                        <h3 className="font-serif text-xl font-bold text-amber-100">{title}</h3>
                        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
                    </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    {aside}
                    {isCollapsible && (
                        <ChevronDown
                            size={18}
                            className={`text-slate-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : 'rotate-0'}`}
                        />
                    )}
                </div>
            </header>
            {isOpen && (
                <div className="p-4 md:p-5">
                    {children}
                </div>
            )}
        </section>
    );
}

function MetricGrid({ items, className = '' }) {
    return (
        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${className}`}>
            {items.map((item) => (
                <MetricTile key={item.label} {...item} />
            ))}
        </div>
    );
}

function MetricTile({ label, value, icon, tone = 'text-slate-100' }) {
    return (
        <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-colors hover:border-amber-700/35 hover:bg-black/40">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        {label}
                    </div>
                    <div className={`mt-1 break-words text-lg font-black leading-tight ${tone}`}>
                        {value}
                    </div>
                </div>
                {icon && createElement(icon, { size: 17, className: 'text-amber-400/75 shrink-0' })}
            </div>
        </div>
    );
}

function PvPCombatPanel({ pvp, isOpen, onToggle }) {
    const wins = (pvp.winsAttacking || 0) + (pvp.winsDefending || 0);
    const losses = (pvp.lossesAttacking || 0) + (pvp.lossesDefending || 0);
    const total = wins + losses;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
    const isPvpFuture = total === 0 && (pvp.attacksDone || 0) === 0;

    return (
        <SectionPanel
            title="Combate PvP"
            subtitle="Duelos entre héroes"
            icon={Swords}
            isOpen={isOpen}
            onToggle={onToggle}
            aside={isPvpFuture ? (
                <span className="inline-flex items-center gap-1.5 rounded border border-purple-500/45 bg-purple-950/35 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-purple-100">
                    <LockKeyhole size={12} />
                    Próximamente
                </span>
            ) : null}
        >
            {isPvpFuture && (
                <div className="mb-4 rounded-lg border border-purple-500/25 bg-purple-950/15 p-4">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg border border-purple-500/30 bg-black/35 p-3">
                            <LockKeyhole size={22} className="text-purple-200" />
                        </div>
                        <p className="text-sm font-medium text-slate-300">
                            La arena PvP abrirá sus puertas próximamente.
                        </p>
                    </div>
                </div>
            )}

            <MetricGrid
                items={[
                    { label: 'Batallas PvP totales', value: formatNumber(total), icon: Swords },
                    { label: 'Victorias PvP', value: formatNumber(wins), icon: Trophy, tone: 'text-emerald-300' },
                    { label: 'Derrotas PvP', value: formatNumber(losses), icon: Skull, tone: 'text-red-300' },
                    { label: 'Win Rate PvP', value: formatPercent(winRate), icon: Crown, tone: 'text-cyan-300' },
                    { label: 'Racha PvP actual', value: formatNumber(0), icon: Flame, tone: 'text-amber-200' },
                    { label: 'Mejor racha PvP', value: formatNumber(0), icon: Award, tone: 'text-amber-200' },
                    { label: 'Ataques realizados', value: formatNumber(pvp.attacksDone), icon: Swords },
                    { label: 'Defensas recibidas', value: formatNumber(pvp.attacksReceived), icon: Shield },
                    { label: 'Victorias atacando', value: formatNumber(pvp.winsAttacking), icon: Trophy, tone: 'text-emerald-300' },
                    { label: 'Victorias defendiendo', value: formatNumber(pvp.winsDefending), icon: Shield, tone: 'text-emerald-300' },
                    { label: 'Venganzas ganadas', value: formatNumber(pvp.revengeWins), icon: Crown, tone: 'text-purple-200' },
                    { label: 'Venganzas perdidas', value: formatNumber(pvp.revengeLosses), icon: Skull, tone: 'text-red-300' }
                ]}
            />
        </SectionPanel>
    );
}

function PvECombatPanel({ combat, isOpen, onToggle }) {
    const difficulty = combat.difficultyKills || {};
    const expeditionsTotal = (combat.expeditionWins || 0) + (combat.expeditionLosses || 0);
    const successRate = expeditionsTotal > 0 ? Math.round(((combat.expeditionWins || 0) / expeditionsTotal) * 100) : 0;

    return (
        <SectionPanel
            title="Combate PvE"
            subtitle="Expediciones y cacería"
            icon={Target}
            isOpen={isOpen}
            onToggle={onToggle}
        >
            <MetricGrid
                items={[
                    { label: 'Expediciones completadas', value: formatNumber(combat.expeditionsCompleted), icon: Swords },
                    { label: 'Expediciones exitosas', value: formatNumber(combat.expeditionWins), icon: Trophy, tone: 'text-emerald-300' },
                    { label: 'Expediciones fallidas', value: formatNumber(combat.expeditionLosses), icon: Skull, tone: 'text-red-300' },
                    { label: 'Tasa de éxito PvE', value: formatPercent(successRate), icon: Crown, tone: 'text-cyan-300' },
                    { label: 'Racha PvE actual', value: formatNumber(combat.currentWinStreak), icon: Flame, tone: 'text-amber-200' },
                    { label: 'Mejor racha PvE', value: formatNumber(combat.bestWinStreak), icon: Award, tone: 'text-amber-200' },
                    { label: 'Mobs eliminados', value: formatNumber(combat.mobsKilled), icon: Target },
                    { label: 'Jefes derrotados', value: formatNumber(combat.bossesKilled), icon: Crown, tone: 'text-purple-200' },
                    { label: 'Enemigos ocultos eliminados', value: formatNumber(combat.hiddenMobsKilled), icon: EyeOff, tone: 'text-slate-300' },
                    { label: 'Mobs fáciles', value: formatNumber(difficulty.common), icon: Shield },
                    { label: 'Mobs medios', value: formatNumber(difficulty.rare), icon: Shield, tone: 'text-blue-300' },
                    { label: 'Jefes / Infernal', value: formatNumber(difficulty.legendary), icon: Shield, tone: 'text-amber-300' }
                ]}
            />
        </SectionPanel>
    );
}

function CurrencyRow({ title, values = {}, includeOnix = false, icon }) {
    const entries = [
        ['gold', values.gold, 'Oro'],
        ['silver', values.silver, 'Plata'],
        ['copper', values.copper, 'Cobre']
    ];

    if (includeOnix) entries.push(['onix', values.onix, 'Ónix']);

    return (
        <div className="rounded-lg border border-white/10 bg-black/30 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <div className="mb-3 flex items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    {createElement(icon, { size: 14, className: 'text-amber-400/85' })}
                    {title}
                </div>
            </div>
            <div className="flex flex-wrap gap-2">
                {entries.map(([key, value, label]) => (
                    <span
                        key={key}
                        className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-xs font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${
                            key === 'onix'
                                ? 'border-purple-500/45 bg-purple-950/30 text-purple-100'
                                : 'border-amber-800/45 bg-slate-950/80 text-amber-100'
                        }`}
                        title={label}
                    >
                        <img src={CURRENCY_ICONS[key]} alt="" className="h-4 w-4 object-contain" />
                        {formatNumber(value)}
                    </span>
                ))}
            </div>
        </div>
    );
}

function EconomyPanel({ economy, isOpen, onToggle }) {
    return (
        <SectionPanel
            title="Economía"
            subtitle="Tesorería del personaje"
            icon={Coins}
            isOpen={isOpen}
            onToggle={onToggle}
        >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <CurrencyRow title="Monedas actuales" values={economy.current} includeOnix icon={Coins} />
                <CurrencyRow title="Banco" values={economy.bank} icon={Landmark} />
                <CurrencyRow title="Ganado total" values={economy.earned} includeOnix icon={HandCoins} />
                <CurrencyRow title="Gastado total" values={economy.spent} includeOnix icon={Banknote} />
                <CurrencyRow title="Robado" values={economy.stolen} icon={Target} />
                <CurrencyRow title="Perdido" values={economy.lost} icon={Shield} />
            </div>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <MetricTile label="Mayor robo" value={formatCopper(economy.biggestRobberyCopperValue)} icon={Banknote} tone="text-amber-100" />
                <MetricTile label="Mayor pérdida" value={formatCopper(economy.biggestLossCopperValue)} icon={Shield} tone="text-red-200" />
            </div>
        </SectionPanel>
    );
}

function InventoryPanel({ inventory, isOpen, onToggle }) {
    return (
        <SectionPanel
            title="Inventario"
            subtitle="Valor de objetos y equipo"
            icon={Backpack}
            isOpen={isOpen}
            onToggle={onToggle}
        >
            <MetricGrid
                items={[
                    { label: 'Valor inventario', value: formatCopper(inventory.inventoryValueCopper), icon: Coins, tone: 'text-amber-200' },
                    { label: 'Valor equipado', value: formatCopper(inventory.equippedValueCopper), icon: Shield, tone: 'text-slate-100' },
                    { label: 'Objetos en bolsa', value: formatNumber(inventory.itemsCount), icon: Backpack },
                    { label: 'Objetos equipados', value: formatNumber(inventory.equippedItemsCount), icon: PackageCheck }
                ]}
            />

            <div className="mt-3 rounded-lg border border-amber-700/35 bg-[linear-gradient(135deg,rgba(120,53,15,0.18),rgba(0,0,0,0.34))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-amber-300/80">
                            Objeto más valioso
                        </div>
                        {inventory.mostValuableItem ? (
                            <div className="mt-3">
                                <div className="truncate text-base font-black text-slate-100">
                                    {inventory.mostValuableItem.name}
                                </div>
                                <div className="mt-1 text-sm font-bold text-amber-200">
                                    {inventory.mostValuableItem.formatted || formatCopper(inventory.mostValuableItem.copperValue)}
                                </div>
                            </div>
                        ) : (
                            <div className="mt-3 text-sm text-slate-500">Sin objeto registrado</div>
                        )}
                    </div>
                    <div className="rounded-lg border border-amber-600/35 bg-black/35 p-3">
                        <Gem size={24} className="text-amber-300" />
                    </div>
                </div>
            </div>
        </SectionPanel>
    );
}

function ProgressCluster({ title, icon, items }) {
    return (
        <div className="rounded-lg border border-white/10 bg-black/25 p-3">
            <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-amber-300/85">
                {createElement(icon, { size: 14 })}
                {title}
            </div>
            <div className="space-y-2">
                {items.map((item) => (
                    <div key={item.label} className="flex items-center justify-between gap-3 border-t border-white/5 pt-2 first:border-t-0 first:pt-0">
                        <span className="text-xs text-slate-400">{item.label}</span>
                        <span className={`text-sm font-black ${item.tone || 'text-slate-100'}`}>{item.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function ProgressPanel({ progress, isOpen, onToggle }) {
    return (
        <SectionPanel
            title="Progreso"
            subtitle="Avance del jugador"
            icon={ScrollText}
            isOpen={isOpen}
            onToggle={onToggle}
        >
            <div className="mb-3 rounded-lg border border-amber-700/35 bg-black/30 p-4">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                            Puntos de logro
                        </p>
                        <p className="mt-1 text-3xl font-black text-amber-200">
                            {formatNumber(progress.achievementPointsTotal)}
                        </p>
                    </div>
                    <Award size={34} className="text-amber-300 drop-shadow-[0_0_12px_rgba(245,158,11,0.35)]" />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <ProgressCluster
                    title="Logros"
                    icon={Trophy}
                    items={[
                        { label: 'Completados', value: formatNumber(progress.achievementsCompleted), tone: 'text-emerald-300' },
                        { label: 'Fases completadas', value: formatNumber(progress.achievementPhasesCompleted), tone: 'text-purple-200' },
                        { label: 'Recompensas', value: formatNumber(progress.achievementRewardsClaimed) },
                        { label: 'Secretos', value: formatNumber(progress.secretAchievementsDiscovered), tone: 'text-slate-300' }
                    ]}
                />
                <ProgressCluster
                    title="Bestiario"
                    icon={BookOpen}
                    items={[
                        { label: 'Descubierto', value: formatNumber(progress.bestiaryDiscovered), tone: 'text-cyan-200' },
                        { label: 'Contratos', value: formatNumber(progress.questsCompleted), tone: 'text-amber-100' }
                    ]}
                />
                <ProgressCluster
                    title="Misiones"
                    icon={ScrollText}
                    items={[
                        { label: 'Diarias', value: formatNumber(progress.dailyQuestsCompleted) },
                        { label: 'Semanales', value: formatNumber(progress.weeklyQuestsCompleted) }
                    ]}
                />
                <ProgressCluster
                    title="Colección"
                    icon={Sparkles}
                    items={[
                        { label: 'Mascotas desbloqueadas', value: formatNumber(progress.petsUnlocked), tone: 'text-emerald-200' },
                        { label: 'Recetas aprendidas', value: formatNumber(progress.recipesLearnedTotal), tone: 'text-amber-100' }
                    ]}
                />
            </div>
        </SectionPanel>
    );
}

function RecentPanel({ recent, isOpen, onToggle }) {
    const rows = [
        { icon: Swords, label: 'Última batalla', value: recent.lastBattleAt },
        { icon: CheckCircle2, label: 'Última victoria', value: recent.lastWinAt },
        { icon: Skull, label: 'Última derrota', value: recent.lastLossAt },
        { icon: Crown, label: 'Último jefe', value: recent.lastBossKillAt },
        { icon: EyeOff, label: 'Último oculto', value: recent.lastHiddenKillAt },
        { icon: ScrollText, label: 'Última misión', value: recent.lastQuestCompletedAt },
        { icon: Sparkles, label: 'Último logro reclamado', value: recent.lastAchievementClaimedAt }
    ];

    return (
        <SectionPanel
            title="Actividad reciente"
            subtitle="Línea de eventos"
            icon={Clock3}
            isOpen={isOpen}
            onToggle={onToggle}
        >
            <div className="relative space-y-2">
                <div className="absolute bottom-4 left-[18px] top-4 w-px bg-gradient-to-b from-amber-500/35 via-slate-700/50 to-transparent" />
                {rows.map((row) => (
                    <RecentRow key={row.label} {...row} />
                ))}
            </div>
        </SectionPanel>
    );
}

function RecentRow({ icon, label, value }) {
    const formatted = formatDate(value);
    const isEmpty = formatted === 'Sin registro';

    return (
        <div className="relative flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/30 px-3 py-3 pl-12">
            <div className="absolute left-2.5 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-amber-700/35 bg-slate-950">
                {createElement(icon, { size: 15, className: isEmpty ? 'text-slate-600' : 'text-amber-300' })}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                {label}
            </div>
            <div className={`text-right text-sm font-bold ${isEmpty ? 'text-slate-600' : 'text-slate-100'}`}>
                {formatted}
            </div>
        </div>
    );
}

export default StatisticsPage;
