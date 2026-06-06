/** Captures the current video frame and triggers a PNG download. */
export async function captureVideoSnapshot(
  video: HTMLVideoElement,
  options?: { filter?: string; filename?: string },
): Promise<void> {
  if (!video.videoWidth || !video.videoHeight) {
    throw new Error("El video aún no tiene frames disponibles");
  }

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo crear el contexto del canvas");

  if (options?.filter) ctx.filter = options.filter;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("No se pudo generar la imagen");

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = options?.filename ?? `snapshot-${Date.now()}.png`;
  anchor.click();
  URL.revokeObjectURL(url);
}
