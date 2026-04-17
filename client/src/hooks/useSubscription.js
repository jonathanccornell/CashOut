import { useState, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '';
const TOKEN_KEY = 'cashout_token';

export function useSubscription() {
  const [tier, setTier] = useState(null);       // null | 'sharp' | 'elite'
  const [email, setEmail] = useState(null);
  const [loading, setLoading] = useState(true);

  const check = useCallback(async (token) => {
    const t = token || localStorage.getItem(TOKEN_KEY);
    if (!t) { setLoading(false); return; }
    try {
      const res = await fetch(`${API_BASE}/api/stripe/status`, {
        headers: { Authorization: `Bearer ${t}` }
      });
      const data = await res.json();
      if (data.active) {
        if (data.token) localStorage.setItem(TOKEN_KEY, data.token);
        setTier(data.tier);
        setEmail(data.email);
      } else {
        localStorage.removeItem(TOKEN_KEY);
        setTier(null);
        setEmail(null);
      }
    } catch {}
    setLoading(false);
  }, []);

  // On mount: check URL for session_id (returning from Stripe), then check stored token
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');

    if (sessionId) {
      // Verify Stripe payment and get token
      fetch(`${API_BASE}/api/stripe/verify?session_id=${sessionId}`)
        .then(r => r.json())
        .then(data => {
          if (data.token) {
            localStorage.setItem(TOKEN_KEY, data.token);
            setTier(data.tier);
            setEmail(data.email);
            // Clean URL
            window.history.replaceState({}, '', '/');
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      check();
    }
  }, [check]);

  const startCheckout = async (planKey) => {
    try {
      const res = await fetch(`${API_BASE}/api/stripe/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: planKey })
      });
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch (err) {
      console.error('Checkout error:', err);
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setTier(null);
    setEmail(null);
  };

  const isSharp = tier === 'sharp' || tier === 'elite';
  const isElite = tier === 'elite';

  return { tier, email, loading, isSharp, isElite, startCheckout, logout };
}
