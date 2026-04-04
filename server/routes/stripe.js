const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const { db } = require('../db');
const { generateToken, verifyToken } = require('../auth');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Migrate: subscriptions table
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      tier TEXT NOT NULL,
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
} catch {}

// Stripe Price IDs — set these after creating products in Stripe dashboard
const PRICES = {
  sharp_monthly:  process.env.STRIPE_PRICE_SHARP_MONTHLY,
  elite_monthly:  process.env.STRIPE_PRICE_ELITE_MONTHLY,
  season_pass:    process.env.STRIPE_PRICE_SEASON_PASS,
};

// POST /api/stripe/checkout — create Stripe Checkout session
router.post('/checkout', async (req, res) => {
  const { tier } = req.body; // 'sharp_monthly' | 'elite_monthly' | 'season_pass'
  const priceId = PRICES[tier];
  if (!priceId) return res.status(400).json({ error: 'Invalid tier' });

  try {
    const isSubscription = tier !== 'season_pass';
    const session = await stripe.checkout.sessions.create({
      mode: isSubscription ? 'subscription' : 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.APP_URL || 'https://cashout.inc'}/welcome?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL || 'https://cashout.inc'}`,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      customer_email: req.body.email || undefined,
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('[Stripe] Checkout error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stripe/verify?session_id=xxx — verify payment and return access token
router.get('/verify', async (req, res) => {
  const { session_id } = req.query;
  if (!session_id) return res.status(400).json({ error: 'Missing session_id' });

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ['subscription', 'customer']
    });

    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      return res.status(402).json({ error: 'Payment not complete' });
    }

    const email = session.customer_details?.email || session.customer_email;
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;

    // Determine tier from price
    const priceId = session.line_items?.data?.[0]?.price?.id ||
      Object.entries(PRICES).find(([, v]) => v)?.[0];

    let tier = 'sharp';
    if (session.amount_total >= 4900 || PRICES.elite_monthly === priceId) tier = 'elite';
    if (PRICES.season_pass === priceId) tier = 'elite'; // season pass = elite access

    // Upsert subscription
    db.prepare(`
      INSERT INTO subscriptions (email, tier, stripe_customer_id, stripe_subscription_id, status)
      VALUES (?, ?, ?, ?, 'active')
      ON CONFLICT(email) DO UPDATE SET
        tier = excluded.tier,
        stripe_customer_id = excluded.stripe_customer_id,
        stripe_subscription_id = excluded.stripe_subscription_id,
        status = 'active',
        updated_at = datetime('now')
    `).run(email, tier, customerId, subscriptionId || null);

    const token = generateToken(email, tier, customerId);
    res.json({ token, email, tier });
  } catch (err) {
    console.error('[Stripe] Verify error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/stripe/webhook — Stripe event webhooks
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'customer.subscription.deleted' || event.type === 'customer.subscription.paused') {
    const sub = event.data.object;
    db.prepare(`UPDATE subscriptions SET status = 'cancelled', updated_at = datetime('now') WHERE stripe_subscription_id = ?`).run(sub.id);
    console.log(`[Stripe] Subscription cancelled: ${sub.id}`);
  }

  if (event.type === 'customer.subscription.updated') {
    const sub = event.data.object;
    const status = sub.status === 'active' ? 'active' : 'cancelled';
    db.prepare(`UPDATE subscriptions SET status = ?, updated_at = datetime('now') WHERE stripe_subscription_id = ?`).run(status, sub.id);
  }

  res.json({ received: true });
});

// GET /api/stripe/status — check subscription status from token
router.get('/status', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.json({ active: false, tier: null });

  const payload = verifyToken(token);
  if (!payload) return res.json({ active: false, tier: null });

  const sub = db.prepare('SELECT * FROM subscriptions WHERE email = ?').get(payload.email);
  if (!sub || sub.status !== 'active') return res.json({ active: false, tier: null });

  // Refresh token
  const newToken = generateToken(payload.email, sub.tier, payload.stripeCustomerId);
  res.json({ active: true, tier: sub.tier, email: payload.email, token: newToken });
});

module.exports = router;
