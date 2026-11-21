import { useAppStore } from '@/stores/useAppStore';

const PROBE_URLS = [
  'https://clients3.google.com/generate_204',
  'https://www.gstatic.com/generate_204',
  'https://cloudflare.com/cdn-cgi/trace'
];

let checkingPromise: Promise<boolean> | null = null;

/**
 * Kiểm tra kết nối Internet thực tế (không chỉ tin navigator.onLine vốn hay sai trên Android WebView & Electron).
 * Dùng fetch mode: 'no-cors' với timeout 3.5 giây -> nếu mạng thông sẽ resolve opaque response, nếu mất mạng sẽ reject TypeError/AbortError.
 */
export async function checkRealConnectivity(timeoutMs = 3500): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    useAppStore.getState().setOnline(false);
    return false;
  }

  if (checkingPromise) return checkingPromise;

  checkingPromise = (async () => {
    for (const baseUrl of PROBE_URLS) {
      const controller = new AbortController();
      const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);
      try {
        const sep = baseUrl.includes('?') ? '&' : '?';
        await fetch(`${baseUrl}${sep}_t=${Date.now()}`, {
          method: 'GET',
          mode: 'no-cors',
          cache: 'no-store',
          signal: controller.signal
        });
        globalThis.clearTimeout(timer);
        useAppStore.getState().setOnline(true);
        return true;
      } catch {
        globalThis.clearTimeout(timer);
      }
    }
    useAppStore.getState().setOnline(false);
    return false;
  })().finally(() => {
    checkingPromise = null;
  });

  return checkingPromise;
}

/**
 * Khởi động bộ theo dõi mạng liên tục (online/offline event, quay lại tab/app, và kiểm tra định kỳ 25 giây).
 */
export function startConnectivityMonitor(): () => void {
  const handleOnline = () => {
    useAppStore.getState().setOnline(true);
    checkRealConnectivity().catch(() => {});
  };
  const handleOffline = () => {
    useAppStore.getState().setOnline(false);
  };
  const handleResume = () => {
    if (typeof document === 'undefined' || document.visibilityState === 'visible') {
      checkRealConnectivity().catch(() => {});
    }
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  window.addEventListener('focus', handleResume);
  document.addEventListener('visibilitychange', handleResume);

  // Kiểm tra thực tế ngay khi khởi động
  checkRealConnectivity().catch(() => {});

  const intervalId = window.setInterval(() => {
    if (document.visibilityState === 'visible') {
      checkRealConnectivity().catch(() => {});
    }
  }, 25000);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    window.removeEventListener('focus', handleResume);
    document.removeEventListener('visibilitychange', handleResume);
    window.clearInterval(intervalId);
  };
}
