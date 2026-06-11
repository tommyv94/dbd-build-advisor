import { useCallback, useEffect, useRef, useState } from 'react';
import { ambientAudio, loadAmbientMuted } from '../lib/ambient-audio';

export function useAmbientAudio(active = true) {
  const [muted, setMutedState] = useState(loadAmbientMuted);
  const startedRef = useRef(false);

  const ensureStarted = useCallback(async () => {
    if (startedRef.current) return;
    startedRef.current = true;
    try {
      await ambientAudio.start();
    } catch {
      startedRef.current = false;
    }
  }, []);

  const setMuted = useCallback((next: boolean) => {
    setMutedState(next);
    ambientAudio.setMuted(next);
    if (!next) void ensureStarted();
  }, [ensureStarted]);

  const toggleMute = useCallback(() => {
    setMutedState((prev) => {
      const next = !prev;
      ambientAudio.setMuted(next);
      if (!next) void ensureStarted();
      return next;
    });
  }, [ensureStarted]);

  useEffect(() => {
    if (!active || muted) return;
    const timer = window.setTimeout(() => {
      void ensureStarted();
    }, 900);
    return () => window.clearTimeout(timer);
  }, [active, muted, ensureStarted]);

  const primeOnInteraction = useCallback(() => {
    if (!muted) void ensureStarted();
  }, [muted, ensureStarted]);

  return { muted, setMuted, toggleMute, primeOnInteraction };
}
