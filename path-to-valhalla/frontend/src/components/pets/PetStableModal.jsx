import React from 'react';
import { PawPrint, X, CheckCircle, Heart } from 'lucide-react';

const STAT_TRANSLATIONS = {
    strength: 'Fuerza',
    dexterity: 'Destreza',
    constitution: 'Constitución',
    intelligence: 'Inteligencia',
    charisma: 'Carisma',
    luck: 'Suerte',
};

function formatStatName(key) {
    return STAT_TRANSLATIONS[key] || key;
}

function getHungerPercent(current, max) {
    if (!max) return 0;
    return Math.round((current / max) * 100);
}

function getHungerColor(percent) {
    if (percent < 30) return 'text-red-400';
    if (percent < 60) return 'text-yellow-400';
    return 'text-green-400';
}

function getPetBonuses(pet) {
    return pet?.bonus_stats || {};
}

function getComparisonRows(equippedPet, activePet) {
    const equippedBonuses = getPetBonuses(equippedPet);
    const selectedBonuses = getPetBonuses(activePet);

    const allKeys = new Set([
        ...Object.keys(equippedBonuses),
        ...Object.keys(selectedBonuses),
    ]);

    return Array.from(allKeys).map(key => ({
        key,
        label: formatStatName(key),
        equippedValue: equippedBonuses[key] || 0,
        selectedValue: selectedBonuses[key] || 0,
        diff: (selectedBonuses[key] || 0) - (equippedBonuses[key] || 0),
    }));
}

function getPetBonusSummary(bonus_stats) {
    const entries = Object.entries(bonus_stats || {});
    return {
        shown: entries.slice(0, 2),
        extraCount: Math.max(0, entries.length - 2),
    };
}

