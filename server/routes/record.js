const express = require('express');
const router = express.Router();
const { getAllTimeRecord, getHistory, getAllPicksForExport, resetAllRecords } = require('../db');

// GET /api/record
router.get('/', (req, res) => {
  res.json(getAllTimeRecord());
});

// GET /api/history
router.get('/history', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  res.json(getHistory(page, limit));
});

// GET /api/export
router.get('/export', (req, res) => {
  const picks = getAllPicksForExport();

  const headers = ['Date', 'Sport', 'Matchup', 'Pick', 'Bet Type', 'Odds', 'Confidence', 'Lock', 'Result', 'Units', 'Reasoning'];
  const rows = picks.map(p => [
    p.date,
    p.sport,
    `"${p.matchup}"`,
    `"${p.pick}"`,
    p.bet_type,
    p.odds,
    p.confidence,
    p.is_lock ? 'Yes' : 'No',
    p.result,
    p.units,
    `"${(p.reasoning || '').replace(/"/g, '""')}"`
  ].join(','));

  const csv = [headers.join(','), ...rows].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=cashout-picks-${new Date().toISOString().split('T')[0]}.csv`);
  res.send(csv);
});

// POST /api/record/reset
router.post('/reset', (req, res) => {
  const resetKey = process.env.RESET_RECORD_KEY;
  const providedKey = req.body?.resetKey;
  const confirm = req.body?.confirm;

  const authorized = resetKey
    ? providedKey === resetKey
    : confirm === 'RESET_CASHOUT_RECORD';

  if (!authorized) {
    return res.status(403).json({ error: 'Reset not authorized' });
  }

  resetAllRecords();
  res.json({ message: 'Record reset complete' });
});

module.exports = router;
