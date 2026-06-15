const GAME_SEED_VERSION = '2026-06-13-world-v1';

const backgrounds = [
  { id: 7, name: 'Trono del Rey', image_url: '/backgrounds/throne_room.png', is_premium: true, price_onyx: 500 },
  { id: 1, name: 'Ciudadela Humana', image_url: '/backgrounds/background_base_humano.png', is_premium: false, price_onyx: 0 },
  { id: 2, name: 'Bosque Ancestral', image_url: '/backgrounds/background_base_elfo.png', is_premium: false, price_onyx: 0 },
  { id: 3, name: 'Fortaleza de Hierro', image_url: '/backgrounds/background_base_enano.png', is_premium: false, price_onyx: 0 },
  { id: 4, name: 'Tierras Baldías', image_url: '/backgrounds/background_base_orco.png', is_premium: false, price_onyx: 0 },
  { id: 5, name: 'Selva Salvaje', image_url: '/backgrounds/background_base_felino.png', is_premium: false, price_onyx: 0 },
  { id: 6, name: 'Cueva Subterránea', image_url: '/backgrounds/background_base_goblin.png', is_premium: false, price_onyx: 0 }
];

const enemy_drops = [
  { id: 1, enemy_id: 5, item_template_id: 10, drop_chance: 100, min_qty: 1, max_qty: 1 }
];

const classes = [
  { id: 1, name: 'human', display_name: 'Humano Vikingo', parent_id: null, tier: 0, image_url: '/classes/human_t0', base_stats: { strength: 5, dexterity: 5, constitution: 5, intelligence: 5, charisma: 7, luck: 5 } },
  { id: 2, name: 'elf', display_name: 'Elfo', parent_id: null, tier: 0, image_url: '/classes/elf_t0', base_stats: { strength: 4, dexterity: 7, constitution: 4, intelligence: 6, charisma: 5, luck: 5 } },
  { id: 3, name: 'dwarf', display_name: 'Enano', parent_id: null, tier: 0, image_url: '/classes/dwarf_t0', base_stats: { strength: 6, dexterity: 3, constitution: 8, intelligence: 4, charisma: 4, luck: 5 } },
  { id: 4, name: 'goblin', display_name: 'Duende', parent_id: null, tier: 0, image_url: '/classes/goblin_t0', base_stats: { strength: 3, dexterity: 8, constitution: 3, intelligence: 7, charisma: 3, luck: 8 } },
  { id: 5, name: 'orc', display_name: 'Orco', parent_id: null, tier: 0, image_url: '/classes/orc_t0', base_stats: { strength: 9, dexterity: 4, constitution: 6, intelligence: 2, charisma: 3, luck: 3 } },
  { id: 6, name: 'feline', display_name: 'Felino', parent_id: null, tier: 0, image_url: '/classes/feline_t0', base_stats: { strength: 5, dexterity: 8, constitution: 4, intelligence: 4, charisma: 4, luck: 5 } },
  { id: 101, name: 'maestro_de_armas', display_name: 'Maestro de Armas', parent_id: 1, tier: 1, image_url: '/classes/human_t1_a', base_stats: { strength: 8, dexterity: 6, constitution: 7, intelligence: 5, charisma: 7, luck: 5 } },
  { id: 102, name: 'sabio_de_batalla', display_name: 'Sabio de Batalla', parent_id: 1, tier: 1, image_url: '/classes/human_t1_b', base_stats: { strength: 6, dexterity: 5, constitution: 6, intelligence: 8, charisma: 7, luck: 5 } },
  { id: 103, name: 'danzarin_sombrio', display_name: 'Danzarin Sombrio', parent_id: 2, tier: 1, image_url: '/classes/elf_t1_a', base_stats: { strength: 5, dexterity: 9, constitution: 5, intelligence: 7, charisma: 5, luck: 6 } },
  { id: 104, name: 'vigia_del_bosque', display_name: 'Vigia del Bosque', parent_id: 2, tier: 1, image_url: '/classes/elf_t1_b', base_stats: { strength: 5, dexterity: 8, constitution: 5, intelligence: 8, charisma: 5, luck: 6 } },
  { id: 105, name: 'verdugo_de_la_forja', display_name: 'Verdugo de la Forja', parent_id: 3, tier: 1, image_url: '/classes/dwarf_t1_a', base_stats: { strength: 8, dexterity: 4, constitution: 10, intelligence: 4, charisma: 4, luck: 5 } },
  { id: 106, name: 'defensor_de_la_montana', display_name: 'Defensor de la Montana', parent_id: 3, tier: 1, image_url: '/classes/dwarf_t1_b', base_stats: { strength: 7, dexterity: 3, constitution: 11, intelligence: 4, charisma: 4, luck: 5 } },
  { id: 107, name: 'asesino_de_alcantarilla', display_name: 'Asesino de Alcantarilla', parent_id: 4, tier: 1, image_url: '/classes/goblin_t1_a', base_stats: { strength: 4, dexterity: 10, constitution: 4, intelligence: 8, charisma: 3, luck: 8 } },
  { id: 108, name: 'chatarrero_ingenioso', display_name: 'Chatarrero Ingenioso', parent_id: 4, tier: 1, image_url: '/classes/goblin_t1_b', base_stats: { strength: 4, dexterity: 8, constitution: 4, intelligence: 9, charisma: 4, luck: 8 } },
  { id: 109, name: 'berserker_piel_de_sangre', display_name: 'Berserker Piel de Sangre', parent_id: 5, tier: 1, image_url: '/classes/orc_t1_a', base_stats: { strength: 12, dexterity: 4, constitution: 8, intelligence: 2, charisma: 3, luck: 3 } },
  { id: 110, name: 'piel_de_hierro', display_name: 'Piel de Hierro', parent_id: 5, tier: 1, image_url: '/classes/orc_t1_b', base_stats: { strength: 10, dexterity: 4, constitution: 10, intelligence: 2, charisma: 3, luck: 3 } },
  { id: 111, name: 'acechador_silencioso', display_name: 'Acechador Silencioso', parent_id: 6, tier: 1, image_url: '/classes/feline_t1_a', base_stats: { strength: 6, dexterity: 10, constitution: 5, intelligence: 4, charisma: 4, luck: 5 } },
  { id: 112, name: 'furia_primitiva', display_name: 'Furia Primitiva', parent_id: 6, tier: 1, image_url: '/classes/feline_t1_b', base_stats: { strength: 8, dexterity: 9, constitution: 5, intelligence: 4, charisma: 4, luck: 5 } },
];