function PetStableModal({
    isOpen,
    onClose,
    pets,
    activePet,
    setActivePet,
    equippedPet,
    onEquipPet,
    onFeedPet,
    getFeedCostText,
}) {
    if (!isOpen) return null;

    const hungerPercent = activePet ? getHungerPercent(activePet.current_hunger, activePet.max_hunger) : 0;
    const isSameAsEquipped = activePet && equippedPet && activePet.player_pet_id === equippedPet.player_pet_id;
    const comparisonRows = activePet ? getComparisonRows(equippedPet, activePet) : [];
    const isFull = activePet ? activePet.current_hunger >= activePet.max_hunger : false;
    const feedCostText = activePet ? getFeedCostText(activePet.tier) : '';
    const isFullFeedText = feedCostText.toLowerCase().includes('recupera');

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-2 sm:p-4 animate-in fade-in" onClick={onClose}>
            <div
                className="relative w-full max-w-6xl max-h-[90vh] lg:h-[75vh] bg-slate-950 border-2 border-amber-600 rounded-xl shadow-[0_0_50px_rgba(245,158,11,0.2)] overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                <button onClick={onClose} className="absolute top-3 right-3 z-50 p-1.5 bg-black/60 rounded-full hover:bg-red-600 transition-colors hidden lg:block"><X size={18} className="text-white" /></button>

                <div className="h-full overflow-y-auto lg:overflow-hidden">
                    <div className="flex flex-col lg:flex-row min-h-full">
                        <div className="sticky top-0 z-50 lg:hidden flex justify-end p-2 bg-slate-950/90 backdrop-blur-sm border-b border-slate-800">
                            <button onClick={onClose} className="p-1.5 bg-slate-800 hover:bg-red-600 rounded-full transition-colors"><X size={18} className="text-slate-300" /></button>
                        </div>
                    {/* LEFT COLUMN — Pet list */}
                    <div className="lg:w-[280px] lg:min-w-[280px] lg:border-r border-slate-800 bg-black/40 flex flex-col lg:overflow-y-auto">
                        <div className="p-4 border-b border-slate-800 shrink-0">
                            <h3 className="text-amber-500 font-serif font-bold uppercase tracking-widest flex items-center gap-2 text-sm">
                                <PawPrint size={18} /> Establo
                            </h3>
                            <p className="text-[10px] text-slate-500 mt-1">{pets.length} mascota{pets.length !== 1 ? 's' : ''}</p>
                        </div>
                        <div className="flex-1 p-3 space-y-2">
                            {pets.length === 0 ? (
                                <div className="text-center p-4 text-slate-500 text-xs">No tienes mascotas todavía.<br/>Consigue mascotas en expediciones, eventos o recompensas futuras.</div>
                            ) : (
                                pets.map(pet => {
                                    const petHungerPct = getHungerPercent(pet.current_hunger, pet.max_hunger);
                                    const bonusSum = getPetBonusSummary(pet.bonus_stats);
                                    return (
                                        <div
                                            key={pet.player_pet_id}
                                            onClick={() => setActivePet(pet)}
                                            className={`flex items-start gap-2.5 p-2.5 rounded cursor-pointer transition-colors border ${
                                                activePet?.player_pet_id === pet.player_pet_id
                                                    ? 'bg-amber-900/30 border-amber-500'
                                                    : 'bg-slate-900/60 border-slate-800 hover:bg-slate-800/80'
                                            }`}
                                        >
                                            <img src={pet.image_url} className="w-10 h-10 object-cover rounded bg-black shrink-0 mt-0.5" />
                                            <div className="min-w-0 flex-1 space-y-1">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-sm text-slate-200 font-bold truncate">{pet.name}</span>
                                                    {pet.is_active && <span className="shrink-0 text-[9px] bg-green-900 text-green-300 px-1 py-0.5 rounded font-bold leading-none">ACTIVA</span>}
                                                </div>
                                                <div className="text-[10px] text-slate-500">Tier {pet.tier}</div>
                                                {bonusSum.shown.length > 0 && (
                                                    <div className="text-[10px] text-slate-400">
                                                        {bonusSum.shown.map(([k, v], i) => (
                                                            <span key={k}>
                                                                {i > 0 && <span className="text-slate-600"> · </span>}
                                                                <span>{formatStatName(k)}</span> <span className="text-green-400">+{v}</span>
                                                            </span>
                                                        ))}
                                                        {bonusSum.extraCount > 0 && <span className="text-slate-500"> +{bonusSum.extraCount} más</span>}
                                                    </div>
                                                )}
                                                <div className="h-1.5 bg-black/50 rounded-full overflow-hidden border border-slate-700/50">
                                                    <div
                                                        className={`h-full ${
                                                            petHungerPct < 30 ? 'bg-red-600' : petHungerPct < 60 ? 'bg-yellow-600' : 'bg-green-600'
                                                        }`}
                                                        style={{ width: `${petHungerPct}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* CENTER COLUMN — Pet detail */}
                    <div className="flex-1 flex flex-col bg-slate-950 min-h-0">
                        {activePet ? (
                            <>
                                <div className="flex-1 relative bg-black overflow-hidden flex items-center justify-center min-h-[200px] max-h-[55vh]">
                                    <div className="absolute inset-0 bg-[url('/patterns/hex.png')] opacity-20"></div>
                                    <div className="absolute inset-0 bg-gradient-to-b from-slate-950/40 via-transparent to-transparent z-[5]"></div>
                                    <img src={activePet.image_url} className="h-full w-full object-contain p-4 animate-in zoom-in duration-500 z-10" />
                                    <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent z-20"></div>
                                    <div className="absolute bottom-4 left-0 right-0 text-center z-30 px-4">
                                        <h2 className="text-3xl font-serif text-amber-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{activePet.name}</h2>
                                        <p className="text-slate-300 text-xs max-w-md mx-auto italic drop-shadow-[0_2px_3px_rgba(0,0,0,0.8)] mt-1">"{activePet.description}"</p>
                                    </div>
                                </div>
                                <div className="bg-slate-900/80 border-t border-slate-800 p-3 space-y-2 shrink-0 min-h-[150px]">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] text-slate-500">Tier {activePet.tier}</span>
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                                            <span>Saciedad</span>
                                            <span className={getHungerColor(hungerPercent)}>{activePet.current_hunger}/{activePet.max_hunger}</span>
                                        </div>
                                        <div className="h-2 bg-black/60 rounded-full overflow-hidden border border-slate-700">
                                            <div
                                                className={`h-full transition-all duration-300 ${
                                                    hungerPercent < 30 ? 'bg-red-600' : hungerPercent < 60 ? 'bg-yellow-600' : 'bg-green-600'
                                                }`}
                                                style={{ width: `${hungerPercent}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                    {activePet.bonus_stats && Object.keys(activePet.bonus_stats).length > 0 && (
                                        <div>
                                            <h4 className="text-amber-500 text-[10px] uppercase tracking-widest font-bold mb-1">Bonificaciones</h4>
                                            <div className="flex flex-wrap gap-1">
                                                {Object.entries(activePet.bonus_stats).map(([key, val]) => (
                                                    <span key={key} className="bg-slate-800 px-2 py-0.5 rounded text-[11px] text-white border border-slate-700 flex items-center gap-1">
                                                        <span className="text-slate-400">{formatStatName(key)}</span>
                                                        <span className="font-bold text-green-400">+{val}</span>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    <div className="flex gap-2 pt-1">
                                        {activePet.is_active ? (
                                            <div className="flex-1 py-2 bg-slate-800 text-green-500 border border-green-900 rounded flex items-center justify-center gap-2 font-bold text-xs uppercase cursor-default">
                                                <CheckCircle size={14} /> Equipada
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => onEquipPet(activePet.player_pet_id)}
                                                className="w-full py-2 bg-amber-700 hover:bg-amber-600 text-white text-xs font-bold uppercase rounded border border-amber-500 shadow-lg hover:scale-[1.02] transition-all"
                                            >
                                                Equipar Ahora
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center justify-center h-full text-slate-500 text-sm">
                                <div className="text-center p-6">
                                    <PawPrint size={40} className="mx-auto mb-3 text-slate-700" />
                                    <p>Selecciona una mascota del establo</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* RIGHT COLUMN — Comparison / Feed */}
                    <div className="lg:w-[280px] lg:min-w-[280px] lg:border-l border-slate-800 bg-black/40 flex flex-col lg:overflow-y-auto">
                        <div className="p-4 border-b border-slate-800 shrink-0">
                            <h3 className="text-amber-500 font-serif font-bold uppercase tracking-widest text-sm">Comparación</h3>
                        </div>
                        <div className="flex-1 p-3 space-y-4">
                            {activePet ? (
                                <>
                                    {comparisonRows.length === 0 ? (
                                        <div className="bg-slate-900/60 rounded p-3 border border-slate-800 text-center">
                                            <p className="text-xs text-slate-400">Sin bonificaciones.</p>
                                        </div>
                                    ) : !equippedPet ? (
                                        <>
                                            <div className="bg-slate-900/60 rounded p-2.5 border border-slate-800 text-center">
                                                <p className="text-[11px] text-slate-400">No hay mascota equipada.</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1">Bonificaciones de {activePet.name}</p>
                                                {comparisonRows.map(row => (
                                                    <div key={row.key} className="flex items-center justify-between bg-slate-900/40 rounded px-2 py-1 border border-slate-800/50">
                                                        <span className="text-xs text-slate-300">{row.label}</span>
                                                        <span className="text-xs font-bold text-green-400">+{row.selectedValue}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    ) : isSameAsEquipped ? (
                                        <>
                                            <div className="bg-slate-900/60 rounded p-2.5 border border-slate-700 text-center">
                                                <CheckCircle size={16} className="text-green-500 mx-auto mb-1" />
                                                <p className="text-[11px] text-slate-300 font-bold">Ya equipada</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1">Bonificaciones activas</p>
                                                {comparisonRows.map(row => (
                                                    <div key={row.key} className="flex items-center justify-between bg-slate-900/40 rounded px-2 py-1 border border-slate-800/50">
                                                        <span className="text-xs text-slate-300">{row.label}</span>
                                                        <span className="text-xs font-bold text-green-400">+{row.selectedValue}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-2 bg-slate-900/60 rounded p-2 border border-slate-800">
                                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                                    <img src={equippedPet.image_url} className="w-6 h-6 object-cover rounded bg-black shrink-0" />
                                                    <span className="text-[10px] text-slate-400 truncate">{equippedPet.name}</span>
                                                </div>
                                                <span className="text-[10px] text-slate-600 font-bold shrink-0">VS</span>
                                                <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end">
                                                    <span className="text-[10px] text-amber-300 truncate">{activePet.name}</span>
                                                    <img src={activePet.image_url} className="w-6 h-6 object-cover rounded bg-black shrink-0" />
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1">Cambios si equipas esta mascota</p>
                                                {comparisonRows.map(row => (
                                                    <div key={row.key} className="flex items-center justify-between bg-slate-900/40 rounded px-2 py-1 border border-slate-800/50">
                                                        <span className="text-xs text-slate-300">{row.label}</span>
                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            <span className="text-[10px] text-slate-500 w-3 text-center">{row.equippedValue || '—'}</span>
                                                            <span className="text-[10px] text-slate-600">→</span>
                                                            <span className="text-[10px] text-slate-500 w-3 text-center">{row.selectedValue || '—'}</span>
                                                            <span className={`text-xs font-bold w-6 text-right ${
                                                                row.diff > 0 ? 'text-green-400' : row.diff < 0 ? 'text-red-400' : 'text-slate-500'
                                                            }`}>
                                                                {row.diff > 0 ? `+${row.diff}` : row.diff === 0 ? '0' : row.diff}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}

                                    <div className="bg-slate-900/60 rounded p-3 border border-slate-800">
                                        <h4 className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-2 flex items-center gap-1">
                                            <Heart size={12} className="text-red-500" /> Alimentación Manual
                                        </h4>
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-xs">
                                                <span className="text-slate-400">Saciedad</span>
                                                <span className={getHungerColor(hungerPercent)}>
                                                    {activePet.current_hunger} / {activePet.max_hunger}
                                                </span>
                                            </div>
                                            <div className="h-2 bg-black/60 rounded-full overflow-hidden border border-slate-700">
                                                <div
                                                    className={`h-full transition-all duration-300 ${
                                                        hungerPercent < 30 ? 'bg-red-600' : hungerPercent < 60 ? 'bg-yellow-600' : 'bg-green-600'
                                                    }`}
                                                    style={{ width: `${hungerPercent}%` }}
                                                ></div>
                                            </div>
                                            <div className="flex justify-between text-[10px]">
                                                <span className="text-slate-500">{hungerPercent}%</span>
                                                <span className="text-slate-500">Recupera +20</span>
                                            </div>
                                            {hungerPercent >= 100 ? (
                                                <p className="text-[11px] text-green-400/80 text-center">Tu mascota está satisfecha.</p>
                                            ) : hungerPercent <= 0 ? (
                                                <p className="text-[11px] text-red-400/80 text-center">Sin saciedad, no otorga bonificaciones.</p>
                                            ) : (
                                                <p className="text-[11px] text-slate-500 text-center">Mantén la saciedad alta para conservar sus bonificaciones.</p>
                                            )}
                                            {isFullFeedText ? (
                                                <>
                                                    <div className="text-[10px] text-slate-500 text-center">Costo de alimentación</div>
                                                    <div className="text-[11px] text-amber-400/80 bg-amber-900/10 rounded px-2 py-1.5 text-center font-bold">{feedCostText}</div>
                                                </>
                                            ) : (
                                                <div className="text-[11px] text-amber-400/80 bg-amber-900/10 rounded px-2 py-1.5 text-center font-bold">Costo: {feedCostText}</div>
                                            )}
                                            <button
                                                onClick={() => onFeedPet(activePet.player_pet_id)}
                                                disabled={isFull}
                                                className={`w-full py-2 text-xs font-bold uppercase rounded flex items-center justify-center gap-1.5 transition-all ${
                                                    isFull
                                                        ? 'bg-slate-800/50 text-slate-600 border border-slate-700/50 cursor-not-allowed'
                                                        : 'bg-amber-700 hover:bg-amber-600 text-white border border-amber-500 shadow-lg hover:scale-[1.02] active:scale-100'
                                                }`}
                                            >
                                                <Heart size={13} className={isFull ? 'text-slate-600' : 'text-red-500'} /> Alimentar
                                            </button>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center p-4 text-slate-500 text-xs">
                                    Selecciona una mascota para ver detalles.
                                </div>
                            )}
                        </div>
                    </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default PetStableModal;
