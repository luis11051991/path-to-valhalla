
-- ============================================================================
-- EVOLUTION SYSTEM SEED (NORMALIZADO POR NAME)
-- 2026-07-22
--
-- 1. Evolution classes (36 rows, upsert por name)
-- 2. Evolution quests (3 rows, upsert por min_level)
--
-- IDEMPOTENTE:
--   - Classes usa ON CONFLICT (name) DO UPDATE
--   - parent_id se resuelve dinámicamente por nombre del padre
--   - No especifica id — se conserva el existente o se auto-asigna
--   - Quests usa WHERE NOT EXISTS por (type, min_level)
--   - No DELETE, DROP, TRUNCATE
--   - No toca players, enemies, expeditions, dungeon tables
-- ============================================================================

-- ============================================================================
-- 1. EVOLUTION CLASSES — TIER 1 (min_level 10)
-- ============================================================================
-- Clases base (IDs 1-6) ya existen. NO se insertan/modifican aquí.
-- parent_id se resuelve por nombre de la clase base.

INSERT INTO public.classes (name, description, tier, min_level, parent_id, race_restriction, image_url, base_stats)
VALUES
-- HUMANO Path A
('Maestro de Armas',
  'Domina toda arma cuerpo a cuerpo. Su técnica marcial es impecable.',
  1, 10, (SELECT id FROM public.classes WHERE name = 'Humano'), 'human', NULL,
  '{"strength":4,"dexterity":3,"constitution":2,"intelligence":0,"charisma":0,"luck":0}'),
-- HUMANO Path B
('Sabio de Batalla',
  'Estudia el campo de batalla como un tablero de ajedrez. Su estrategia es imparable.',
  1, 10, (SELECT id FROM public.classes WHERE name = 'Humano'), 'human', NULL,
  '{"strength":1,"dexterity":1,"constitution":0,"intelligence":4,"charisma":3,"luck":1}'),
-- ELFO Path A
('Danzarín Sombrío',
  'Se mueve entre las sombras como una danza mortal. Sus ataques son veloces y precisos.',
  1, 10, (SELECT id FROM public.classes WHERE name = 'Elfo'), 'elf', NULL,
  '{"strength":1,"dexterity":5,"constitution":0,"intelligence":2,"charisma":0,"luck":2}'),
-- ELFO Path B
('Vigía del Bosque',
  'Los árboles le susurran secretos. Defiende la naturaleza con fiereza.',
  1, 10, (SELECT id FROM public.classes WHERE name = 'Elfo'), 'elf', NULL,
  '{"strength":0,"dexterity":3,"constitution":2,"intelligence":4,"charisma":0,"luck":1}'),
-- ENANO Path A
('Verdugo de la Forja',
  'Su martillo y yunque son extensiones de su voluntad. Forja destrucción.',
  1, 10, (SELECT id FROM public.classes WHERE name = 'Enano'), 'dwarf', NULL,
  '{"strength":4,"dexterity":1,"constitution":3,"intelligence":0,"charisma":0,"luck":1}'),
-- ENANO Path B
('Defensor de la Montaña',
  'Nadie pasa mientras él esté en pie. Es la muralla viviente de su clan.',
  1, 10, (SELECT id FROM public.classes WHERE name = 'Enano'), 'dwarf', NULL,
  '{"strength":2,"dexterity":1,"constitution":5,"intelligence":0,"charisma":0,"luck":0}'),
-- GOBLIN Path A
('Asesino de Alcantarilla',
  'Conoce cada rincón oscuro de la ciudad. Nadie está a salvo de su daga.',
  1, 10, (SELECT id FROM public.classes WHERE name = 'Goblin'), 'goblin', NULL,
  '{"strength":0,"dexterity":4,"constitution":0,"intelligence":3,"charisma":0,"luck":2}'),
-- GOBLIN Path B
('Chatarrero Ingenioso',
  'Convierte la basura en tesoros. Sus inventos son impredecibles y mortales.',
  1, 10, (SELECT id FROM public.classes WHERE name = 'Goblin'), 'goblin', NULL,
  '{"strength":0,"dexterity":2,"constitution":2,"intelligence":5,"charisma":0,"luck":1}'),
-- ORCO Path A
('Berserker Piel de Sangre',
  'La sangre de sus enemigos es su combustible. Entra en trance de batalla.',
  1, 10, (SELECT id FROM public.classes WHERE name = 'Orco'), 'orc', NULL,
  '{"strength":6,"dexterity":1,"constitution":3,"intelligence":0,"charisma":0,"luck":0}'),
