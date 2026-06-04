CREATE TABLE "user_favorites" (
  "user_id"    UUID NOT NULL,
  "camera_id"  UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "user_favorites_pkey" PRIMARY KEY ("user_id", "camera_id"),
  CONSTRAINT "user_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "user_favorites_camera_id_fkey" FOREIGN KEY ("camera_id") REFERENCES "cameras"("id") ON DELETE CASCADE
);
CREATE INDEX "idx_user_favorites_user" ON "user_favorites"("user_id");