const itemsTemplates = [
  { id: 1, name: 'Piel de Lobo', type: 'material', slot: null, rarity: 'common', icon: 'fur_wolf', image_url: '/items/materials/fur_wolf.png', price_copper: 18, min_level: 1, stackable: true, in_shop: false, description: 'Material comun usado en curtido y arqueria.', base_stats: {} },
  { id: 2, name: 'Baba de Slime', type: 'material', slot: null, rarity: 'common', icon: 'goo_slime', image_url: '/items/materials/goo_slime.png', price_copper: 14, min_level: 1, stackable: true, in_shop: false, description: 'Gel alquimico con propiedades estabilizantes.', base_stats: {} },
  { id: 3, name: 'Piel de Serpiente', type: 'material', slot: null, rarity: 'common', icon: 'skin_serpent', image_url: '/items/materials/skin_serpent.png', price_copper: 26, min_level: 4, stackable: true, in_shop: false, description: 'Escamas flexibles para pociones y correas.', base_stats: {} },
  { id: 4, name: 'Corazon de Ogro', type: 'material', slot: null, rarity: 'uncommon', icon: 'heart_ogre', image_url: '/items/materials/heart_ogre.png', price_copper: 70, min_level: 8, stackable: true, in_shop: false, description: 'Ingrediente raro para brebajes agresivos.', base_stats: {} },
  { id: 5, name: 'Espada Oxidada Novata', type: 'weapon', slot: 'main_hand', rarity: 'common', icon: 'rusty_sword', image_url: '/items/weapons/espada_oxidada_novata1.png', price_copper: 45, min_level: 1, stackable: false, in_shop: true, description: 'Vieja, pesada y confiable.', base_stats: { damage_min: [4, 6], damage_max: [7, 10], strength: 1 } },
  { id: 6, name: 'Arco de Iniciacion', type: 'weapon', slot: 'main_hand', rarity: 'common', icon: 'novice_bow', image_url: '/items/weapons/arco_novato1.png', price_copper: 48, min_level: 1, stackable: false, in_shop: true, description: 'Arco ligero para cazadores novatos.', base_stats: { damage_min: [3, 5], damage_max: [8, 11], dexterity: 1 } },
  { id: 7, name: 'Escudo de Madera', type: 'armor', slot: 'off_hand', rarity: 'common', icon: 'wooden_shield', image_url: '/items/shields/escudo_novato_lvl_1.png', price_copper: 40, min_level: 1, stackable: false, in_shop: true, description: 'Absorbe golpes modestos.', base_stats: { armor: [2, 4], constitution: 1 } },
  { id: 8, name: 'Escudo de Guardia', type: 'armor', slot: 'off_hand', rarity: 'uncommon', icon: 'guard_shield', image_url: '/items/shields/escudo_2_novato_lvl_1.png', price_copper: 68, min_level: 4, stackable: false, in_shop: true, description: 'Refuerzo de hierro para defensores.', base_stats: { armor: [4, 6], constitution: 2, block: 1 } },
  { id: 9, name: 'Casco de Recluta', type: 'armor', slot: 'head', rarity: 'common', icon: 'novice_helm', image_url: '/items/head/casco_novato_lvl_1.png', price_copper: 42, min_level: 1, stackable: false, in_shop: true, description: 'Proteccion basica para la primera marcha.', base_stats: { armor: [1, 3], constitution: 1 } },
  { id: 10, name: 'Racion de Viaje', type: 'consumable', slot: null, rarity: 'common', icon: 'travel_ration', image_url: '/items/materials/goo_slime.png', price_copper: 12, min_level: 1, stackable: true, in_shop: true, description: 'Un bocado rapido que mantiene la marcha.', base_stats: { heal_amount: 20 } },
  { id: 11, name: 'Jerky de Lobo', type: 'consumable', slot: null, rarity: 'common', icon: 'wolf_jerky', image_url: '/items/materials/fur_wolf.png', price_copper: 16, min_level: 1, stackable: true, in_shop: true, description: 'Carne seca para expediciones cortas.', base_stats: { heal_amount: 28 } },
  { id: 12, name: 'Anillo del Aspirante', type: 'accessory', slot: 'ring', rarity: 'common', icon: 'aspirant_ring', image_url: '/icons/slots/ring_1.png', price_copper: 36, min_level: 1, stackable: false, in_shop: true, description: 'Pequena joya que enfoca la voluntad.', base_stats: { luck: 1, charisma: 1 } },
  { id: 13, name: 'Amuleto del Cazador', type: 'accessory', slot: 'neck', rarity: 'common', icon: 'hunter_charm', image_url: '/icons/slots/neck.png', price_copper: 39, min_level: 1, stackable: false, in_shop: true, description: 'Talismán de rastreo sencillo.', base_stats: { dexterity: 1, luck: 1 } },
  { id: 14, name: 'Banda del Guardian', type: 'accessory', slot: 'ring', rarity: 'uncommon', icon: 'guardian_band', image_url: '/icons/slots/ring_2.png', price_copper: 72, min_level: 5, stackable: false, in_shop: true, description: 'Anillo usado por veteranos de muralla.', base_stats: { constitution: 2, armor: 1 } },
  { id: 15, name: 'Martillo de Forja Ligero', type: 'weapon', slot: 'main_hand', rarity: 'common', icon: 'forge_hammer', image_url: '/items/weapons/espada_oxidada_novata1.png', price_copper: 55, min_level: 2, stackable: false, in_shop: true, description: 'Herramienta que tambien sirve para aplastar.', base_stats: { damage_min: [5, 7], damage_max: [8, 12], strength: 2 } },
  { id: 16, name: 'Lanza de Hueso', type: 'weapon', slot: 'main_hand', rarity: 'uncommon', icon: 'bone_spear', image_url: '/items/weapons/arco_novato2.png', price_copper: 84, min_level: 6, stackable: false, in_shop: true, description: 'Lanza tribal con sorprendente alcance.', base_stats: { damage_min: [7, 10], damage_max: [11, 15], dexterity: 2 } },
  { id: 17, name: 'Plano: Hoja Burda', type: 'recipe', slot: null, rarity: 'common', icon: 'recipe_rough_blade', image_url: '/icons/sidebar/city_workshop.png', price_copper: 60, min_level: 5, stackable: true, in_shop: true, description: 'Ensenia el patron de una hoja simple.', stats: { learn_recipe_id: 1 }, base_stats: {} },
  { id: 18, name: 'Plano: Tonico del Bosque', type: 'recipe', slot: null, rarity: 'common', icon: 'recipe_forest_tonic', image_url: '/icons/sidebar/city_workshop.png', price_copper: 58, min_level: 5, stackable: true, in_shop: true, description: 'Receta basica de herbolaria.', stats: { learn_recipe_id: 3 }, base_stats: {} },
  { id: 19, name: 'Pergamino: Mordida Lupina', type: 'scroll', slot: null, rarity: 'uncommon', icon: 'scroll_wolf_bite', image_url: '/skills/mordida.png', price_copper: 95, min_level: 5, stackable: true, in_shop: true, description: 'Tecnica feroz para depredadores y rastreadores.', stats: { learn_skill_id: 11 }, base_stats: {} },
  { id: 20, name: 'Tonico de Campamento', type: 'consumable', slot: null, rarity: 'common', icon: 'camp_tonic', image_url: '/items/materials/goo_slime.png', price_copper: 20, min_level: 1, stackable: true, in_shop: true, description: 'Pocion debil pero segura.', base_stats: { heal_amount: 35 } },
  { id: 21, name: 'Capucha del Explorador', type: 'armor', slot: 'head', rarity: 'common', icon: 'scout_hood', image_url: '/items/head/casco_novato_lvl_1.png', price_copper: 50, min_level: 2, stackable: false, in_shop: true, description: 'Equipo ligero para vigias.', base_stats: { armor: [2, 3], dexterity: 1 } },
  { id: 22, name: 'Broquel Ligero', type: 'armor', slot: 'off_hand', rarity: 'common', icon: 'scout_buckler', image_url: '/items/shields/escudo_novato_lvl_1.png', price_copper: 44, min_level: 1, stackable: false, in_shop: true, description: 'Pequeno y veloz.', base_stats: { armor: [2, 3], dexterity: 1 } },
  { id: 23, name: 'Colgante Lunar', type: 'accessory', slot: 'neck', rarity: 'uncommon', icon: 'moon_pendant', image_url: '/icons/slots/neck.png', price_copper: 78, min_level: 6, stackable: false, in_shop: true, description: 'Foco sereno para el pensamiento.', base_stats: { intelligence: 2, luck: 1 } },
  { id: 24, name: 'Hacha de Saqueo', type: 'weapon', slot: 'main_hand', rarity: 'uncommon', icon: 'raider_axe', image_url: '/items/weapons/espada_oxidada_novata1.png', price_copper: 88, min_level: 6, stackable: false, in_shop: true, description: 'Arma brutal favorita de merodeadores.', base_stats: { damage_min: [8, 11], damage_max: [12, 16], strength: 2 } },
  { id: 25, name: 'Escudo Rocoso', type: 'armor', slot: 'off_hand', rarity: 'uncommon', icon: 'stoneguard_shield', image_url: '/items/shields/escudo_2_novato_lvl_1.png', price_copper: 90, min_level: 6, stackable: false, in_shop: true, description: 'Pesado, tosco y muy resistente.', base_stats: { armor: [5, 7], constitution: 2 } },
  { id: 26, name: 'Talismán de Garra', type: 'accessory', slot: 'neck', rarity: 'common', icon: 'claw_talisman', image_url: '/icons/slots/neck.png', price_copper: 41, min_level: 1, stackable: false, in_shop: true, description: 'Totem de acecho para cazadores felinos.', base_stats: { dexterity: 1, strength: 1 } },
  { id: 27, name: 'Daga de Chatarra', type: 'weapon', slot: 'main_hand', rarity: 'common', icon: 'scrap_dagger', image_url: '/items/weapons/espada_oxidada_novata1.png', price_copper: 43, min_level: 1, stackable: false, in_shop: true, description: 'Corta mas de lo que aparenta.', base_stats: { damage_min: [4, 5], damage_max: [8, 9], dexterity: 1 } },
  { id: 28, name: 'Yelmo Rúnico Improvisado', type: 'armor', slot: 'head', rarity: 'common', icon: 'runed_cap', image_url: '/items/head/casco_novato_lvl_1.png', price_copper: 46, min_level: 1, stackable: false, in_shop: true, description: 'Proteccion fabricada con ingenio cuestionable.', base_stats: { armor: [1, 2], intelligence: 1 } },
  { id: 29, name: 'Anillo del Tunel', type: 'accessory', slot: 'ring', rarity: 'common', icon: 'tunnel_ring', image_url: '/icons/slots/ring_1.png', price_copper: 34, min_level: 1, stackable: false, in_shop: true, description: 'Fetiche de suerte goblin.', base_stats: { luck: 2 } },
  { id: 30, name: 'Brebaje de Onix', type: 'consumable', slot: null, rarity: 'uncommon', icon: 'onyx_brew', image_url: '/items/materials/goo_slime.png', price_copper: 36, min_level: 4, stackable: true, in_shop: true, description: 'Mezcla fuerte para volver al combate.', base_stats: { heal_amount: 55 } },
  { id: 31, name: 'Vial de Baba Concentrada', type: 'consumable', slot: null, rarity: 'common', icon: 'slime_vial', image_url: '/items/materials/goo_slime.png', price_copper: 22, min_level: 2, stackable: true, in_shop: true, description: 'Toma desagradable pero efectiva.', base_stats: { heal_amount: 30 } },
  { id: 32, name: 'Unguento de Serpiente', type: 'consumable', slot: null, rarity: 'common', icon: 'serpent_salve', image_url: '/items/materials/skin_serpent.png', price_copper: 28, min_level: 3, stackable: true, in_shop: true, description: 'Remedio artesanal de los humedales.', base_stats: { heal_amount: 40 } },
  { id: 33, name: 'Elixir Corazon de Ogro', type: 'consumable', slot: null, rarity: 'uncommon', icon: 'ogre_draught', image_url: '/items/materials/heart_ogre.png', price_copper: 66, min_level: 8, stackable: true, in_shop: true, description: 'Devuelve vigor con una patada brutal.', base_stats: { heal_amount: 75 } },
  { id: 34, name: 'Aro en Bruto', type: 'accessory', slot: 'ring', rarity: 'common', icon: 'blank_ring', image_url: '/icons/slots/ring_2.png', price_copper: 52, min_level: 5, stackable: false, in_shop: false, description: 'Base simple para joyeria de taller.', base_stats: { charisma: 1 } },
  { id: 35, name: 'Morral del Herbolario', type: 'accessory', slot: 'neck', rarity: 'common', icon: 'herbal_satchel', image_url: '/icons/slots/neck.png', price_copper: 47, min_level: 4, stackable: false, in_shop: false, description: 'Bolsa llena de aromas curativos.', base_stats: { intelligence: 1, luck: 1 } },
  { id: 36, name: 'Tabla Rúnica Menor', type: 'scroll', slot: null, rarity: 'common', icon: 'runed_tablet', image_url: '/skills/torreta.png', price_copper: 74, min_level: 5, stackable: true, in_shop: true, description: 'Instrucciones de una tecnica defensiva.', stats: { learn_skill_id: 5 }, base_stats: {} },
];

