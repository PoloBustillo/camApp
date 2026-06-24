"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface UseRecorderReturn {
  isRecording: boolean;
  duration: number;
  startRecording: (stream: MediaStream, filename?: string) => void;
  stopRecording: () => void;
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

/**
 * Manages MediaRecorder for client-side video recording.
 * Records the raw WebRTC MediaStream and triggers a download on stop.
 */
export function useRecorder(): UseRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const filenameRef = useRef("grabacion");

  const startRecording = useCallback((stream: MediaStream, filename?: string) => {
    if (recorderRef.current?.state === "recording") return;

    const mimeType = getSupportedMimeType();
    const recorder = new MediaRecorder(stream, { mimeType });
    chunksRef.current = [];
    filenameRef.current = filename || `grabacion-${Date.now()}`;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const ext = mimeType.includes("mp4") ? "mp4" : "webm";
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filenameRef.current}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      chunksRef.current = [];
    };

    recorder.start(1000);
    recorderRef.current = recorder;
    setIsRecording(true);
    setDuration(0);

    timerRef.current = setInterval(() => {
      setDuration((d) => d + 1);
    }, 1000);
  }, []);

  const stopRecording = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
    setDuration(0);
  }, []);

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
