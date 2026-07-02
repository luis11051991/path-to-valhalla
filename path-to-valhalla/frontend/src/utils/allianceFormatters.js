const formatValue = (value) => new Intl.NumberFormat('es-ES').format(Number(value || 0));

const effectLabels = {
    treasuryCapacityBonusPercent: (value) => `+${formatValue(value)}% capacidad del tesoro`,
    statsPercent: (value) => `+${formatValue(value)}% atributos para todos los miembros`,
    maxMembers: (value) => `Capacidad maxima: ${formatValue(value)} miembros`,
    expPercent: (value) => `+${formatValue(value)}% experiencia ganada`,
    workshopDiscountPercent: (value) => `-${formatValue(value)}% costos del Taller`,
    hiddenFindPercent: (value) => `+${formatValue(value)}% probabilidad de encontrar enemigos ocultos`,
    dungeonsUnlocked: (value) => `Mazmorras desbloqueadas: ${Array.isArray(value) ? value.join(', ') : value}`,
    judgementEnabled: () => 'Votaciones de expulsion desbloqueadas',
    durationMinutes: (value) => `Duracion del juicio: ${formatValue(value)} minutos`,
    maxActiveJudgements: (value) => `Juicios activos permitidos: ${formatValue(value)}`
};

const humanizeEffectKey = (key) => String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\bpercent\b/gi, '%')
    .replace(/\bbonus\b/gi, 'bono')
    .trim()
    .toLocaleLowerCase('es-ES');

export function formatBuildingEffect(effect) {
    return Object.entries(effect || {})
        .filter(([key]) => key !== 'level')
        .map(([key, value]) => {
            const formatter = effectLabels[key];
            if (formatter) return formatter(value);
            return `${humanizeEffectKey(key)}: ${formatValue(value)}`;
        });
}

export function formatUnlockRequirement(code, level) {
    const names = {
        valhallus_sanctuary: 'Santuario de Valhallus',
        training_field: 'Campo de Entrenamiento',
        great_hall: 'Gran Salon',
        alliance_bank: 'Banco de la Alianza',
        workshop: 'Taller de la Alianza',
        scouts_lodge: 'Puesto de Exploradores'
    };

    return `Requiere ${names[code] || humanizeEffectKey(code)} nivel ${formatValue(level)}`;
}