-- ORCO Path B
('Piel de Hierro',
  'Su cuerpo es tan duro como el acero forjado. Los golpes rebotan en él.',
  1, 10, (SELECT id FROM public.classes WHERE name = 'Orco'), 'orc', NULL,
  '{"strength":3,"dexterity":0,"constitution":5,"charisma":0,"intelligence":0,"luck":1}'),
-- FELINO Path A
('Acechador Silencioso',
  'Sus pasos no hacen ruido. Sus garras encuentran siempre el punto débil.',
  1, 10, (SELECT id FROM public.classes WHERE name = 'Felino'), 'feline', NULL,
  '{"strength":2,"dexterity":5,"constitution":0,"intelligence":0,"charisma":0,"luck":2}'),
-- FELINO Path B
('Furia Primitiva',
  'Desata su instinto salvaje. La bestia interior emerge sin control.',
  1, 10, (SELECT id FROM public.classes WHERE name = 'Felino'), 'feline', NULL,
  '{"strength":4,"dexterity":3,"constitution":2,"intelligence":0,"charisma":0,"luck":1}')
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  tier = EXCLUDED.tier,
  min_level = EXCLUDED.min_level,
  parent_id = EXCLUDED.parent_id,
  race_restriction = EXCLUDED.race_restriction,
  base_stats = EXCLUDED.base_stats;

-- ============================================================================
-- 1. EVOLUTION CLASSES — TIER 2 (min_level 50)
-- ============================================================================

INSERT INTO public.classes (name, description, tier, min_level, parent_id, race_restriction, image_url, base_stats)
VALUES
-- HUMANO Path A -> Estratega de la Arena
('Estratega de la Arena',
  'Cada golpe tiene un propósito. Cada movimiento acerca el final de sus enemigos.',
  2, 50, (SELECT id FROM public.classes WHERE name = 'Maestro de Armas'), 'human', NULL,
  '{"strength":8,"dexterity":6,"constitution":4,"intelligence":2,"charisma":0,"luck":0}'),
-- HUMANO Path B -> Archimago de Combate
('Archimago de Combate',
  'Funde magia y acero en una sinfonía letal. Su poder arcano es temido.',
  2, 50, (SELECT id FROM public.classes WHERE name = 'Sabio de Batalla'), 'human', NULL,
  '{"strength":2,"dexterity":2,"constitution":0,"intelligence":8,"charisma":6,"luck":2}'),
-- ELFO Path A -> Espectro del Viento
('Espectro del Viento',
  'Tan rápido que parece estar en todas partes. El viento mismo es su aliado.',
  2, 50, (SELECT id FROM public.classes WHERE name = 'Danzarín Sombrío'), 'elf', NULL,
  '{"strength":2,"dexterity":10,"constitution":0,"intelligence":4,"charisma":0,"luck":4}'),
-- ELFO Path B -> Susurro de la Muerte
('Susurro de la Muerte',
  'Donde pasa, la vida se apaga. Su flecha siempre encuentra su destino.',
  2, 50, (SELECT id FROM public.classes WHERE name = 'Vigía del Bosque'), 'elf', NULL,
  '{"strength":0,"dexterity":6,"constitution":4,"intelligence":8,"charisma":0,"luck":2}'),
-- ENANO Path A -> Maestro Hacha Rúnica
('Maestro Hacha Rúnica',
  'Sus hachas están grabadas con runas antiguas. Cada golpe libera magia ancestral.',
  2, 50, (SELECT id FROM public.classes WHERE name = 'Verdugo de la Forja'), 'dwarf', NULL,
  '{"strength":8,"dexterity":3,"constitution":6,"intelligence":2,"charisma":0,"luck":1}'),
-- ENANO Path B -> Baluarte Inquebrantable
('Baluarte Inquebrantable',
  'Ni ejércitos enteros pueden moverlo. Es la defensa absoluta.',
  2, 50, (SELECT id FROM public.classes WHERE name = 'Defensor de la Montaña'), 'dwarf', NULL,
  '{"strength":4,"dexterity":2,"constitution":12,"intelligence":0,"charisma":0,"luck":2}'),
