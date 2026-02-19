/**
 * Browser Desktop Notification Service
 *
 * Handles:
 * - Permission request (must be triggered by user gesture for best UX)
 * - Desktop notifications when tab is minimized/hidden
 * - Sound playback
 * - Focus tab on notification click
 * - Permission denied handling
 * - Secure context (HTTPS) requirement
 */

export type NotificationPermission = 'granted' | 'denied' | 'default';

export interface NotificationPayload {
  type: string;
  title: string;
  message: string;
  extra?: { time?: string; [key: string]: unknown };
}

/** Check if notifications are supported (requires secure context: HTTPS or localhost) */
export function isNotificationSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window
  );
}

/** Get current permission state */
export function getPermission(): NotificationPermission {
  if (!isNotificationSupported() || !('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission as NotificationPermission;
}

/**
 * Request notification permission. Call from user gesture (e.g. after login, button click).
 * Returns the permission result.
 */
export async function requestPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) {
    console.warn('[Notifications] Not supported (requires HTTPS or localhost)');
    return 'denied';
  }
  if (!('Notification' in window)) {
    return 'denied';
  }
  if (Notification.permission === 'granted') {
    return 'granted';
  }
  if (Notification.permission === 'denied') {
    return 'denied';
  }
  try {
    const result = await Notification.requestPermission();
    return result as NotificationPermission;
  } catch (err) {
    console.warn('[Notifications] Permission request failed:', err);
    return 'denied';
  }
}

/** Play a short notification sound using Web Audio API (no external file needed) */
function playNotificationSound(): void {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch {
    // Silently fail if AudioContext not available
  }
}

/**
 * Show a desktop notification when:
 * - Permission is granted
 * - Tab is hidden (user won't see in-app message)
 *
 * On click: focuses the tab and closes the notification.
 */
export function showDesktopNotification(payload: NotificationPayload): void {
  if (!isNotificationSupported() || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  // Only show desktop notification when tab is hidden
  if (typeof document !== 'undefined' && !document.hidden) {
    return;
  }

  const title = payload.title || 'Notification';
  const body = payload.message || '';
  const tag = `notification-${Date.now()}`;

  try {
    const n = new Notification(title, {
      body,
      tag,
      requireInteraction: false,
    });

    n.onclick = () => {
      n.close();
      window.focus();
      if (typeof document !== 'undefined') {
        document.body?.focus?.();
      }
    };

    n.onclose = () => {
      // Cleanup if needed
    };
  } catch (err) {
    console.warn('[Notifications] Failed to show:', err);
  }

}

/**
 * Handle incoming WebSocket notification payload.
 * - When tab is hidden: show desktop notification (if permitted) + play sound
 * - When tab is visible: play sound only (user sees in-app message)
 */
export function handleIncomingNotification(payload: NotificationPayload): void {
  if (!payload || typeof payload !== 'object') return;
  const { type, title, message } = payload;

  if (!type || !message) return;

  // Always play sound
  playNotificationSound();

  // Desktop notification only when tab is hidden
  if (typeof document !== 'undefined' && document.hidden) {
    showDesktopNotification(payload);
  }
}
