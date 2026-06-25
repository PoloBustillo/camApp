export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Lazy-load backup worker only when cloud is configured
    const { CLOUD_ENDPOINT } = process.env;
    if (CLOUD_ENDPOINT) {
      const { startBackupWorker } = await import("@/lib/backup-worker");
      startBackupWorker();
    }
  }
}
