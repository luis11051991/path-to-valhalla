-- Add extra entries column for purchased dungeon entries
ALTER TABLE public.players
ADD COLUMN IF NOT EXISTS dungeon_extra_entries INT NOT NULL DEFAULT 0;