const professions = [
  { id: 1, name: 'weaponsmith', display_name: 'Armero', icon: 'sword' },
  { id: 2, name: 'armorsmith', display_name: 'Herrero de Armaduras', icon: 'shield' },
  { id: 3, name: 'herbalist', display_name: 'Herbolario', icon: 'flask' },
  { id: 4, name: 'scribe', display_name: 'Escriba', icon: 'scroll' },
  { id: 5, name: 'jeweler', display_name: 'Joyero', icon: 'gem' },
];

const recipes = [
  { id: 1, profession_id: 1, result_item_template_id: 15, result_quantity: 1, result_name: 'Martillo de Forja Ligero', result_image: '/items/weapons/espada_oxidada_novata1.png', item_desc: 'Herramienta pesada para abrir armaduras ligeras.', min_profession_level: 1, cost_gold: 0, cost_silver: 0, cost_copper: 40, xp_reward: 45, rarity: 'common', materials: { 1: 3 } },
  { id: 2, profession_id: 2, result_item_template_id: 8, result_quantity: 1, result_name: 'Escudo de Guardia', result_image: '/items/shields/escudo_2_novato_lvl_1.png', item_desc: 'Escudo con refuerzo de hierro para novatos serios.', min_profession_level: 1, cost_gold: 0, cost_silver: 0, cost_copper: 38, xp_reward: 45, rarity: 'common', materials: { 1: 4 } },
  { id: 3, profession_id: 3, result_item_template_id: 31, result_quantity: 2, result_name: 'Vial de Baba Concentrada', result_image: '/items/materials/goo_slime.png', item_desc: 'Consumible basico del laboratorio.', min_profession_level: 1, cost_gold: 0, cost_silver: 0, cost_copper: 25, xp_reward: 40, rarity: 'common', materials: { 2: 3 } },
  { id: 4, profession_id: 4, result_item_template_id: 36, result_quantity: 1, result_name: 'Tabla Rúnica Menor', result_image: '/skills/torreta.png', item_desc: 'Tabla con runas defensivas para estudio.', min_profession_level: 1, cost_gold: 0, cost_silver: 0, cost_copper: 35, xp_reward: 42, rarity: 'common', materials: { 3: 2 } },
  { id: 5, profession_id: 5, result_item_template_id: 34, result_quantity: 1, result_name: 'Aro en Bruto', result_image: '/icons/slots/ring_2.png', item_desc: 'Joya simple con hueco para mejoras futuras.', min_profession_level: 1, cost_gold: 0, cost_silver: 0, cost_copper: 30, xp_reward: 40, rarity: 'common', materials: { 1: 2 } },
];

