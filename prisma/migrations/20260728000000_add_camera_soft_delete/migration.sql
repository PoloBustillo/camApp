-- Soft-delete cameras so recordings can keep their FK (ON DELETE NO ACTION)
ALTER TABLE "cameras" ADD COLUMN "deleted_at" TIMESTAMPTZ;

CREATE INDEX "idx_cameras_deleted_at" ON "cameras"("deleted_at");
