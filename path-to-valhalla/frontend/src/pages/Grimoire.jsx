import React, { useState, useEffect } from 'react';
import { Zap, Ban, ArrowUpCircle, Sword, Heart, Sparkles, Search, X, ArrowLeft } from 'lucide-react';
import { apiUrl } from '../constants/api';

const MAX_POSSIBLE_SLOTS = 5;
const UNLOCK_LEVELS = { 1: 1, 2: 1, 3: 10, 4: 50, 5: 100 };

const Grimoire = ({ user, onUpdateUser }) => {
    const [mySkills, setMySkills] = useState([]);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState(null);
    const [selectedSkill, setSelectedSkill] = useState(null);
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');

    const fetchSkills = () => {
        fetch(apiUrl('/api/my-skills'), { 
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } 
        })
        .then(res => res.json())
        .then(data => { 
            if (data.success) {
                setMySkills(data.skills);
            }
            setLoading(false);
        })
        .catch(err => {
            console.error(err);
            setLoading(false);
        });
    };

    useEffect(() => {
        fetchSkills();
    }, []);

    useEffect(() => {
        if (!selectedSkill) return;
        const fresh = mySkills.find(s => s.player_skill_id === selectedSkill.player_skill_id);
        if (!fresh) {
            setSelectedSkill(null);
            return;
        }
        if (fresh !== selectedSkill) {
            setSelectedSkill(fresh);
        }
    }, [mySkills, selectedSkill?.player_skill_id]);

    const getMaxSlots = () => {
        if (user.level >= 100) return 5;
        if (user.level >= 50) return 4;
        if (user.level >= 10) return 3;
        return 2;
    };

    const calculateUpgradeCost = (skill) => {
        const base = skill.base_price || 100;
        const lvl = skill.skill_level || 1;
        return Math.floor(base * Math.pow(1.3, lvl - 1));
    };

    const formatCurrency = (totalCopper) => {
        if (!totalCopper) return <span className="text-slate-500 font-bold">Gratis</span>;
        const gold = Math.floor(totalCopper / 10000);
        const remainderAfterGold = totalCopper % 10000;
        const silver = Math.floor(remainderAfterGold / 100);
        const copper = remainderAfterGold % 100;
        return (
            <span className="flex items-center gap-1">
                {gold > 0 && <span className="text-yellow-500 font-bold">{gold}g</span>}
                {silver > 0 && <span className="text-slate-300 font-bold">{silver}s</span>}
                {copper > 0 && <span className="text-orange-500 font-bold">{copper}c</span>}
            </span>
        );
    };

    const getSkillType = (skill) => {
        if (skill.damage_min > 0) return { label: 'Daño', icon: Sword, color: 'text-red-400', bg: 'bg-red-900/30 border-red-500/30' };
        if ((skill.heal_amount ?? 0) > 0) return { label: 'Curación', icon: Heart, color: 'text-green-400', bg: 'bg-green-900/30 border-green-500/30' };
        return { label: 'Utilidad', icon: Sparkles, color: 'text-blue-400', bg: 'bg-blue-900/30 border-blue-500/30' };
    };

    const computeDamage = (skill) => {
        return Math.floor(skill.damage_min * (1 + (skill.skill_level - 1) * 0.1));
    };

    const computeHeal = (skill) => {
        return Math.floor((skill.heal_amount ?? 0) * (1 + (skill.skill_level - 1) * 0.1));
    };

    const handleToggleEquip = async (skillId) => {
        try {
            const res = await fetch(apiUrl('/api/equip-skill'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({ skillId })
            });
            const data = await res.json();
            if (data.success) {
                fetchSkills();
                setErrorMsg(data.is_equipped
                    ? `Habilidad equipada en Slot ${data.slot_index}.`
                    : 'Habilidad desequipada.');
            } else {
                setErrorMsg(data.message);
            }
        } catch (error) {
            setErrorMsg("Error de conexión.");
        }
    };

    const handleUpgradeSkill = async (e, skill) => {
        e.stopPropagation();

        const maxLevel = skill.max_level || 10;
        if ((skill.skill_level || 1) >= maxLevel) return;

        const cost = calculateUpgradeCost(skill);
        const playerTotalCopper = (user.gold * 10000) + (user.silver * 100) + user.copper;

        if (playerTotalCopper < cost) {
            setErrorMsg(`Fondos insuficientes para mejorar ${skill.name}.`);
            return;
        }

        try {
            const res = await fetch(apiUrl('/api/skills/upgrade'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({ playerSkillId: skill.player_skill_id })
            });
            const data = await res.json();

            if (data.success) {
                onUpdateUser({ ...user, ...data.newFunds });
                fetchSkills();
                setErrorMsg(`${skill.name} subió a nivel ${data.newLevel || ((skill.skill_level || 1) + 1)}!`);
            } else {
                setErrorMsg(data.message);
            }
        } catch (error) {
            setErrorMsg("Error al mejorar habilidad.");
        }
    };

    const unlockedSlots = getMaxSlots();
    const equippedSkills = mySkills.filter(s => s.is_equipped).sort((a, b) => (a.slot_index || 0) - (b.slot_index || 0));
    const equippedBySlot = new Map();
    equippedSkills.forEach(skill => {
        if (skill.slot_index > 0) equippedBySlot.set(skill.slot_index, skill);
    });
    const slotsDisplay = [...Array(MAX_POSSIBLE_SLOTS)].map((_, i) => equippedBySlot.get(i + 1) || null);
    const hasFreeSlot = equippedSkills.length < unlockedSlots;

    const filteredSkills = mySkills.filter(skill => {
        if (filter === 'equipped' && !skill.is_equipped) return false;
        if (filter === 'upgradable') {
            const maxLevel = skill.max_level || 10;
            if ((skill.skill_level || 1) >= maxLevel) return false;
        }
        if (filter === 'maxed') {
            const maxLevel = skill.max_level || 10;
            if ((skill.skill_level || 1) < maxLevel) return false;
        }
        if (search) {
            const q = search.toLowerCase();
            const nameMatch = skill.name?.toLowerCase().includes(q);
            const descMatch = skill.description?.toLowerCase().includes(q);
            if (!nameMatch && !descMatch) return false;
        }
        return true;
    });

    const handleCardClick = (skill) => {
        setSelectedSkill(prev => prev?.player_skill_id === skill.player_skill_id ? null : skill);
    };

    const handleSlotClick = (idx) => {
        const skill = slotsDisplay[idx];
        if (skill) {
            setSelectedSkill(prev => prev?.player_skill_id === skill.player_skill_id ? null : skill);
            handleToggleEquip(skill.player_skill_id);
        }
    };

    const handleEquipFromCard = (e, skill) => {
        e.stopPropagation();
        handleToggleEquip(skill.player_skill_id);
    };

    const filters = [
        { key: 'all', label: 'Todos' },
        { key: 'equipped', label: 'Equipados' },
        { key: 'upgradable', label: 'Mejorables' },
        { key: 'maxed', label: 'Máximo' },
    ];

    return (
        <div className="h-full flex flex-col p-4 md:p-6 animate-in fade-in duration-500 overflow-y-auto custom-scrollbar">
            {/* BARRA DE BATALLA */}
            <div className="mb-6 p-4 md:p-6 bg-slate-900/80 border border-purple-500/30 rounded-xl shadow-[0_0_50px_rgba(168,85,247,0.1)]">
                <div className="flex justify-between items-start mb-2 border-b border-purple-500/20 pb-3">
                    <div>
                        <h3 className="text-base md:text-lg font-serif font-bold text-purple-300 uppercase tracking-widest flex items-center gap-2">
                            <img src="/icons/tabs/tab_grimoire.png" className="w-5 h-5 md:w-6 md:h-6" alt="" /> Barra de Batalla
                        </h3>
                        <p className="text-[10px] md:text-xs text-slate-400 mt-0.5">Los poderes equipados se activan automáticamente durante las expediciones.</p>
                    </div>
                    <span className="text-xs font-bold bg-purple-900/40 text-purple-200 px-3 py-1 rounded-full border border-purple-500/30 shrink-0 whitespace-nowrap" title={unlockedSlots < 5 ? `Siguiente ranura en Nv.${UNLOCK_LEVELS[unlockedSlots + 1]}` : "Todas las ranuras desbloqueadas"}>
                        Usadas: {equippedSkills.length} / Disp: {unlockedSlots}
                    </span>
                </div>

                <div className="flex gap-2 md:gap-4 justify-center flex-wrap">
                    {[...Array(MAX_POSSIBLE_SLOTS)].map((_, i) => {
                        const isUnlocked = i < unlockedSlots;
                        const skill = slotsDisplay[i];
                        const unlockLvl = UNLOCK_LEVELS[i + 1];

                        return (
                            <div key={i} className="flex flex-col items-center gap-1">
                                <div
                                    onClick={() => isUnlocked && skill && handleSlotClick(i)}
                                    className={`w-16 h-16 md:w-20 md:h-20 rounded-xl border-2 flex items-center justify-center relative transition-all overflow-hidden group shrink-0
                                    ${!isUnlocked
                                        ? 'border-slate-800 bg-slate-950 cursor-default'
                                        : skill
                                            ? 'border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.4)] cursor-pointer hover:scale-105 bg-purple-900/20'
                                            : 'border-dashed border-slate-600 bg-slate-900/30'}`}
                                    title={skill ? "Click para desequipar" : isUnlocked ? "Ranura vacía" : `Se desbloquea en nivel ${unlockLvl}`}
                                >
                                    {!isUnlocked ? (
                                        <>
                                            <img src="/icons/ui/slot_locked.png" className="w-full h-full object-cover opacity-60" alt="Bloqueado" />
                                            <span className="absolute bottom-1 text-[9px] text-white font-bold bg-black/60 px-1 rounded border border-white/10">
                                                Nv.{unlockLvl}
                                            </span>
                                        </>
                                    ) : skill ? (
                                        <>
                                            <img src={skill.image_url} className="w-full h-full object-cover" alt={skill.name} />
                                            <span className="absolute top-1 left-1 bg-black/80 text-[8px] text-white px-1 font-bold rounded border border-white/10 leading-tight">
                                                Nv.{skill.skill_level}
                                            </span>
                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                <Ban className="text-red-400" />
                                            </div>
                                        </>
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <div className="text-center">
                                                <div className="text-lg md:text-2xl text-slate-600 font-bold leading-none">—</div>
                                                <div className="text-[8px] md:text-[9px] text-slate-600 mt-0.5">Vacío</div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <span className="text-[10px] font-mono text-slate-500 font-bold">{i + 1}</span>
                            </div>
                        );
                    })}
                </div>
                {unlockedSlots < 5 && (
                    <p className="text-[10px] text-slate-500 text-center mt-1">Siguiente ranura desbloqueable en Nv.{UNLOCK_LEVELS[unlockedSlots + 1]}</p>
                )}
                {unlockedSlots >= 5 && (
                    <p className="text-[10px] text-amber-500/60 text-center mt-1">Todas las ranuras desbloqueadas.</p>
                )}
                <p className="text-[10px] text-slate-600 text-center mt-2">Uso manual y atajos 1-5 estarán disponibles en una fase futura.</p>
            </div>

            {/* FILTROS + BÚSQUEDA */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4 items-start sm:items-center justify-between">
                <div className="flex gap-1 flex-wrap">
                    {filters.map(f => (
                        <button
                            key={f.key}
                            onClick={() => { setFilter(f.key); setSelectedSkill(null); }}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all uppercase tracking-wider
                            ${filter === f.key
                                ? 'bg-purple-700 text-white shadow-md'
                                : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-purple-500/50'}`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
                <div className="relative w-full sm:w-56">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Buscar habilidad..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-8 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500/50 transition-colors"
                    />
                    {search && (
                        <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* CONTENIDO PRINCIPAL */}
            {loading ? (
                <div className="text-center text-slate-500 mt-10">Leyendo pergaminos antiguos...</div>
            ) : filteredSkills.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-500 border-2 border-dashed border-slate-800 rounded-xl">
                    <img src="/icons/tabs/tab_grimoire.png" className="w-16 h-16 opacity-30 mb-4 grayscale" alt="Empty" />
                    <p>{mySkills.length === 0 ? "No has aprendido ninguna habilidad aún." : "No hay habilidades con ese filtro."}</p>
                </div>
            ) : (
                <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0 lg:items-start">
                    {/* GRILLA DE HABILIDADES */}
                    <div className={`grid gap-4 ${selectedSkill ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3 lg:w-3/5' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 w-full'} content-start pb-20`}>
                        {filteredSkills.map((skill) => {
                            const maxLevel = skill.max_level || 10;
                            const isMax = (skill.skill_level || 1) >= maxLevel;
                            const upgradeCost = isMax ? null : calculateUpgradeCost(skill);
                            const isSelected = selectedSkill?.player_skill_id === skill.player_skill_id;
                            const typeInfo = getSkillType(skill);

                            return (
                                <div
                                    key={skill.player_skill_id}
                                    onClick={() => handleCardClick(skill)}
                                    className={`relative group bg-slate-900 border rounded-xl cursor-pointer flex flex-col h-[160px]
                                    ${isSelected
                                        ? 'border-purple-400/80 bg-purple-950/20 ring-1 ring-inset ring-purple-500/40'
                                        : skill.is_equipped
                                            ? 'border-purple-500/60 bg-purple-900/5'
                                            : 'border-slate-700/70 hover:border-purple-400/50'}`}
                                >
                                    {/* Cabecera Card */}
                                    <div className="flex p-3 gap-3 items-start">
                                        <div className={`w-12 h-12 rounded-lg bg-black border shrink-0 overflow-hidden relative shadow-inner ${skill.is_equipped ? 'border-purple-400' : 'border-slate-700'}`}>
                                            {skill.image_url ? (
                                                <img src={skill.image_url} alt={skill.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-purple-900"><Zap /></div>
                                            )}
                                            <div className="absolute bottom-0 right-0 bg-black/80 text-[10px] text-white px-1.5 font-bold border-tl border-slate-700 rounded-tl">
                                                Nv.{skill.skill_level}
                                            </div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start gap-1">
                                                <h3 className={`text-sm font-bold truncate ${skill.is_equipped ? 'text-purple-300' : 'text-slate-200 group-hover:text-white'}`}>
                                                    {skill.name}
                                                </h3>
                                                {skill.is_equipped && (
                                                    <div className="flex items-center gap-1 shrink-0 mt-0.5">
                                                        <Zap size={12} className="text-purple-400" />
                                                        <span className="text-[9px] font-mono text-purple-300">S{skill.slot_index || '?'}</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${typeInfo.bg} ${typeInfo.color} font-bold`}>
                                                    {typeInfo.label}
                                                </span>
                                                <span className="text-[10px] text-yellow-500/80">Auto: {(skill.trigger_chance || 15)}%</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Stats Mini */}
                                    <div className="px-3 pb-2 flex gap-3 text-[10px] font-mono">
                                        {skill.damage_min > 0 && (
                                            <span className="text-red-400">DMG {computeDamage(skill)}</span>
                                        )}
                                        {(skill.heal_amount ?? 0) > 0 && (
                                            <span className="text-green-400">CURA {computeHeal(skill)}</span>
                                        )}
                                        <span className="text-blue-400 ml-auto">MP {skill.energy_cost}</span>
                                    </div>

                                    {/* Acciones */}
                                    <div className="mt-auto bg-black/40 px-3 py-2.5 flex justify-between items-center border-t border-white/5 gap-2 rounded-b-xl">
                                        {skill.is_equipped ? (
                                            <button
                                                onClick={(e) => handleEquipFromCard(e, skill)}
                                                className="px-2.5 py-1 rounded text-[10px] font-bold uppercase transition-all flex items-center gap-1 bg-red-900/40 text-red-300 border border-red-500/30 hover:bg-red-900/60"
                                            >
                                                <Ban size={10} /> Desequipar
                                            </button>
                                        ) : hasFreeSlot ? (
                                            <button
                                                onClick={(e) => handleEquipFromCard(e, skill)}
                                                className="px-2.5 py-1 rounded text-[10px] font-bold uppercase transition-all flex items-center gap-1 bg-purple-900/40 text-purple-300 border border-purple-500/30 hover:bg-purple-900/60"
                                            >
                                                <Zap size={10} /> Equipar
                                            </button>
                                        ) : (
                                            <div className="px-2.5 py-1 bg-slate-800/50 text-slate-600 rounded text-[10px] font-bold uppercase border border-slate-700/50 cursor-default flex items-center gap-1">
                                                <Ban size={10} /> Sin ranura
                                            </div>
                                        )}

                                        {isMax ? (
                                            <div className="px-2.5 py-1 bg-slate-800 text-slate-500 rounded text-[10px] font-bold uppercase border border-slate-700 cursor-default">
                                                MAX
                                            </div>
                                        ) : (
                                            <button
                                                onClick={(e) => handleUpgradeSkill(e, skill)}
                                                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-amber-500 text-slate-300 hover:text-white rounded text-[10px] font-bold uppercase flex items-center gap-1.5 transition-all group/btn"
                                                title="Mejorar Habilidad"
                                            >
                                                <ArrowUpCircle size={10} className="text-green-500 group-hover/btn:animate-bounce" />
                                                {formatCurrency(upgradeCost)}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* PANEL DE DETALLE LATERAL */}
                    <div className="lg:w-2/5 shrink-0 self-start">
                        <aside className="sticky top-4 lg:h-[430px] bg-slate-900/90 border border-purple-500/30 rounded-xl shadow-[0_0_40px_rgba(168,85,247,0.1)] overflow-hidden">
                            {selectedSkill ? (
                                <div className="h-full overflow-y-auto custom-scrollbar">
                                    {/* Mobile close */}
                                    <div className="flex justify-between items-center p-4 border-b border-purple-500/20 lg:hidden">
                                        <h4 className="text-sm font-bold text-purple-300 uppercase tracking-wider">Detalle</h4>
                                        <button onClick={() => setSelectedSkill(null)} className="text-slate-400 hover:text-white">
                                            <X size={16} />
                                        </button>
                                    </div>

                                    {(() => {
                                        const skill = selectedSkill;
                                        const maxLevel = skill.max_level || 10;
                                        const isMax = (skill.skill_level || 1) >= maxLevel;
                                        const upgradeCost = isMax ? null : calculateUpgradeCost(skill);
                                        const typeInfo = getSkillType(skill);
                                        const TypeIcon = typeInfo.icon;

                                        return (
                                            <>
                                                {/* Hero */}
                                                <div className="p-4 md:p-6 flex gap-4 items-center">
                                                    <div className="w-16 h-16 md:w-20 md:h-20 rounded-xl bg-black border-2 border-purple-500 overflow-hidden shadow-[0_0_20px_rgba(168,85,247,0.3)] shrink-0">
                                                        {skill.image_url ? (
                                                            <img src={skill.image_url} alt={skill.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-purple-700"><Zap size={32} /></div>
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <h2 className="text-lg md:text-xl font-bold text-white truncate">{skill.name}</h2>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${typeInfo.bg} ${typeInfo.color} font-bold`}>
                                                                <TypeIcon size={12} /> {typeInfo.label}
                                                            </span>
                                                            <span className="text-xs text-yellow-500/80">Prob. activación automática: {(skill.trigger_chance || 15)}%</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-2">
                                                            <div className="bg-purple-900/40 text-purple-300 text-xs font-bold px-2 py-0.5 rounded border border-purple-500/30">
                                                                Nivel {skill.skill_level} / {maxLevel}
                                                            </div>
                                                            {skill.is_equipped && (
                                                                <div className="bg-green-900/40 text-green-300 text-xs font-bold px-2 py-0.5 rounded border border-green-500/30 flex items-center gap-1">
                                                                    <Zap size={10} /> Equipada{skill.slot_index > 0 ? ` en Slot ${skill.slot_index}` : ''}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Descripción */}
                                                <div className="px-4 md:px-6 pb-4">
                                                    <p className="text-sm text-slate-300 italic leading-relaxed">"{skill.description}"</p>
                                                </div>

                                                {/* Botones de acción */}
                                                <div className="px-4 md:px-6 pb-4 flex gap-2">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleToggleEquip(skill.player_skill_id); }}
                                                        className={`px-3 py-1.5 rounded text-xs font-bold uppercase transition-all flex items-center gap-1.5
                                                        ${skill.is_equipped
                                                            ? 'bg-red-900/40 text-red-300 border border-red-500/30 hover:bg-red-900/60'
                                                            : 'bg-purple-900/40 text-purple-300 border border-purple-500/30 hover:bg-purple-900/60'}`}
                                                    >
                                                        {skill.is_equipped ? <Ban size={12} /> : <Zap size={12} />}
                                                        {skill.is_equipped ? 'Desequipar' : 'Equipar'}
                                                    </button>
                                                </div>

                                                {/* Stats */}
                                                <div className="flex flex-wrap gap-px bg-slate-800/50 mx-4 md:mx-6 rounded-lg overflow-hidden border border-slate-700/50 mb-4">
                                                    {skill.damage_min > 0 && (
                                                        <div className="bg-slate-900/60 p-3 text-center flex-1 min-w-[80px]">
                                                            <div className="text-[10px] text-red-400 uppercase font-bold mb-1">Daño</div>
                                                            <div className="text-lg font-bold text-red-300">{computeDamage(skill)}</div>
                                                        </div>
                                                    )}
                                                    {(skill.heal_amount ?? 0) > 0 && (
                                                        <div className="bg-slate-900/60 p-3 text-center flex-1 min-w-[80px]">
                                                            <div className="text-[10px] text-green-400 uppercase font-bold mb-1">Curación</div>
                                                            <div className="text-lg font-bold text-green-300">{computeHeal(skill)}</div>
                                                        </div>
                                                    )}
                                                    <div className="bg-slate-900/60 p-3 text-center flex-1 min-w-[80px]">
                                                        <div className="text-[10px] text-blue-400 uppercase font-bold mb-1">Coste MP</div>
                                                        <div className="text-lg font-bold text-blue-300">{skill.energy_cost}</div>
                                                    </div>
                                                    <div className="bg-slate-900/60 p-3 text-center flex-1 min-w-[80px]">
                                                        <div className="text-[10px] text-yellow-500 uppercase font-bold mb-1">Prob. Auto.</div>
                                                        <div className="text-lg font-bold text-yellow-400">{skill.trigger_chance || 15}%</div>
                                                    </div>
                                                    {skill.cooldown_turns > 0 && (
                                                        <div className="bg-slate-900/60 p-3 text-center flex-1 min-w-[80px]">
                                                            <div className="text-[10px] text-purple-400 uppercase font-bold mb-1">Cooldown</div>
                                                            <div className="text-lg font-bold text-purple-300">{skill.cooldown_turns} turnos</div>
                                                        </div>
                                                    )}
                                                    {skill.scaling_stat && (
                                                        <div className="bg-slate-900/60 p-3 text-center flex-1 min-w-[80px]">
                                                            <div className="text-[10px] text-cyan-400 uppercase font-bold mb-1">Escala con</div>
                                                            <div className="text-lg font-bold text-cyan-300">{skill.scaling_stat}{skill.scaling_factor != null ? ` (x${skill.scaling_factor})` : ''}</div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Próximo nivel */}
                                                <div className="px-4 md:px-6 pb-6">
                                                    <div className="bg-slate-900/60 border border-slate-700/50 rounded-lg p-3 md:p-4">
                                                        <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                                            {isMax ? 'Nivel Máximo Alcanzado' : 'Siguiente Nivel'}
                                                        </h5>
                                                        {!isMax && (
                                                            <>
                                                                <div className="text-sm text-slate-300 mb-2">
                                                                    <span className="font-bold text-white">Nv. {skill.skill_level || 1}</span>
                                                                    <span className="text-slate-500 mx-2">→</span>
                                                                    <span className="font-bold text-amber-300">Nv. {(skill.skill_level || 1) + 1}</span>
                                                                </div>
                                                                {(skill.damage_min > 0 || (skill.heal_amount ?? 0) > 0) && (
                                                                    <div className="text-xs text-slate-400 mb-3 space-y-1">
                                                                        {skill.damage_min > 0 && (
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="text-red-400 font-mono">DMG</span>
                                                                                <span className="text-white">{computeDamage(skill)}</span>
                                                                                <span className="text-slate-600">→</span>
                                                                                <span className="text-red-300 font-bold">{computeDamage({ ...skill, skill_level: (skill.skill_level || 1) + 1 })}</span>
                                                                            </div>
                                                                        )}
                                                                        {(skill.heal_amount ?? 0) > 0 && (
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="text-green-400 font-mono">CURA</span>
                                                                                <span className="text-white">{computeHeal(skill)}</span>
                                                                                <span className="text-slate-600">→</span>
                                                                                <span className="text-green-300 font-bold">{computeHeal({ ...skill, skill_level: (skill.skill_level || 1) + 1 })}</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                                <div className="flex items-center justify-between pt-2 border-t border-slate-700/40">
                                                                    <div className="text-xs text-slate-400">
                                                                        <span className="text-slate-500">Costo:</span> {formatCurrency(upgradeCost)}
                                                                    </div>
                                                                    <button
                                                                        onClick={(e) => handleUpgradeSkill(e, skill)}
                                                                        className="px-3 py-1.5 bg-amber-700/60 hover:bg-amber-700/80 border border-amber-500/50 text-amber-200 rounded-lg text-xs font-bold uppercase flex items-center gap-1.5 transition-all"
                                                                    >
                                                                        <ArrowUpCircle size={12} /> Mejorar
                                                                    </button>
                                                                </div>
                                                            </>
                                                        )}
                                                        {isMax && (
                                                            <div className="text-sm text-slate-500 italic">Esta habilidad ha alcanzado su potencial máximo.</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                                    <Sparkles size={40} className="text-slate-600 mb-4" />
                                    <h4 className="text-sm font-bold text-slate-400 mb-1">Selecciona un poder</h4>
                                    <p className="text-xs text-slate-500 max-w-[200px]">Elige una habilidad del Grimorio para ver sus efectos, coste y evolución.</p>
                                </div>
                            )}
                        </aside>
                    </div>
                </div>
            )}

            {/* Mobile: back to list when detail is open */}
            {selectedSkill && (
                <div className="fixed bottom-4 left-4 z-40 lg:hidden">
                    <button
                        onClick={() => setSelectedSkill(null)}
                        className="bg-slate-800 border border-slate-600 text-slate-300 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-slate-700 transition-all shadow-lg"
                    >
                        <ArrowLeft size={14} /> Volver a lista
                    </button>
                </div>
            )}

            {errorMsg && (
                <div className="fixed bottom-4 right-4 bg-red-900/90 text-white px-6 py-3 rounded-lg shadow-xl border border-red-500 animate-in slide-in-from-right fade-in z-50 flex items-center gap-4">
                    <span>{errorMsg}</span>
                    <button onClick={() => setErrorMsg(null)} className="font-bold hover:text-red-200">X</button>
                </div>
            )}
        </div>
    );
};

export default Grimoire;
