require('dotenv').config({ override: true });
const express = require('express');
const cors = require('cors');
const path = require('path');

const picksRouter = require('./routes/picks');
const parlaysRouter = require('./routes/parlays');
const recordRouter = require('./routes/record');
const chatRouter = require('./routes/chat');
// const { router: alertsRouter } = require('./routes/alerts');   // enable when ready
// const { startLiveScanner } = require('./livescanner');          // enable when ready
// const stripeRouter = require('./routes/stripe');                // enable when ready
const learningsRouter = require('./routes/learnings');
const { scheduleLearning, runDailyPostGameAnalysis, updateSignalPerformance, calculateCLV, saveSituationalPatterns, trackOfficialsFromAnalysis } = require('./learning');
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
// app.use('/api/alerts', alertsRouter);  // enable when ready
// app.use('/api/stripe', stripeRouter);  // enable when ready
app.use('/api/learnings', learningsRouter);

// Serve static frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'client', 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
  });
}

let autoGenerating = false;

function normalizeParlayLeg(leg) {
  return String(leg || '').replace(/\s*\([^)]+\)\s*$/, '').trim();
}

function resolveParlayResult(parlay) {
  let legs;
  try {
    legs = JSON.parse(parlay.legs || '[]').map(normalizeParlayLeg);
  } catch {
    return 'Pending';
  }

  if (legs.length === 0) return 'Pending';

  const picksForDate = db.prepare(`
    SELECT pick, result
    FROM picks
    WHERE date = ?
  `).all(parlay.date);

  const legResults = legs.map((leg) => {
    const match = picksForDate.find((pick) => {
      const normalizedPick = normalizeParlayLeg(pick.pick);
      return normalizedPick === leg || leg.startsWith(normalizedPick);
    });

    return match ? match.result : null;
  });

  if (legResults.some(result => !result || result === 'Pending')) return 'Pending';
  if (legResults.some(result => result === 'L')) return 'L';
  if (legResults.some(result => result === 'Push')) return 'Push';
  return 'W';
}

// Check if picks already exist for today in ET — guards against duplicate generation on restart
function recentPicksExist() {
  const todayET = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const row = db.prepare(`SELECT COUNT(*) as count FROM picks WHERE date = ?`).get(todayET);
  return row.count > 0;
}

async function autoGeneratePicks() {
  if (autoGenerating) {
    console.log('[CashOut] Auto-generation already in progress, skipping.');
    return;
  }
  if (recentPicksExist()) {
    console.log(`[CashOut] Picks already generated within last 20 hours, skipping auto-generation.`);
    return;
  }
  autoGenerating = true;
  console.log(`[CashOut] Auto-generating picks for ${getTodayDate()}...`);
  try {
    const result = await generatePicks();
    const today = getTodayDate();
    if (result.lock) {
      insertPick({ date: today, sport: result.lock.sport || 'MULTI', matchup: result.lock.matchup,
        pick: result.lock.pick, betType: result.lock.betType, odds: result.lock.odds,
        confidence: result.lock.confidence, reasoning: result.lock.reasoning,
        signals: result.lock.signals, line: result.lock.line, isLock: true,
        units: result.lock.kelly_units || 2.0,
        kelly_units: result.lock.kelly_units || 2.0 });
    }
    for (const pick of result.picks || []) {
      insertPick({ date: today, sport: pick.sport || 'MULTI', matchup: pick.matchup,
        pick: pick.pick, betType: pick.betType, odds: pick.odds,
        confidence: pick.confidence, reasoning: pick.reasoning,
        signals: pick.signals, line: pick.line, isLock: false,
        units: pick.kelly_units || 1.0,
        kelly_units: pick.kelly_units || 1.0 });
    }
    for (const parlay of result.parlays || []) {
      insertParlay({ date: today, name: parlay.name, legs: parlay.legs,
        estimatedOdds: parlay.estimatedOdds, reasoning: parlay.reasoning, units: 1.0 });
    }
    console.log(`[CashOut] Auto-generation complete: 1 Lock + ${result.picks.length} picks + ${result.parlays.length} parlays`);
  } catch (err) {
    console.error('[CashOut] Auto-generation failed:', err.message);
  } finally {
    autoGenerating = false;
  }
}

