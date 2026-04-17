const express = require('express');
const router = express.Router();
const { chatAboutGames } = require('../claude');
const { getTodayPicks } = require('../db');

// POST /api/chat
router.post('/', async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array required' });
    }

    const todayPicks = getTodayPicks();
    const reply = await chatAboutGames(messages, todayPicks);
    res.json({ reply });
  } catch (err) {
    console.error('[CashOut Chat] Error:', err);
    res.status(503).json({ error: 'CashOut chat is temporarily unavailable.' });
  }
});

module.exports = router;