const skills = [
  { id: 1, class_id: 1, name: 'Golpe de Pommel', description: 'Impacto rapido para abrir la guardia enemiga.', image_url: '/skills/golpe_pommel.png', trigger_chance: 18, energy_cost: 8, damage_min: 8, damage_max: 12, base_price: 100, max_level: 10 },
  { id: 2, class_id: 1, name: 'Grito de Guerra', description: 'Impulso tactico que intimida al rival.', image_url: '/skills/grito.png', trigger_chance: 14, energy_cost: 10, damage_min: 6, damage_max: 10, base_price: 120, max_level: 10 },
  { id: 3, class_id: 2, name: 'Flecha Certera', description: 'Disparo preciso con daño consistente.', image_url: '/skills/flecha.png', trigger_chance: 20, energy_cost: 7, damage_min: 9, damage_max: 13, base_price: 100, max_level: 10 },
  { id: 4, class_id: 2, name: 'Bomba de Humo', description: 'Tactica evasiva que rompe el ritmo enemigo.', image_url: '/skills/bomba_humo.png', trigger_chance: 12, energy_cost: 9, damage_min: 5, damage_max: 9, base_price: 115, max_level: 10 },
  { id: 5, class_id: 3, name: 'Muro de Hierro', description: 'Postura de defensa extrema forjada en acero.', image_url: '/skills/muro_hierro.png', trigger_chance: 15, energy_cost: 9, damage_min: 4, damage_max: 8, base_price: 105, max_level: 10 },
  { id: 6, class_id: 3, name: 'Martillazo', description: 'Descarga pesada que castiga la linea frontal.', image_url: '/skills/martillazo.png', trigger_chance: 16, energy_cost: 11, damage_min: 10, damage_max: 15, base_price: 125, max_level: 10 },
  { id: 7, class_id: 4, name: 'Puñalada', description: 'Ataque sucio con alta precision.', image_url: '/skills/punalada.png', trigger_chance: 22, energy_cost: 6, damage_min: 8, damage_max: 12, base_price: 95, max_level: 10 },
  { id: 8, class_id: 4, name: 'Torreta Chatarra', description: 'Artilugio improvisado con daño sostenido.', image_url: '/skills/torreta.png', trigger_chance: 10, energy_cost: 12, damage_min: 7, damage_max: 11, base_price: 130, max_level: 10 },
  { id: 9, class_id: 5, name: 'Sismo', description: 'Golpe brutal que sacude el terreno.', image_url: '/skills/sismo.png', trigger_chance: 15, energy_cost: 12, damage_min: 12, damage_max: 18, base_price: 130, max_level: 10 },
  { id: 10, class_id: 5, name: 'Corte Circular', description: 'Barrido violento contra varios angulos.', image_url: '/skills/corte_circular.png', trigger_chance: 17, energy_cost: 10, damage_min: 10, damage_max: 14, base_price: 120, max_level: 10 },
  { id: 11, class_id: 6, name: 'Mordida Lupina', description: 'Embestida feroz enfocada en puntos vitales.', image_url: '/skills/mordida.png', trigger_chance: 20, energy_cost: 7, damage_min: 9, damage_max: 13, base_price: 100, max_level: 10 },
  { id: 12, class_id: 6, name: 'Paso Umbrio', description: 'Acometida agil nacida del instinto cazador.', image_url: '/skills/bomba_humo.png', trigger_chance: 14, energy_cost: 8, damage_min: 7, damage_max: 11, base_price: 110, max_level: 10 },
];

