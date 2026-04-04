const express = require('express');
const router = express.Router();
const { getTodayParlays, updateParlayResult } = require('../db');

// GET /api/parlays/today
router.get('/today', (req, res) => {
  res.json(getTodayParlays());
});

// PATCH /api/parlays/:id/result
router.patch('/:id/result', (req, res) => {
  const { result } = req.body;
  if (!['W', 'L', 'Push', 'Pending'].includes(result)) {
    return res.status(400).json({ error: 'Result must be W, L, Push, or Pending' });
  }
  updateParlayResult(req.params.id, result);
  res.json({ message: 'Parlay result updated' });
});

module.exports = router;
