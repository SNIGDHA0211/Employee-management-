/**
 * Browser desktop notifications for WebSocket messages.
 *
 * Requirements:
 * - HTTPS in production (or localhost for dev)
 * - User gesture for initial permission request (e.g. after login)
 *
 * Features:
 * - Request permission properly
 * - Show notification only when tab is hidden/minimized
 * - Play a short sound
 * - Focus tab on notification click
 * - Handle permission denied gracefully
 */

export type NotificationPayload = {
  type: string;
  title: string;
  message: string;
  extra?: { time?: string; [key: string]: unknown };
};

/** Check if the Notification API is supported and we're in a secure context (HTTPS or localhost) */
export function isNotificationSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    (window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  );
}

/** Get current permission state without prompting */
export function getPermission(): NotificationPermission {
  if (!isNotificationSupported()) return 'denied';
  return Notification.permission;
}

/**
 * Request notification permission. Call this after a user gesture (e.g. login).
 * Returns the permission state.
 */
export async function requestPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return 'denied';
  if (Notification.permission === 'granted') {
    unlockNotificationAudio();
    return 'granted';
  }
  if (Notification.permission === 'denied') return 'denied';
  try {
    const perm = await Notification.requestPermission();
    if (perm === 'granted') unlockNotificationAudio();
    return perm;
  } catch {
    return 'denied';
  }
}

/**
 * Unlock audio for programmatic playback. Call after a user gesture.
 * Allows repeated notification sounds to play even when tab is in background.
 */
function unlockNotificationAudio(): void {
  try {
    const audio = getNotificationAudio();
    const prevVolume = audio.volume;
    audio.volume = 0;
    audio.play().then(() => {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = prevVolume;
    }).catch(() => {});
  } catch {
    // ignore
  }
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx && !cachedAudioContext) {
      cachedAudioContext = new AudioCtx();
      cachedAudioContext.resume().catch(() => {});
    }
  } catch {
    // ignore
  }
}

/** Path to notification sound (place file at public/assets/notification.mp3) */
const NOTIFICATION_SOUND_URL = '/assets/notification.mp3';

let cachedNotificationAudio: HTMLAudioElement | null = null;
let cachedAudioContext: AudioContext | null = null;

function getNotificationAudio(): HTMLAudioElement {
  if (!cachedNotificationAudio) {
    cachedNotificationAudio = new Audio(NOTIFICATION_SOUND_URL);
    cachedNotificationAudio.volume = 0.7;
    cachedNotificationAudio.preload = 'auto';
  }
  return cachedNotificationAudio;
}

/** Play notification sound. Reuses a single Audio element so repeat plays are not blocked by autoplay policy. */
export function playNotificationSound(): void {
  try {
    const audio = getNotificationAudio();
    audio.currentTime = 0;
    audio.play().catch(() => {
      playNotificationSoundFallback();
    });
  } catch {
    playNotificationSoundFallback();
  }
}

function playNotificationSoundFallback(): void {
  const playBeep = (ctx: AudioContext) => {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // ignore
    }
  };
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    // Use cached context if unlocked (resumed on user gesture), otherwise create new and resume
    const ctx = cachedAudioContext || new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().then(() => playBeep(ctx)).catch(() => {});
    } else {
      playBeep(ctx);
    }
  } catch {
    // ignore
  }
}

/** Focus the browser tab/window */
function focusWindow(): void {
  if (typeof window === 'undefined') return;
  window.focus();
}

let repeatingNotifIntervalId: ReturnType<typeof setInterval> | null = null;
let activeRepeatingNotif: Notification | null = null;

function stopRepeatingNotification(): void {
  if (repeatingNotifIntervalId) {
    clearInterval(repeatingNotifIntervalId);
    repeatingNotifIntervalId = null;
  }
  activeRepeatingNotif?.close();
  activeRepeatingNotif = null;
}

/**
 * Show a desktop notification that repeats every 5 seconds until the user clicks it.
 * Uses a unique tag per show so the browser displays a new popup each time (same tag would replace in-place).
 * - Plays sound (caller responsibility)
 * - On click: stops repeat, closes notification, focuses the tab
 */
export function showRepeatingDesktopNotification(payload: NotificationPayload): void {
  if (!isNotificationSupported()) return;
  if (Notification.permission !== 'granted') return;

  stopRepeatingNotification();

  const { title, message, extra } = payload;
  const bodyParts = [extra?.from && `From ${extra.from}`, message, extra?.time].filter(Boolean);
  const body = bodyParts.join('\n');

  const showOne = () => {
    try {
      activeRepeatingNotif?.close();
      playNotificationSound();
      const n = new Notification(title, {
        body,
        tag: `repeating-${Date.now()}`, // unique tag so browser shows new popup each time
        requireInteraction: true,
        silent: false,
      });
      activeRepeatingNotif = n;
      n.onclick = () => {
        stopRepeatingNotification();
        focusWindow();
      };
    } catch {
      stopRepeatingNotification();
    }
  };

  showOne();
  repeatingNotifIntervalId = setInterval(showOne, 5000);
}

/**
 * Show a desktop notification (one-shot).
 * - Plays sound
 * - On click: focuses the tab
 * - Auto-dismiss after 20 seconds
 */
export function showDesktopNotification(payload: NotificationPayload): void {
  if (!isNotificationSupported()) return;
  if (Notification.permission !== 'granted') return;

  const { title, message, extra } = payload;
  const bodyParts = [extra?.from && `From ${extra.from}`, message, extra?.time].filter(Boolean);
  const body = bodyParts.join('\n');
  const options: NotificationOptions = {
    body,
    tag: `notification-${Date.now()}`,
    requireInteraction: false,
    silent: false,
  };

  try {
    const n = new Notification(title, options);

    n.onclick = () => {
      n.close();
      focusWindow();
    };

    setTimeout(() => n.close(), 20000);
  } catch {
    // Ignore if Notification constructor fails
  }
}

/** Normalize WebSocket payload to NotificationPayload */
export function parseNotificationPayload(data: unknown): NotificationPayload | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const hasType = d.type === 'notification' || d.type === 'send_notification';
  const hasCategory = d.category && typeof d.title === 'string' && typeof d.message === 'string';
  if (!hasType && !hasCategory) return null;
  const title = typeof d.title === 'string' ? d.title : 'Notification';
  const message = typeof d.message === 'string' ? d.message : '';
  const baseExtra = d.extra && typeof d.extra === 'object' ? (d.extra as Record<string, unknown>) : {};
  const extra = { ...baseExtra, ...(d.from ? { from: d.from } : {}) };
  return { type: 'notification', title, message, extra: Object.keys(extra).length ? extra : undefined };
}

/**
 * Handle incoming WebSocket notification payload.
 * Shows repeating desktop notification until user clicks it.
 */
export function handleWebSocketNotification(data: unknown): void {
  const payload = parseNotificationPayload(data);
  if (!payload) return;
  showRepeatingDesktopNotification(payload);
}
