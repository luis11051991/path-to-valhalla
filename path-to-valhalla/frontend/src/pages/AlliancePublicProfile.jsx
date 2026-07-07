import { createElement, useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Crown, Lock, Shield, Sparkles, UserPlus, Users, X } from 'lucide-react';
import { allianceService } from '../services/allianceService';

const JOIN_LABELS = {
    open: 'Abierta',
    request: 'Por solicitud',
    closed: 'Cerrada'
};

const ROLE_LABELS = {
    leader: 'Líder',
    admin: 'Administrador',
    member: 'Miembro'
};

const formatNumber = (value) => new Intl.NumberFormat('es-ES').format(Number(value || 0));

function AlliancePublicProfile({ user }) {
    const { allianceId } = useParams();
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [feedback, setFeedback] = useState(null);
    const [showApply, setShowApply] = useState(false);

    const loadProfile = useCallback(async () => {
        setLoading(true);
        try {
            setProfile(await allianceService.getAlliancePublicProfile(allianceId));
            setFeedback(null);
        } catch (requestError) {
            setFeedback(requestError.message || 'No se pudo cargar la alianza.');
        } finally {
            setLoading(false);
        }
    }, [allianceId]);

    useEffect(() => {
        if (user) loadProfile();
    }, [user, loadProfile]);

    if (!user) return null;

    const alliance = profile?.alliance;
    const hasOwnAlliance = alliance?.applyBlockedReason === 'Ya perteneces a una alianza.';

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
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,7,13,0.68),rgba(2,6,12,0.96))]" />

            <div className="relative z-10 p-4 md:p-6 lg:p-8">
                <button
                    type="button"
                    onClick={() => navigate('/alliance')}
                    className="mb-4 inline-flex items-center gap-2 rounded border border-slate-700 bg-black/35 px-3 py-2 text-xs font-bold uppercase tracking-widest text-slate-300 hover:border-amber-700 hover:text-amber-100"
                >
                    <ArrowLeft size={14} />
                    Volver
                </button>

                {feedback && (
                    <div className="mb-4 rounded-lg border border-amber-900/45 bg-amber-950/25 p-4 text-sm text-amber-100">
                        {feedback}
                    </div>
                )}

                {loading ? (
                    <div className="rounded-lg border border-amber-900/35 bg-black/55 p-10 text-center text-slate-400 animate-pulse">
                        Cargando estandarte...
                    </div>
                ) : alliance && (
                    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
                        <section className="overflow-hidden rounded-lg border border-amber-900/40 bg-slate-950/85 shadow-[0_18px_50px_rgba(0,0,0,0.34)]">
                            <div className="h-40 bg-[linear-gradient(135deg,rgba(120,53,15,0.34),rgba(30,41,59,0.38))]" />
                            <div className="p-5">
                                <div className="-mt-20 mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                                    <div className="flex min-w-0 items-end gap-4">
                                        <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-lg border border-amber-500/55 bg-slate-950 shadow-[0_0_35px_rgba(245,158,11,0.16)]">
                                            {alliance.logoUrl ? (
                                                <img src={alliance.logoUrl} alt="" className="h-20 w-20 object-contain" />
                                            ) : (
                                                <Shield size={60} className="text-amber-300" />
                                            )}
                                        </div>
                                        <div className="min-w-0 pb-1">
                                            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-400/80">
                                                {alliance.tag || 'SIN TAG'} · Nivel {formatNumber(alliance.level)}
                                            </p>
                                            <h1 className="font-serif text-4xl font-bold text-amber-100 md:text-5xl">{alliance.name}</h1>
                                            <p className="mt-1 text-sm text-slate-400">Líder: {alliance.leaderName || 'Desconocido'}</p>
                                        </div>
                                    </div>
                                    {hasOwnAlliance ? (
                                        <span className="inline-flex items-center gap-2 rounded border border-slate-700 bg-black/30 px-4 py-3 text-xs font-bold text-slate-400">
                                            Ya perteneces a una alianza.
                                        </span>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => setShowApply(true)}
                                            disabled={!alliance.canApply}
                                            title={alliance.applyBlockedReason || ''}
                                            className={`inline-flex items-center justify-center gap-2 rounded border px-4 py-3 text-xs font-black uppercase tracking-widest ${
                                                alliance.canApply
                                                    ? 'border-amber-500/60 bg-amber-700/25 text-amber-100 hover:bg-amber-700/40'
                                                    : 'cursor-not-allowed border-slate-800 bg-slate-900/70 text-slate-600'
                                            }`}
                                        >
                                            {alliance.canApply ? <UserPlus size={15} /> : <Lock size={15} />}
                                            {alliance.hasPendingApplication ? 'Solicitud pendiente' : 'Aplicar'}
                                        </button>
                                    )}
                                </div>

                                <p className="text-base leading-7 text-slate-300">{alliance.description}</p>

                                <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                                    <InfoBlock label="Miembros" value={`${formatNumber(alliance.membersCount)} / ${formatNumber(alliance.maxMembers)}`} />
                                    <InfoBlock label="Ingreso" value={JOIN_LABELS[alliance.joinType] || alliance.joinType} />
                                    <InfoBlock label="Nivel mínimo" value={formatNumber(alliance.minLevelRequired)} />
                                    <InfoBlock label="Poder mínimo" value={formatNumber(alliance.minPowerRequired)} />
                                </div>
                            </div>
                        </section>

                        <aside className="space-y-5">
                            <Panel title="Bonos principales" icon={Sparkles}>
                                <div className="grid grid-cols-2 gap-2">
                                    <Bonus label="Atributos" value={`+${formatNumber(profile.bonuses?.statsPercent)}%`} />
                                    <Bonus label="Experiencia" value={`+${formatNumber(profile.bonuses?.expPercent)}%`} />
                                    <Bonus label="Miembros" value={formatNumber(profile.bonuses?.maxMembers || alliance.maxMembers)} />
                                    <Bonus label="Ocultos" value={`+${formatNumber(profile.bonuses?.hiddenFindPercent)}%`} />
                                    <Bonus label="Taller" value={`-${formatNumber(profile.bonuses?.workshopDiscountPercent)}%`} />
                                    <Bonus label="Tesoro" value={`+${formatNumber(profile.bonuses?.treasuryCapacityBonusPercent)}%`} />
                                </div>
                            </Panel>
                            <Panel title="Miembros destacados" icon={Users}>
                                <div className="space-y-2">
                                    {(profile.featuredMembers || []).map((member) => (
                                        <div key={member.playerId} className="flex items-center justify-between gap-3 rounded border border-white/10 bg-black/30 px-3 py-2">
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-bold text-slate-100">{member.username}</p>
                                                <p className="text-[11px] text-slate-500">{ROLE_LABELS[member.role] || member.role}</p>
                                            </div>
                                            <span className="text-xs font-bold text-amber-200">Nvl {formatNumber(member.level)}</span>
                                        </div>
                                    ))}
                                </div>
                            </Panel>
                            {!hasOwnAlliance && (
                                <Link
                                    to="/alliance/create"
                                    className="inline-flex w-full items-center justify-center gap-2 rounded border border-slate-700 bg-black/35 px-4 py-3 text-xs font-bold uppercase tracking-widest text-slate-300 hover:border-amber-700 hover:text-amber-100"
                                >
                                    <Crown size={15} />
                                    Fundar otra alianza
                                </Link>
                            )}
                        </aside>
                    </div>
                )}
            </div>

            {showApply && alliance && (
                <ApplyModal
                    alliance={alliance}
                    onClose={() => setShowApply(false)}
                    onApplied={async (result) => {
                        setShowApply(false);
                        setFeedback(result.message || 'Solicitud enviada.');
                        await loadProfile();
                    }}
                />
            )}
        </div>
    );
}

