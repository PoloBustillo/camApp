-- Fix email unique constraint
-- Before: @@unique([email], name: "users_email_unique") → exposed as `users_email_unique` in Prisma where input
-- After:  @unique on field → exposed as `email` in Prisma where input (standard behavior)

-- Drop old named constraint and index
DROP INDEX IF EXISTS "users_email_unique";
DROP INDEX IF EXISTS "idx_users_email";

-- Create standard unique constraint (Prisma @unique convention: tablename_fieldname_key)
ALTER TABLE "users" ADD CONSTRAINT "users_email_key" UNIQUE ("email");
