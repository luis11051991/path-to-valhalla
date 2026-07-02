import { createElement } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, LockKeyhole, Sparkles } from 'lucide-react';

function ComingSoonFeature({ title, description, icon }) {
    return (
        <div className="relative min-h-full overflow-hidden bg-[#07090d] text-slate-100">
            <img
                src="/backgrounds/throne_room.png"
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-[0.12] saturate-[0.7]"
                onError={(event) => {
                    event.currentTarget.style.display = 'none';
                }}
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,7,13,0.72),rgba(2,6,12,0.96))]" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/70 to-transparent" />

            <div className="relative z-10 flex min-h-full items-center justify-center p-4 md:p-8">
                <section className="w-full max-w-3xl overflow-hidden rounded-lg border border-amber-900/45 bg-black/50 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
                    <div className="border-b border-white/10 bg-[linear-gradient(135deg,rgba(120,53,15,0.24),rgba(15,23,42,0.42))] px-5 py-4">
                        <div className="flex items-center justify-between gap-3">
                            <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.28em] text-amber-300/80">
                                <Sparkles size={14} />
                                Ciudad de Valhallus
                            </div>
                            <span className="inline-flex items-center gap-1.5 rounded border border-purple-500/40 bg-purple-950/35 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-purple-100">
                                <LockKeyhole size={12} />
                                Próximamente
                            </span>
                        </div>
                    </div>

                    <div className="px-5 py-8 text-center md:px-8 md:py-10">
                        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-lg border border-amber-600/45 bg-[linear-gradient(145deg,rgba(120,53,15,0.28),rgba(2,6,23,0.88))] shadow-[0_0_38px_rgba(245,158,11,0.18)]">
                            {createElement(icon, { size: 48, className: 'text-amber-300 drop-shadow-[0_0_16px_rgba(245,158,11,0.38)]' })}
                        </div>

                        <h2 className="font-serif text-4xl font-bold text-amber-200 md:text-5xl">
                            {title}
                        </h2>
                        <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-300 md:text-base">
                            {description}
                        </p>

                        <div className="mx-auto mt-7 max-w-sm rounded-lg border border-amber-900/35 bg-black/30 px-4 py-3 text-xs font-bold uppercase tracking-widest text-slate-400">
                            Las puertas se abrirán en una próxima actualización.
                        </div>

                        <Link
                            to="/hero"
                            className="mt-7 inline-flex items-center gap-2 rounded border border-amber-600/55 bg-amber-700/20 px-4 py-2 text-xs font-bold uppercase tracking-widest text-amber-100 transition-colors hover:bg-amber-700/35"
                        >
                            <ArrowLeft size={15} />
                            Volver
                        </Link>
                    </div>
                </section>
            </div>
        </div>
    );
}

export default ComingSoonFeature;
