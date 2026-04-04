const express = require('express');
const router = express.Router();
const webpush = require('web-push');
const { db } = require('../db');

// Set VAPID details
webpush.setVapidDetails(
  process.env.VAPID_EMAIL || 'mailto:admin@cashout.inc',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Migrate: create push_subscriptions table
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint TEXT UNIQUE NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
} catch {}

// GET /api/alerts/vapid-key — return public key to client
router.get('/vapid-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// POST /api/alerts/subscribe — save push subscription
router.post('/subscribe', (req, res) => {
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: 'Invalid subscription' });
  }
  try {
    db.prepare(`
      INSERT OR REPLACE INTO push_subscriptions (endpoint, p256dh, auth)
      VALUES (?, ?, ?)
    `).run(endpoint, keys.p256dh, keys.auth);
    console.log('[CashOut] New push subscriber saved');
    res.json({ message: 'Subscribed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/alerts/unsubscribe
router.post('/unsubscribe', (req, res) => {
  const { endpoint } = req.body;
  if (endpoint) db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
  res.json({ message: 'Unsubscribed' });
});

// Internal: broadcast a push notification to all subscribers
async function broadcastPush(title, body, data = {}) {
  const subs = db.prepare('SELECT * FROM push_subscriptions').all();
  console.log(`[CashOut] Broadcasting to ${subs.length} subscribers: ${title}`);
  const payload = JSON.stringify({ title, body, ...data });
  const dead = [];

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      );
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) dead.push(sub.id);
    }
  }

  // Remove dead subscriptions
  for (const id of dead) db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(id);
  return subs.length - dead.length;
}

module.exports = { router, broadcastPush };
