import { createElement, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Crown, Gem, Shield, Swords, Users } from 'lucide-react';
import { allianceService } from '../services/allianceService';
import { ALLIANCE_JOIN_OPTIONS, OFFICIAL_ALLIANCE_EMBLEMS } from '../constants/alliance';

function AllianceCreate({ user, onUpdateUser }) {
    const navigate = useNavigate();
    const [form, setForm] = useState({
        name: '',
        tag: '',
        description: '',
        messageOfTheDay: '',
        logoUrl: OFFICIAL_ALLIANCE_EMBLEMS[0],
        bannerUrl: '',
        minLevelRequired: 1,
        minPowerRequired: 0,
        joinType: 'request'
    });
    const [feedback, setFeedback] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    const setField = (field, value) => {
        setForm((prev) => ({ ...prev, [field]: value }));
    };

    const submit = async () => {
        setSubmitting(true);
        setFeedback(null);
        try {
            const result = await allianceService.createAlliance(form);
            onUpdateUser?.(result.userCurrency);
            navigate('/alliance');
        } catch (requestError) {
            setFeedback(requestError.message || 'No se pudo crear la alianza.');
        } finally {
            setSubmitting(false);
        }
    };

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

                <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
                    <section className="rounded-lg border border-amber-900/40 bg-slate-950/85 shadow-[0_18px_50px_rgba(0,0,0,0.34)]">
                        <header className="border-b border-white/10 p-5">
                            <div className="flex items-center gap-3">
                                <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-amber-600/45 bg-black/35">
                                    <Crown size={25} className="text-amber-300" />
                                </div>
                                <div>
                                    <h1 className="font-serif text-4xl font-bold text-amber-100">Crear Alianza</h1>
                                    <p className="text-sm text-slate-500">Fundar una alianza cuesta 1 oro.</p>
                                </div>
                            </div>
                        </header>

                        <div className="space-y-5 p-5">
                            <div>
                                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Selector de emblema</p>
                                <div className="flex flex-wrap gap-2">
                                    {OFFICIAL_ALLIANCE_EMBLEMS.map((emblem) => (
                                        <button
                                            key={emblem}
                                            type="button"
                                            onClick={() => setField('logoUrl', emblem)}
                                            className={`flex h-16 w-16 items-center justify-center rounded-lg border bg-black/35 ${
                                                form.logoUrl === emblem ? 'border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.2)]' : 'border-slate-700'
                                            }`}
                                        >
                                            <img src={emblem} alt="" className="h-10 w-10 object-contain" />
                                        </button>
                                    ))}
                                </div>
                                <p className="mt-2 text-xs text-slate-500">Subida personalizada próximamente.</p>
                            </div>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <InputField label="Nombre" value={form.name} onChange={(value) => setField('name', value)} />
                                <InputField label="Tag" value={form.tag} maxLength={8} onChange={(value) => setField('tag', value.toUpperCase())} />
                            </div>
                            <TextAreaField label="Descripción" value={form.description} onChange={(value) => setField('description', value)} />
                            <TextAreaField label="Mensaje del día" value={form.messageOfTheDay} onChange={(value) => setField('messageOfTheDay', value)} />

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                <InputField label="Nivel mínimo" type="number" value={form.minLevelRequired} onChange={(value) => setField('minLevelRequired', value)} />
                                <InputField label="Poder mínimo futuro" type="number" value={form.minPowerRequired} onChange={(value) => setField('minPowerRequired', value)} />
                                <label className="block">
                                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Tipo de ingreso</span>
                                    <select
                                        value={form.joinType}
                                        onChange={(event) => setField('joinType', event.target.value)}
                                        className="w-full rounded border border-slate-700 bg-black/45 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-amber-500"
                                    >
                                        {ALLIANCE_JOIN_OPTIONS.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </select>
                                </label>
                            </div>

                            <div className="rounded-lg border border-amber-900/35 bg-amber-950/15 p-4">
                                <div className="flex items-center gap-3">
                                    <img src="/icons/currency/gold.png" alt="" className="h-7 w-7 object-contain" />
                                    <div>
                                        <p className="font-bold text-amber-100">Costo de fundación: 1 oro</p>
                                        <p className="text-xs text-slate-500">Se descontará de tu bolsa al confirmar.</p>
                                    </div>
                                </div>
                            </div>

                            {feedback && (
                                <div className="rounded border border-red-900/55 bg-red-950/25 px-3 py-2 text-sm text-red-200">
                                    {feedback}
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={submit}
                                disabled={submitting}
                                className="inline-flex w-full items-center justify-center gap-2 rounded border border-amber-500/60 bg-amber-700/25 px-4 py-3 text-xs font-black uppercase tracking-widest text-amber-100 hover:bg-amber-700/40 disabled:opacity-50"
                            >
                                <Crown size={16} />
                                {submitting ? 'Fundando...' : 'Crear Alianza'}
                            </button>
                        </div>
                    </section>

                    <AlliancePreview form={form} />
                </div>
            </div>
        </div>
    );
}

function AlliancePreview({ form }) {
    return (
        <aside className="rounded-lg border border-amber-900/40 bg-slate-950/85 shadow-[0_18px_50px_rgba(0,0,0,0.34)] xl:sticky xl:top-5">
            <div className="h-24 bg-[linear-gradient(135deg,rgba(120,53,15,0.34),rgba(30,41,59,0.35))]" />
            <div className="p-5">
                <div className="-mt-16 mb-4 flex items-end gap-3">
                    <div className="flex h-24 w-24 items-center justify-center rounded-lg border border-amber-500/55 bg-slate-950">
                        <img src={form.logoUrl} alt="" className="h-16 w-16 object-contain" />
                    </div>
                    <div className="pb-1">
                        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-amber-400/80">{form.tag || 'TAG'}</p>
                        <h2 className="font-serif text-3xl font-bold text-amber-100">{form.name || 'Nueva Alianza'}</h2>
                    </div>
                </div>
                <p className="min-h-[5rem] text-sm leading-6 text-slate-300">
                    {form.description || 'Describe el juramento, estilo y ambición de tu alianza.'}
                </p>
                <div className="mt-4 rounded border border-white/10 bg-black/30 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Mensaje del día</p>
                    <p className="mt-1 text-sm text-slate-300">{form.messageOfTheDay || 'Sin mensaje.'}</p>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                    <PreviewStat icon={Users} label="Miembros" value="1 / 10" />
                    <PreviewStat icon={Shield} label="Nivel mínimo" value={form.minLevelRequired || 1} />
                    <PreviewStat icon={Swords} label="Poder mínimo" value={form.minPowerRequired || 0} />
                    <PreviewStat icon={Gem} label="Ingreso" value={ALLIANCE_JOIN_OPTIONS.find((option) => option.value === form.joinType)?.label || 'Solicitud'} />
                </div>
            </div>
        </aside>
    );
}

function PreviewStat({ icon: Icon, label, value }) {
    return (
        <div className="rounded border border-white/10 bg-black/30 p-3">
            {createElement(Icon, { size: 16, className: 'mb-2 text-amber-300' })}
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
            <p className="mt-1 text-sm font-black text-slate-100">{value}</p>
        </div>
    );
}

function InputField({ label, value, onChange, type = 'text', maxLength }) {
    return (
        <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</span>
            <input
                type={type}
                value={value}
                maxLength={maxLength}
                onChange={(event) => onChange(event.target.value)}
                className="w-full rounded border border-slate-700 bg-black/45 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-amber-500"
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

export default AllianceCreate;
