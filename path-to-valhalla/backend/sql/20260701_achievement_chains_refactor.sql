BEGIN;

ALTER TABLE IF EXISTS public.achievement_definitions
    ADD COLUMN IF NOT EXISTS max_phase INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS is_chain BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS chain_key VARCHAR(100),
    ADD COLUMN IF NOT EXISTS base_name VARCHAR(150);

ALTER TABLE IF EXISTS public.player_achievements
    ADD COLUMN IF NOT EXISTS current_phase INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS max_phase INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS is_completed BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.achievement_phases (
    id BIGSERIAL PRIMARY KEY,
    achievement_id BIGINT NOT NULL REFERENCES public.achievement_definitions(id) ON DELETE CASCADE,
    phase INTEGER NOT NULL,
    target INTEGER NOT NULL,
    points INTEGER NOT NULL DEFAULT 0,
    reward JSONB NOT NULL DEFAULT '{}'::jsonb,
    description TEXT,
    full_description TEXT,
    advice TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_achievement_phase UNIQUE (achievement_id, phase),
    CONSTRAINT chk_achievement_phase_positive CHECK (phase > 0),
    CONSTRAINT chk_achievement_phase_target_positive CHECK (target > 0)
);

ALTER TABLE IF EXISTS public.achievement_claim_logs
    ADD COLUMN IF NOT EXISTS phase INTEGER NOT NULL DEFAULT 1;

DO $$
DECLARE
    constraint_to_drop TEXT;
BEGIN
    FOR constraint_to_drop IN
        SELECT c.conname
        FROM pg_constraint c
        WHERE c.conrelid = 'public.achievement_claim_logs'::regclass
          AND c.contype = 'u'
          AND (
              SELECT array_agg(a.attname::text ORDER BY key_column.ord)
              FROM unnest(c.conkey) WITH ORDINALITY AS key_column(attnum, ord)
              JOIN pg_attribute a
                ON a.attrelid = c.conrelid
               AND a.attnum = key_column.attnum
          ) = ARRAY['player_id', 'achievement_id']
    LOOP
        EXECUTE format('ALTER TABLE public.achievement_claim_logs DROP CONSTRAINT %I', constraint_to_drop);
    END LOOP;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        WHERE c.conrelid = 'public.achievement_claim_logs'::regclass
          AND c.contype = 'u'
          AND (
              SELECT array_agg(a.attname::text ORDER BY key_column.ord)
              FROM unnest(c.conkey) WITH ORDINALITY AS key_column(attnum, ord)
              JOIN pg_attribute a
                ON a.attrelid = c.conrelid
               AND a.attnum = key_column.attnum
          ) = ARRAY['player_id', 'achievement_id', 'phase']
    ) THEN
        ALTER TABLE public.achievement_claim_logs
            ADD CONSTRAINT uq_achievement_claim_phase UNIQUE (player_id, achievement_id, phase);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_achievement_phases_achievement_phase
    ON public.achievement_phases (achievement_id, phase);