const pets = [
  { id: 1, code: 'wolf_t1', name: 'Lobo Joven', description: 'Compañero fiel que afina el instinto de caza.', image_url: '/pets/pet_wolf_t1.png', tier: 1, bonus_stats: { strength: 1, dexterity: 1 }, max_hunger: 100 },
  { id: 2, code: 'crow_t1', name: 'Cuervo Vigia', description: 'Observa desde lo alto y detecta oportunidades.', image_url: '/pets/pet_cuervo_t1.png', tier: 1, bonus_stats: { intelligence: 1, luck: 1 }, max_hunger: 100 },
  { id: 3, code: 'boar_t1', name: 'Jabali Obstinado', description: 'Carga sin miedo y mejora la resistencia.', image_url: '/pets/pet_jabali_t1.png', tier: 1, bonus_stats: { constitution: 2 }, max_hunger: 100 },
  { id: 4, code: 'rabbit_t1', name: 'Conejo de Brezal', description: 'Ligero, nervioso y sorprendentemente util.', image_url: '/pets/pet_conejo_t1.png', tier: 1, bonus_stats: { dexterity: 2 }, max_hunger: 100 },
  { id: 5, code: 'griffin_t1', name: 'Grifo Menor', description: 'Cria orgullosa de mirada feroz.', image_url: '/pets/pet_grifo_t1.png', tier: 1, bonus_stats: { strength: 1, charisma: 1 }, max_hunger: 100 },
];

