import { useEffect, useRef, useCallback } from 'react';

export type CallRingtoneMode = 'outgoing' | 'incoming' | 'none';

/**
 * Plays a ringtone loop and fires repeating desktop notifications every ~5 s
 * until the mode becomes 'none' (call answered, declined, or ended).
 *
 * Notifications fire regardless of whether the tab is visible so the user
 * always sees the popup on their desktop until they respond.
 *
 * @param mode   - 'incoming' | 'outgoing' | 'none'
 * @param title  - notification title  (e.g. "Incoming Audio Call")
 * @param body   - notification body   (e.g. "John Doe is calling...")
 * @param icon   - optional icon URL for the desktop notification
 */
export function useCallRingtone(
  mode: CallRingtoneMode,
  title: string,
  body: string,
  icon?: string
) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const notifIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeNotifRef = useRef<Notification | null>(null);

  // Request notification permission once on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const stopAll = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (notifIntervalRef.current) {
      clearInterval(notifIntervalRef.current);
      notifIntervalRef.current = null;
    }
    activeNotifRef.current?.close();
    activeNotifRef.current = null;
  }, []);

  const showNotification = useCallback(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    // Close previous before creating a new one (prevents stacking)
    activeNotifRef.current?.close();
    try {
      const notif = new Notification(title, {
        body,
        icon: icon ?? '/favicon.ico',
        // requireInteraction keeps the notification visible until dismissed
        requireInteraction: true,
        silent: true, // audio is handled by Web Audio, not system sound
        tag: 'call-ringtone', // same tag replaces previous notification
      });
      notif.onclick = () => {
        window.focus();
        notif.close();
      };
      activeNotifRef.current = notif;
    } catch {
      // Notifications blocked or not supported — silent fail
    }
  }, [title, body, icon]);

  useEffect(() => {
    if (mode === 'none') {
      stopAll();
      return;
    }

    // Build audio element lazily
    if (!audioRef.current) {
      audioRef.current = new Audio('/ringtone.wav');
      audioRef.current.loop = true;
    }

    // Start ringtone
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {
      // Autoplay may be blocked on first load; safe to ignore — the user
      // already interacted with the page to initiate/receive the call.
    });

    // Show first notification immediately so the user sees it right away
    showNotification();

    // Repeat notification every 5 s regardless of tab visibility so the
    // desktop popup keeps reappearing until the receiver responds
    notifIntervalRef.current = setInterval(() => {
      showNotification();
    }, 5000);

    return () => {
      stopAll();
    };
  // Re-run only when mode changes; title/body/icon changes handled via showNotification's closure
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Cleanup on unmount
  useEffect(() => () => stopAll(), []);
}
