import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
    Maximize2, ScrollText, Image as ImageIcon, AlertTriangle, Ban,
    PawPrint, Heart, Zap, CheckCircle, X, Lock, Clock, Plus, Gem
} from 'lucide-react';
import { RACES } from '../constants/races';
import { apiUrl } from '../constants/api';
import StatsPanel from '../components/StatsPanel';
import EvolutionModal from '../components/EvolutionModal';
import { getRequiredXp } from '../shared/level_xp';

const STAT_IMAGES = {
    strength: '/icons/stats/strength.png',
    dexterity: '/icons/stats/dexterity.png',
    constitution: '/icons/stats/constitution.png',
    intelligence: '/icons/stats/intelligence.png',
    wisdom: '/icons/stats/intelligence.png',
    charisma: '/icons/stats/charisma.png',
    luck: '/icons/stats/luck.png',
    defense: '/icons/stats/defense.png',
    block: '/icons/stats/block.png',
    crit: '/icons/stats/crit.png',
    damage: '/icons/stats/damage.png',
    health: '/icons/stats/health.png'
};

const HeroOverview = ({ user: propUser, onUpdateUser: propOnUpdateUser }) => {
    // Soporte dual: Funciona si se pasa por props (Router nuevo) o Context (Outlet)
    const contextData = useOutletContext();
    const user = propUser || (contextData ? contextData[0] : null);
    const onUpdateUser = propOnUpdateUser || (contextData ? contextData[1] : null);

    // --- ESTADOS (Copiados de Dashboard) ---
    const [showAvatarModal, setShowAvatarModal] = useState(false);
    const [showEvolutionModal, setShowEvolutionModal] = useState(false);
    const [showPetModal, setShowPetModal] = useState(false);

    const [backgroundsList, setBackgroundsList] = useState([]);
    const [currentBgUrl, setCurrentBgUrl] = useState(user?.active_background_url);
    const [pendingPurchase, setPendingPurchase] = useState(null);
    const [errorMsg, setErrorMsg] = useState(null);
    const [successMsg, setSuccessMsg] = useState(null); // Nuevo estado para mensajes de éxito

    const [myPets, setMyPets] = useState([]);
    const [activePet, setActivePet] = useState(null);

    const [activeBag, setActiveBag] = useState(1);
    const [tooltipData, setTooltipData] = useState(null);
    const [draggedItem, setDraggedItem] = useState(null);
    const [compatibleSlots, setCompatibleSlots] = useState([]);
    
    // --- ESTADO PARA MENÚ CONTEXTUAL ---
    const [contextMenu, setContextMenu] = useState(null);

    // --- LÓGICA DE EVOLUCIÓN ---
    const [evolutionStatus, setEvolutionStatus] = useState(() => {
        if (user?.evolution_quest_status === 'completed') return 'completed';
        if (user?.level >= 10) return 'available';
        return 'locked';
    });
    const [evolutionQuestData, setEvolutionQuestData] = useState(null);

    const raceData = RACES.find((race) => race.id === user?.race) || RACES[0];

    const fetchPets = useCallback(() => {
        fetch(apiUrl('/api/my-pets'), { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setMyPets(data.pets);
                    const equipped = data.pets.find(p => p.is_active);
                    if (equipped) setActivePet(equipped);
                    else if (data.pets.length > 0) setActivePet(data.pets[0]);
                }
            });
    }, []);

    const refreshUser = useCallback(async () => {
        try {
            const res = await fetch(apiUrl('/api/auth/profile'), {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            if (data.user) onUpdateUser(data.user);
        } catch (error) {
            console.error('Error refrescando perfil:', error);
        }
    }, [onUpdateUser]);

    // --- EFECTOS DE CARGA ---
    useEffect(() => {
        if (!user) return;
        if (user.level >= 10 && user.evolution_quest_status !== 'completed') {
            fetch(apiUrl(`/api/quests/status?context=evolution&t=${Date.now()}`), {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            })
                .then(r => r.json())
                .then(data => {
                    setEvolutionStatus(data.status);
                    if (data.quest) setEvolutionQuestData(data);
                })
                .catch(err => console.error('Error cargando estado evolución:', err));
        } else {
            const nextStatus = user.evolution_quest_status === 'completed' ? 'completed' : 'locked';
            const timer = setTimeout(() => {
                setEvolutionStatus(nextStatus);
            }, 0);
            return () => clearTimeout(timer);
        }
        
        // Refrescar inventario al cargar para asegurar consistencia
        void refreshUser();
    }, [refreshUser, user]);

    // Cerrar menú contextual al hacer click en cualquier lado
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    useEffect(() => {
        if (showAvatarModal && user?.id) {
            fetch(apiUrl(`/api/backgrounds?userId=${user.id}`))
                .then(res => res.json())
                .then(data => setBackgroundsList(data));
        }
    }, [showAvatarModal, user?.id]);

    useEffect(() => {
        void fetchPets();
    }, [fetchPets]);

    // --- ACCIONES DE ÍTEMS (USAR) ---
    const handleUseItem = async (item) => {
        try {
            const res = await fetch(apiUrl('/api/inventory/use'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({ inventoryItemId: item.id })
            });
            const data = await res.json();
            if (data.success) {
                setSuccessMsg(data.message);
                onUpdateUser({ ...user, ...data.user, real_inventory: data.inventory });
            } else {
                setErrorMsg(data.message);
            }
        } catch { setErrorMsg("Error de conexión al usar objeto."); }
        setContextMenu(null);
    };

    const handleContextMenu = (e, item) => {
        e.preventDefault();
        // Solo mostrar menú si es consumible, receta, pergamino o material
        if (['consumable', 'scroll', 'recipe', 'material'].includes(item.type)) {
            setContextMenu({ x: e.clientX, y: e.clientY, item });
        }
    };

    // --- ACCIONES (Mascotas, Fondo, Stats) ---
    const handleEquipPet = async (playerPetId) => {
        const res = await fetch(apiUrl('/api/equip-pet'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify({ playerPetId })
        });
        const data = await res.json();
        if (data.success) {
            fetchPets();
            const newlyEquipped = myPets.find(p => p.player_pet_id === playerPetId);
            if (newlyEquipped) setActivePet({ ...newlyEquipped, is_active: true });
            await refreshUser();
        }
    };

    const handleFeedPet = async (playerPetId) => {
        const res = await fetch(apiUrl('/api/feed-pet'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify({ playerPetId })
        });
        const data = await res.json();
        if (data.success) {
            fetchPets();
            if (data.newMoney) onUpdateUser({ ...user, ...data.newMoney });
        } else {
            setErrorMsg(data.message);
        }
    };

    const handleEquipBg = async (bgId) => {
        const res = await fetch(apiUrl('/api/equip-background'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, backgroundId: bgId })
        });
        const data = await res.json();
        if (data.success) {
            setCurrentBgUrl(data.newUrl);
            onUpdateUser({ ...user, active_background_url: data.newUrl, active_background_id: bgId });
        }
    };

    const handleBuyBgClick = (bgId, price) => {
        setPendingPurchase({ type: 'bg', id: bgId, price, name: 'Fondo Exclusivo' });
    };

    const handleRentBagClick = (bagNum) => {
        const isActive = isBagUnlocked(bagNum);
        const action = isActive ? "Extender" : "Alquilar";
        setPendingPurchase({ type: 'bag', id: bagNum, price: 50, name: `${action} Mochila ${bagNum} (7 dias)` });
    };

    const executePurchase = async () => {
        if (!pendingPurchase) return;
        let url = '', body = {};

        if (pendingPurchase.type === 'bg') {
            url = apiUrl('/api/buy-background');
            body = { userId: user.id, backgroundId: pendingPurchase.id };
        } else if (pendingPurchase.type === 'bag') {
            url = apiUrl('/api/rent-bag');
            body = { userId: user.id, bagNumber: pendingPurchase.id };
        }

        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        setPendingPurchase(null);

        if (data.success) {
            if (pendingPurchase.type === 'bg') {
                fetch(apiUrl(`/api/backgrounds?userId=${user.id}`)).then(r => r.json()).then(list => setBackgroundsList(list));
                onUpdateUser({ ...user, onix: user.onix - pendingPurchase.price });
            } else if (pendingPurchase.type === 'bag') {
                onUpdateUser(data.user);
            }
        } else {
            setErrorMsg(data.message);
        }
    };

    const handleSaveStats = async (newStats, pointsSpent) => {
        try {
            const response = await fetch(apiUrl('/api/train-stats'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id, newStats, pointsSpent })
            });
            const data = await response.json();
            if (data.success) onUpdateUser(data.user);
        } catch (e) {
            console.error(e);
        }
    };

    const handleOrganizeInventory = async () => {
        try {
            const response = await fetch(apiUrl('/api/inventory/organize'), {
                method: 'POST',
                // ¡AQUÍ ESTÁ LA CLAVE! Agregamos el Token de autorización
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}` 
                },
                body: JSON.stringify({ userId: user.id })
            });
            const data = await response.json();
            
            if (data.success) {
                // Actualizamos el inventario con lo que devuelve el servidor ordenado
                onUpdateUser({ ...user, real_inventory: data.inventory });
            } else {
                setErrorMsg(data.message || "Error al organizar.");
            }
        } catch (error) {
            console.error("Error al organizar inventario:", error);
            setErrorMsg("Error de conexión al organizar.");
        }
    };

    // --- HELPERS VISUALES Y LÓGICOS ---
    const getFeedCostText = (tier) => {
        if (tier === 1) return 'Recupera 20 Saciedad por 10 Cobre';
        if (tier === 2) return 'Recupera 20 Saciedad por 5 Plata';
        if (tier >= 3) return 'Recupera 20 Saciedad por 1 Oro';
        return 'Alimentar mascota';
    };

    const isBagUnlocked = (bagNumber) => {
        if (bagNumber <= 2) return true;
        if (bagNumber === 3) return user.level >= 20;
        if (bagNumber >= 4) return user.rented_bags?.some(b => b.bag_number === bagNumber);
        return false;
    };

    const getEquippedItem = (slotName) => user.real_inventory?.find(i => i.is_equipped && i.equipped_slot === slotName);
    
    const getBagItem = (slotIndex) => {
        const realIndex = ((activeBag - 1) * 40) + slotIndex;
        return user.real_inventory?.find(i => !i.is_equipped && i.bag_slot === realIndex);
    };

    const getAllowedSlotsForItem = (item) => {
        if (!item) return [];
        if (Array.isArray(item.allowed_slots)) return item.allowed_slots;
        if (Array.isArray(item.valid_slots)) return item.valid_slots;
        if (Array.isArray(item.slot_types)) return item.slot_types;
        if (item.slot_type) return [item.slot_type];
        if (item.slot) return [item.slot];
        if (item.equipped_slot) return [item.equipped_slot];

        const iconMap = {
            Sword: ['main_hand', 'off_hand'], Shield: ['off_hand'], Shirt: ['chest'], Crown: ['head'],
            Footprints: ['feet'], Hand: ['gloves'], Gem: ['ring_1', 'ring_2', 'neck'], Sparkles: ['earring_1', 'earring_2'], Scroll: ['neck', 'off_hand']
        };
        if (item.icon && iconMap[item.icon]) return iconMap[item.icon];
        return [];
    };

    // --- DRAG & DROP ---
    const resetDragState = () => {
        setDraggedItem(null);
        setCompatibleSlots([]);
        setTooltipData(null);
    };

    const handleDragStart = (e, item) => {
        setDraggedItem(item);
        setTooltipData(null);
        setCompatibleSlots(getAllowedSlotsForItem(item));
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };

    const handleDragEnd = () => {
        resetDragState();
    };

    const handleDrop = async (e, destination) => {
        e.preventDefault();
        if (!draggedItem) return;
        
        // Evitar mover al mismo sitio
        if (destination.type === 'bag' && destination.slot === draggedItem.bag_slot) return;
        if (destination.type === 'equipped' && destination.slot === draggedItem.equipped_slot) return;

        try {
            const response = await fetch(apiUrl('/api/inventory/move'), {
                method: 'POST',
                // ¡AQUÍ ESTABA EL ERROR! Faltaba el token
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}` // <--- ESTO ES VITAL
                },
                body: JSON.stringify({ userId: user.id, itemId: draggedItem.id, destination: destination })
            });
            const data = await response.json();
            
            if (data.success) {
                // Si el servidor devuelve el inventario actualizado, úsalo
                if (data.user && data.inventory) {
                     onUpdateUser({ ...user, ...data.user, real_inventory: data.inventory });
                } else {
                     // Si no, refresca todo el usuario por seguridad
                     await refreshUser();
                }
            } else {
                setErrorMsg(data.message || 'No puedes mover eso ahí.');
            }
        } catch (error) {
            console.error("Error al mover item:", error);
            setErrorMsg("Error de conexión al mover el objeto.");
        } finally {
            resetDragState();
        }
    };

    const handleMouseEnter = (item, e, side) => {
        if (!item) return;
        const rect = e.currentTarget.getBoundingClientRect();
        setTooltipData({ item, rect, side });
    };

    const handleMouseLeave = () => {
        setTooltipData(null);
    };

    const formatCurrency = (totalCopper) => {
        if (!totalCopper) return <span className="text-orange-700 font-bold">0c</span>;
        const gold = Math.floor(totalCopper / 10000);
        const remainderAfterGold = totalCopper % 10000;
        const silver = Math.floor(remainderAfterGold / 100);
        const copper = remainderAfterGold % 100;
        return (
            <span className="flex items-center gap-1 justify-end">
                {gold > 0 && <span className="text-yellow-500 font-bold">{gold}g</span>}
                {silver > 0 && <span className="text-slate-300 font-bold">{silver}s</span>}
                {copper > 0 && <span className="text-orange-700 font-bold">{copper}c</span>}
            </span>
        );
    };

    const getAvatarImage = () => {
        if (user.class_image) {
            const dbPath = user.class_image;
            const genderSuffix = user.gender === 'female' ? '_female' : '_male';
            const lastDotIndex = dbPath.lastIndexOf('.');
            if (lastDotIndex === -1) return dbPath + genderSuffix + ".png";
            return `${dbPath.substring(0, lastDotIndex)}${genderSuffix}${dbPath.substring(lastDotIndex)}`;
        }
        return raceData.images[user.gender || 'male'];
    };

    const getBackgroundImage = () => currentBgUrl || raceData.bgImage;
    const currentXp = user.experience || 0;
    const maxXp = getRequiredXp(user.level);
    const xpPercent = Math.min((currentXp / maxXp) * 100, 100);

    // --- CÁLCULOS DE STATS ---
    const itemBonuses = useMemo(() => {
        let bonuses = { strength: 0, dexterity: 0, constitution: 0, intelligence: 0, charisma: 0, luck: 0, armor: 0, damage_min: 0, damage_max: 0, defense: 0 };
        if (user.real_inventory) {
            user.real_inventory.forEach(item => {
                if (item.is_equipped && item.base_stats) {
                    Object.entries(item.base_stats).forEach(([key, val]) => {
                        let valueToAdd = Array.isArray(val) ? Math.floor((val[0] + val[1]) / 2) : val;
                        if (bonuses[key] !== undefined) bonuses[key] += valueToAdd;
                        else bonuses[key] = valueToAdd;
                    });
                }
            });
        }
        return bonuses;
    }, [user.real_inventory]);

    const petBonuses = useMemo(() => {
        const active = myPets.find(p => p.is_active);
        if (!active || active.current_hunger <= 0) return {};
        return active.bonus_stats || {};
    }, [myPets]);

    const totalBonuses = useMemo(() => {
        const combined = { ...itemBonuses };
        Object.entries(petBonuses).forEach(([key, val]) => {
            combined[key] = (combined[key] || 0) + val;
        });
        return combined;
    }, [itemBonuses, petBonuses]);

    const derivedStats = (() => {
        const baseStats = user?.stats || {};
        const totalStats = {
            strength: (baseStats.strength || 0) + (totalBonuses.strength || 0),
            dexterity: (baseStats.dexterity || 0) + (totalBonuses.dexterity || 0),
            constitution: (baseStats.constitution || 0) + (totalBonuses.constitution || 0),
            intelligence: (baseStats.intelligence || 0) + (totalBonuses.intelligence || 0),
            charisma: (baseStats.charisma || 0) + (totalBonuses.charisma || 0),
            luck: (baseStats.luck || 0) + (totalBonuses.luck || 0),
        };

        const strBonus = totalStats.strength * 2;
        const totalDamageMin = (totalBonuses.damage_min || 0) + strBonus;
        const totalDamageMax = (totalBonuses.damage_max || 0) + strBonus;
        const defense = (totalBonuses.armor || 0) + (totalBonuses.defense || 0) + Math.floor(totalStats.constitution / 2);

        let critChance = Math.min(totalStats.dexterity * 0.25, 25);
        let blockChance = Math.min(totalStats.luck * 0.25, 25);

        // --- AGREGAR CÁLCULOS DE INTELIGENCIA (CON TOPE 25%) ---
        const skillDamagePct = Math.min(totalStats.intelligence * 0.25, 25).toFixed(2); 
        const healingPct = Math.min(totalStats.intelligence * 0.5, 25).toFixed(2);

        return { totalDamageMin, totalDamageMax, defense, critChance, blockChance, skillDamagePct, healingPct };
    })();

    const displayMaxHp = user.calculatedMaxHp ?? user.calculated_max_hp ?? 0;
    const equippedPet = myPets.find(p => p.is_active);

    const getItemStyles = (rarity) => {
        switch (rarity) {
            case 'uncommon': return { text: 'text-green-400', border: 'border-green-800', glow: '' };
            case 'rare': return { text: 'text-blue-400', border: 'border-blue-800', glow: '' };
            case 'legendary': return { text: 'text-orange-400', border: 'border-orange-500', glow: 'shadow-[0_0_15px_rgba(251,146,60,0.4)]' };
            case 'mythic': return { text: 'text-red-500', border: 'border-red-600', glow: 'shadow-[0_0_20px_rgba(220,38,38,0.6)] animate-pulse' };
            default: return { text: 'text-slate-200', border: 'border-slate-600', glow: '' };
        }
    };

    // --- RENDERIZADO DE COMPONENTES UI ---
    const globalTooltip = tooltipData ? (() => {
        const { item, rect, side } = tooltipData;
        const stats = item.base_stats || {};
        const durability = item.durability_current !== undefined ? item.durability_current : 100;
        const maxDurability = item.durability_max || 100;
        const isBroken = durability === 0;
        const styles = getItemStyles(item.rarity);
        
        // --- LOGICA DE VISIBILIDAD DE DURABILIDAD (Modificada) ---
        // Ocultar si es consumible, material, pergamino, receta o legendario
        const hideDurability = ['consumable', 'material', 'scroll', 'recipe'].includes(item.type) || item.rarity === 'legendary';
        const showDurabilityBar = !hideDurability && (item.durability_current !== null);

        let style = { position: 'fixed', zIndex: 9999 };
        if (side === 'left') { style.right = (window.innerWidth - rect.left) + 10; style.top = rect.top; } 
        else if (side === 'top') { style.left = rect.left + (rect.width / 2) - 100; style.bottom = (window.innerHeight - rect.top) + 10; } 
        else if (side === 'right') { style.left = rect.right + 10; style.top = rect.top; } 
        else if (side === 'bottom') { style.left = rect.left + (rect.width / 2) - 100; style.top = rect.bottom + 10; }
        
        const renderValue = (val) => Array.isArray(val) ? `${val[0]}-${val[1]}` : val;

        return (
            <div style={style} className={`bg-slate-950 border-2 p-3 rounded shadow-[0_0_30px_rgba(0,0,0,0.9)] min-w-[200px] pointer-events-none animate-in fade-in zoom-in-95 duration-100 ${styles.border} ${styles.glow}`}>
                <p className={`font-bold text-sm ${styles.text}`}>{item.name}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2 border-b border-white/10 pb-1">{item.type} {item.rarity}</p>
                <div className="mb-2 text-[10px] font-bold text-center border-b border-white/5 pb-1"> {item.is_bound ? (<span className="text-red-500">VINCULADO (Soulbound)</span>) : (<span className="text-green-500">TRADEABLE</span>)} </div>
                <div className="space-y-1 mb-2">
                    {stats.heal_amount && <p className="text-xs text-green-400">❤️ Recupera {stats.heal_amount} HP</p>}
                    {stats.damage_min || stats.damage ? (
                        <p className={`text-xs flex items-center gap-2 ${isBroken ? 'text-slate-600 line-through' : 'text-slate-300'}`}>
                            <img src={STAT_IMAGES.damage} className="w-5 h-5" /> 
                            <span>Daño: <span className="text-white">{stats.damage_min ? `${stats.damage_min} - ${stats.damage_max}` : renderValue(stats.damage)}</span></span>
                        </p>
                    ) : null}
                    {stats.armor ? (
                        <p className={`text-xs flex items-center gap-2 ${isBroken ? 'text-slate-600 line-through' : 'text-slate-300'}`}>
                            <img src={STAT_IMAGES.defense} className="w-5 h-5" />
                            <span>Armadura: <span className="text-white">{renderValue(stats.armor)}</span></span>
                        </p>
                    ) : null}
                    {Object.entries(stats).map(([key, val]) => {
                        if (['damage_min', 'damage_max', 'damage', 'armor', 'heal_amount', 'learn_recipe_id', 'learn_skill_id'].includes(key)) return null;
                        if (!Array.isArray(val) && val <= 0) return null;
                        const iconPath = STAT_IMAGES[key] || '/icons/stats/luck.png'; 
                        return (
                            <p key={key} className="text-xs text-green-400 capitalize flex items-center gap-2">
                                <img src={iconPath} className="w-5 h-5" /> {key}: +{renderValue(val)}
                            </p>
                        );
                    })}
                </div>
                
                {/* Renderizado condicional de la barra */}
                {showDurabilityBar && (
                    <div className="mt-2 pt-1 border-t border-white/10">
                        <div className="flex justify-between text-[10px] mb-0.5"><span className={isBroken ? "text-red-500 font-bold" : "text-slate-400"}>{isBroken ? "ROTO" : "Durabilidad"}</span><span className={durability < 20 ? "text-red-400" : "text-slate-400"}>{durability}/{maxDurability}</span></div>
                        <div className="h-1 bg-slate-800 rounded-full overflow-hidden"><div className={`h-full ${durability < 20 ? 'bg-red-600' : 'bg-green-600'}`} style={{ width: `${(durability / maxDurability) * 100}%` }}></div></div>
                    </div>
                )}
                
                {/* Mensaje de Ayuda para Usar */}
                {hideDurability && !item.is_equipped && (
                    <div className="text-[10px] mt-2 text-right text-amber-400 italic border-t border-white/10 pt-1">Clic derecho para usar</div>
                )}
                
                <div className="text-[10px] mt-2 text-right border-t border-white/10 pt-1 flex justify-between items-center"> <span className="text-slate-500">Valor de venta:</span> {formatCurrency(item.price_copper)} </div>
            </div>
        );
    })() : null;

    const renderEquipmentSlot = (slotName, className = '', tooltipSide = 'top') => {
        const item = getEquippedItem(slotName);
        const slotImage = `/icons/slots/${slotName}.png`; 
        const showCompatibilityGuide = draggedItem && compatibleSlots.length > 0;
        const isSlotAllowed = !showCompatibilityGuide || compatibleSlots.includes(slotName);
        const dimClass = showCompatibilityGuide && !isSlotAllowed ? 'opacity-30 grayscale pointer-events-none' : '';
        const highlightClass = showCompatibilityGuide && isSlotAllowed ? 'ring-2 ring-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.7)]' : '';

        return (
            <div
                key={slotName}
                className={`w-16 h-16 bg-slate-900/80 border-2 rounded flex items-center justify-center relative group shadow-lg z-20 transition-all ${item ? 'border-amber-500 bg-slate-800 cursor-grab active:cursor-grabbing' : 'border-slate-600'} ${highlightClass} ${dimClass} ${className}`}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, { type: 'equipped', slot: slotName })}
                onMouseEnter={(e) => handleMouseEnter(item, e, tooltipSide)}
                onMouseLeave={handleMouseLeave}
                onContextMenu={(e) => item && handleContextMenu(e, item)}
                draggable={!!item}
                onDragStart={(e) => handleDragStart(e, item)}
                onDragEnd={handleDragEnd}
            >
                {item ? (
                    <img src={item.image_url} alt={item.name} className="w-full h-full object-contain p-1 drop-shadow-[0_0_5px_rgba(245,158,11,0.5)]" />
                ) : (
                    <img src={slotImage} alt={slotName} className="w-10 h-10 object-contain opacity-20" />
                )}
            </div>
        );
    };

    if (!user) return null;

    return (
        <div className="min-h-full relative font-sans p-4 flex flex-col gap-4">
            {globalTooltip}
            
            {/* MENÚ FLOTANTE CONTEXTUAL (Clic Derecho) */}
            {contextMenu && (
                <div 
                    className="fixed z-[10000] bg-slate-900 border border-amber-600 rounded shadow-2xl py-1 w-32 animate-in fade-in zoom-in-95 cursor-pointer" 
                    style={{ top: contextMenu.y, left: contextMenu.x }} 
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="px-3 py-1 text-xs font-bold text-amber-500 border-b border-slate-800 mb-1 truncate">{contextMenu.item.name}</div>
                    
                    {['consumable', 'scroll', 'recipe', 'material'].includes(contextMenu.item.type) && (
                        <button onClick={() => handleUseItem(contextMenu.item)} className="w-full text-left px-3 py-2 text-xs text-white hover:bg-amber-700 flex items-center gap-2 transition-colors">
                            <Zap size={12}/> Usar Objeto
                        </button>
                    )}
                    
                    <button onClick={() => setContextMenu(null)} className="w-full text-left px-3 py-2 text-xs text-slate-400 hover:bg-slate-800 transition-colors">Cancelar</button>
                </div>
            )}

            {/* AVISOS */}
            {successMsg && <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-green-900/90 border border-green-500 text-white px-6 py-3 rounded-lg shadow-xl z-[100] animate-bounce flex items-center gap-3"><CheckCircle size={20}/> {successMsg} <button onClick={()=>setSuccessMsg(null)} className="ml-4"><X size={16}/></button></div>}
            {errorMsg && <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-red-900/90 border border-red-500 text-white px-6 py-3 rounded-lg shadow-xl z-[100] animate-bounce flex items-center gap-3"><Ban size={20}/> {errorMsg} <button onClick={()=>setErrorMsg(null)} className="ml-4"><X size={16}/></button></div>}

            {/* ... RESTO DEL DISEÑO (Fondo, Columnas, etc) ... */}
            <div className="absolute inset-0 z-0 pointer-events-none"><img src={raceData.bgImage} className="w-full h-full object-cover opacity-60 fixed inset-0" /><div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/60 to-slate-900/30 fixed inset-0" /></div>

            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-4 items-start animate-in fade-in duration-300">
                {/* COL 1: PERFIL */}
                <div className="lg:col-span-3 space-y-4">
                    <div className="bg-black/50 backdrop-blur-md border border-amber-900/30 rounded-lg p-4 flex items-center gap-4 shadow-lg">
                        <div className="relative group cursor-zoom-in w-16 h-16 shrink-0" onClick={() => setShowAvatarModal(true)}>
                            <div className="w-full h-full rounded border-2 border-amber-600 bg-slate-900 overflow-hidden relative z-10">
                                <img src={getBackgroundImage()} className="absolute inset-0 w-full h-full object-cover opacity-80" />
                                <img src={getAvatarImage()} className="absolute inset-0 w-full h-full object-cover object-top z-10 drop-shadow-[0_0_18px_rgba(0,0,0,0.8)]" style={{ filter: 'contrast(1.28) saturate(1.2) brightness(0.9)' }} />
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity z-20 rounded">
                                <Maximize2 size={16} className="text-white" />
                            </div>
                        </div>
                        <div className="flex-1">
                            <h2 className="text-xl font-serif text-amber-500">{user.username}</h2>
                            <p className="text-slate-400 text-[10px] uppercase tracking-widest">{raceData.name} Lvl {user.level}</p>
                            <div className="w-full mt-2">
                                <div className="flex justify-between text-[9px] text-slate-400 mb-0.5"><span>EXP</span><span>{Math.floor(xpPercent)}%</span></div>
                                <div className="h-1.5 bg-slate-800 border border-slate-600 rounded-full overflow-hidden">
                                    <div className="h-full bg-yellow-500 shadow-[0_0_5px_rgba(234,179,8,0.8)]" style={{ width: `${xpPercent}%` }}></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Botones y Stats (Mismo código que subiste) */}
                    {evolutionStatus !== 'locked' && evolutionStatus !== 'completed' && (
                        <button onClick={() => setShowEvolutionModal(true)} className={`w-full mb-4 font-bold py-3 px-4 rounded border flex items-center justify-center gap-2 uppercase tracking-widest text-xs hover:scale-105 transition-transform shadow-lg ${evolutionStatus === 'in_progress' ? 'bg-slate-800 border-amber-500 text-amber-400 animate-pulse' : 'bg-gradient-to-r from-purple-700 via-pink-700 to-purple-700 bg-[length:200%_auto] animate-gradient text-white border-purple-400'}`}>
                            {evolutionStatus === 'in_progress' ? <><ScrollText size={16} /> Misión en Progreso</> : <><Zap size={16} className="animate-spin-slow" /> ¡Evolución Disponible!</>}
                        </button>
                    )}

                    <StatsPanel stats={user?.stats || {}} bonuses={totalBonuses} availablePoints={user.stat_points || 0} maxHp={displayMaxHp} onSave={handleSaveStats} />
                    
                    {/* Resumen Stats ESTANDARIZADO (Sin bordes, 7 stats) */}
                    <div className="mt-3 p-3 rounded-lg border border-amber-900/40 bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-black/70 shadow-[0_0_25px_rgba(0,0,0,0.35)] space-y-2">
                        
                        {/* 1. Vida */}
                        <div className="flex justify-between items-center pb-1">
                            <span className="text-slate-300 flex items-center gap-2 font-semibold tracking-wide"><img src={STAT_IMAGES.health} className="w-5 h-5 drop-shadow" /> Salud</span>
                            <span className="text-red-400 font-mono text-sm">{user.current_hp} / {displayMaxHp}</span>
                        </div>

                        {/* 2. Daño */}
                        <div className="flex justify-between items-center pb-1">
                            <span className="text-slate-300 flex items-center gap-2 font-semibold tracking-wide"><img src={STAT_IMAGES.damage} className="w-5 h-5 drop-shadow" /> Daño Físico</span>
                            <span className="text-amber-400 font-mono font-extrabold text-sm">{derivedStats.totalDamageMin} - {derivedStats.totalDamageMax}</span>
                        </div>

                        {/* 3. Defensa */}
                        <div className="flex justify-between items-center pb-1">
                            <span className="text-slate-300 flex items-center gap-2 font-semibold tracking-wide"><img src={STAT_IMAGES.defense} className="w-5 h-5 drop-shadow" /> Defensa</span>
                            <span className="text-white font-mono text-sm">{derivedStats.defense}</span>
                        </div>

                        {/* 4. Crítico (Agregado) */}
                        <div className="flex justify-between items-center pb-1">
                            <span className="text-slate-300 flex items-center gap-2 font-semibold tracking-wide"><img src={STAT_IMAGES.crit} className="w-5 h-5 drop-shadow" /> Crítico</span>
                            <span className="text-yellow-200 font-mono text-sm">{derivedStats.critChance.toFixed(1)}%</span>
                        </div>

                        {/* 5. Bloqueo (Agregado) */}
                        <div className="flex justify-between items-center pb-1">
                            <span className="text-slate-300 flex items-center gap-2 font-semibold tracking-wide"><img src={STAT_IMAGES.block} className="w-5 h-5 drop-shadow" /> Bloqueo</span>
                            <span className="text-blue-200 font-mono text-sm">{derivedStats.blockChance.toFixed(1)}%</span>
                        </div>

                        {/* 6. Cura */}
                        <div className="flex justify-between items-center pb-1">
                            <span className="text-slate-300 flex items-center gap-2 font-semibold tracking-wide"><img src={STAT_IMAGES.wisdom} className="w-5 h-5 drop-shadow" /> Poder Curación</span>
                            <span className="text-green-400 font-mono text-sm">+{derivedStats.healingPct}%</span>
                        </div>

                        {/* 7. Daño Skill */}
                        <div className="flex justify-between items-center">
                            <span className="text-slate-300 flex items-center gap-2 font-semibold tracking-wide"><img src={STAT_IMAGES.intelligence} className="w-5 h-5 drop-shadow" /> Daño Habilidad</span>
                            <span className="text-purple-400 font-mono text-sm">+{derivedStats.skillDamagePct}%</span>
                        </div>
                    </div>
                </div>

                {/* COL 2: PAPER DOLL */}
                <div className="lg:col-span-5">
                    <div className="bg-black/40 backdrop-blur-md border border-amber-900/30 rounded-lg p-4 h-[700px] relative shadow-2xl flex flex-col items-center">
                        <h3 className="text-amber-500 font-serif uppercase tracking-widest text-sm mb-4 border-b border-amber-500/20 w-full text-center pb-2">Equipamiento</h3>
                        <div className="relative w-full h-full max-w-[420px]">
                            <div className="absolute inset-x-0 top-12 bottom-12 flex items-center justify-center z-0 opacity-90 pointer-events-none select-none">
                                <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/50 pointer-events-none" />
                                <img src={getAvatarImage()} className="h-full w-auto object-contain drop-shadow-[0_0_25px_rgba(0,0,0,0.9)]" style={{ filter: 'contrast(1.28) saturate(1.2) brightness(0.9)' }} />
                            </div>
                            <div className="absolute top-0 left-1/2 -translate-x-1/2">{renderEquipmentSlot("head", "", "bottom")}</div>
                            <div className="absolute top-4 left-0">{renderEquipmentSlot("earring_1", "", "right")}</div>
                            <div className="absolute top-4 right-0">{renderEquipmentSlot("earring_2", "", "left")}</div>
                            <div className="absolute top-24 left-0">{renderEquipmentSlot("neck", "", "bottom")}</div>
                            <div className="absolute top-44 left-0">{renderEquipmentSlot("main_hand")}</div>
                            <div className="absolute bottom-36 left-0">{renderEquipmentSlot("ring_1")}</div>
                            <div className="absolute bottom-16 left-0">{renderEquipmentSlot("gloves")}</div>
                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2">{renderEquipmentSlot("feet")}</div>
                            <div className="absolute top-24 right-0">{renderEquipmentSlot("chest")}</div>
                            <div className="absolute top-44 right-0">{renderEquipmentSlot("off_hand")}</div>
                            <div className="absolute bottom-36 right-0">{renderEquipmentSlot("ring_2")}</div>
                            
                            {/* Pet Slot */}
                            <div className={`absolute bottom-8 right-8 w-16 h-16 rounded-full border-2 cursor-pointer transition-transform hover:scale-110 shadow-lg z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm ${equippedPet ? 'border-amber-400' : 'border-slate-600 border-dashed'}`} onClick={() => setShowPetModal(true)} title="Ver Mascotas">
                                {equippedPet ? <img src={equippedPet.image_url} className="w-full h-full object-cover rounded-full p-1" /> : <img src="/icons/slots/pet_slot.png" className="w-10 h-10 opacity-30" />}
                                {equippedPet && equippedPet.current_hunger < 20 && <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-ping" />}
                            </div>
                        </div>
                    </div>
                </div>

                {/* COL 3: MOCHILA */}
                <div className="lg:col-span-4">
                    <div className="bg-slate-900 border-2 border-amber-900/50 rounded-lg p-1 h-[700px] flex flex-col shadow-2xl relative">
                        <div className="flex gap-1 mb-1 px-1 overflow-x-auto">
                            {[1, 2, 3, 4, 5, 6].map((num) => (
                                <button key={num} onClick={() => setActiveBag(num)} className={`flex-1 py-1.5 text-[10px] font-bold uppercase border-t-2 transition-colors relative ${activeBag === num ? 'bg-amber-900/80 text-amber-100 border-amber-500' : 'bg-slate-800 text-slate-500 border-transparent hover:bg-slate-700'} ${!isBagUnlocked(num) ? 'opacity-70' : ''}`}>
                                    {!isBagUnlocked(num) && <Lock size={10} className="absolute top-0.5 right-0.5 text-red-400" />}
                                    {num >= 4 ? <span className="text-purple-400">VIP</span> : `BOLSA ${num}`}
                                </button>
                            ))}
                        </div>
                        <div className="flex-1 bg-black/60 border border-slate-700 rounded p-2 overflow-y-auto relative">
                            {!isBagUnlocked(activeBag) ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-black/80 z-20">
                                    <Lock size={48} className={activeBag >= 4 ? "text-purple-500 mb-4" : "text-slate-500 mb-4"} />
                                    <h3 className="text-white font-bold mb-2">Mochila Bloqueada</h3>
                                    {activeBag === 3 ? <p className="text-slate-400 text-xs">Nivel 20 requerido.</p> : <div><p className="text-slate-400 text-xs mb-4">Premium</p><button onClick={() => handleRentBagClick(activeBag)} className="px-4 py-2 bg-purple-700 hover:bg-purple-600 text-white text-xs font-bold rounded flex items-center justify-center gap-2 mx-auto"><Gem size={12} /> 50 ónix</button></div>}
                                </div>
                            ) : (
                                <div className="grid grid-cols-5 gap-1.5 h-full content-start">
                                    {[...Array(40)].map((_, i) => {
                                        const item = getBagItem(i);
                                        return (
                                            <div
                                                key={i}
                                                className={`aspect-square border rounded-sm flex items-center justify-center cursor-pointer shadow-inner relative group transition-colors ${item ? 'bg-slate-800 border-amber-600/50 cursor-grab active:cursor-grabbing' : 'bg-slate-800/50 border-slate-700 hover:border-amber-500/30'}`}
                                                onDragOver={handleDragOver}
                                                onDrop={(e) => handleDrop(e, { type: 'bag', slot: ((activeBag - 1) * 40) + i })}
                                                draggable={!!item}
                                                onDragStart={(e) => handleDragStart(e, item)}
                                                onDragEnd={handleDragEnd}
                                                onMouseEnter={(e) => handleMouseEnter(item, e, 'left')}
                                                onMouseLeave={handleMouseLeave}
                                                onContextMenu={(e) => item && handleContextMenu(e, item)}
                                            >
                                                {item ? (
                                                    item.image_url ? (
                                                        <>
                                                            <img src={item.image_url} alt={item.name} className="w-full h-full object-contain p-0.5 drop-shadow-md hover:scale-110 transition-transform" />
                                                            {item.quantity > 1 && <span className="absolute bottom-0 right-0 bg-black/90 text-[10px] text-white px-1.5 font-mono font-bold border-tl border-slate-700 rounded-tl z-10">{item.quantity}</span>}
                                                        </>
                                                    ) : <span className="text-[8px] text-slate-500">?</span>
                                                ) : null}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        <div className="mt-1 flex justify-between items-center px-2 py-1 text-[10px] text-slate-500 bg-slate-950 rounded-b">
                            <span>Libres: {40 - (user.real_inventory?.filter(i => !i.is_equipped && i.bag_slot >= (activeBag - 1) * 40 && i.bag_slot < activeBag * 40).length || 0)}</span>
                            <button onClick={handleOrganizeInventory} className="text-amber-500 hover:underline font-bold uppercase flex items-center gap-1">Organizar</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* MODALES EXTRA (Avatar, Pet, Background, Evolution) - Mismo código */}
            {showAvatarModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-[fadeIn_0.2s_ease-out]" onClick={() => setShowAvatarModal(false)}>
                    <div className="relative w-full max-w-4xl flex flex-col gap-4" onClick={e => e.stopPropagation()}>
                        <div className="relative w-full h-[60vh] bg-black/50 rounded-lg overflow-hidden border-2 border-amber-600 shadow-2xl flex items-center justify-center">
                            <img src={getBackgroundImage()} className="absolute inset-0 w-full h-full object-cover opacity-60 transition-opacity duration-500" />
                            <img src={getAvatarImage()} className="relative z-10 max-h-full w-auto object-contain drop-shadow-[0_0_30px_rgba(0,0,0,0.9)]" style={{ filter: 'contrast(1.28) saturate(1.2) brightness(0.9)' }} />
                            <button onClick={() => setShowAvatarModal(false)} className="absolute top-4 right-4 p-2 bg-black/60 text-slate-200 hover:text-white hover:bg-red-600/80 rounded-full z-50 border border-white/10 transition-colors"><X size={24} /></button>
                        </div>
                        <div className="w-full bg-slate-900/90 border-2 border-slate-700 rounded-lg p-4 backdrop-blur-sm">
                            <h3 className="text-amber-500 font-bold text-sm mb-3 uppercase tracking-wider flex items-center gap-2"><ImageIcon size={16} /> Colección de Fondos</h3>
                            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-amber-900 scrollbar-track-slate-800">
                                {backgroundsList.map(bg => (
                                    <div key={bg.id} className="relative group shrink-0 w-32 cursor-pointer" onClick={() => bg.owned && handleEquipBg(bg.id)}>
                                        <div className={`h-20 rounded-md overflow-hidden border-2 transition-all relative ${currentBgUrl === bg.image_url ? 'border-amber-500 shadow-[0_0_10px_#f59e0b]' : 'border-slate-600 opacity-70 group-hover:opacity-100 group-hover:border-slate-400'}`}>
                                            <img src={bg.image_url} className="w-full h-full object-cover" />
                                            {!bg.owned && <div className="absolute inset-0 bg-black/70 flex items-center justify-center"><Lock size={20} className="text-slate-400" /></div>}
                                        </div>
                                        <div className="mt-1 text-center">
                                            {bg.owned ? (
                                                <span className={`text-[10px] font-bold ${currentBgUrl === bg.image_url ? 'text-green-400' : 'text-slate-400'}`}>{currentBgUrl === bg.image_url ? 'Equipado' : 'Equipar'}</span>
                                            ) : (
                                                <button onClick={(e) => { e.stopPropagation(); handleBuyBgClick(bg.id, bg.price_onyx); }} className="w-full text-[10px] bg-purple-700 hover:bg-purple-600 text-white rounded px-1 py-0.5 flex items-center justify-center gap-1"><Gem size={8} /> {bg.price_onyx}</button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {pendingPurchase && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-slate-900 border-2 border-amber-600 rounded-lg p-6 max-w-sm w-full shadow-[0_0_50px_rgba(245,158,11,0.2)] transform scale-100 flex flex-col items-center">
                        <AlertTriangle className="text-amber-500 mb-4 h-10 w-10" />
                        <h3 className="text-xl font-serif font-bold text-amber-500 mb-2 text-center uppercase tracking-widest">Confirmar Compra</h3>
                        <p className="text-slate-300 text-center text-sm mb-6 leading-relaxed">¿Deseas confirmar la transacción por <br /><span className="font-bold text-purple-400 text-lg">{pendingPurchase.price} ónix</span>?<br /><span className="text-xs text-slate-500 mt-2 block">{pendingPurchase.name}</span></p>
                        <div className="flex justify-center gap-4 w-full">
                            <button onClick={() => setPendingPurchase(null)} className="flex-1 py-2 rounded bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors text-sm font-bold uppercase">Cancelar</button>
                            <button onClick={executePurchase} className="flex-1 py-2 rounded bg-gradient-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white shadow-lg transition-all text-sm font-bold uppercase">Confirmar</button>
                        </div>
                    </div>
                </div>
            )}

            {showEvolutionModal && (
                <EvolutionModal user={user} status={evolutionStatus} activeQuestData={evolutionQuestData} onClose={() => setShowEvolutionModal(false)} onEvolveSuccess={(updatedUser) => { onUpdateUser(updatedUser); setShowEvolutionModal(false); setEvolutionStatus('completed'); }} />
            )}

            {showPetModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in" onClick={() => setShowPetModal(false)}>
                    <div className="relative w-full max-w-4xl h-[70vh] bg-slate-950 border-2 border-amber-600 rounded-xl flex overflow-hidden shadow-[0_0_50px_rgba(245,158,11,0.2)]" onClick={e => e.stopPropagation()}>
                        <div className="w-1/3 border-r border-slate-800 bg-black/40 flex flex-col">
                            <h3 className="p-4 text-amber-500 font-serif font-bold uppercase tracking-widest border-b border-slate-800 flex items-center gap-2"><PawPrint size={18} /> Establo</h3>
                            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                                {myPets.length === 0 ? <div className="text-center p-4 text-slate-500 text-xs">No tienes mascotas aún.</div> : myPets.map(pet => (
                                    <div key={pet.player_pet_id} onClick={() => setActivePet(pet)} className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors border ${activePet?.player_pet_id === pet.player_pet_id ? 'bg-amber-900/30 border-amber-500' : 'bg-slate-900 border-slate-800 hover:bg-slate-800'}`}>
                                        <img src={pet.image_url} className="w-10 h-10 object-cover rounded bg-black" />
                                        <div><div className="text-sm text-slate-200 font-bold">{pet.name}</div><div className="text-[10px] text-slate-500">Nivel {pet.tier}</div></div>
                                        {pet.is_active && <span className="ml-auto text-[10px] bg-green-900 text-green-300 px-1 rounded">ACTIVA</span>}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="w-2/3 relative flex flex-col bg-slate-950">
                            <button onClick={() => setShowPetModal(false)} className="absolute top-4 right-4 text-white z-50 p-2 bg-black/50 rounded-full hover:bg-red-600"><X /></button>
                            {activePet ? (
                                <>
                                    <div className="flex-1 relative w-full bg-black overflow-hidden flex items-center justify-center">
                                        <div className="absolute inset-0 bg-[url('/patterns/hex.svg')] opacity-20"></div>
                                        <img src={activePet.image_url} className="h-full w-full object-contain p-0 animate-in zoom-in duration-500 z-10" />
                                        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-slate-950 to-transparent z-20"></div>
                                        <div className="absolute bottom-4 left-0 right-0 text-center z-30">
                                            <h2 className="text-4xl font-serif text-amber-400 drop-shadow-md mb-1">{activePet.name}</h2>
                                            <p className="text-slate-300 text-sm max-w-lg mx-auto italic drop-shadow-md">"{activePet.description}"</p>
                                        </div>
                                    </div>
                                    <div className="h-48 bg-slate-900 border-t-4 border-amber-900 p-4 flex gap-4 shadow-[0_-10px_20px_rgba(0,0,0,0.5)] z-40">
                                        <div className="w-1/2 space-y-2">
                                            <h4 className="text-amber-500 text-xs uppercase tracking-widest font-bold border-b border-slate-700 pb-1 mb-2">Bonificaciones Activas</h4>
                                            <div className="grid grid-cols-2 gap-2">
                                                {Object.entries(activePet.bonus_stats || {}).map(([key, val]) => (
                                                    <div key={key} className="bg-slate-800 px-2 py-1.5 rounded text-xs text-white border border-slate-600 capitalize flex justify-between"><span className="text-slate-400">{key}</span> <span className="font-bold text-green-400">+{val}</span></div>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="w-1/2 flex flex-col justify-between">
                                            <div>
                                                <div className="flex justify-between text-xs text-slate-300 mb-1 font-bold"><span>Nivel de Saciedad</span><span className={activePet.current_hunger < 30 ? 'text-red-500' : 'text-green-500'}>{activePet.current_hunger}%</span></div>
                                                <div className="h-3 bg-black rounded-full overflow-hidden border border-slate-700"><div className={`h-full ${activePet.current_hunger < 30 ? 'bg-red-600' : 'bg-green-600'}`} style={{ width: `${activePet.current_hunger}%` }}></div></div>
                                            </div>
                                            <div className="flex gap-2 mt-2">
                                                {activePet.is_active ? <div className="flex-1 py-3 bg-slate-800 text-green-500 border border-green-900 rounded flex items-center justify-center gap-2 font-bold text-xs uppercase cursor-default"><CheckCircle size={16} /> Equipada</div> : <button onClick={() => handleEquipPet(activePet.player_pet_id)} className="flex-1 py-3 bg-amber-700 hover:bg-amber-600 text-white text-xs font-bold uppercase rounded border border-amber-500 shadow-lg hover:scale-105 transition-all">Equipar Ahora</button>}
                                                <button onClick={() => handleFeedPet(activePet.player_pet_id)} className="w-1/3 py-3 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold uppercase rounded border border-slate-600 transition-colors flex flex-col items-center justify-center gap-1" title={getFeedCostText(activePet.tier)}><Heart size={14} className="text-red-500" /> Comer</button>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : <div className="flex items-center justify-center h-full text-slate-500">Selecciona una mascota del establo</div>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HeroOverview;
