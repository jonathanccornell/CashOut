const express = require('express');
const router = express.Router();
const { runLearningAnalysis, getCurrentLearnings } = require('../learning');
const { db } = require('../db');

// GET /api/learnings — get current learnings
router.get('/', (req, res) => {
  const learnings = getCurrentLearnings();
  const runs = db.prepare('SELECT * FROM learning_runs ORDER BY id DESC LIMIT 10').all();
  res.json({ learnings, runs });
});

// POST /api/learnings/run — manually trigger a learning run
router.post('/run', async (req, res) => {
  try {
    console.log('[Learning] Manual run triggered');
    const result = await runLearningAnalysis();
    if (!result) return res.json({ message: 'Not enough data yet (need 10+ decided picks)' });
    res.json({ message: 'Learning complete', result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