-- GOBLIN Path A -> Sombra Caótica
('Sombra Caótica',
  'El caos es su herramienta. Sus enemigos mueren sin saber de dónde vino el golpe.',
  2, 50, (SELECT id FROM public.classes WHERE name = 'Asesino de Alcantarilla'), 'goblin', NULL,
  '{"strength":0,"dexterity":8,"constitution":0,"intelligence":6,"charisma":0,"luck":4}'),
-- GOBLIN Path B -> Tecnomante Siniestro
('Tecnomante Siniestro',
  'La tecnología y la magia negra se fusionan en sus creaciones. Sus artefactos siembran muerte.',
  2, 50, (SELECT id FROM public.classes WHERE name = 'Chatarrero Ingenioso'), 'goblin', NULL,
  '{"strength":0,"dexterity":4,"constitution":4,"intelligence":10,"charisma":0,"luck":2}'),
-- ORCO Path A -> Tormenta de Guerra
('Tormenta de Guerra',
  'Arrasa el campo de batalla como un huracán de acero y sangre.',
  2, 50, (SELECT id FROM public.classes WHERE name = 'Berserker Piel de Sangre'), 'orc', NULL,
  '{"strength":12,"dexterity":3,"constitution":6,"intelligence":0,"charisma":0,"luck":0}'),
-- ORCO Path B -> El Inmortal
('El Inmortal',
  'Ha sobrevivido a todo. Las heridas que matarían a cualquier otro solo lo enfurecen.',
  2, 50, (SELECT id FROM public.classes WHERE name = 'Piel de Hierro'), 'orc', NULL,
  '{"strength":6,"dexterity":0,"constitution":12,"intelligence":0,"charisma":0,"luck":2}'),
-- FELINO Path A -> Garras del Crepúsculo
('Garras del Crepúsculo',
  'Caza en la penumbra. Sus ojos ven lo que otros no pueden. Sus garras alcanzan lo imposible.',
  2, 50, (SELECT id FROM public.classes WHERE name = 'Acechador Silencioso'), 'feline', NULL,
  '{"strength":4,"dexterity":10,"constitution":0,"intelligence":0,"charisma":0,"luck":6}'),
-- FELINO Path B -> Avatar de la Cacería
('Avatar de la Cacería',
  'La cacería eterna lo consume. Cada presa caída lo hace más fuerte.',
  2, 50, (SELECT id FROM public.classes WHERE name = 'Furia Primitiva'), 'feline', NULL,
  '{"strength":8,"dexterity":6,"constitution":4,"intelligence":0,"charisma":0,"luck":2}')
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  tier = EXCLUDED.tier,
  min_level = EXCLUDED.min_level,
  parent_id = EXCLUDED.parent_id,
  race_restriction = EXCLUDED.race_restriction,
  base_stats = EXCLUDED.base_stats;

-- ============================================================================
-- 1. EVOLUTION CLASSES — TIER 3 (min_level 100)
-- ============================================================================

INSERT INTO public.classes (name, description, tier, min_level, parent_id, race_restriction, image_url, base_stats)
VALUES
-- HUMANO Path A -> Señor de la Guerra
('Señor de la Guerra',
  'Leyenda viviente. Los ejércitos se arrodillan a su paso. La guerra misma le obedece.',
  3, 100, (SELECT id FROM public.classes WHERE name = 'Estratega de la Arena'), 'human', NULL,
  '{"strength":14,"dexterity":10,"constitution":8,"intelligence":4,"charisma":4,"luck":0}'),
-- HUMANO Path B -> Oráculo de Guerra
('Oráculo de Guerra',
  'Ve el futuro en cada movimiento. El destino mismo se pliega a su voluntad.',
  3, 100, (SELECT id FROM public.classes WHERE name = 'Archimago de Combate'), 'human', NULL,
  '{"strength":4,"dexterity":4,"constitution":0,"intelligence":14,"charisma":12,"luck":4}'),
-- ELFO Path A -> Fantasma del Vendaval
('Fantasma del Vendaval',
  'Nadie lo ha visto y vivido para contarlo. Es la tormenta perfecta, la muerte hecha viento.',
  3, 100, (SELECT id FROM public.classes WHERE name = 'Espectro del Viento'), 'elf', NULL,
  '{"strength":4,"dexterity":16,"constitution":0,"intelligence":8,"charisma":0,"luck":8}'),
