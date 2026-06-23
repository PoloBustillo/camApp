-- CreateTable
CREATE TABLE "user_camera_order" (
    "user_id" UUID NOT NULL,
    "camera_id" UUID NOT NULL,
    "position" SMALLINT NOT NULL,

    CONSTRAINT "user_camera_order_pkey" PRIMARY KEY ("user_id","camera_id")
);

-- CreateIndex
CREATE INDEX "idx_user_camera_order_user" ON "user_camera_order"("user_id");

-- AddForeignKey
ALTER TABLE "user_camera_order" ADD CONSTRAINT "user_camera_order_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_camera_order" ADD CONSTRAINT "user_camera_order_camera_id_fkey" FOREIGN KEY ("camera_id") REFERENCES "cameras"("id") ON DELETE CASCADE ON UPDATE CASCADE;
