"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface RecordingMetadata {
  fileName: string;
  fileSize: number;
  duration: number;
  fileHash: string;
  mimeType: string;
  startTime: string;
  endTime: string;
}

export interface UseRecorderReturn {
  isRecording: boolean;
  duration: number;
  startRecording: (stream: MediaStream, filename?: string) => void;
  stopRecording: () => Promise<RecordingMetadata | null>;
}

function getSupportedMimeType(): string {
  const types = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4",
  ];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) || "video/webm";
}

async function computeSHA256(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Manages MediaRecorder for client-side video recording.
 * Records the raw WebRTC MediaStream, computes SHA-256 hash, and triggers a download on stop.
 */
export function useRecorder(): UseRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const filenameRef = useRef("grabacion");
  const startTimeRef = useRef<string>("");

  const startRecording = useCallback((stream: MediaStream, filename?: string) => {
    if (recorderRef.current?.state === "recording") return;

    const mimeType = getSupportedMimeType();
    const recorder = new MediaRecorder(stream, { mimeType });
    chunksRef.current = [];
    filenameRef.current = filename || `grabacion-${Date.now()}`;
    startTimeRef.current = new Date().toISOString();

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.start(1000);
    recorderRef.current = recorder;
    setIsRecording(true);
    setDuration(0);

    timerRef.current = setInterval(() => {
      setDuration((d) => d + 1);
    }, 1000);
  }, []);

  const stopRecording = useCallback(async (): Promise<RecordingMetadata | null> => {
    if (recorderRef.current?.state !== "recording") return null;

    const endTime = new Date().toISOString();
    const finalDuration = duration;

    return new Promise((resolve) => {
      const recorder = recorderRef.current!;
      recorder.onstop = async () => {
        const mimeType = recorder.mimeType || "video/webm";
        const ext = mimeType.includes("mp4") ? "mp4" : "webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const fileName = `${filenameRef.current}.${ext}`;

        // Compute SHA-256 hash
        const fileHash = await computeSHA256(blob);

        // Download the file
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        chunksRef.current = [];

        resolve({
          fileName,
          fileSize: blob.size,
          duration: finalDuration,
          fileHash,
          mimeType,
          startTime: startTimeRef.current,
          endTime,
        });
      };

      recorder.stop();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setIsRecording(false);
      setDuration(0);
    });
  }, [duration]);

  useEffect(() => {
    return () => {
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.stop();
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return { isRecording, duration, startRecording, stopRecording };
}
