const express = require('express');
const router = express.Router();
const { runLearningAnalysis, getCurrentLearnings, runDailyPostGameAnalysis } = require('../learning');
const { db } = require('../db');

// GET /api/learnings — get current learnings
router.get('/', (req, res) => {
  const learnings = getCurrentLearnings();
  const runs = db.prepare('SELECT * FROM learning_runs ORDER BY id DESC LIMIT 10').all();
  const recentAnalyses = db.prepare('SELECT * FROM daily_analysis ORDER BY date DESC, id ASC LIMIT 50').all();
  res.json({ learnings, runs, recentAnalyses });
});

// POST /api/learnings/run — manually trigger weekly learning run
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

// POST /api/learnings/postgame — manually trigger post-game analysis
router.post('/postgame', async (req, res) => {
  try {
    console.log('[PostGame] Manual run triggered');
    const result = await runDailyPostGameAnalysis();
    if (!result) return res.json({ message: 'No graded picks found for yesterday or analysis already exists' });
    res.json({ message: 'Post-game analysis complete', analyses: result.length, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
