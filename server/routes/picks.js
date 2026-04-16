const express = require('express');
const router = express.Router();
const {
  getTodayPicks,
  getTodayLock,
  insertPick,
  updatePickResult,
  todayPicksExist,
  clearTodayPicks,
  insertParlay,
  getTodayDate
} = require('../db');
const { generatePicks, gradePicks } = require('../claude');
const { db } = require('../db');

let generating = false;

function ensureManualGradingAllowed(req, res) {
  const configuredKey = process.env.MANUAL_GRADE_KEY;
  if (!configuredKey) {
    return res.status(403).json({ error: 'Manual grading is disabled. CashOut settles results automatically.' });
  }

  const providedKey = req.body?.gradeKey || req.get('x-grade-key');
  if (providedKey !== configuredKey) {
    return res.status(403).json({ error: 'Manual grading requires authorization.' });
  }

  return null;
}

// POST /api/picks/generate — trigger Claude to generate today's picks
router.post('/generate', async (req, res) => {
  try {
    const force = req.query.force === 'true';

    if (generating) {
      return res.status(409).json({ error: 'Pick generation already in progress' });
    }

    if (!force && todayPicksExist()) {
      return res.json({ message: 'Today\'s picks already exist', cached: true, picks: getTodayPicks() });
    }

    if (force) {
      // SAFETY: never clear picks that have already been graded — users may have acted on them
      const gradedToday = db.prepare(`SELECT COUNT(*) as count FROM picks WHERE date = ? AND result IN ('W','L','Push')`).get(getTodayDate());
      if (gradedToday.count > 0) {
        return res.status(403).json({ error: 'Cannot regenerate — today already has graded results. Picks are locked once games are decided.' });
      }
      // Also refuse if any picks exist and it's past 1 PM ET (2 hour window after 11 AM generation)
      const etHour = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false }).format(new Date()));
      if (todayPicksExist() && etHour >= 13) {
        return res.status(403).json({ error: 'Cannot regenerate after 1 PM ET — picks are locked for the day to protect users who have already placed bets.' });
      }
      clearTodayPicks();
    }

    generating = true;
    console.log(`[CashOut] Generating picks for ${getTodayDate()}...`);

    const result = await generatePicks();
    const today = getTodayDate();

    // Insert lock
    if (result.lock) {
      insertPick({
        date: today,
        sport: result.lock.sport || 'MULTI',
        matchup: result.lock.matchup,
        pick: result.lock.pick,
        betType: result.lock.betType,
        odds: result.lock.odds,
        confidence: result.lock.confidence,
        reasoning: result.lock.reasoning,
        signals: result.lock.signals,
        line: result.lock.line,
        isLock: true,
        units: result.lock.kelly_units || 1.0,
        kelly_units: result.lock.kelly_units || 1.0
      });
    }

    // Insert picks
    for (const pick of result.picks || []) {
      insertPick({
        date: today,
        sport: pick.sport || 'MULTI',
        matchup: pick.matchup,
        pick: pick.pick,
        betType: pick.betType,
        odds: pick.odds,
        confidence: pick.confidence,
        reasoning: pick.reasoning,
        signals: pick.signals,
        line: pick.line,
        isLock: false,
        units: pick.kelly_units || 1.0,
        kelly_units: pick.kelly_units || 1.0
      });
    }

    // Insert parlays
    for (const parlay of result.parlays || []) {
      insertParlay({
        date: today,
        name: parlay.name,
        legs: parlay.legs,
        estimatedOdds: parlay.estimatedOdds,
        reasoning: parlay.reasoning,
        units: 1.0
      });
    }

    generating = false;
    console.log(`[CashOut] Picks generated successfully`);
    res.json({ message: 'Picks generated', picks: getTodayPicks() });
  } catch (error) {
    generating = false;
    console.error('[CashOut] Generation error:', error);
    res.status(500).json({ error: 'Failed to generate picks', details: error.message });
  }
});

// POST /api/picks/grade — auto-grade pending picks
router.post('/grade', async (req, res) => {
  try {
    const today = getTodayDate();
    const pending = db.prepare(`
      SELECT * FROM picks
      WHERE date <= ? AND result = 'Pending'
      ORDER BY date DESC, id DESC
      LIMIT 200
    `).all(today);
    if (pending.length === 0) return res.json({ message: 'No pending picks to grade' });
    const results = await gradePicks(pending);
    for (const r of results) {
      if (r.result && r.result !== 'Pending') {
        db.prepare('UPDATE picks SET result = ? WHERE id = ?').run(r.result, r.id);
      }
    }
    res.json({ graded: results });
  } catch (err) {
    res.status(500).json({ error: 'Grading failed', details: err.message });
  }
});

// GET /api/picks/today
router.get('/today', (req, res) => {
  res.json(getTodayPicks());
});

// GET /api/picks/lock
router.get('/lock', (req, res) => {
  const lock = getTodayLock();
  if (!lock) return res.json(null);
  res.json(lock);
});

// PATCH /api/picks/:id/result
router.patch('/:id/result', (req, res) => {
  const denied = ensureManualGradingAllowed(req, res);
  if (denied) return denied;

  const { result } = req.body;
  if (!['W', 'L', 'Push', 'Pending'].includes(result)) {
    return res.status(400).json({ error: 'Result must be W, L, Push, or Pending' });
  }
  updatePickResult(req.params.id, result);
  res.json({ message: 'Result updated' });
});

module.exports = router;