CREATE INDEX IF NOT EXISTS idx_player_achievements_player_status
    ON public.player_achievements (player_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS ux_achievement_definitions_season_chain_key
    ON public.achievement_definitions (season_code, chain_key)
    WHERE chain_key IS NOT NULL;

TRUNCATE public.achievement_claim_logs RESTART IDENTITY CASCADE;
TRUNCATE public.player_achievements RESTART IDENTITY CASCADE;
TRUNCATE public.achievement_phases RESTART IDENTITY CASCADE;
TRUNCATE public.achievement_definitions RESTART IDENTITY CASCADE;

CREATE TEMP TABLE _achievement_seed (
    code TEXT NOT NULL,
    chain_key TEXT NOT NULL,
    base_name TEXT NOT NULL,
    category TEXT NOT NULL,
    rarity TEXT NOT NULL,
    description TEXT NOT NULL,
    full_description TEXT NOT NULL,
    event_type TEXT NOT NULL,
    conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_secret BOOLEAN NOT NULL DEFAULT false,
    is_hidden_until_unlocked BOOLEAN NOT NULL DEFAULT false,
    advice TEXT,
    route_labels JSONB NOT NULL DEFAULT '[]'::jsonb,
    sort_order INTEGER NOT NULL,
    phases JSONB NOT NULL
) ON COMMIT DROP;

INSERT INTO _achievement_seed
    (code, chain_key, base_name, category, rarity, description, full_description, event_type, conditions, is_secret, is_hidden_until_unlocked, advice, route_labels, sort_order, phases)
VALUES
(
    's01-combat-kill-any',
    'combat_kill_any',
    'Cazador de Valhallus',
    'Combate',
    'Común',
    'Derrota criaturas en expediciones.',
    'Derrota criaturas en expediciones durante la temporada S01.',
    'combat.kill',
    '{"source":"expedition"}'::jsonb,
    false,
    false,
    'Derrota criaturas en Expediciones para avanzar este logro.',
    '["Ver Expediciones"]'::jsonb,
    1000,
    '[
        {"phase":1,"target":10,"points":10,"reward":{"copper":20}},
        {"phase":2,"target":20,"points":15,"reward":{"copper":50}},
        {"phase":3,"target":40,"points":25,"reward":{"silver":1}},
        {"phase":4,"target":80,"points":40,"reward":{"silver":2}},
        {"phase":5,"target":160,"points":60,"reward":{"silver":5}},
        {"phase":6,"target":320,"points":85,"reward":{"silver":10}},
        {"phase":7,"target":640,"points":110,"reward":{"silver":25}},
        {"phase":8,"target":1000,"points":150,"reward":{"silver":50}},
        {"phase":9,"target":1500,"points":200,"reward":{"gold":1}},
        {"phase":10,"target":2500,"points":300,"reward":{"gold":3,"title":"Cazador de Temporada"}}
    ]'::jsonb
),
(
    's01-combat-kill-boss',
    'combat_kill_boss',
    'Rompejefes',
    'Combate',
    'Común',
    'Derrota jefes de expedición.',
    'Derrota jefes de expedición durante la temporada S01.',
    'combat.kill.boss',
    '{"source":"expedition","isBoss":true}'::jsonb,
    false,
    false,
    'Busca enemigos marcados como jefe en Expediciones.',
    '["Ver Expediciones"]'::jsonb,
    1100,
    '[
        {"phase":1,"target":1,"points":15,"reward":{"silver":1}},
        {"phase":2,"target":3,"points":20,"reward":{"silver":3}},
        {"phase":3,"target":5,"points":35,"reward":{"silver":5}},
        {"phase":4,"target":10,"points":50,"reward":{"silver":10}},
        {"phase":5,"target":20,"points":75,"reward":{"silver":20}},
        {"phase":6,"target":35,"points":100,"reward":{"silver":50}},
        {"phase":7,"target":50,"points":130,"reward":{"gold":1}},
        {"phase":8,"target":75,"points":170,"reward":{"gold":2}},
        {"phase":9,"target":100,"points":220,"reward":{"gold":5}},
        {"phase":10,"target":150,"points":320,"reward":{"gold":10,"title":"Azote de Jefes"}}
    ]'::jsonb
),
(
    's01-combat-kill-hidden',
    'combat_kill_hidden',
    'Cazador de Sombras',
    'Secretos',
    'Raro',
    'Derrota criaturas ocultas.',
    'Derrota criaturas ocultas durante la temporada S01.',
    'combat.kill.hidden',
    '{"source":"expedition","isHidden":true}'::jsonb,
    true,
    true,
    'Explora zonas raras y derrota criaturas ocultas.',
    '["Ver Expediciones","Ir a Bestiario"]'::jsonb,
    1200,
    '[
        {"phase":1,"target":1,"points":25,"reward":{"silver":2}},
        {"phase":2,"target":3,"points":40,"reward":{"silver":5}},
        {"phase":3,"target":5,"points":60,"reward":{"silver":10}},
        {"phase":4,"target":10,"points":90,"reward":{"silver":20}},
        {"phase":5,"target":20,"points":120,"reward":{"silver":50}},
        {"phase":6,"target":30,"points":150,"reward":{"gold":1}},
        {"phase":7,"target":50,"points":190,"reward":{"gold":2}},
        {"phase":8,"target":75,"points":230,"reward":{"gold":4}},
        {"phase":9,"target":100,"points":280,"reward":{"gold":7}},
        {"phase":10,"target":150,"points":380,"reward":{"gold":10,"onix":1,"title":"Cazador de lo Oculto"}}
    ]'::jsonb
),
(
    's01-combat-kill-tier1',
    'combat_kill_tier1',
    'Cazador de Criaturas Comunes',
    'Combate',
    'Común',
    'Derrota criaturas comunes.',
    'Derrota criaturas comunes de expedición durante la temporada S01.',
    'combat.kill.difficulty',
    '{"source":"expedition","difficultyTier":1}'::jsonb,
    false,
    false,
    'Derrota enemigos de dificultad común en Expediciones.',
    '["Ver Expediciones"]'::jsonb,
    2100,
    '[
        {"phase":1,"target":10,"points":10,"reward":{"copper":25}},
        {"phase":2,"target":20,"points":15,"reward":{"copper":60}},
        {"phase":3,"target":40,"points":25,"reward":{"silver":1}},
        {"phase":4,"target":80,"points":40,"reward":{"silver":3}},
        {"phase":5,"target":160,"points":60,"reward":{"silver":8}}
    ]'::jsonb
),
(
    's01-combat-kill-tier2',
    'combat_kill_tier2',
    'Cazador de Criaturas Raras',
    'Combate',
    'Raro',
    'Derrota criaturas raras.',
    'Derrota criaturas raras de expedición durante la temporada S01.',
    'combat.kill.difficulty',
    '{"source":"expedition","difficultyTier":2}'::jsonb,
    false,
    false,
    'Derrota enemigos de dificultad rara en Expediciones.',
    '["Ver Expediciones"]'::jsonb,
    2200,
    '[
        {"phase":1,"target":5,"points":20,"reward":{"silver":1}},
        {"phase":2,"target":10,"points":30,"reward":{"silver":2}},
        {"phase":3,"target":20,"points":45,"reward":{"silver":5}},
        {"phase":4,"target":40,"points":70,"reward":{"silver":10}},
        {"phase":5,"target":80,"points":100,"reward":{"silver":25}}
    ]'::jsonb
),
(
    's01-combat-kill-tier3',
    'combat_kill_tier3',
    'Cazador de Criaturas Legendarias',
    'Combate',
    'Legendario',
    'Derrota criaturas legendarias.',
    'Derrota criaturas legendarias de expedición durante la temporada S01.',
    'combat.kill.difficulty',
    '{"source":"expedition","difficultyTier":3}'::jsonb,
    false,
    false,
    'Derrota enemigos de dificultad legendaria en Expediciones.',
    '["Ver Expediciones"]'::jsonb,
    2300,
    '[
        {"phase":1,"target":1,"points":40,"reward":{"silver":3}},
        {"phase":2,"target":3,"points":60,"reward":{"silver":7}},
        {"phase":3,"target":5,"points":80,"reward":{"silver":15}},
        {"phase":4,"target":10,"points":110,"reward":{"silver":30}},
        {"phase":5,"target":20,"points":150,"reward":{"gold":1}}
    ]'::jsonb
),
(
    's01-expedition-complete',
    'expedition_complete',
    'Explorador de Valhallus',
    'Expediciones',
    'Común',
    'Completa expediciones.',
    'Completa expediciones durante la temporada S01.',
    'expedition.complete',
    '{"source":"expedition"}'::jsonb,
    false,
    false,
    'Completa combates victoriosos en Expediciones.',
    '["Ver Expediciones"]'::jsonb,
    3000,
    '[
        {"phase":1,"target":1,"points":5,"reward":{"copper":30}},
        {"phase":2,"target":5,"points":10,"reward":{"copper":75}},
        {"phase":3,"target":10,"points":15,"reward":{"silver":1}},
        {"phase":4,"target":25,"points":30,"reward":{"silver":3}},
        {"phase":5,"target":50,"points":45,"reward":{"silver":8}},
        {"phase":6,"target":100,"points":70,"reward":{"silver":15}},
        {"phase":7,"target":200,"points":95,"reward":{"silver":30}},
        {"phase":8,"target":350,"points":130,"reward":{"silver":60}},
        {"phase":9,"target":500,"points":180,"reward":{"gold":1}},
        {"phase":10,"target":750,"points":260,"reward":{"gold":3,"title":"Viajero Incansable"}}
    ]'::jsonb
),
(
    's01-bestiary-discover',
    'bestiary_discover',
    'Cronista de Bestias',
    'Bestiario',
    'Común',
    'Descubre criaturas del bestiario.',
    'Descubre nuevas criaturas en el bestiario durante la temporada S01.',
    'bestiary.discover',
    '{}'::jsonb,
    false,
    false,
    'Derrota criaturas nuevas para registrarlas en el Bestiario.',
    '["Ir a Bestiario","Ver Expediciones"]'::jsonb,
    4000,
    '[
        {"phase":1,"target":1,"points":5,"reward":{"copper":50}},
        {"phase":2,"target":3,"points":10,"reward":{"silver":1}},
        {"phase":3,"target":5,"points":15,"reward":{"silver":2}},
        {"phase":4,"target":10,"points":30,"reward":{"silver":5}},
        {"phase":5,"target":15,"points":45,"reward":{"silver":10}},
        {"phase":6,"target":20,"points":70,"reward":{"silver":20}},
        {"phase":7,"target":30,"points":95,"reward":{"silver":40}},
        {"phase":8,"target":40,"points":130,"reward":{"gold":1}},
        {"phase":9,"target":50,"points":180,"reward":{"gold":2}},
        {"phase":10,"target":60,"points":260,"reward":{"gold":5,"title":"Sabio del Bestiario"}}
    ]'::jsonb
),
(
    's01-economy-copper-earned',
    'economy_copper_earned',
    'Bolsa del Vigía',
    'Economía',
    'Común',
    'Gana cobre.',
    'Gana cobre desde recompensas de la temporada S01.',
    'economy.copper_earned',
    '{}'::jsonb,
    false,
    false,
    'Completa expediciones y misiones para ganar cobre.',
    '["Ver Expediciones"]'::jsonb,
    5000,
    '[
        {"phase":1,"target":100,"points":5,"reward":{"copper":25}},
        {"phase":2,"target":500,"points":10,"reward":{"copper":50}},
        {"phase":3,"target":1000,"points":15,"reward":{"silver":1}},
        {"phase":4,"target":2500,"points":30,"reward":{"silver":2}},
        {"phase":5,"target":5000,"points":45,"reward":{"silver":5}},
        {"phase":6,"target":10000,"points":70,"reward":{"silver":10}},
        {"phase":7,"target":25000,"points":95,"reward":{"silver":20}},
        {"phase":8,"target":50000,"points":130,"reward":{"silver":50}},
        {"phase":9,"target":100000,"points":180,"reward":{"gold":1}},
        {"phase":10,"target":250000,"points":260,"reward":{"gold":2,"title":"Amasador de Fortuna"}}
    ]'::jsonb
),
(
    's01-economy-gold-earned',
    'economy_gold_earned',
    'Tesoro de Valhallus',
    'Economía',
    'Raro',
    'Gana oro.',
    'Gana oro desde recompensas de la temporada S01.',
    'economy.gold_earned',
    '{}'::jsonb,
    false,
    false,
    'Completa misiones con recompensa de oro para avanzar.',
    '[]'::jsonb,
    5100,
    '[
        {"phase":1,"target":1,"points":5,"reward":{"silver":1}},
        {"phase":2,"target":3,"points":10,"reward":{"silver":2}},
        {"phase":3,"target":5,"points":20,"reward":{"silver":5}},
        {"phase":4,"target":10,"points":35,"reward":{"silver":10}},
        {"phase":5,"target":20,"points":55,"reward":{"silver":20}},
        {"phase":6,"target":35,"points":80,"reward":{"silver":40}},
        {"phase":7,"target":50,"points":110,"reward":{"silver":60}},
        {"phase":8,"target":75,"points":150,"reward":{"gold":1}},
        {"phase":9,"target":100,"points":210,"reward":{"gold":2}},
        {"phase":10,"target":150,"points":300,"reward":{"gold":3,"title":"Señor del Oro"}}
    ]'::jsonb
),
(
    's01-economy-onix-earned',
    'economy_onix_earned',
    'Brillo de Ónix',
    'Economía',
    'Raro',
    'Gana Ónix.',
    'Gana Ónix desde recompensas de la temporada S01.',
    'economy.onix_earned',
    '{}'::jsonb,
    false,
    false,
    'Completa actividades que entreguen Ónix.',
    '[]'::jsonb,
    5200,
    '[
        {"phase":1,"target":1,"points":20,"reward":{"silver":5}},
        {"phase":2,"target":3,"points":35,"reward":{"silver":10}},
        {"phase":3,"target":5,"points":55,"reward":{"silver":25}},
        {"phase":4,"target":10,"points":80,"reward":{"gold":1}},
        {"phase":5,"target":20,"points":120,"reward":{"gold":2,"onix":1,"title":"Marcado por el Ónix"}}
    ]'::jsonb
),
(
    's01-quest-complete',
    'quest_complete',
    'Servidor del Salón',
    'Expediciones',
    'Común',
    'Completa misiones del Salón.',
    'Completa misiones del Salón de Valhallus durante la temporada S01.',
    'quest.complete',
    '{}'::jsonb,
    false,
    false,
    'Acepta y completa contratos del Salón de Valhallus.',
    '[]'::jsonb,
    6000,
    '[
        {"phase":1,"target":1,"points":5,"reward":{"copper":50}},
        {"phase":2,"target":3,"points":10,"reward":{"silver":1}},
        {"phase":3,"target":5,"points":15,"reward":{"silver":2}},
        {"phase":4,"target":10,"points":30,"reward":{"silver":5}},
        {"phase":5,"target":20,"points":45,"reward":{"silver":10}},
        {"phase":6,"target":35,"points":70,"reward":{"silver":20}},
        {"phase":7,"target":50,"points":95,"reward":{"silver":40}},
        {"phase":8,"target":75,"points":130,"reward":{"gold":1}},
        {"phase":9,"target":100,"points":180,"reward":{"gold":2}},
        {"phase":10,"target":150,"points":260,"reward":{"gold":4,"title":"Campeón del Salón"}}
    ]'::jsonb
),
(
    's01-grimoire-equip',
    'grimoire_equip',
    'Aprendiz del Grimorio',
    'Grimorio',
    'Común',
    'Equipa poderes diferentes.',
    'Equipa poderes diferentes en tu barra de batalla.',
    'grimoire.equip',
    '{}'::jsonb,
    false,
    false,
    'Equipa poderes desde el Grimorio.',
    '["Ir a Grimorio"]'::jsonb,
    7000,
    '[
        {"phase":1,"target":3,"points":15,"reward":{"silver":2}}
    ]'::jsonb
),
(
    's01-grimoire-upgrade',
    'grimoire_upgrade',
    'Maestro del Grimorio',
    'Grimorio',
    'Raro',
    'Mejora poderes del Grimorio.',
    'Mejora poderes del Grimorio durante la temporada S01.',
    'grimoire.upgrade',
    '{}'::jsonb,
    false,
    false,
    'Mejora habilidades desde el Grimorio.',
    '["Ir a Grimorio"]'::jsonb,
    7100,
    '[
        {"phase":1,"target":10,"points":30,"reward":{"silver":10,"title":"Tejedor de Runas"}}
    ]'::jsonb
),
(
    's01-pet-feed',
    'pet_feed',
    'Compañero Fiel',
    'Mascotas',
    'Común',
    'Cuida a tus mascotas.',
    'Cuida a tus mascotas durante la temporada S01.',
    'pet.feed',
    '{}'::jsonb,
    false,
    false,
    'Alimenta mascotas desde el panel de héroe.',
    '["Ir a Mascotas"]'::jsonb,
    8000,
    '[
        {"phase":1,"target":5,"points":10,"reward":{"copper":75,"item":"3 carnes selectas"}}
    ]'::jsonb
),
(
    's01-pet-unlock',
    'pet_unlock',
    'Domador de Valhallus',
    'Mascotas',
    'Épico',
    'Desbloquea mascotas.',
    'Consigue mascotas diferentes durante la temporada S01.',
    'pet.unlock',
    '{}'::jsonb,
    false,
    false,
    'Consigue mascotas en recompensas o sistemas especiales.',
    '["Ir a Mascotas","Ver Expediciones"]'::jsonb,
    8100,
    '[
        {"phase":1,"target":4,"points":40,"reward":{"gold":1,"title":"Domador de Valhallus"}}
    ]'::jsonb
);

