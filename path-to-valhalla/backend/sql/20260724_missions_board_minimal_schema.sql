
-- ============================================================================
-- MISSIONS BOARD — MÍNIMO SCHEMA PARA BANCO DE MISIONES
-- 2026-07-24
--
-- Columnas nuevas en public.quests:
--   1. max_level  INTEGER NULL        — techo de nivel para la misión
--   2. zone_id    INTEGER NULL        — FK → expeditions(id), misión de zona
--   3. weight     INTEGER NOT NULL DEFAULT 100 — peso para selección aleatoria en tablón
--
-- IDEMPOTENTE:
--   - ADD COLUMN IF NOT EXISTS
--   - FK constraint con verificación previa
--   - CREATE INDEX IF NOT EXISTS
--   - No DELETE, DROP, TRUNCATE
--   - No toca datos existentes
-- ============================================================================

-- ============================================================================
-- 1. max_level — límite superior de nivel
--    Sirve para que una misión desaparezca del tablón cuando el jugador
--    supera cierto nivel. Permite control por banda de nivel
--    (ej. solo visible entre min_level=11 y max_level=20).
--    NULL = sin límite superior.
-- ============================================================================
ALTER TABLE public.quests
  ADD COLUMN IF NOT EXISTS max_level INTEGER;

-- ============================================================================
-- 2. zone_id — opcional, asocia la misión a una zona/expedición específica
--    Sirve para filtrar misiones que solo se completan en cierta zona.
--    NULL = cualquier zona.
-- ============================================================================
ALTER TABLE public.quests
  ADD COLUMN IF NOT EXISTS zone_id INTEGER;

-- La FK se agrega con DO para evitar error si la columna ya existe pero la
-- constraint no se creó todavía (ej. ejecución parcial previa).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'quests_zone_id_fkey'
      AND conrelid = 'public.quests'::regclass
  ) THEN
    ALTER TABLE public.quests
      ADD CONSTRAINT quests_zone_id_fkey
      FOREIGN KEY (zone_id) REFERENCES public.expeditions(id)
      ON DELETE SET NULL;
  END IF;
END;
$$;

-- ============================================================================
-- 3. weight — peso relativo para selección aleatoria en tablón
--    Cuando el backend elija 6 misiones, weight puede sesgar la
--    probabilidad de aparición. Valor por defecto 100 = neutro.
--    Valores mayores aparecen con más frecuencia; menores, con menos.
--    El backend usará: ORDER BY (-LOG(RANDOM()) / weight) LIMIT 6
--    (método alias o weighted random selection).
-- ============================================================================
ALTER TABLE public.quests
  ADD COLUMN IF NOT EXISTS weight INTEGER NOT NULL DEFAULT 100;

-- ============================================================================
-- 4. ÍNDICES RECOMENDADOS
-- ============================================================================

-- 4a. Índice compuesto por (type, min_level, max_level)
--     Útil para filtrar misiones del tablón:
--     WHERE type IN ('side','daily','weekly')
--       AND min_level <= $player_level
--       AND (max_level IS NULL OR max_level >= $player_level)
--     Cubre el filtro principal de selección de misiones.
CREATE INDEX IF NOT EXISTS idx_quests_type_level_range
  ON public.quests (type, min_level, max_level);

-- 4b. Índice por zone_id
--     Útil para filtrar misiones de zona cuando se implemente
--     el tablón por zona o expedición.
CREATE INDEX IF NOT EXISTS idx_quests_zone_id
  ON public.quests (zone_id);

-- 4c. Índice por weight — NO SE CREA
--     Motivo: la columna weight se usará en una expresión de
--     selección aleatoria ponderada. En ese contexto, un índice
--     b-tree sobre weight no aporta beneficio porque la query
--     escanea el conjunto ya filtrado por type/rango de nivel
--     (unas decenas o cientos de filas) y aplica ORDER BY RANDOM()
--     o la expresión weight. Un índice aquí no aceleraría la
--     selección y agregaría overhead en INSERT/UPDATE.
--     Si en el futuro se necesitan consultas como
--     "todas las misiones con weight > 500", entonces sí valdría
--     la pena crearlo.

-- ============================================================================
-- VERIFICACIÓN (ejecutar después)
-- ============================================================================
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'quests'
-- ORDER BY ordinal_position;
