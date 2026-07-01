-- Fix email unique constraint (idempotent)
-- Prisma init creo un UNIQUE INDEX (no constraint) con el mismo nombre
-- Hay que dropearlo antes de crear la constraint para evitar conflicto
DROP INDEX IF EXISTS "users_email_key";
DROP INDEX IF EXISTS "users_email_unique";
DROP INDEX IF EXISTS "idx_users_email";

-- Add standard unique constraint only if it doesn't exist
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_email_key'
  ) THEN
    ALTER TABLE "users" ADD CONSTRAINT "users_email_key" UNIQUE ("email");
  END IF;
END $$;
