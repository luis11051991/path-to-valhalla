BEGIN;

-- ============================================================
-- HOTFIX: access_password column for private rooms
-- Idempotente: ADD COLUMN IF NOT EXISTS
-- ============================================================
ALTER TABLE public.dungeon_rooms
ADD COLUMN IF NOT EXISTS access_password VARCHAR(100);

COMMIT;
