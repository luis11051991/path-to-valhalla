ALTER TABLE public.alliance_judgements
ADD COLUMN IF NOT EXISTS eligible_voters_count INTEGER NOT NULL DEFAULT 0;
