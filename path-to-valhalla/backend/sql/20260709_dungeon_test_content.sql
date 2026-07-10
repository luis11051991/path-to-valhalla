BEGIN;

-- ============================================================
-- DUNGEON TEST CONTENT — Enemigos simbólicos, drops, imágenes
-- Idempotente: se puede ejecutar varias veces sin duplicar
-- ============================================================

-- 1. Enemigos simbólicos de mazmorra (para zone_id = 1)
INSERT INTO public.enemies (zone_id, name, image_url, is_boss, min_level, max_level, hp_min, hp_max, damage_min, damage_max, armor, crit_chance, block_chance, difficulty_tier, description)
SELECT 1, 'Esqueleto Guardián', '/icons/enemies/dungeon_skeleton.png', false, 8, 12, 60, 90, 8, 14, 4, 5.0, 2.0, 1, 'Un esqueleto reanimado que patrulla las criptas.'
WHERE NOT EXISTS (SELECT 1 FROM public.enemies WHERE name = 'Esqueleto Guardián' AND zone_id = 1);

INSERT INTO public.enemies (zone_id, name, image_url, is_boss, min_level, max_level, hp_min, hp_max, damage_min, damage_max, armor, crit_chance, block_chance, difficulty_tier, description)
SELECT 1, 'Araña de Cripta', '/icons/enemies/dungeon_spider.png', false, 8, 12, 40, 70, 10, 18, 2, 8.0, 1.0, 1, 'Una araña enorme que teje telarañas entre los sarcófagos.'
WHERE NOT EXISTS (SELECT 1 FROM public.enemies WHERE name = 'Araña de Cripta' AND zone_id = 1);

INSERT INTO public.enemies (zone_id, name, image_url, is_boss, min_level, max_level, hp_min, hp_max, damage_min, damage_max, armor, crit_chance, block_chance, difficulty_tier, description)
SELECT 1, 'Guerrero Esquelético', '/icons/enemies/dungeon_skeleton.png', false, 10, 15, 80, 120, 12, 20, 6, 5.0, 4.0, 2, 'Un guerrero esquelético que empuña una espada oxidada.'
WHERE NOT EXISTS (SELECT 1 FROM public.enemies WHERE name = 'Guerrero Esquelético' AND zone_id = 1);

INSERT INTO public.enemies (zone_id, name, image_url, is_boss, min_level, max_level, hp_min, hp_max, damage_min, damage_max, armor, crit_chance, block_chance, difficulty_tier, description)
SELECT 1, 'Espectro Gemebundo', '/icons/enemies/dungeon_spider.png', false, 10, 15, 50, 80, 14, 22, 1, 12.0, 0.0, 2, 'Un alma en pena que atraviesa las paredes.'
WHERE NOT EXISTS (SELECT 1 FROM public.enemies WHERE name = 'Espectro Gemebundo' AND zone_id = 1);

INSERT INTO public.enemies (zone_id, name, image_url, is_boss, min_level, max_level, hp_min, hp_max, damage_min, damage_max, armor, crit_chance, block_chance, difficulty_tier, description)
SELECT 1, 'Guardahuesos', '/icons/enemies/dungeon_bone_guardian.png', false, 12, 18, 100, 150, 15, 25, 10, 4.0, 6.0, 3, 'Un constructo de huesos que protege las cámaras internas.'
WHERE NOT EXISTS (SELECT 1 FROM public.enemies WHERE name = 'Guardahuesos' AND zone_id = 1);

INSERT INTO public.enemies (zone_id, name, image_url, is_boss, min_level, max_level, hp_min, hp_max, damage_min, damage_max, armor, crit_chance, block_chance, difficulty_tier, description)
SELECT 1, 'Nigromante Menor', '/icons/enemies/dungeon_crypt_lord.png', false, 12, 18, 70, 100, 18, 30, 3, 10.0, 2.0, 3, 'Un nigromante enano que invoca esqueletos desde las sombras.'
WHERE NOT EXISTS (SELECT 1 FROM public.enemies WHERE name = 'Nigromante Menor' AND zone_id = 1);

INSERT INTO public.enemies (zone_id, name, image_url, is_boss, min_level, max_level, hp_min, hp_max, damage_min, damage_max, armor, crit_chance, block_chance, difficulty_tier, description)
SELECT 1, 'Señor de la Cripta', '/icons/enemies/dungeon_crypt_lord.png', true, 15, 20, 300, 400, 22, 38, 15, 10.0, 8.0, 3, 'El maestro de la cripta, un poderoso liche que comanda a los no-muertos.'
WHERE NOT EXISTS (SELECT 1 FROM public.enemies WHERE name = 'Señor de la Cripta' AND zone_id = 1);

-- 2. Drops simbólicos usando items existentes si existen
INSERT INTO public.enemy_drops (enemy_id, item_template_id, drop_chance, min_quantity, max_quantity)
SELECT e.id, it.id, 25.0, 1, 1
FROM public.enemies e
CROSS JOIN public.items_templates it
WHERE e.name = 'Esqueleto Guardián' AND e.zone_id = 1
  AND it.name ILIKE '%hueso%'
  AND NOT EXISTS (SELECT 1 FROM public.enemy_drops WHERE enemy_id = e.id AND item_template_id = it.id);

INSERT INTO public.enemy_drops (enemy_id, item_template_id, drop_chance, min_quantity, max_quantity)
SELECT e.id, it.id, 15.0, 1, 1
FROM public.enemies e
CROSS JOIN public.items_templates it
WHERE e.name = 'Señor de la Cripta' AND e.zone_id = 1
  AND it.rarity IN ('rare', 'epic')
  AND NOT EXISTS (SELECT 1 FROM public.enemy_drops WHERE enemy_id = e.id AND item_template_id = it.id)
LIMIT 2;

-- 3. Actualizar image_url de dungeon_types (temporal)
UPDATE public.dungeon_types
SET image_url = '/icons/dungeons/test_crypt.png'
WHERE image_url IS NULL AND name IN ('Catacumbas Olvidadas', 'Cripta de Prueba');

COMMIT;
