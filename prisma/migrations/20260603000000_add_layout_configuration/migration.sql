-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'layout_duplicated';

-- AlterTable
ALTER TABLE "layouts" ADD COLUMN "configuration" JSONB;
