import { api } from './api';

type PushPublicKeyResponse = {
  publicKey: string;
};

let pushBootstrapPromise: Promise<void> | null = null;
let pushBootstrapAttempted = false;

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    arr[i] = raw.charCodeAt(i);
  }
  return arr;
}

export async function ensureProcessPushSubscription(): Promise<void> {
  if (pushBootstrapAttempted) return;
  if (pushBootstrapPromise) return pushBootstrapPromise;

  pushBootstrapPromise = (async () => {
  try {
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window)
    ) {
      console.warn('[process-push] Push API unsupported in this browser/context');
      return;
    }

    const keyRes = await api.get<PushPublicKeyResponse>('/processes/push/public-key');
    const publicKey = keyRes.data.publicKey;
    if (!publicKey) {
      console.warn('[process-push] VAPID public key is empty');
      return;
    }

    const registration = await navigator.serviceWorker.register('/sw.js');
    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }
    if (permission !== 'granted') {
      console.warn(`[process-push] Notification permission is ${permission}`);
      return;
    }

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToUint8Array(publicKey) as BufferSource,
      });
    }
    const subJson = subscription.toJSON();
    const endpoint = subJson.endpoint;
    const p256dh = subJson.keys?.p256dh;
    const auth = subJson.keys?.auth;
    if (!endpoint || !p256dh || !auth) {
      console.warn('[process-push] Subscription is missing endpoint or keys');
      return;
    }

    await api.post('/processes/push/subscribe', {
      endpoint,
      keys: { p256dh, auth },
      userAgent: navigator.userAgent,
    });
    pushBootstrapAttempted = true;
  } catch (error) {
    console.error('[process-push] Failed to register push subscription', error);
    // Считаем попытку завершенной, чтобы не зацикливать запросы разрешений.
    pushBootstrapAttempted = true;
  } finally {
    pushBootstrapPromise = null;
  }
  })();

  return pushBootstrapPromise;
}
