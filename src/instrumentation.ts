import { startBackupWorker } from "@/lib/backup-worker";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    startBackupWorker();
  }
}