const expeditions = [
  { id: 1, name: 'Llanuras Bloodpaw', level_required: 1, level_req: 1, image_url: '/locations/bloodpaw_plains.png', description: 'Pastizales abiertos donde las manadas cazan a plena vista.' },
  { id: 2, name: 'Matorral Shadowpine', level_required: 5, level_req: 5, image_url: '/locations/shadowpine_thicket.png', description: 'Bosque oscuro con sendas estrechas y ojos brillando entre los pinos.' },
  { id: 3, name: 'Colinas Stonefang', level_required: 9, level_req: 9, image_url: '/locations/stonefang_hills.png', description: 'Laderas rocosas donde sobreviven las bestias mas tercas del norte.' },
  { id: 4, name: 'Bosque Gravewood', level_required: 13, level_req: 13, image_url: '/locations/gravewood_forest.png', description: 'Ruinas antiguas y niebla espesa envuelven esta tierra maldita.' },
];

const enemies = [
  { id: 1, zone_id: 1, name: 'Lobo Bloodpaw', image_url: '/enemies/bloodpaw_wolf.png', difficulty_tier: 1, is_boss: false, is_hidden: false, min_level: 1, max_level: 2, hp_min: 55, hp_max: 80, damage_min: 5, damage_max: 8, armor: 2, crit_chance: 5, block_chance: 2, description: 'Depredador rapido que patrulla los pastizales.', drops: [{ item_template_id: 1, drop_chance: 55 }, { item_template_id: 11, drop_chance: 12 }] },
  { id: 2, zone_id: 1, name: 'Hiena de la Llanura', image_url: '/enemies/plains_hyena.png', difficulty_tier: 1, is_boss: false, is_hidden: false, min_level: 1, max_level: 3, hp_min: 60, hp_max: 90, damage_min: 6, damage_max: 9, armor: 2, crit_chance: 4, block_chance: 3, description: 'Carroñera agresiva que ataca en manada.', drops: [{ item_template_id: 1, drop_chance: 35 }, { item_template_id: 10, drop_chance: 8 }] },
  { id: 3, zone_id: 1, name: 'Alpha Plains Wolf', image_url: '/enemies/alpha_plains_wolf.png', difficulty_tier: 2, is_boss: false, is_hidden: false, min_level: 2, max_level: 4, hp_min: 88, hp_max: 120, damage_min: 8, damage_max: 12, armor: 4, crit_chance: 8, block_chance: 4, description: 'Lider curtido de una manada territorial.', drops: [{ item_template_id: 1, drop_chance: 70 }, { item_template_id: 13, drop_chance: 6 }] },
  { id: 4, zone_id: 1, name: 'Skarn Bloodpaw Devorador', image_url: '/enemies/skarn_bloodpaw_devourer.png', difficulty_tier: 3, is_boss: true, is_hidden: false, min_level: 4, max_level: 4, hp_min: 180, hp_max: 220, damage_min: 14, damage_max: 18, armor: 8, crit_chance: 10, block_chance: 6, description: 'Bestia alfa que reina con violencia sobre las llanuras.', drops: [{ item_template_id: 1, drop_chance: 100 }, { item_template_id: 12, drop_chance: 18 }, { item_template_id: 20, drop_chance: 30 }] },
  { id: 5, zone_id: 2, name: 'Lobo Sombrio', image_url: '/enemies/shadow_wolf.png', difficulty_tier: 1, is_boss: false, is_hidden: false, min_level: 5, max_level: 6, hp_min: 85, hp_max: 110, damage_min: 8, damage_max: 11, armor: 4, crit_chance: 7, block_chance: 4, description: 'Cazador silencioso del bosque oscuro.', drops: [{ item_template_id: 1, drop_chance: 45 }, { item_template_id: 3, drop_chance: 20 }] },
  { id: 6, zone_id: 2, name: 'Pine Horror', image_url: '/enemies/pine_horror.png', difficulty_tier: 2, is_boss: false, is_hidden: false, min_level: 5, max_level: 7, hp_min: 110, hp_max: 150, damage_min: 10, damage_max: 14, armor: 5, crit_chance: 8, block_chance: 5, description: 'Criatura retorcida nacida de madera y carroña.', drops: [{ item_template_id: 2, drop_chance: 35 }, { item_template_id: 3, drop_chance: 28 }] },
  { id: 7, zone_id: 2, name: 'Night Stalker Lynx', image_url: '/enemies/night_stalker_lynx.png', difficulty_tier: 2, is_boss: false, is_hidden: false, min_level: 6, max_level: 8, hp_min: 120, hp_max: 155, damage_min: 11, damage_max: 15, armor: 5, crit_chance: 11, block_chance: 4, description: 'Felino veloz que embosca desde lo alto.', drops: [{ item_template_id: 1, drop_chance: 30 }, { item_template_id: 26, drop_chance: 7 }] },
  { id: 8, zone_id: 2, name: 'Velsk Terror de Shadowpine', image_url: '/enemies/velsk_the_shadowpine_terror.png', difficulty_tier: 3, is_boss: true, is_hidden: false, min_level: 8, max_level: 8, hp_min: 230, hp_max: 280, damage_min: 15, damage_max: 20, armor: 9, crit_chance: 12, block_chance: 7, description: 'Acechador legendario de la espesura.', drops: [{ item_template_id: 3, drop_chance: 100 }, { item_template_id: 23, drop_chance: 16 }, { item_template_id: 32, drop_chance: 35 }] },
  { id: 9, zone_id: 3, name: 'Jabali de Roca', image_url: '/enemies/rock_boar.png', difficulty_tier: 1, is_boss: false, is_hidden: false, min_level: 9, max_level: 10, hp_min: 130, hp_max: 165, damage_min: 11, damage_max: 15, armor: 6, crit_chance: 5, block_chance: 7, description: 'Animal testarudo que embiste sin dudar.', drops: [{ item_template_id: 1, drop_chance: 38 }, { item_template_id: 4, drop_chance: 6 }] },
  { id: 10, zone_id: 3, name: 'Bruto de Colina', image_url: '/enemies/hill_brute.png', difficulty_tier: 2, is_boss: false, is_hidden: false, min_level: 9, max_level: 11, hp_min: 155, hp_max: 205, damage_min: 13, damage_max: 18, armor: 7, crit_chance: 6, block_chance: 6, description: 'Gigante torpe pero demoledor.', drops: [{ item_template_id: 4, drop_chance: 18 }, { item_template_id: 25, drop_chance: 8 }] },
  { id: 11, zone_id: 3, name: 'Stonefang Hyena', image_url: '/enemies/stonefang_hyena.png', difficulty_tier: 2, is_boss: false, is_hidden: false, min_level: 10, max_level: 12, hp_min: 150, hp_max: 195, damage_min: 12, damage_max: 17, armor: 7, crit_chance: 10, block_chance: 5, description: 'Carroñera endurecida por las rocas.', drops: [{ item_template_id: 1, drop_chance: 30 }, { item_template_id: 30, drop_chance: 12 }] },
  { id: 12, zone_id: 3, name: 'Grondar Troll Stonefang', image_url: '/enemies/grondar_the_stonefang_troll.png', difficulty_tier: 3, is_boss: true, is_hidden: false, min_level: 12, max_level: 12, hp_min: 300, hp_max: 360, damage_min: 18, damage_max: 24, armor: 11, crit_chance: 10, block_chance: 10, description: 'Troll guardian de las colinas y sus cavernas.', drops: [{ item_template_id: 4, drop_chance: 100 }, { item_template_id: 24, drop_chance: 18 }, { item_template_id: 33, drop_chance: 28 }] },
  { id: 13, zone_id: 4, name: 'Ghoul Funerario', image_url: '/enemies/burial_ghoul.png', difficulty_tier: 1, is_boss: false, is_hidden: false, min_level: 13, max_level: 14, hp_min: 160, hp_max: 210, damage_min: 13, damage_max: 17, armor: 7, crit_chance: 8, block_chance: 5, description: 'Cadaver errante que protege tumbas rotas.', drops: [{ item_template_id: 2, drop_chance: 20 }, { item_template_id: 3, drop_chance: 30 }] },
  { id: 14, zone_id: 4, name: 'Howling Phantom', image_url: '/enemies/howling_phantom.png', difficulty_tier: 2, is_boss: false, is_hidden: false, min_level: 13, max_level: 15, hp_min: 185, hp_max: 235, damage_min: 15, damage_max: 20, armor: 8, crit_chance: 11, block_chance: 7, description: 'Espiritu de guerra atrapado entre arboles malditos.', drops: [{ item_template_id: 23, drop_chance: 8 }, { item_template_id: 36, drop_chance: 10 }] },
  { id: 15, zone_id: 4, name: 'Grave Stalker', image_url: '/enemies/grave_stalker.png', difficulty_tier: 2, is_boss: false, is_hidden: false, min_level: 14, max_level: 16, hp_min: 190, hp_max: 245, damage_min: 16, damage_max: 21, armor: 8, crit_chance: 12, block_chance: 6, description: 'Predador necrotico de movimientos lentos y letales.', drops: [{ item_template_id: 3, drop_chance: 32 }, { item_template_id: 4, drop_chance: 12 }] },
  { id: 16, zone_id: 4, name: 'Eldrik Señor del Gravewood', image_url: '/enemies/eldrik_lord_of_the_gravewood.png', difficulty_tier: 3, is_boss: true, is_hidden: false, min_level: 16, max_level: 16, hp_min: 340, hp_max: 410, damage_min: 20, damage_max: 27, armor: 13, crit_chance: 13, block_chance: 10, description: 'Senescal muerto que domina el bosque corrompido.', drops: [{ item_template_id: 4, drop_chance: 100 }, { item_template_id: 14, drop_chance: 16 }, { item_template_id: 19, drop_chance: 15 }] },
];

