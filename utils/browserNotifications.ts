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
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const perm = await Notification.requestPermission();
    return perm;
  } catch {
    return 'denied';
  }
}

/** Play a short notification sound using Web Audio API (no external file needed) */
export function playNotificationSound(): void {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
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
    // Silently ignore if AudioContext fails (e.g. autoplay policy)
  }
}

/** Focus the browser tab/window */
function focusWindow(): void {
  if (typeof window === 'undefined') return;
  window.focus();
}

/**
 * Show a desktop notification.
 * - Plays sound
 * - On click: focuses the tab
 * - Respects permission state
 */
export function showDesktopNotification(payload: NotificationPayload): void {
  if (!isNotificationSupported()) return;
  if (Notification.permission !== 'granted') return;

  const { title, message, extra } = payload;
  const body = extra?.time ? `${message}\n${extra.time}` : message;
  const options: NotificationOptions = {
    body,
    tag: `notification-${Date.now()}`, // unique tag to avoid stacking
    requireInteraction: false,
    silent: false, // we'll play our own sound for consistency
  };

  try {
    const n = new Notification(title, options);

    n.onclick = () => {
      n.close();
      focusWindow();
    };

    setTimeout(() => n.close(), 20000); // Auto-dismiss after 20 seconds

    // Sound is played by caller when notification is received
  } catch {
    // Ignore if Notification constructor fails
  }
}

/** Normalize WebSocket payload to NotificationPayload */
export function parseNotificationPayload(data: unknown): NotificationPayload | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (d.type !== 'notification' && d.type !== 'send_notification') return null;
  const title = typeof d.title === 'string' ? d.title : 'Notification';
  const message = typeof d.message === 'string' ? d.message : '';
  const extra = d.extra && typeof d.extra === 'object' ? (d.extra as Record<string, unknown>) : undefined;
  return { type: 'notification', title, message, extra };
}

/**
 * Handle incoming WebSocket notification payload.
 * Shows desktop notification when tab is hidden.
 */
export function handleWebSocketNotification(data: unknown): void {
  const payload = parseNotificationPayload(data);
  if (!payload) return;
  showDesktopNotification(payload);
}