-- ELFO Path B -> La Parca Silenciosa
('La Parca Silenciosa',
  'No hay rastro, no hay advertencia. Solo silencio, y luego la muerte.',
  3, 100, (SELECT id FROM public.classes WHERE name = 'Susurro de la Muerte'), 'elf', NULL,
  '{"strength":0,"dexterity":10,"constitution":6,"intelligence":14,"charisma":0,"luck":6}'),
-- ENANO Path A -> Señor de las Runas
('Señor de las Runas',
  'Las runas antiguas le revelaron sus secretos. Su poder forja el destino de los mundos.',
  3, 100, (SELECT id FROM public.classes WHERE name = 'Maestro Hacha Rúnica'), 'dwarf', NULL,
  '{"strength":12,"dexterity":4,"constitution":10,"intelligence":8,"charisma":0,"luck":4}'),
-- ENANO Path B -> Muralla de Mithril
('Muralla de Mithril',
  'Impenetrable. Indestructible. Eterna. Ni los dioses pueden derribarlo.',
  3, 100, (SELECT id FROM public.classes WHERE name = 'Baluarte Inquebrantable'), 'dwarf', NULL,
  '{"strength":8,"dexterity":4,"constitution":22,"intelligence":0,"charisma":0,"luck":4}'),
-- GOBLIN Path A -> Príncipe del Caos
('Príncipe del Caos',
  'El caos no es aleatorio; es su voluntad. Todo conspira para destruir a sus enemigos.',
  3, 100, (SELECT id FROM public.classes WHERE name = 'Sombra Caótica'), 'goblin', NULL,
  '{"strength":0,"dexterity":14,"constitution":0,"intelligence":12,"charisma":0,"luck":10}'),
-- GOBLIN Path B -> Arquitecto de la Plaga
('Arquitecto de la Plaga',
  'Sus creaciones han diezmado civilizaciones enteras. La destrucción es su obra de arte.',
  3, 100, (SELECT id FROM public.classes WHERE name = 'Tecnomante Siniestro'), 'goblin', NULL,
  '{"strength":0,"dexterity":8,"constitution":6,"intelligence":20,"charisma":0,"luck":4}'),
-- ORCO Path A -> Cataclismo Viviente
('Cataclismo Viviente',
  'Donde pisa, la tierra tiembla. Donde golpea, montañas se derrumban. Es el fin.',
  3, 100, (SELECT id FROM public.classes WHERE name = 'Tormenta de Guerra'), 'orc', NULL,
  '{"strength":22,"dexterity":6,"constitution":10,"intelligence":0,"charisma":0,"luck":0}'),
-- ORCO Path B -> Titán Indestructible
('Titán Indestructible',
  'Ha desafiado a la muerte misma y ganó. Su existencia es una afrenta a los dioses.',
  3, 100, (SELECT id FROM public.classes WHERE name = 'El Inmortal'), 'orc', NULL,
  '{"strength":12,"dexterity":0,"constitution":22,"intelligence":0,"charisma":0,"luck":6}'),
-- FELINO Path A -> Pesadilla Nocturna
('Pesadilla Nocturna',
  'El miedo de sus enemigos le da poder. En la oscuridad, es el cazador supremo.',
  3, 100, (SELECT id FROM public.classes WHERE name = 'Garras del Crepúsculo'), 'feline', NULL,
  '{"strength":8,"dexterity":18,"constitution":0,"intelligence":0,"charisma":0,"luck":12}'),
-- FELINO Path B -> Dios de la Presa
('Dios de la Presa',
  'La cacería eterna ha terminado. Ya no caza; decide quién merece ser cazado.',
  3, 100, (SELECT id FROM public.classes WHERE name = 'Avatar de la Cacería'), 'feline', NULL,
  '{"strength":14,"dexterity":10,"constitution":8,"intelligence":0,"charisma":0,"luck":4}')
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  tier = EXCLUDED.tier,
  min_level = EXCLUDED.min_level,
  parent_id = EXCLUDED.parent_id,
  race_restriction = EXCLUDED.race_restriction,
  base_stats = EXCLUDED.base_stats;

-- ============================================================================
-- Reset sequence de classes al máximo ID actual
-- ============================================================================
SELECT pg_catalog.setval('public.classes_id_seq', GREATEST(45, (SELECT MAX(id) FROM public.classes)), true);

-- ============================================================================
-- 2. EVOLUTION QUESTS (idempotente por min_level)
-- ============================================================================
-- Se actualiza si ya existe; se inserta si no.