const quests = [
  { id: 1, type: 'daily', title: 'Control de Manada', description: 'Reduce la presion de los lobos en las llanuras.', min_level: 1, reward_xp: 55, reward_gold: 0, reward_silver: 0, reward_copper: 55, reward_items: [{ template_id: 20, qty: 1 }], requirements: [{ type: 'kill', target_id: 1, count: 3, name: 'Derrota Lobos Bloodpaw' }] },
  { id: 2, type: 'daily', title: 'Risa de Hienas', description: 'Limpia el camino principal para los comerciantes.', min_level: 1, reward_xp: 60, reward_gold: 0, reward_silver: 0, reward_copper: 60, reward_items: [], requirements: [{ type: 'kill', target_id: 2, count: 3, name: 'Derrota Hienas de la Llanura' }] },
  { id: 3, type: 'daily', title: 'Sombra entre Pinos', description: 'Caza a los acechadores del matorral.', min_level: 5, reward_xp: 85, reward_gold: 0, reward_silver: 1, reward_copper: 25, reward_items: [{ template_id: 31, qty: 1 }], requirements: [{ type: 'kill', target_id: 5, count: 4, name: 'Derrota Lobos Sombríos' }] },
  { id: 4, type: 'daily', title: 'Raices Retorcidas', description: 'Conten la corrupcion vegetal de Shadowpine.', min_level: 6, reward_xp: 95, reward_gold: 0, reward_silver: 1, reward_copper: 45, reward_items: [], requirements: [{ type: 'kill', target_id: 6, count: 2, name: 'Derrota Pine Horrors' }] },
  { id: 5, type: 'daily', title: 'Aullidos de Piedra', description: 'La ruta minera necesita menos bestias y mas carros.', min_level: 9, reward_xp: 120, reward_gold: 0, reward_silver: 2, reward_copper: 15, reward_items: [{ template_id: 30, qty: 1 }], requirements: [{ type: 'kill', target_id: 11, count: 3, name: 'Derrota Stonefang Hyenas' }] },
  { id: 6, type: 'daily', title: 'Silencio en la Cripta', description: 'Haz retroceder a los muertos del Gravewood.', min_level: 13, reward_xp: 145, reward_gold: 0, reward_silver: 3, reward_copper: 20, reward_items: [], requirements: [{ type: 'kill', target_id: 13, count: 3, name: 'Derrota Ghouls Funerarios' }] },
  { id: 7, type: 'weekly', title: 'Dominio Bloodpaw', description: 'Derriba al devorador de las llanuras.', min_level: 4, reward_xp: 220, reward_gold: 0, reward_silver: 4, reward_copper: 40, reward_items: [{ template_id: 12, qty: 1 }], requirements: [{ type: 'kill', target_id: 4, count: 1, name: 'Derrota a Skarn' }] },
  { id: 8, type: 'weekly', title: 'Corazon de Piedra', description: 'Elimina al troll que bloquea la cantera.', min_level: 12, reward_xp: 320, reward_gold: 0, reward_silver: 8, reward_copper: 0, reward_items: [{ template_id: 25, qty: 1 }], requirements: [{ type: 'kill', target_id: 12, count: 1, name: 'Derrota a Grondar' }] },
  { id: 9, type: 'evolution', title: 'Prueba de los Dioses', description: 'Demuestra que tu senda merece ser elevada ante Valhallus.', min_level: 10, reward_xp: 250, reward_gold: 0, reward_silver: 5, reward_copper: 0, reward_items: [], requirements: [{ type: 'kill', target_id: 8, count: 1, name: 'Derrota a Velsk' }] },
];

