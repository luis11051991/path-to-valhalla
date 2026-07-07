import React, { useEffect, useMemo, useState } from 'react';
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
    const [showPowerDetail, setShowPowerDetail] = useState(false);
    const [showCombatStats, setShowCombatStats] = useState(false);
    const [showActiveBonuses, setShowActiveBonuses] = useState(false);
    const [showQuickSuggestions, setShowQuickSuggestions] = useState(false);

    const [selectedItem, setSelectedItem] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [filterRarity, setFilterRarity] = useState('all');
    const [equipping, setEquipping] = useState(false);
    const [showSlotChoice, setShowSlotChoice] = useState(null); // { item, slots: [a, b] }

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

    const raceData = useMemo(
        () => RACES.find((race) => race.id === user?.race) || RACES[0],
        [user?.race]
    );

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
        } else if (user.evolution_quest_status === 'completed') {
            setEvolutionStatus('completed');
        } else {
            setEvolutionStatus('locked');
        }
        
        // Refrescar inventario al cargar para asegurar consistencia
        refreshUser();
    }, [user?.level, user?.evolution_quest_status]);

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
        fetchPets();
    }, []);

    const fetchPets = () => {
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
    };

    const refreshUser = async () => {
        try {
            const res = await fetch(apiUrl('/api/auth/profile'), {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            if (data.user) onUpdateUser(data.user);
        } catch (error) {
            console.error('Error refrescando perfil:', error);
        }
    };

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
        } catch (err) { setErrorMsg("Error de conexión al usar objeto."); }
        setContextMenu(null);
    };

    const handleEquipSelected = async (item, targetSlot) => {
        if (!item || !targetSlot) return;
        setEquipping(true);
        try {
            const res = await fetch(apiUrl('/api/inventory/move'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({ userId: user.id, itemId: item.id, destination: { type: 'equipped', slot: targetSlot } })
            });
            const data = await res.json();
            if (data.success) {
                if (data.user && data.inventory) {
                    onUpdateUser({ ...user, ...data.user, real_inventory: data.inventory });
                } else {
                    await refreshUser();
                }
                setSelectedItem(null);
                setSuccessMsg('Objeto equipado.');
            } else {
                setErrorMsg(data.message || 'No se pudo equipar el objeto.');
            }
        } catch {
            setErrorMsg('Error de conexión al equipar.');
        } finally {
            setEquipping(false);
            setShowSlotChoice(null);
        }
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

    const getBagTimeRemaining = (bagNumber) => {
        const bag = user.rented_bags?.find(b => b.bag_number === bagNumber);
        if (!bag) return null;
        const now = new Date();
        const expires = new Date(bag.expires_at);
        const diffMs = expires - now;
        if (diffMs <= 0) return "Expirado";
        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        if (days > 0) return `${days}d ${hours}h`;
        return `${hours}h restantes`;
    };

    const getEquippedItem = (slotName) => user.real_inventory?.find(i => i.is_equipped && i.equipped_slot === slotName);
    
    const getBagItem = (slotIndex) => {
        const realIndex = ((activeBag - 1) * 40) + slotIndex;
        return user.real_inventory?.find(i => !i.is_equipped && i.bag_slot === realIndex);
    };

    const matchesTypeFilter = (item, filter) => {
        const s = item.slot || '';
        const t = item.type || '';
        switch (filter) {
            case 'weapon': return s === 'weapon' || t === 'weapon';
            case 'armor': return ['helmet', 'armor', 'boots', 'gloves', 'belt', 'cloak', 'pants', 'bracers'].includes(s);
            case 'accessory': return ['ring', 'earring', 'amulet', 'neck', 'offhand'].includes(s) || t === 'accessory';
            case 'consumable': return ['consumable', 'scroll', 'recipe'].includes(t);
            case 'material': return t === 'material';
            default: return true;
        }
    };

    const filteredInventory = useMemo(() => {
        if (!user.real_inventory) return [];
        let items = user.real_inventory.filter(i => !i.is_equipped);
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            items = items.filter(i => i.name.toLowerCase().includes(q) || (i.description || '').toLowerCase().includes(q));
        }
        if (filterType !== 'all') items = items.filter(i => matchesTypeFilter(i, filterType));
        if (filterRarity !== 'all') items = items.filter(i => i.rarity === filterRarity);
        return items;
    }, [user.real_inventory, searchQuery, filterType, filterRarity]);

    const hasActiveFilters = searchQuery.trim() || filterType !== 'all' || filterRarity !== 'all';

    const isEquippable = (item) => {
        if (!item) return false;
        return ['weapon', 'armor', 'accessory'].includes(item.type);
    };

    const itemSlotToEquippedSlots = (itemSlot) => {
        const map = {
            weapon: ['main_hand'],
            offhand: ['off_hand'],
            off_hand: ['off_hand'],
            helmet: ['head'],
            head: ['head'],
            armor: ['chest'],
            chest: ['chest'],
            gloves: ['gloves'],
            boots: ['feet'],
            feet: ['feet'],
            amulet: ['neck'],
            neck: ['neck'],
            ring: ['ring_1', 'ring_2'],
            ring_1: ['ring_1'],
            ring_2: ['ring_2'],
            earring: ['earring_1', 'earring_2'],
            earring_1: ['earring_1'],
            earring_2: ['earring_2'],
            main_hand: ['main_hand'],
        };
        return map[itemSlot] || null;
    };

    const resolveSlot = (item) => {
        // 1. Usar item.slot directamente si existe y está en el mapa
        if (item.slot) {
            const mapped = itemSlotToEquippedSlots(item.slot);
            if (mapped) return mapped;
        }
        // 2. Fallback por type
        if (item.type === 'weapon') return ['main_hand'];
        if (item.type === 'armor') {
            const slots = item.allowed_slots || item.slot_types || [];
            if (slots.includes('head') || slots.includes('helmet')) return ['head'];
            if (slots.includes('chest') || slots.includes('armor')) return ['chest'];
            if (slots.includes('gloves')) return ['gloves'];
            if (slots.includes('feet') || slots.includes('boots')) return ['feet'];
            return ['chest'];
        }
        if (item.type === 'accessory') {
            const slots = item.allowed_slots || item.slot_types || [];
            if (slots.includes('ring') || slots.includes('ring_1') || slots.includes('ring_2')) return ['ring_1', 'ring_2'];
            if (slots.includes('earring') || slots.includes('earring_1') || slots.includes('earring_2')) return ['earring_1', 'earring_2'];
            if (slots.includes('neck') || slots.includes('amulet')) return ['neck'];
            if (slots.includes('off_hand') || slots.includes('offhand')) return ['off_hand'];
            return ['neck'];
        }
        if (item.base_stats?.damage_min != null || item.base_stats?.damage != null) return ['main_hand'];
        if (item.base_stats?.armor != null) return ['chest'];
        return null;
    };

    const findEquippedForComparison = (selected) => {
        if (!selected) return { equipped: null, slotName: null, secondary: null };
        const candidateSlots = resolveSlot(selected);
        if (!candidateSlots) return { equipped: null, slotName: null, secondary: null };

        // Para slots con dos posiciones (ring, earring), buscar la mejor coincidencia
        if (candidateSlots.length > 1) {
            const eq1 = getEquippedItem(candidateSlots[0]);
            const eq2 = getEquippedItem(candidateSlots[1]);
            if (!eq1 && !eq2) return { equipped: null, slotName: candidateSlots[0], secondary: null };
            if (eq1 && !eq2) return { equipped: eq1, slotName: candidateSlots[0], secondary: null };
            if (!eq1 && eq2) return { equipped: eq2, slotName: candidateSlots[1], secondary: null };
            // Ambos ocupados: mostrar el primero y marcar secundario
            return { equipped: eq1, slotName: candidateSlots[0], secondary: { equipped: eq2, slotName: candidateSlots[1] } };
        }

        const eq = getEquippedItem(candidateSlots[0]);
        return { equipped: eq, slotName: candidateSlots[0], secondary: null };
    };

    const SLOT_LABELS = {
        main_hand: 'Mano principal', off_hand: 'Mano secundaria', head: 'Cabeza',
        chest: 'Pecho', gloves: 'Guantes', feet: 'Pies', neck: 'Cuello',
        ring_1: 'Anillo 1', ring_2: 'Anillo 2', earring_1: 'Pendiente 1', earring_2: 'Pendiente 2'
    };

    const STAT_LABELS = {
        strength: 'Fuerza', dexterity: 'Destreza', constitution: 'Constitución',
        intelligence: 'Inteligencia', charisma: 'Carisma', luck: 'Suerte',
        damage_min: 'Daño mínimo', damage_max: 'Daño máximo',
        weapon_damage: 'Daño', armor: 'Armadura', defense: 'Defensa',
        crit_chance: 'Crítico', block_chance: 'Bloqueo',
        healing_bonus: 'Curación', skill_damage: 'Daño de habilidad',
        skill_damage_bonus: 'Daño de habilidad'
    };

    const formatStatKey = (key) => STAT_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

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

    // --- CÁLCULOS DE STATS (backend como fuente de verdad) ---
    const equipPetBonuses = useMemo(() => {
        if (user.stat_breakdown) {
            const result = {};
            for (const stat of ['strength', 'dexterity', 'constitution', 'intelligence', 'charisma', 'luck']) {
                const bd = user.stat_breakdown[stat];
                result[stat] = (bd?.equipment || 0) + (bd?.pet || 0);
            }
            for (const stat of ['damage_min', 'damage_max', 'armor', 'defense']) {
                result[stat] = user.total_stats?.[stat] || 0;
            }
            return result;
        }
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
        const active = myPets.find(p => p.is_active);
        if (active && active.current_hunger > 0 && active.bonus_stats) {
            Object.entries(active.bonus_stats).forEach(([key, val]) => {
                bonuses[key] = (bonuses[key] || 0) + val;
            });
        }
        return bonuses;
    }, [user.stat_breakdown, user.total_stats, user.real_inventory, myPets]);

    const derivedStats = useMemo(() => {
        const bd = user.derived_stats;
        if (bd) {
            return {
                totalDamageMin: bd.physicalDamageMin,
                totalDamageMax: bd.physicalDamageMax,
                defense: bd.defense,
                critChance: bd.critChance,
                blockChance: bd.blockChance,
                skillDamagePct: bd.skillDamageBonus,
                healingPct: bd.healingPower
            };
        }
        const totalStats = user.total_stats || user.stats || {};
        const s = totalStats.strength || 0;
        const d = totalStats.dexterity || 0;
        const c = totalStats.constitution || 0;
        const i = totalStats.intelligence || 0;
        const l = totalStats.luck || 0;
        return {
            totalDamageMin: (totalStats.damage_min || 0) + s * 2,
            totalDamageMax: (totalStats.damage_max || 0) + s * 2,
            defense: (totalStats.armor || 0) + (totalStats.defense || 0) + Math.floor(c / 2),
            critChance: Math.min(d * 0.25, 25),
            blockChance: Math.min(l * 0.25, 25),
            skillDamagePct: Math.min(i * 0.25, 25),
            healingPct: Math.min(i * 0.5, 25)
        };
    }, [user.derived_stats, user.total_stats, user.stats]);

    const displayMaxHp = user.calculatedMaxHp ?? user.calculated_max_hp ?? 0;
    const equippedPet = myPets.find(p => p.is_active);

    const quickSuggestions = useMemo(() => {
        const tips = [];
        if (user.stat_points > 0) tips.push({ icon: 'Zap', text: `Tienes ${user.stat_points} punto${user.stat_points !== 1 ? 's' : ''} de atributo disponible${user.stat_points !== 1 ? 's' : ''}.`, tone: 'amber' });
        if (selectedItem && isEquippable(selectedItem)) tips.push({ icon: 'ArrowUpCircle', text: 'Puedes equipar este objeto o compararlo con tu equipo actual.', tone: 'blue' });
        const inv = user.real_inventory || [];
        const visibleSlots = ['head', 'earring_1', 'earring_2', 'neck', 'main_hand', 'chest', 'off_hand', 'ring_1', 'ring_2', 'gloves', 'feet'];
        const emptySlots = visibleSlots.filter(s => !inv.find(i => i.is_equipped && i.equipped_slot === s));
        if (emptySlots.length > 0) tips.push({ icon: 'Shield', text: `Hay ${emptySlots.length} espacio${emptySlots.length !== 1 ? 's' : ''} de equipo vacío${emptySlots.length !== 1 ? 's' : ''}.`, tone: 'slate' });
        if (user.active_bonuses?.alliance?.length > 0) tips.push({ icon: 'Users', text: 'Tu alianza te otorga bonos activos.', tone: 'amber' });
        if (equippedPet) tips.push({ icon: 'PawPrint', text: 'Tu mascota activa está otorgando bonificaciones.', tone: 'green' });
        else if (myPets.length > 0) tips.push({ icon: 'PawPrint', text: 'Tienes mascotas disponibles para equipar.', tone: 'slate' });
        if (user.power) tips.push({ icon: 'Zap', text: `Tu poder total actual es ${user.power.total.toLocaleString()}.`, tone: 'amber' });
        const totalInventorySlots = user.real_inventory?.filter(i => !i.is_equipped).length || 0;
        const totalBagCapacity = 240; // 6 bags × 40 slots
        if (totalInventorySlots > totalBagCapacity * 0.75) tips.push({ icon: 'Package', text: 'Tu mochila está bastante llena, considera organizarla.', tone: 'slate' });
        return tips;
    }, [user.stat_points, selectedItem, user.active_bonuses, equippedPet, myPets.length, user.power, user.real_inventory]);

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
    const GlobalTooltip = () => {
        if (!tooltipData) return null;
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
    };

    const renderItemDetail = (item) => {
        if (!item) return null;
        const styles = getItemStyles(item.rarity);
        const stats = item.base_stats || {};
        const isStackable = item.stackable || item.quantity > 1;

        const renderStatValue = (val) => Array.isArray(val) ? `${val[0]} - ${val[1]}` : val;

        return (
            <div className="bg-slate-900/90 border-t-2 border-amber-900/50 p-3">
                <div className="flex items-start gap-3 mb-2">
                    <div className={`w-12 h-12 rounded border ${styles.border} bg-slate-800 flex items-center justify-center shrink-0 ${styles.glow}`}>
                        {item.image_url ? (
                            <img src={item.image_url} alt={item.name} className="w-full h-full object-contain p-0.5" />
                        ) : (
                            <span className="text-[8px] text-slate-500">?</span>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className={`font-bold text-xs ${styles.text} truncate`}>{item.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[9px] text-slate-500 uppercase tracking-wider">{item.type}</span>
                            <span className="text-[9px] text-slate-700">·</span>
                            <span className={`text-[9px] uppercase tracking-wider ${styles.text}`}>{item.rarity}</span>
                        </div>
                    </div>
                    <button onClick={() => setSelectedItem(null)} className="text-slate-500 hover:text-white transition-colors shrink-0">
                        <X size={14} />
                    </button>
                </div>

                {item.description && (
                    <p className="text-[10px] text-slate-400 italic mb-2 border-b border-white/5 pb-2">{item.description}</p>
                )}

                {Object.keys(stats).length > 0 && (
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mb-2">
                        {stats.heal_amount && (
                            <span className="text-[10px] text-green-400 flex items-center gap-1 col-span-2">
                                <span className="text-green-500">+</span> Recupera {stats.heal_amount} HP
                            </span>
                        )}
                        {stats.damage_min != null && (
                            <span className="text-[10px] text-slate-300 flex items-center gap-1">
                                <img src={STAT_IMAGES.damage} className="w-3 h-3" />
                                Daño: <span className="text-white">{stats.damage_min} - {stats.damage_max}</span>
                            </span>
                        )}
                        {stats.armor != null && (
                            <span className="text-[10px] text-slate-300 flex items-center gap-1">
                                <img src={STAT_IMAGES.defense} className="w-3 h-3" />
                                Armadura: <span className="text-white">{renderStatValue(stats.armor)}</span>
                            </span>
                        )}
                        {Object.entries(stats).map(([key, val]) => {
                            if (['damage_min', 'damage_max', 'damage', 'armor', 'heal_amount', 'learn_recipe_id', 'learn_skill_id'].includes(key)) return null;
                            if (!Array.isArray(val) && val <= 0) return null;
                            const iconPath = STAT_IMAGES[key] || '/icons/stats/luck.png';
                            return (
                                <span key={key} className="text-[10px] text-green-400 flex items-center gap-1">
                                    <img src={iconPath} className="w-3 h-3" />
                                    {key}: <span className="text-white">+{renderStatValue(val)}</span>
                                </span>
                            );
                        })}
                    </div>
                )}

                {/* COMPARACIÓN: solo para items equipables */}
                {isEquippable(item) && (() => {
                    const { equipped, slotName, secondary } = findEquippedForComparison(item);
                    const equippedStats = equipped?.base_stats || {};

                    // Recolectar todas las keys de stats de ambos items
                    const allKeys = [...new Set([...Object.keys(stats), ...Object.keys(equippedStats)])].filter(
                        k => !['learn_recipe_id', 'learn_skill_id'].includes(k)
                    );

                    const slotLabel = SLOT_LABELS[slotName] || slotName;
                    const slotLabelSecondary = secondary ? SLOT_LABELS[secondary.slotName] || secondary.slotName : null;

                    return (
                        <div className="mt-2 pt-2 border-t border-amber-500/20">
                            <h4 className="text-[10px] text-amber-500 font-serif uppercase tracking-widest mb-1.5">Comparación</h4>

                            {!slotName && (
                                <p className="text-[9px] text-slate-500 italic">Este tipo de equipo aún no tiene slot visible en el personaje.</p>
                            )}

                            {slotName && (
                                <>
                                    {/* Encabezados */}
                                    <div className="grid grid-cols-3 gap-1 mb-1 text-[9px] text-slate-600 uppercase tracking-wider font-bold border-b border-white/5 pb-1">
                                        <span></span>
                                        <span className="text-center">Equipado</span>
                                        <span className="text-center">Seleccionado</span>
                                    </div>

                                    {/* Items: icono + nombre + rareza */}
                                    <div className="grid grid-cols-3 gap-1 mb-1.5 text-[9px]">
                                        <span className="text-slate-500 self-center">{slotLabel}</span>
                                        <div className="text-center flex flex-col items-center">
                                            {equipped ? (
                                                <>
                                                    <div className={`w-8 h-8 rounded border ${getItemStyles(equipped.rarity).border} bg-slate-800 flex items-center justify-center mb-0.5`}>
                                                        {equipped.image_url ? <img src={equipped.image_url} className="w-full h-full object-contain" /> : <span className="text-[6px] text-slate-500">?</span>}
                                                    </div>
                                                    <span className={`${getItemStyles(equipped.rarity).text} font-bold truncate max-w-[60px]`}>{equipped.name}</span>
                                                </>
                                            ) : (
                                                <span className="text-slate-600 italic">Vacío</span>
                                            )}
                                        </div>
                                        <div className="text-center flex flex-col items-center">
                                            <div className={`w-8 h-8 rounded border ${styles.border} bg-slate-800 flex items-center justify-center mb-0.5`}>
                                                {item.image_url ? <img src={item.image_url} className="w-full h-full object-contain" /> : <span className="text-[6px] text-slate-500">?</span>}
                                            </div>
                                            <span className={`${styles.text} font-bold truncate max-w-[60px]`}>{item.name}</span>
                                        </div>
                                    </div>

                                    {/* Stats comparison */}
                                    <div className="space-y-0.5">
                                        {allKeys.length === 0 && <p className="text-[9px] text-slate-600 italic">Sin atributos adicionales.</p>}
                                        {allKeys.map(key => {
                                            const currentVal = stats[key];
                                            const equippedVal = equippedStats[key];
                                            if (currentVal === undefined && equippedVal === undefined) return null;

                                            const renderVal = (v) => v === undefined ? 0 : (Array.isArray(v) ? Math.floor((v[0] + v[1]) / 2) : v);
                                            const displayVal = (v) => v === undefined ? '0' : (Array.isArray(v) ? `${v[0]} - ${v[1]}` : String(v));

                                            const cur = renderVal(currentVal);
                                            const eq = renderVal(equippedVal);
                                            const diff = cur - eq;

                                            if (diff === 0) return null;

                                            return (
                                                <div key={key} className="grid grid-cols-3 gap-1 text-[10px]">
                                                    <span className="text-slate-500">{formatStatKey(key)}</span>
                                                    <span className="text-center text-slate-400">{displayVal(equippedVal)}</span>
                                                    <span className={`text-center font-mono font-bold ${diff > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                        {diff > 0 ? '+' : ''}{diff}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Slot secundario (ring_2 / earring_2) */}
                                    {secondary && (
                                        <div className="mt-1.5 pt-1.5 border-t border-white/5">
                                            <p className="text-[9px] text-slate-500 italic">
                                                También equipado en {slotLabelSecondary}: <span className={`${getItemStyles(secondary.equipped.rarity).text}`}>{secondary.equipped.name}</span>
                                            </p>
                                        </div>
                                    )}

                                    {/* Botón Equipar */}
                                    <div className="mt-2 pt-2 border-t border-white/5">
                                        {showSlotChoice?.item?.id === item.id ? (
                                            <div className="flex gap-1">
                                                {showSlotChoice.slots.map((s) => {
                                                    const equippedInSlot = getEquippedItem(s);
                                                    return (
                                                        <button
                                                            key={s}
                                                            onClick={() => handleEquipSelected(item, s)}
                                                            disabled={equipping}
                                                            className="flex-1 py-1.5 rounded bg-amber-700 hover:bg-amber-600 text-white text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-50"
                                                        >
                                                            Reemplazar {SLOT_LABELS[s] || s}
                                                            {equippedInSlot && <span className="block text-[8px] text-amber-200 normal-case font-normal">{equippedInSlot.name}</span>}
                                                        </button>
                                                    );
                                                })}
                                                <button onClick={() => setShowSlotChoice(null)} className="px-2 py-1.5 rounded bg-slate-800 text-slate-400 hover:text-white text-[10px] transition-colors">
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => secondary ? setShowSlotChoice({ item, slots: [slotName, secondary.slotName] }) : handleEquipSelected(item, slotName)}
                                                disabled={equipping}
                                                className="w-full py-1.5 rounded bg-amber-700 hover:bg-amber-600 text-white text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {equipping ? 'Equipando...' : (secondary ? 'Elegir slot' : 'Equipar')}
                                            </button>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    );
                })()}

                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-500 border-t border-white/5 pt-1.5">
                    {isStackable && <span>Cantidad: <span className="text-slate-300 font-mono">{item.quantity}</span></span>}
                    {item.durability_current != null && !['consumable', 'material', 'scroll', 'recipe'].includes(item.type) && (
                        <span>Durabilidad: <span className={`font-mono ${item.durability_current < 20 ? 'text-red-400' : 'text-slate-300'}`}>{item.durability_current}/{item.durability_max || 100}</span></span>
                    )}
                    <span>Valor: {formatCurrency(item.price_copper)}</span>
                    {item.is_bound && <span className="text-red-500">Vinculado</span>}
                </div>
            </div>
        );
    };

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
            <GlobalTooltip />
            
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

            <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 items-start animate-in fade-in duration-300">
                {/* COL 1: PERFIL + STATS */}
                <div className="md:col-span-1 lg:col-span-3 xl:col-span-3 space-y-4">
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
                            {user.power && (
                                <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/10">
                                    <span className="text-[10px] text-slate-500 uppercase tracking-widest">Poder Total</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-amber-400 font-mono font-extrabold text-sm drop-shadow-[0_0_6px_rgba(251,191,36,0.4)]">
                                            {user.power.total.toLocaleString()}
                                        </span>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setShowPowerDetail(true); }}
                                            className="text-[9px] text-slate-500 hover:text-amber-400 transition-colors uppercase tracking-wider"
                                        >
                                            Ver desglose
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Botones y Stats (Mismo código que subiste) */}
                    {evolutionStatus !== 'locked' && evolutionStatus !== 'completed' && (
                        <button onClick={() => setShowEvolutionModal(true)} className={`w-full mb-4 font-bold py-3 px-4 rounded border flex items-center justify-center gap-2 uppercase tracking-widest text-xs hover:scale-105 transition-transform shadow-lg ${evolutionStatus === 'in_progress' ? 'bg-slate-800 border-amber-500 text-amber-400 animate-pulse' : 'bg-gradient-to-r from-purple-700 via-pink-700 to-purple-700 bg-[length:200%_auto] animate-gradient text-white border-purple-400'}`}>
                            {evolutionStatus === 'in_progress' ? <><ScrollText size={16} /> Misión en Progreso</> : <><Zap size={16} className="animate-spin-slow" /> ¡Evolución Disponible!</>}
                        </button>
                    )}

                    <StatsPanel stats={user.stats} bonuses={equipPetBonuses} availablePoints={user.stat_points || 0} maxHp={displayMaxHp} onSave={handleSaveStats} />

                    {/* DESGLOSE DE ATRIBUTOS */}
                    {user.stat_breakdown && (
                        <div className="mt-3 rounded-lg border border-amber-900/40 bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-black/70 shadow-[0_0_25px_rgba(0,0,0,0.35)] overflow-hidden">
                            <h3 className="text-amber-500 font-serif uppercase tracking-widest text-xs px-3 pt-3 pb-2 border-b border-amber-500/20">Desglose de Atributos</h3>
                            <div className="divide-y divide-amber-900/30">
                                {Object.entries(user.stat_breakdown).map(([key, bd]) => {
                                    const labelMap = { strength: 'Fuerza', dexterity: 'Destreza', constitution: 'Constitución', intelligence: 'Inteligencia', charisma: 'Carisma', luck: 'Suerte' };
                                    const bonuses = [];
                                    if (bd.equipment > 0) bonuses.push({ label: 'Equipo', value: `+${bd.equipment}`, color: 'text-cyan-400' });
                                    if (bd.pet > 0) bonuses.push({ label: 'Mascota', value: `+${bd.pet}`, color: 'text-green-400' });
                                    if (bd.alliance > 0) bonuses.push({ label: 'Alianza', value: `+${bd.alliancePercent}% (+${bd.alliance})`, color: 'text-amber-400' });
                                    return (
                                        <div key={key} className="flex items-center px-3 py-2 hover:bg-white/[0.02] transition-colors">
                                            <div className="flex items-center gap-2 w-[120px] shrink-0">
                                                <img src={STAT_IMAGES[key] || `/icons/stats/${key}.png`} className="w-5 h-5 object-contain" />
                                                <span className="text-xs font-bold text-slate-300">{labelMap[key] || key}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="text-white font-mono font-bold text-sm tabular-nums">{bd.total}</span>
                                                    <span className="text-[10px] text-slate-600 mx-1">|</span>
                                                    <span className="text-[10px] text-slate-500 font-mono">Base {bd.base}</span>
                                                    {bonuses.map((b, i) => (
                                                        <span key={i} className="text-[10px] font-mono">
                                                            <span className={`${b.color}`}>{b.value}</span>
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    
                    {/* ACORDEÓN: Estadísticas de Combate */}
                    <div className="mt-3 p-3 rounded-lg border border-amber-900/40 bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-black/70 shadow-[0_0_25px_rgba(0,0,0,0.35)]">
                        <button onClick={() => setShowCombatStats(!showCombatStats)} className="w-full flex items-center justify-between text-left">
                            <h3 className="text-amber-500 font-serif uppercase tracking-widest text-xs">Estadísticas de Combate</h3>
                            <span className={`text-amber-400 transition-transform duration-200 ${showCombatStats ? 'rotate-180' : ''}`}>▼</span>
                        </button>
                        {showCombatStats && (
                            <div className="mt-2 pt-2 border-t border-amber-500/20 space-y-2">
                                <div className="flex justify-between items-center pb-1">
                                    <span className="text-slate-300 flex items-center gap-2 font-semibold tracking-wide"><img src={STAT_IMAGES.health} className="w-5 h-5 drop-shadow" /> Salud</span>
                                    <span className="text-red-400 font-mono text-sm">{user.current_hp} / {displayMaxHp}</span>
                                </div>
                                <div className="flex justify-between items-center pb-1">
                                    <span className="text-slate-300 flex items-center gap-2 font-semibold tracking-wide"><img src={STAT_IMAGES.damage} className="w-5 h-5 drop-shadow" /> Daño Físico</span>
                                    <span className="text-amber-400 font-mono font-extrabold text-sm">{derivedStats.totalDamageMin} - {derivedStats.totalDamageMax}</span>
                                </div>
                                <div className="flex justify-between items-center pb-1">
                                    <span className="text-slate-300 flex items-center gap-2 font-semibold tracking-wide"><img src={STAT_IMAGES.defense} className="w-5 h-5 drop-shadow" /> Defensa</span>
                                    <span className="text-white font-mono text-sm">{derivedStats.defense}</span>
                                </div>
                                <div className="flex justify-between items-center pb-1">
                                    <span className="text-slate-300 flex items-center gap-2 font-semibold tracking-wide"><img src={STAT_IMAGES.crit} className="w-5 h-5 drop-shadow" /> Crítico</span>
                                    <span className="text-yellow-200 font-mono text-sm">{derivedStats.critChance.toFixed(1)}%</span>
                                </div>
                                <div className="flex justify-between items-center pb-1">
                                    <span className="text-slate-300 flex items-center gap-2 font-semibold tracking-wide"><img src={STAT_IMAGES.block} className="w-5 h-5 drop-shadow" /> Bloqueo</span>
                                    <span className="text-blue-200 font-mono text-sm">{derivedStats.blockChance.toFixed(1)}%</span>
                                </div>
                                <div className="flex justify-between items-center pb-1">
                                    <span className="text-slate-300 flex items-center gap-2 font-semibold tracking-wide"><img src={STAT_IMAGES.wisdom} className="w-5 h-5 drop-shadow" /> Poder Curación</span>
                                    <span className="text-green-400 font-mono text-sm">+{derivedStats.healingPct}%</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-300 flex items-center gap-2 font-semibold tracking-wide"><img src={STAT_IMAGES.intelligence} className="w-5 h-5 drop-shadow" /> Daño Habilidad</span>
                                    <span className="text-purple-400 font-mono text-sm">+{derivedStats.skillDamagePct}%</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ACORDEÓN: Bonos Activos */}
                    <div className="mt-3 rounded-lg border border-amber-900/40 bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-black/70 shadow-[0_0_25px_rgba(0,0,0,0.35)] overflow-hidden">
                        <button onClick={() => setShowActiveBonuses(!showActiveBonuses)} className="w-full flex items-center justify-between text-left px-3 py-2.5">
                            <h3 className="text-amber-500 font-serif uppercase tracking-widest text-xs">Bonos Activos</h3>
                            <span className={`text-amber-400 transition-transform duration-200 ${showActiveBonuses ? 'rotate-180' : ''}`}>▼</span>
                        </button>
                        {showActiveBonuses && (() => {
                            const allianceBonuses = user.active_bonuses?.alliance || [];
                            const hasPetBonus = equippedPet && equippedPet.current_hunger > 0 && Object.keys(equippedPet.bonus_stats || {}).length > 0;
                            const hasAny = allianceBonuses.length > 0 || hasPetBonus;

                            const PET_STAT_LABELS = {
                                strength: 'Fuerza', dexterity: 'Destreza', constitution: 'Constitución',
                                intelligence: 'Inteligencia', charisma: 'Carisma', luck: 'Suerte'
                            };

                            return (
                                <div className="px-3 pb-3 pt-2 border-t border-amber-500/20 space-y-1.5">
                                    {!hasAny && (
                                        <p className="text-[10px] text-slate-500 italic">No hay bonos activos.</p>
                                    )}
                                    {allianceBonuses.map((b, i) => (
                                        <div key={i} className="flex items-center gap-1.5 text-[10px]">
                                            <span className="shrink-0 px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-400 font-bold uppercase tracking-wider text-[8px]">Alianza</span>
                                            <span className="text-slate-300">{b.source}</span>
                                            <span className="text-amber-300 font-mono ml-auto">{b.label}</span>
                                        </div>
                                    ))}
                                    {hasPetBonus && (
                                        <div className="flex items-start gap-1.5 text-[10px]">
                                            <span className="shrink-0 px-1.5 py-0.5 rounded bg-green-900/40 text-green-400 font-bold uppercase tracking-wider text-[8px] mt-0.5">Mascota</span>
                                            <div className="flex-1 min-w-0">
                                                <span className="text-slate-300">{equippedPet.name}</span>
                                                <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-green-400 font-mono">
                                                    {Object.entries(equippedPet.bonus_stats).map(([k, v]) => (
                                                        <span key={k}>{PET_STAT_LABELS[k] || k} +{v}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>

                    {/* ACORDEÓN: Sugerencias rápidas */}
                    <div className="mt-3 rounded-lg border border-amber-900/40 bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-black/70 shadow-[0_0_25px_rgba(0,0,0,0.35)] overflow-hidden">
                        <button onClick={() => setShowQuickSuggestions(!showQuickSuggestions)} className="w-full flex items-center justify-between text-left px-3 py-2.5">
                            <h3 className="text-amber-500 font-serif uppercase tracking-widest text-xs">Sugerencias rápidas</h3>
                            <span className={`text-amber-400 transition-transform duration-200 ${showQuickSuggestions ? 'rotate-180' : ''}`}>▼</span>
                        </button>
                        {showQuickSuggestions && (
                            <div className="px-3 pb-3 pt-2 border-t border-amber-500/20 space-y-1.5">
                                {quickSuggestions.length === 0 ? (
                                    <p className="text-[10px] text-slate-500 italic">Todo está en orden por ahora.</p>
                                ) : (
                                    quickSuggestions.map((s, i) => (
                                        <div key={i} className="flex items-start gap-2 text-[10px]">
                                            <span className={`shrink-0 font-bold mt-0.5 ${s.tone === 'amber' ? 'text-amber-400' : s.tone === 'green' ? 'text-green-400' : s.tone === 'blue' ? 'text-blue-400' : 'text-slate-400'}`}>▶</span>
                                            <span className={`${s.tone === 'amber' ? 'text-amber-200' : s.tone === 'green' ? 'text-green-200' : s.tone === 'blue' ? 'text-blue-200' : 'text-slate-300'}`}>
                                                {s.text}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* COL 2: PAPER DOLL + MASCOTA */}
                <div className="md:col-span-1 lg:col-span-5 xl:col-span-5">
                    <div className="bg-black/40 backdrop-blur-md border border-amber-900/30 rounded-lg p-4 min-h-[600px] h-[70vh] max-h-[780px] relative shadow-2xl flex flex-col items-center">
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

                {/* COL 3: MOCHILA + DETALLE */}
                <div className="md:col-span-2 lg:col-span-4 xl:col-span-4">
                    <div className="bg-slate-900 border-2 border-amber-900/50 rounded-lg p-1 flex flex-col shadow-2xl relative">
                        {/* BARRA DE BÚSQUEDA Y FILTROS */}
                        <div className="flex flex-col gap-1 px-1 pt-1 pb-1.5">
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Buscar en inventario..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-700 rounded text-[10px] text-slate-300 px-2 py-1.5 pr-7 placeholder-slate-600 focus:outline-none focus:border-amber-500/50 transition-colors"
                                />
                                {searchQuery && (
                                    <button onClick={() => setSearchQuery('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300">
                                        <X size={12} />
                                    </button>
                                )}
                            </div>
                            <div className="flex gap-1 flex-wrap">
                                {[
                                    { key: 'all', label: 'Todos' },
                                    { key: 'weapon', label: 'Armas' },
                                    { key: 'armor', label: 'Armaduras' },
                                    { key: 'accessory', label: 'Accesorios' },
                                    { key: 'consumable', label: 'Consumibles' },
                                    { key: 'material', label: 'Materiales' },
                                ].map(({ key, label }) => (
                                    <button
                                        key={key}
                                        onClick={() => setFilterType(filterType === key ? 'all' : key)}
                                        className={`px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider font-bold transition-colors ${filterType === key ? 'bg-amber-700 text-white' : 'bg-slate-800 text-slate-500 hover:text-slate-300'}`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                            <div className="flex gap-1 flex-wrap">
                                {[
                                    { key: 'all', label: 'Todas' },
                                    { key: 'common', label: 'Común' },
                                    { key: 'uncommon', label: 'Poco común' },
                                    { key: 'rare', label: 'Raro' },
                                    { key: 'legendary', label: 'Legendario' },
                                    { key: 'mythic', label: 'Mítico' },
                                ].map(({ key, label }) => (
                                    <button
                                        key={key}
                                        onClick={() => setFilterRarity(filterRarity === key ? 'all' : key)}
                                        className={`px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider font-bold transition-colors ${filterRarity === key ? 'bg-amber-700 text-white' : 'bg-slate-800 text-slate-500 hover:text-slate-300'}`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* TABS DE BOLSAS */}
                        <div className="flex gap-1 px-1 overflow-x-auto">
                            {[1, 2, 3, 4, 5, 6].map((num) => (
                                <button key={num} onClick={() => setActiveBag(num)} className={`flex-1 py-1.5 text-[10px] font-bold uppercase border-t-2 transition-colors relative ${activeBag === num ? 'bg-amber-900/80 text-amber-100 border-amber-500' : 'bg-slate-800 text-slate-500 border-transparent hover:bg-slate-700'} ${!isBagUnlocked(num) ? 'opacity-70' : ''}`}>
                                    {!isBagUnlocked(num) && <Lock size={10} className="absolute top-0.5 right-0.5 text-red-400" />}
                                    {num >= 4 ? <span className="text-purple-400">VIP</span> : `BOLSA ${num}`}
                                </button>
                            ))}
                        </div>

                        {/* GRILLA / VISTA FILTRADA */}
                        <div className="flex-1 bg-black/60 border border-slate-700 rounded m-1 p-2 overflow-y-auto relative min-h-[280px] max-h-[340px]">
                            {hasActiveFilters ? (
                                filteredInventory.length === 0 ? (
                                    <div className="flex items-center justify-center h-full text-slate-600 text-[10px] italic">Sin resultados.</div>
                                ) : (
                                    <div className="grid grid-cols-5 gap-1.5 content-start">
                                        {filteredInventory.map((item) => (
                                            <div
                                                key={item.id}
                                                className={`aspect-square border rounded-sm flex items-center justify-center cursor-pointer shadow-inner relative group transition-all ${selectedItem?.id === item.id ? 'border-amber-400 ring-1 ring-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.3)]' : 'border-amber-600/50 bg-slate-800'} hover:border-amber-400`}
                                                onClick={() => setSelectedItem(selectedItem?.id === item.id ? null : item)}
                                                onMouseEnter={(e) => handleMouseEnter(item, e, 'left')}
                                                onMouseLeave={handleMouseLeave}
                                                onContextMenu={(e) => handleContextMenu(e, item)}
                                            >
                                                {item.image_url ? (
                                                    <>
                                                        <img src={item.image_url} alt={item.name} className="w-full h-full object-contain p-0.5 drop-shadow-md" />
                                                        {item.quantity > 1 && <span className="absolute bottom-0 right-0 bg-black/90 text-[10px] text-white px-1.5 font-mono font-bold border-tl border-slate-700 rounded-tl z-10">{item.quantity}</span>}
                                                    </>
                                                ) : <span className="text-[8px] text-slate-500">?</span>}
                                            </div>
                                        ))}
                                    </div>
                                )
                            ) : !isBagUnlocked(activeBag) ? (
                                <div className="flex flex-col items-center justify-center h-full text-center p-6">
                                    <Lock size={48} className={activeBag >= 4 ? "text-purple-500 mb-4" : "text-slate-500 mb-4"} />
                                    <h3 className="text-white font-bold mb-2 text-sm">Mochila Bloqueada</h3>
                                    {activeBag === 3 ? <p className="text-slate-400 text-xs">Nivel 20 requerido.</p> : <div><p className="text-slate-400 text-xs mb-4">Premium</p><button onClick={() => handleRentBagClick(activeBag)} className="px-4 py-2 bg-purple-700 hover:bg-purple-600 text-white text-xs font-bold rounded flex items-center justify-center gap-2 mx-auto"><Gem size={12} /> 50 ónix</button></div>}
                                </div>
                            ) : (
                                <div className="grid grid-cols-5 gap-1.5 content-start">
                                    {[...Array(40)].map((_, i) => {
                                        const item = getBagItem(i);
                                        return (
                                            <div
                                                key={i}
                                                className={`aspect-square border rounded-sm flex items-center justify-center shadow-inner relative group transition-all ${item ? 'bg-slate-800 border-amber-600/50 cursor-grab active:cursor-grabbing' : 'bg-slate-800/50 border-slate-700 hover:border-amber-500/30'} ${selectedItem?.id === item?.id ? 'ring-1 ring-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.3)]' : ''}`}
                                                onDragOver={handleDragOver}
                                                onDrop={(e) => handleDrop(e, { type: 'bag', slot: ((activeBag - 1) * 40) + i })}
                                                draggable={!!item}
                                                onDragStart={(e) => handleDragStart(e, item)}
                                                onDragEnd={handleDragEnd}
                                                onMouseEnter={(e) => handleMouseEnter(item, e, 'left')}
                                                onMouseLeave={handleMouseLeave}
                                                onContextMenu={(e) => item && handleContextMenu(e, item)}
                                                onClick={() => item && setSelectedItem(selectedItem?.id === item.id ? null : item)}
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

                        {/* BARRA INFERIOR */}
                        <div className="mx-1 mb-1 flex justify-between items-center px-2 py-1 text-[10px] text-slate-500 bg-slate-950 rounded-b">
                            {hasActiveFilters ? (
                                <span>{filteredInventory.length} resultado{filteredInventory.length !== 1 ? 's' : ''}</span>
                            ) : (
                                <span>Libres: {40 - (user.real_inventory?.filter(i => !i.is_equipped && i.bag_slot >= (activeBag - 1) * 40 && i.bag_slot < activeBag * 40).length || 0)}</span>
                            )}
                            <button onClick={handleOrganizeInventory} className="text-amber-500 hover:underline font-bold uppercase flex items-center gap-1">Organizar</button>
                        </div>

                        {/* PANEL DE DETALLE DEL ITEM SELECCIONADO */}
                        {selectedItem && renderItemDetail(selectedItem)}
                    </div>
                </div>
            </div>

            {/* MODAL DESGLOSE PODER */}
            {showPowerDetail && user.power?.breakdown && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in" onClick={() => setShowPowerDetail(false)}>
                    <div className="bg-slate-900 border-2 border-amber-600 rounded-lg p-5 max-w-xs w-full mx-4 shadow-[0_0_40px_rgba(245,158,11,0.25)]" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4 border-b border-amber-500/20 pb-2">
                            <h3 className="text-amber-500 font-serif font-bold uppercase tracking-widest text-sm">Desglose de Poder</h3>
                            <button onClick={() => setShowPowerDetail(false)} className="text-slate-400 hover:text-white transition-colors"><X size={16} /></button>
                        </div>
                        <div className="space-y-2 text-xs">
                            {[
                                { key: 'attributes', label: 'Atributos', color: 'text-green-400' },
                                { key: 'combat', label: 'Combate', color: 'text-orange-400' },
                                { key: 'level', label: 'Nivel', color: 'text-blue-400' },
                                { key: 'rarity', label: 'Rareza equipada', color: 'text-purple-400' }
                            ].map(({ key, label, color }) => (
                                <div key={key} className="flex justify-between items-center">
                                    <span className="text-slate-400">{label}</span>
                                    <span className={`font-mono font-bold ${color}`}>
                                        {user.power.breakdown[key]?.toLocaleString() || 0}
                                    </span>
                                </div>
                            ))}
                            <div className="flex justify-between items-center pt-2 mt-2 border-t border-white/10">
                                <span className="text-slate-300 font-bold text-sm">Total</span>
                                <span className="text-amber-400 font-mono font-bold text-sm">
                                    {user.power.total.toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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
                                        <div className="absolute inset-0 bg-[url('/patterns/hex.png')] opacity-20"></div>
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