WITH upsert AS (
  UPDATE public.quests SET
    title = 'La Prueba del Guerrero',
    description = 'Los dioses observan tu valor. Demuestra que mereces evolucionar más allá de tus límites actuales. Derrota enemigos en expediciones para probar tu valía.',
    requirements = '[{"type":"kill","count":30}]'::jsonb,
    reward_xp = 300,
    reward_gold = 0,
    reward_silver = 0,
    reward_copper = 150,
    reward_onix = 0,
    reward_items = '[]'::jsonb
  WHERE type = 'evolution' AND min_level = 10
  RETURNING id
)
INSERT INTO public.quests (title, description, type, min_level, requirements, reward_xp, reward_gold, reward_silver, reward_copper, reward_onix, reward_items)
SELECT
  'La Prueba del Guerrero',
  'Los dioses observan tu valor. Demuestra que mereces evolucionar más allá de tus límites actuales. Derrota enemigos en expediciones para probar tu valía.',
  'evolution', 10,
  '[{"type":"kill","count":30}]'::jsonb,
  300, 0, 0, 150, 0, '[]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM upsert);

WITH upsert AS (
  UPDATE public.quests SET
    title = 'El Juicio del Héroe',
    description = 'Tu leyenda comienza a escribirse. Los dioses exigen sacrificios mayores. Enfrenta desafíos más oscuros y demuestra que tu espíritu es indomable.',
    requirements = '[{"type":"kill","count":150}]'::jsonb,
    reward_xp = 1500,
    reward_gold = 1,
    reward_silver = 0,
    reward_copper = 0,
    reward_onix = 30,
    reward_items = '[]'::jsonb
  WHERE type = 'evolution' AND min_level = 50
  RETURNING id
)
INSERT INTO public.quests (title, description, type, min_level, requirements, reward_xp, reward_gold, reward_silver, reward_copper, reward_onix, reward_items)
SELECT
  'El Juicio del Héroe',
  'Tu leyenda comienza a escribirse. Los dioses exigen sacrificios mayores. Enfrenta desafíos más oscuros y demuestra que tu espíritu es indomable.',
  'evolution', 50,
  '[{"type":"kill","count":150}]'::jsonb,
  1500, 1, 0, 0, 30, '[]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM upsert);

WITH upsert AS (
  UPDATE public.quests SET
    title = 'El Desafío del Legendario',
    description = 'Solo los más grandes han alcanzado este nivel de poder. Los dioses te ponen a prueba final. Forja tu lugar en el Valhalla.',
    requirements = '[{"type":"kill","count":500}]'::jsonb,
    reward_xp = 4000,
    reward_gold = 5,
    reward_silver = 0,
    reward_copper = 0,
    reward_onix = 150,
    reward_items = '[]'::jsonb
  WHERE type = 'evolution' AND min_level = 100
  RETURNING id
)
INSERT INTO public.quests (title, description, type, min_level, requirements, reward_xp, reward_gold, reward_silver, reward_copper, reward_onix, reward_items)
SELECT
  'El Desafío del Legendario',
  'Solo los más grandes han alcanzado este nivel de poder. Los dioses te ponen a prueba final. Forja tu lugar en el Valhalla.',
  'evolution', 100,
  '[{"type":"kill","count":500}]'::jsonb,
  4000, 5, 0, 0, 150, '[]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM upsert);

-- ============================================================================
-- VALIDACIONES
-- ============================================================================

-- 1. Todas las clases ordenadas por id
SELECT id, name, tier, min_level, parent_id, race_restriction, base_stats
FROM public.classes
ORDER BY id;

-- 2. Árbol de evolución (parent_id resuelto)
SELECT child.id, child.name, child.tier, child.parent_id, parent.name AS parent_name, child.race_restriction
FROM public.classes child
LEFT JOIN public.classes parent ON parent.id = child.parent_id
ORDER BY child.id;

-- 3. Conteo por raza y tier (solo evoluciones)
SELECT race_restriction, tier, COUNT(*)
FROM public.classes
WHERE tier > 0
GROUP BY race_restriction, tier
ORDER BY race_restriction, tier;

-- 4. Quests evolution
SELECT id, title, type, min_level, requirements
FROM public.quests
WHERE type = 'evolution'
ORDER BY min_level;

-- 5. Jugadores con su clase actual
SELECT p.username, p.level, p.class_id, c.name AS class_name, c.tier, c.race_restriction
FROM public.players p
LEFT JOIN public.classes c ON c.id = p.class_id
ORDER BY p.username;
