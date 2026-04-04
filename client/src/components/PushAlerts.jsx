import { useState, useEffect } from 'react';

const API_BASE = '';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return new Uint8Array([...raw].map(c => c.charCodeAt(0)));
}

export default function PushAlerts() {
  const [status, setStatus] = useState('idle'); // idle | subscribed | denied | unsupported
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported'); return;
    }
    navigator.serviceWorker.getRegistration('/sw.js').then(reg => {
      if (!reg) return;
      reg.pushManager.getSubscription().then(sub => {
        if (sub) setStatus('subscribed');
      });
    });
  }, []);

  async function subscribe() {
    if (!('serviceWorker' in navigator)) return;
    setLoading(true);
    try {
      // Get VAPID public key
      const { publicKey } = await fetch(`${API_BASE}/api/alerts/vapid-key`).then(r => r.json());

      // Register service worker
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      // Request permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setStatus('denied'); setLoading(false); return; }

      // Subscribe
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

      // Send to server
      await fetch(`${API_BASE}/api/alerts/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub)
      });

      setStatus('subscribed');
    } catch (err) {
      console.error('Push subscribe error:', err);
    }
    setLoading(false);
  }

  async function unsubscribe() {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await fetch(`${API_BASE}/api/alerts/unsubscribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: sub.endpoint })
          });
          await sub.unsubscribe();
        }
      }
      setStatus('idle');
    } catch {}
    setLoading(false);
  }

  if (status === 'unsupported') return null;

  if (status === 'subscribed') {
    return (
      <button
        onClick={unsubscribe}
        disabled={loading}
        className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-neon/60 hover:text-neon/40 transition-colors"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-neon animate-pulse" />
        Live Alerts On
      </button>
    );
  }

  return (
    <button
      onClick={subscribe}
      disabled={loading}
      className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/30 hover:text-neon transition-colors"
    >
      <span className="text-base leading-none">🔔</span>
      {loading ? 'Enabling...' : 'Live Alerts'}
    </button>
  );
}