async function autoGradePicks() {
  // Grade only prior-date picks. Same-day grading was too aggressive and could
  // mark live games as final when search results were still ambiguous.
  const todayET = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const pending = db.prepare(`
    SELECT * FROM picks
    WHERE date < ? AND result = 'Pending'
    ORDER BY date DESC, id DESC
    LIMIT 200
  `).all(todayET);
  if (pending.length === 0) {
    console.log('[CashOut] No pending picks to grade.');
    return;
  }
  console.log(`[CashOut] Auto-grading ${pending.length} pending picks...`);
  try {
    const results = await gradePicks(pending);
    for (const r of results) {
      if (r.result && r.result !== 'Pending') {
        // Get the full pick for CLV/signal calculation
        const fullPick = db.prepare('SELECT * FROM picks WHERE id = ?').get(r.id);

        // Calculate CLV if closing line available
        let clv = null;
        if (r.closing_line && fullPick) {
          clv = calculateCLV(fullPick, r.closing_line);
        }

        // Update pick with result, closing line, and CLV
        db.prepare('UPDATE picks SET result = ?, closing_line = ?, clv = ? WHERE id = ?')
          .run(r.result, r.closing_line || null, clv, r.id);

        // Update signal performance table
        if (fullPick) {
          updateSignalPerformance(fullPick, r.result, clv);
          saveSituationalPatterns(fullPick, r.result, clv);
        }

        console.log(`[CashOut] Pick ${r.id} graded: ${r.result} | CLV: ${clv !== null ? clv.toFixed(2) : 'N/A'} — ${r.reason}`);
      }
    }

    // Also grade parlays based on their legs
    const pendingParlays = db.prepare(`
      SELECT * FROM parlays
      WHERE date < ? AND result = 'Pending'
      ORDER BY date DESC, id DESC
    `).all(todayET);
    for (const parlay of pendingParlays) {
      const parlayResult = resolveParlayResult(parlay);
      if (parlayResult !== 'Pending') {
        db.prepare('UPDATE parlays SET result = ? WHERE id = ?').run(parlayResult, parlay.id);
      }
    }
    console.log('[CashOut] Auto-grading complete.');
  } catch (err) {
    console.error('[CashOut] Auto-grading failed:', err.message);
  }
}

// Schedule daily auto-generation at 11:00 AM Eastern Time
// 11 AM gives Cash: NHL morning skate confirmations, MLB lineups, more line movement data
function scheduleDailyGeneration() {
  const now = new Date();

  // Get current ET hour/minute using Intl
  const etHour = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false }).format(now));
  const etMinute = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', minute: 'numeric' }).format(now));
  const minutesUntil11amET = ((11 - etHour) * 60 - etMinute + 1440) % 1440; // minutes until next 11 AM ET
  const msUntil11am = minutesUntil11amET * 60 * 1000 || 24 * 60 * 60 * 1000;

  setTimeout(() => {
    autoGeneratePicks();
    setInterval(autoGeneratePicks, 24 * 60 * 60 * 1000);
  }, msUntil11am);
  console.log(`[CashOut] Daily auto-generation scheduled in ${Math.round(msUntil11am/60000)} minutes (11 AM ET)`);

  // Reconcile results after a safe overnight window, then once per day.
  const nextAutoGrade = new Date(now);
  nextAutoGrade.setUTCHours(10, 0, 0, 0); // 6 AM ET / 10 AM UTC is safely after late games
  if (now >= nextAutoGrade) nextAutoGrade.setUTCDate(nextAutoGrade.getUTCDate() + 1);
  setTimeout(() => {
    autoGradePicks();
    setInterval(autoGradePicks, 24 * 60 * 60 * 1000);
  }, nextAutoGrade - now);
  console.log(`[CashOut] Auto-grading scheduled daily at ${nextAutoGrade.toISOString()} (10 AM UTC / 6 AM ET)`);

  // Schedule post-game analysis at 3:30 AM UTC (= 11:30 PM ET)
  const next330am = new Date(now);
  next330am.setHours(3, 30, 0, 0);
  if (now >= next330am) next330am.setDate(next330am.getDate() + 1);
  setTimeout(() => {
    runDailyPostGameAnalysis();
    setInterval(runDailyPostGameAnalysis, 24 * 60 * 60 * 1000);
  }, next330am - now);
  console.log(`[CashOut] Post-game analysis scheduled for ${next330am.toISOString()} (3:30 AM UTC / 11:30 PM ET)`);
}

app.listen(PORT, () => {
  console.log(`[CashOut] Server running on port ${PORT}`);
  scheduleDailyGeneration();
  // Auto-generate on startup if no picks exist today
  setTimeout(autoGeneratePicks, 3000);
  setTimeout(autoGradePicks, 15000);
  // startLiveScanner();  // enable when ready
  scheduleLearning(); // weekly self-improvement analysis every Sunday
});
