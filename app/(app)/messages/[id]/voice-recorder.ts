"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { AUDIO_TYPES } from "@/lib/media-types";
import { VOICE_MAX_SECONDS } from "@/lib/validation";

const EXTENSIONS: Record<(typeof AUDIO_TYPES)[number], string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
};

// Premier format accepté par /api/files que le navigateur sait enregistrer
// (WebM sous Chrome, Ogg sous Firefox, MP4 sous Safari).
const recordableType = () =>
  typeof MediaRecorder === "undefined" ? undefined : AUDIO_TYPES.find((type) => MediaRecorder.isTypeSupported(type));

// Enregistrement d'un message vocal au micro. `onRecorded` reçoit le fichier à l'arrêt,
// sauf après `cancel()`. L'enregistrement s'arrête seul au bout de VOICE_MAX_SECONDS.
export function useVoiceRecorder(onRecorded: (file: File) => void) {
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef(0);
  const cancelled = useRef(false);
  // Secondes écoulées, null hors enregistrement.
  const [seconds, setSeconds] = useState<number | null>(null);
  const [error, setError] = useState("");

  const stop = () => {
    window.clearInterval(timer.current);
    if (recorder.current?.state === "recording") recorder.current.stop();
  };

  const cancel = () => {
    cancelled.current = true;
    stop();
  };

  // Quitter la conversation coupe le micro sans rien envoyer.
  const onUnmount = useEffectEvent(cancel);
  useEffect(() => () => onUnmount(), []);

  const start = async () => {
    setError("");
    const type = recordableType();
    if (!type || !navigator.mediaDevices) {
      setError("Ton navigateur ne sait pas enregistrer de message vocal.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Micro inaccessible : autorise-le pour envoyer un message vocal.");
      return;
    }
    const rec = new MediaRecorder(stream, { mimeType: type });
    const chunks: Blob[] = [];
    rec.ondataavailable = (event) => chunks.push(event.data);
    rec.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      recorder.current = null;
      setSeconds(null);
      if (cancelled.current || !chunks.length) return;
      onRecorded(new File(chunks, `vocal.${EXTENSIONS[type]}`, { type }));
    };
    cancelled.current = false;
    recorder.current = rec;
    rec.start();
    const startedAt = Date.now();
    setSeconds(0);
    timer.current = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      setSeconds(elapsed);
      if (elapsed >= VOICE_MAX_SECONDS) stop();
    }, 250);
  };

  return { recording: seconds !== null, seconds: seconds ?? 0, error, start, stop, cancel };
}

export const formatDuration = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
