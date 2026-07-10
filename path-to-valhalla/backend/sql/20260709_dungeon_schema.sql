BEGIN;

-- ============================================================
-- SISTEMA DE MAZMORRAS V1 — Esquema completo (10 tablas)
-- ============================================================

-- 1. Tipos de mazmorra (referencia zonas/expediciones para pools de enemigos)
CREATE TABLE IF NOT EXISTS public.dungeon_types (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    zone_id BIGINT NOT NULL REFERENCES public.expeditions(id) ON DELETE CASCADE,
    min_level INT NOT NULL DEFAULT 1,
    image_url VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Salas de mazmorra (lobbies)
CREATE TABLE IF NOT EXISTS public.dungeon_rooms (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(6) NOT NULL,
    dungeon_type_id BIGINT NOT NULL REFERENCES public.dungeon_types(id) ON DELETE CASCADE,
    difficulty VARCHAR(20) NOT NULL DEFAULT 'normal',
    party_size INT NOT NULL DEFAULT 3,
    status VARCHAR(20) NOT NULL DEFAULT 'waiting',
    is_public BOOLEAN DEFAULT true,
    created_by UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    CONSTRAINT uq_dungeon_rooms_code UNIQUE (code),
    CONSTRAINT chk_dungeon_rooms_party_size CHECK (party_size IN (3, 4, 5)),
    CONSTRAINT chk_dungeon_rooms_difficulty CHECK (difficulty IN ('easy', 'normal', 'hard', 'inferno')),
    CONSTRAINT chk_dungeon_rooms_status CHECK (status IN ('waiting', 'ready', 'in_progress', 'completed', 'failed', 'expired', 'cancelled'))
);

-- 3. Miembros de sala
CREATE TABLE IF NOT EXISTS public.dungeon_room_members (
    id BIGSERIAL PRIMARY KEY,
    room_id BIGINT NOT NULL REFERENCES public.dungeon_rooms(id) ON DELETE CASCADE,
    player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
    is_npc BOOLEAN DEFAULT false,
    npc_level INT,
    is_ready BOOLEAN DEFAULT false,
    is_master BOOLEAN DEFAULT false,
    joined_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_dungeon_room_members_room_player UNIQUE (room_id, player_id),
    CONSTRAINT chk_npc_or_player CHECK (
        (is_npc = true AND player_id IS NULL) OR
        (is_npc = false AND player_id IS NOT NULL)
    )
);

-- 4. Ejecuciones de mazmorra
CREATE TABLE IF NOT EXISTS public.dungeon_runs (
    id BIGSERIAL PRIMARY KEY,
    room_id BIGINT NOT NULL REFERENCES public.dungeon_rooms(id) ON DELETE CASCADE,
    dungeon_type_id BIGINT NOT NULL REFERENCES public.dungeon_types(id),
    difficulty VARCHAR(20) NOT NULL,
    total_rooms INT NOT NULL,
    current_room_number INT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    started_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    CONSTRAINT chk_dungeon_runs_status CHECK (status IN ('active', 'completed', 'failed'))
);

-- 5. Miembros de ejecución
CREATE TABLE IF NOT EXISTS public.dungeon_run_members (
    id BIGSERIAL PRIMARY KEY,
    run_id BIGINT NOT NULL REFERENCES public.dungeon_runs(id) ON DELETE CASCADE,
    player_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
    is_npc BOOLEAN DEFAULT false,
    npc_level INT,
    initial_hp INT,
    final_hp INT,
    status VARCHAR(20) NOT NULL DEFAULT 'alive',
    damage_dealt INT DEFAULT 0,
    healing_done INT DEFAULT 0,
    CONSTRAINT chk_dungeon_run_members_status CHECK (status IN ('alive', 'dead', 'escaped'))
);

-- 6. Salas de la mazmorra (una por habitáculo en V1)
CREATE TABLE IF NOT EXISTS public.dungeon_room_stages (
    id BIGSERIAL PRIMARY KEY,
    run_id BIGINT NOT NULL REFERENCES public.dungeon_runs(id) ON DELETE CASCADE,
    room_number INT NOT NULL,
    stage_number INT NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    CONSTRAINT chk_dungeon_room_stages_status CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
    CONSTRAINT uq_dungeon_room_stages UNIQUE (run_id, room_number, stage_number)
);

-- 7. Enemigos de cada sala
CREATE TABLE IF NOT EXISTS public.dungeon_stage_enemies (
    id BIGSERIAL PRIMARY KEY,
    stage_id BIGINT NOT NULL REFERENCES public.dungeon_room_stages(id) ON DELETE CASCADE,
    enemy_template_id BIGINT REFERENCES public.enemies(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    level INT NOT NULL,
    hp_max INT NOT NULL,
    hp_current INT NOT NULL,
    damage_min INT NOT NULL DEFAULT 1,
    damage_max INT NOT NULL DEFAULT 1,
    armor INT NOT NULL DEFAULT 0,
    crit_chance DECIMAL(5,2) DEFAULT 0,
    block_chance DECIMAL(5,2) DEFAULT 0,
    is_boss BOOLEAN DEFAULT false,
    is_elite BOOLEAN DEFAULT false,
    is_defeated BOOLEAN DEFAULT false,
    image_url VARCHAR(500)
);

-- 8. Recompensas de sala
CREATE TABLE IF NOT EXISTS public.dungeon_stage_rewards (
    id BIGSERIAL PRIMARY KEY,
    stage_id BIGINT NOT NULL REFERENCES public.dungeon_room_stages(id) ON DELETE CASCADE,
    xp_total INT NOT NULL DEFAULT 0,
    copper_total INT NOT NULL DEFAULT 0,
    items_json JSONB DEFAULT '[]'::jsonb,
    distributed BOOLEAN DEFAULT false,
    distributed_at TIMESTAMPTZ
);

-- 9. Tiradas de botín (sistema de codicia para objetos raros+)
CREATE TABLE IF NOT EXISTS public.dungeon_loot_rolls (
    id BIGSERIAL PRIMARY KEY,
    run_id BIGINT NOT NULL REFERENCES public.dungeon_runs(id) ON DELETE CASCADE,
    stage_id BIGINT REFERENCES public.dungeon_room_stages(id) ON DELETE SET NULL,
    item_template_id BIGINT REFERENCES public.items_templates(id) ON DELETE SET NULL,
    item_name VARCHAR(100) NOT NULL,
    item_rarity VARCHAR(20) NOT NULL,
    rolls JSONB DEFAULT '[]'::jsonb,
    winner_player_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
    resolved BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMPTZ
);

-- 10. Historial de combate
CREATE TABLE IF NOT EXISTS public.dungeon_run_log (
    id BIGSERIAL PRIMARY KEY,
    run_id BIGINT NOT NULL REFERENCES public.dungeon_runs(id) ON DELETE CASCADE,
    stage_id BIGINT REFERENCES public.dungeon_room_stages(id) ON DELETE CASCADE,
    round_number INT DEFAULT 0,
    entry_type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_dungeon_rooms_status ON public.dungeon_rooms (status);
CREATE INDEX IF NOT EXISTS idx_dungeon_rooms_code ON public.dungeon_rooms (code);
CREATE INDEX IF NOT EXISTS idx_dungeon_rooms_created_by ON public.dungeon_rooms (created_by);
CREATE INDEX IF NOT EXISTS idx_dungeon_room_members_room ON public.dungeon_room_members (room_id);
CREATE INDEX IF NOT EXISTS idx_dungeon_room_members_player ON public.dungeon_room_members (player_id);
CREATE INDEX IF NOT EXISTS idx_dungeon_runs_room ON public.dungeon_runs (room_id);
CREATE INDEX IF NOT EXISTS idx_dungeon_runs_status ON public.dungeon_runs (status);
CREATE INDEX IF NOT EXISTS idx_dungeon_run_members_run ON public.dungeon_run_members (run_id);
CREATE INDEX IF NOT EXISTS idx_dungeon_room_stages_run ON public.dungeon_room_stages (run_id);
CREATE INDEX IF NOT EXISTS idx_dungeon_stage_enemies_stage ON public.dungeon_stage_enemies (stage_id);
CREATE INDEX IF NOT EXISTS idx_dungeon_stage_rewards_stage ON public.dungeon_stage_rewards (stage_id);
CREATE INDEX IF NOT EXISTS idx_dungeon_loot_rolls_run ON public.dungeon_loot_rolls (run_id);
CREATE INDEX IF NOT EXISTS idx_dungeon_run_log_run ON public.dungeon_run_log (run_id);
CREATE INDEX IF NOT EXISTS idx_dungeon_run_log_stage ON public.dungeon_run_log (stage_id);

-- ============================================================
-- SEED: Tipos de mazmorra por defecto
-- ============================================================
INSERT INTO public.dungeon_types (name, description, zone_id, min_level, image_url)
SELECT 'Catacumbas Olvidadas', 'Profundidades oscuras donde los no-muertos moran.', id, 1, NULL
FROM public.expeditions WHERE id = 1
AND NOT EXISTS (SELECT 1 FROM public.dungeon_types WHERE name = 'Catacumbas Olvidadas');

-- ============================================================
-- SEED: Mazmorra de prueba "Cripta de Prueba"
-- ============================================================
INSERT INTO public.dungeon_types (name, description, zone_id, min_level, image_url)
SELECT 'Cripta de Prueba', 'Una mazmorra básica para probar el sistema de salas, NPC, combate y recompensas.', id, 10, NULL
FROM public.expeditions WHERE id = 1
AND NOT EXISTS (SELECT 1 FROM public.dungeon_types WHERE name = 'Cripta de Prueba');

-- ============================================================
-- SEED: Sala pública de prueba (solo si existe al menos un jugador)
-- ============================================================
DO $$
DECLARE
    test_player_id UUID;
    test_room_id BIGINT;
    test_dungeon_type_id BIGINT;
    test_code VARCHAR(6);
BEGIN
    -- Obtener el primer jugador existente
    SELECT id INTO test_player_id FROM public.players ORDER BY created_at NULLS LAST LIMIT 1;

    IF test_player_id IS NULL THEN
        RAISE NOTICE 'No se creó sala de prueba porque no existen jugadores.';
        RETURN;
    END IF;

    -- Obtener el id del tipo de mazmorra de prueba
    SELECT id INTO test_dungeon_type_id FROM public.dungeon_types WHERE name = 'Cripta de Prueba' LIMIT 1;

    IF test_dungeon_type_id IS NULL THEN
        RAISE NOTICE 'No se creó sala de prueba porque no existe el tipo "Cripta de Prueba".';
        RETURN;
    END IF;

    -- Verificar si ya existe una sala activa del mismo tipo creada por este jugador
    IF EXISTS (
        SELECT 1 FROM public.dungeon_rooms
        WHERE dungeon_type_id = test_dungeon_type_id
          AND created_by = test_player_id
          AND status IN ('waiting', 'ready', 'in_progress')
    ) THEN
        RAISE NOTICE 'Ya existe una sala activa de "Cripta de Prueba" para este jugador.';
        RETURN;
    END IF;

    -- Generar código único de 6 caracteres
    test_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));

    -- Crear sala pública de prueba
    INSERT INTO public.dungeon_rooms (code, dungeon_type_id, difficulty, party_size, is_public, created_by, expires_at)
    VALUES (test_code, test_dungeon_type_id, 'normal', 3, true, test_player_id, NOW() + INTERVAL '2 hours')
    RETURNING id INTO test_room_id;

    -- Agregar al creador como miembro maestro
    INSERT INTO public.dungeon_room_members (room_id, player_id, is_npc, is_master, is_ready)
    VALUES (test_room_id, test_player_id, false, true, true);

    RAISE NOTICE 'Sala de prueba creada: código=%, room_id=%, master=%', test_code, test_room_id, test_player_id;
END $$;

COMMIT;