function InfoBlock({ label, value }) {
    return (
        <div className="rounded-lg border border-white/10 bg-black/30 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
            <p className="mt-1 text-lg font-black text-slate-100">{value}</p>
        </div>
    );
}

function Bonus({ label, value }) {
    return (
        <div className="rounded border border-amber-900/35 bg-amber-950/15 p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-300/80">{label}</p>
            <p className="mt-1 text-xl font-black text-amber-100">{value}</p>
        </div>
    );
}

function Panel({ title, icon: Icon, children }) {
    return (
        <section className="rounded-lg border border-amber-900/40 bg-slate-950/85 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.34)]">
            <div className="mb-4 flex items-center gap-2">
                {createElement(Icon, { size: 18, className: 'text-amber-300' })}
                <h2 className="font-serif text-xl font-bold text-amber-100">{title}</h2>
            </div>
            {children}
        </section>
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
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <section className="w-full max-w-lg rounded-lg border border-amber-700/50 bg-slate-950 shadow-[0_30px_90px_rgba(0,0,0,0.65)]">
                <header className="flex items-center justify-between gap-3 border-b border-white/10 p-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded border border-amber-600/45 bg-black/35">
                            <UserPlus size={21} className="text-amber-300" />
                        </div>
                        <h3 className="font-serif text-2xl font-bold text-amber-100">Aplicar a {alliance.name}</h3>
                    </div>
                    <button type="button" onClick={onClose} className="rounded border border-slate-700 bg-black/30 p-2 text-slate-400 hover:text-amber-100">
                        <X size={18} />
                    </button>
                </header>
                <div className="p-4">
                    <textarea
                        value={message}
                        onChange={(event) => setMessage(event.target.value)}
                        rows={5}
                        className="w-full rounded border border-slate-700 bg-black/45 p-3 text-sm text-slate-100 outline-none focus:border-amber-500"
                        placeholder="Mensaje para el liderazgo..."
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
                </div>
            </section>
        </div>
    );
}

export default AlliancePublicProfile;