const raceStarters = [
  { id: 'human', name: 'Kit del Recluta Humano', items: [{ template_id: 5, quantity: 1 }, { template_id: 7, quantity: 1 }, { template_id: 20, quantity: 2 }] },
  { id: 'elf', name: 'Kit del Explorador Elfico', items: [{ template_id: 6, quantity: 1 }, { template_id: 21, quantity: 1 }, { template_id: 20, quantity: 2 }] },
  { id: 'dwarf', name: 'Kit de la Forja Enana', items: [{ template_id: 15, quantity: 1 }, { template_id: 8, quantity: 1 }, { template_id: 9, quantity: 1 }] },
  { id: 'orc', name: 'Kit del Saqueador Orco', items: [{ template_id: 24, quantity: 1 }, { template_id: 25, quantity: 1 }, { template_id: 30, quantity: 2 }] },
  { id: 'feline', name: 'Kit del Acechador Felino', items: [{ template_id: 27, quantity: 1 }, { template_id: 22, quantity: 1 }, { template_id: 26, quantity: 1 }] },
  { id: 'goblin', name: 'Kit del Manitas Goblin', items: [{ template_id: 27, quantity: 1 }, { template_id: 28, quantity: 1 }, { template_id: 29, quantity: 1 }] },
];

module.exports = {
  GAME_SEED_VERSION,
  backgrounds,
  classes,
  itemsTemplates,
  professions,
  recipes,
  skills,
  pets,
  expeditions,
  enemies,
  quests,
  raceStarters,
};




