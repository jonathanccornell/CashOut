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
const { generatePicks } = require('../claude');

let generating = false;

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
        isLock: true,
        units: 2.0
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
        isLock: false,
        units: 1.0
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
  const { result } = req.body;
  if (!['W', 'L', 'Push', 'Pending'].includes(result)) {
    return res.status(400).json({ error: 'Result must be W, L, Push, or Pending' });
  }
  updatePickResult(req.params.id, result);
  res.json({ message: 'Result updated' });
});

module.exports = router;
