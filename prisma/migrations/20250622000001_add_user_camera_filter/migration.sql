-- CreateTable
CREATE TABLE "user_camera_filter" (
    "user_id" UUID NOT NULL,
    "camera_id" UUID NOT NULL,
    "brightness" SMALLINT NOT NULL DEFAULT 100,
    "contrast" SMALLINT NOT NULL DEFAULT 100,
    "saturation" SMALLINT NOT NULL DEFAULT 100,
    "preset" VARCHAR(32) NOT NULL DEFAULT 'normal',

    CONSTRAINT "user_camera_filter_pkey" PRIMARY KEY ("user_id","camera_id")
);

-- CreateIndex
CREATE INDEX "idx_user_camera_filter_user" ON "user_camera_filter"("user_id");

-- AddForeignKey
ALTER TABLE "user_camera_filter" ADD CONSTRAINT "user_camera_filter_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_camera_filter" ADD CONSTRAINT "user_camera_filter_camera_id_fkey" FOREIGN KEY ("camera_id") REFERENCES "cameras"("id") ON DELETE CASCADE ON UPDATE CASCADE;