WITH inserted_definitions AS (
    INSERT INTO public.achievement_definitions (
        code,
        name,
        category,
        rarity,
        description,
        full_description,
        target,
        points,
        event_type,
        is_secret,
        is_hidden_until_unlocked,
        advice,
        route_labels,
        reward,
        is_active,
        season_code,
        phase,
        is_seasonal,
        conditions,
        sort_order,
        max_phase,
        is_chain,
        chain_key,
        base_name,
        created_at,
        updated_at
    )
    SELECT
        seed.code,
        seed.base_name,
        seed.category,
        seed.rarity,
        seed.description,
        seed.full_description,
        ((seed.phases -> 0) ->> 'target')::integer,
        ((seed.phases -> 0) ->> 'points')::integer,
        seed.event_type,
        seed.is_secret,
        seed.is_hidden_until_unlocked,
        seed.advice,
        seed.route_labels,
        COALESCE((seed.phases -> 0) -> 'reward', '{}'::jsonb),
        true,
        'S01',
        1,
        true,
        seed.conditions,
        seed.sort_order,
        jsonb_array_length(seed.phases),
        jsonb_array_length(seed.phases) > 1,
        seed.chain_key,
        seed.base_name,
        NOW(),
        NOW()
    FROM _achievement_seed seed
    RETURNING id, chain_key
)
INSERT INTO public.achievement_phases (
    achievement_id,
    phase,
    target,
    points,
    reward,
    description,
    full_description,
    advice,
    created_at,
    updated_at
)
SELECT
    inserted_definitions.id,
    (phase_data ->> 'phase')::integer,
    (phase_data ->> 'target')::integer,
    COALESCE((phase_data ->> 'points')::integer, 0),
    COALESCE(phase_data -> 'reward', '{}'::jsonb),
    phase_data ->> 'description',
    phase_data ->> 'full_description',
    phase_data ->> 'advice',
    NOW(),
    NOW()
FROM _achievement_seed seed
JOIN inserted_definitions
  ON inserted_definitions.chain_key = seed.chain_key
CROSS JOIN LATERAL jsonb_array_elements(seed.phases) AS phase_data;

COMMIT;
