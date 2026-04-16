const express = require('express');
const router = express.Router();
const { getTodayParlays, updateParlayResult } = require('../db');

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

// GET /api/parlays/today
router.get('/today', (req, res) => {
  res.json(getTodayParlays());
});

// PATCH /api/parlays/:id/result
router.patch('/:id/result', (req, res) => {
  const denied = ensureManualGradingAllowed(req, res);
  if (denied) return denied;

  const { result } = req.body;
  if (!['W', 'L', 'Push', 'Pending'].includes(result)) {
    return res.status(400).json({ error: 'Result must be W, L, Push, or Pending' });
  }
  updateParlayResult(req.params.id, result);
  res.json({ message: 'Parlay result updated' });
});

module.exports = router;
