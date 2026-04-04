require('dotenv').config({ override: true });
const express = require('express');
const cors = require('cors');
const path = require('path');

const picksRouter = require('./routes/picks');
const parlaysRouter = require('./routes/parlays');
const recordRouter = require('./routes/record');
const chatRouter = require('./routes/chat');
const { router: alertsRouter } = require('./routes/alerts');
const { startLiveScanner } = require('./livescanner');
const { todayPicksExist, clearTodayPicks, getTodayDate, insertPick, insertParlay, db } = require('./db');
const { generatePicks, gradePicks } = require('./claude');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// API routes
app.use('/api/picks', picksRouter);
app.use('/api/parlays', parlaysRouter);
app.use('/api/record', recordRouter);
app.use('/api/chat', chatRouter);
app.use('/api/alerts', alertsRouter);

// Serve static frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'client', 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
  });
}

async function autoGeneratePicks() {
  if (todayPicksExist()) {
    console.log(`[CashOut] Picks already exist for ${getTodayDate()}, skipping auto-generation.`);
    return;
  }
  console.log(`[CashOut] Auto-generating picks for ${getTodayDate()}...`);
  try {
    const result = await generatePicks();
    const today = getTodayDate();
    if (result.lock) {
      insertPick({ date: today, sport: result.lock.sport || 'MULTI', matchup: result.lock.matchup,
        pick: result.lock.pick, betType: result.lock.betType, odds: result.lock.odds,
        confidence: result.lock.confidence, reasoning: result.lock.reasoning,
        signals: result.lock.signals, isLock: true, units: 2.0 });
    }
    for (const pick of result.picks || []) {
      insertPick({ date: today, sport: pick.sport || 'MULTI', matchup: pick.matchup,
        pick: pick.pick, betType: pick.betType, odds: pick.odds,
        confidence: pick.confidence, reasoning: pick.reasoning,
        signals: pick.signals, isLock: false, units: 1.0 });
    }
    for (const parlay of result.parlays || []) {
      insertParlay({ date: today, name: parlay.name, legs: parlay.legs,
        estimatedOdds: parlay.estimatedOdds, reasoning: parlay.reasoning, units: 1.0 });
    }
    console.log(`[CashOut] Auto-generation complete: 1 Lock + ${result.picks.length} picks + ${result.parlays.length} parlays`);
  } catch (err) {
    console.error('[CashOut] Auto-generation failed:', err.message);
  }
}

async function autoGradePicks() {
  const today = getTodayDate();
  const pending = db.prepare("SELECT * FROM picks WHERE date = ? AND result = 'Pending'").all(today);
  if (pending.length === 0) {
    console.log('[CashOut] No pending picks to grade.');
    return;
  }
  console.log(`[CashOut] Auto-grading ${pending.length} pending picks...`);
  try {
    const results = await gradePicks(pending);
    for (const r of results) {
      if (r.result && r.result !== 'Pending') {
        db.prepare('UPDATE picks SET result = ? WHERE id = ?').run(r.result, r.id);
        console.log(`[CashOut] Pick ${r.id} graded: ${r.result} — ${r.reason}`);
      }
    }
    // Also grade parlays based on their legs
    const pendingParlays = db.prepare("SELECT * FROM parlays WHERE date = ? AND result = 'Pending'").all(today);
    for (const parlay of pendingParlays) {
      const legs = JSON.parse(parlay.legs);
      const parlayPicks = db.prepare(`SELECT result FROM picks WHERE date = ? AND result != 'Pending'`).all(today);
      if (parlayPicks.length > 0) {
        const allResolved = pending.length === 0 || results.every(r => r.result !== 'Pending');
        if (allResolved) {
          const hasLoss = results.some(r => r.result === 'L');
          const hasPush = results.some(r => r.result === 'Push');
          const parlayResult = hasLoss ? 'L' : hasPush ? 'Push' : 'W';
          db.prepare('UPDATE parlays SET result = ? WHERE id = ?').run(parlayResult, parlay.id);
        }
      }
    }
    console.log('[CashOut] Auto-grading complete.');
  } catch (err) {
    console.error('[CashOut] Auto-grading failed:', err.message);
  }
}

// Schedule daily auto-generation at 9:00 AM server time
function scheduleDailyGeneration() {
  const now = new Date();
  const next9am = new Date(now);
  next9am.setHours(9, 0, 0, 0);
  if (now >= next9am) next9am.setDate(next9am.getDate() + 1); // already past 9am, schedule for tomorrow
  const msUntil9am = next9am - now;
  setTimeout(() => {
    autoGeneratePicks();
    setInterval(autoGeneratePicks, 24 * 60 * 60 * 1000); // then every 24 hours
  }, msUntil9am);
  console.log(`[CashOut] Daily auto-generation scheduled for ${next9am.toLocaleTimeString()}`);

  // Schedule nightly auto-grading at 11:00 PM
  const next11pm = new Date(now);
  next11pm.setHours(23, 0, 0, 0);
  if (now >= next11pm) next11pm.setDate(next11pm.getDate() + 1);
  setTimeout(() => {
    autoGradePicks();
    setInterval(autoGradePicks, 24 * 60 * 60 * 1000);
  }, next11pm - now);
  console.log(`[CashOut] Nightly auto-grading scheduled for ${next11pm.toLocaleTimeString()}`);
}

app.listen(PORT, () => {
  console.log(`[CashOut] Server running on port ${PORT}`);
  scheduleDailyGeneration();
  // Auto-generate on startup if no picks exist today
  setTimeout(autoGeneratePicks, 3000);
  // Start live bet scanner (runs every 20 min during game hours)
  if (process.env.VAPID_PUBLIC_KEY) startLiveScanner();
});
