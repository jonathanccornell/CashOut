const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.NODE_ENV === 'production'
  ? '/data/cashout.db'
  : path.join(__dirname, '..', 'cashout.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS picks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    sport TEXT NOT NULL,
    matchup TEXT NOT NULL,
    pick TEXT NOT NULL,
    bet_type TEXT NOT NULL,
    odds TEXT NOT NULL,
    confidence INTEGER NOT NULL,
    reasoning TEXT,
    is_lock INTEGER DEFAULT 0,
    result TEXT DEFAULT 'Pending',
    units REAL DEFAULT 1.0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS parlays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    name TEXT NOT NULL,
    legs TEXT NOT NULL,
    estimated_odds TEXT NOT NULL,
    reasoning TEXT,
    result TEXT DEFAULT 'Pending',
    units REAL DEFAULT 1.0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_picks_date ON picks(date);
  CREATE INDEX IF NOT EXISTS idx_picks_is_lock ON picks(is_lock);
  CREATE INDEX IF NOT EXISTS idx_parlays_date ON parlays(date);
`);

// Migrate: add signals column if it doesn't exist
try { db.exec('ALTER TABLE picks ADD COLUMN signals TEXT DEFAULT "[]"'); } catch {}

// CLV + Kelly columns on picks
try { db.exec('ALTER TABLE picks ADD COLUMN closing_line TEXT DEFAULT NULL'); } catch {}
try { db.exec('ALTER TABLE picks ADD COLUMN clv REAL DEFAULT NULL'); } catch {}
try { db.exec('ALTER TABLE picks ADD COLUMN kelly_units REAL DEFAULT 1.0'); } catch {}
try { db.exec('ALTER TABLE picks ADD COLUMN situations TEXT DEFAULT "[]"'); } catch {}
try { db.exec('ALTER TABLE picks ADD COLUMN line TEXT DEFAULT NULL'); } catch {}

// Signal performance tracking
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS signal_performance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tag TEXT NOT NULL UNIQUE,
      appearances INTEGER DEFAULT 0,
      wins INTEGER DEFAULT 0,
      losses INTEGER DEFAULT 0,
      pushes INTEGER DEFAULT 0,
      total_clv REAL DEFAULT 0,
      last_updated TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS situational_patterns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pattern TEXT NOT NULL,
      pick_id INTEGER,
      game_date TEXT,
      result TEXT,
      clv REAL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS official_tendencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sport TEXT NOT NULL,
      official_name TEXT NOT NULL,
      game_date TEXT,
      matchup TEXT,
      total_pts INTEGER,
      went_over INTEGER,
      pick_side_won INTEGER,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
} catch {}

function getTodayDate() {
  // Always use US Eastern time so dates match the US sports calendar
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

function extractBetLine(pickText, betType) {
  const text = String(pickText || '');

  if (betType === 'spread') {
    const matches = [...text.matchAll(/([+-]\d+(?:\.\d+)?)/g)];
    return matches.length > 0 ? matches[matches.length - 1][1] : null;
  }

  if (betType === 'total' || betType === 'prop') {
    const ouMatch = text.match(/\b(?:over|under)\s+(\d+(?:\.\d+)?)/i);
    if (ouMatch) return ouMatch[1];

    const matches = [...text.matchAll(/(\d+(?:\.\d+)?)/g)];
    return matches.length > 0 ? matches[0][1] : null;
  }

  return null;
}

function parseAmericanOdds(odds) {
  const parsed = parseFloat(String(odds || '').replace(/[^0-9+.\-]/g, ''));
  return Number.isFinite(parsed) && parsed !== 0 ? parsed : null;
}

function getPickProfit(pick) {
  const units = Number(pick.units) || 1;

  if (pick.result === 'Push') return 0;
  if (pick.result !== 'W' && pick.result !== 'L') return 0;
  if (pick.result === 'L') return -units;

  const american = parseAmericanOdds(pick.odds);
  if (!american) return 0;

  return american < 0
    ? units * (100 / Math.abs(american))
    : units * (american / 100);
}

try {
  const backfill = db.prepare('SELECT id, pick, bet_type FROM picks WHERE line IS NULL');
  const update = db.prepare('UPDATE picks SET line = ? WHERE id = ?');
  for (const row of backfill.all()) {
    update.run(extractBetLine(row.pick, row.bet_type), row.id);
  }
} catch {}

// Picks
function getTodayPicks() {
  return db.prepare('SELECT * FROM picks WHERE date = ? ORDER BY is_lock DESC, confidence DESC').all(getTodayDate());
}

function getTodayLock() {
  return db.prepare('SELECT * FROM picks WHERE date = ? AND is_lock = 1').get(getTodayDate());
}

function getPicksByDate(date) {
  return db.prepare('SELECT * FROM picks WHERE date = ? ORDER BY is_lock DESC, confidence DESC').all(date);
}

function insertPick(pick) {
  const stmt = db.prepare(`
    INSERT INTO picks (date, sport, matchup, pick, bet_type, odds, confidence, reasoning, is_lock, units, signals, kelly_units, situations, line)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const betType = pick.betType || pick.bet_type;
  return stmt.run(
    pick.date || getTodayDate(),
    pick.sport,
    pick.matchup,
    pick.pick,
    betType,
    pick.odds,
    pick.confidence,
    pick.reasoning || '',
    pick.isLock ? 1 : 0,
    pick.units || 1.0,
    JSON.stringify(Array.isArray(pick.signals) ? pick.signals : []),
    pick.kelly_units || 1.0,
    JSON.stringify([]),
    pick.line || extractBetLine(pick.pick, betType)
  );
}

function updatePickResult(id, result) {
  return db.prepare('UPDATE picks SET result = ? WHERE id = ?').run(result, id);
}

function todayPicksExist() {
  const row = db.prepare('SELECT COUNT(*) as count FROM picks WHERE date = ?').get(getTodayDate());
  return row.count > 0;
}

function clearTodayPicks() {
  const today = getTodayDate();
  db.prepare('DELETE FROM picks WHERE date = ?').run(today);
  db.prepare('DELETE FROM parlays WHERE date = ?').run(today);
}

// Parlays
function getTodayParlays() {
  const parlays = db.prepare('SELECT * FROM parlays WHERE date = ?').all(getTodayDate());
  return parlays.map(p => ({ ...p, legs: JSON.parse(p.legs) }));
}

function insertParlay(parlay) {
  const stmt = db.prepare(`
    INSERT INTO parlays (date, name, legs, estimated_odds, reasoning, units)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  return stmt.run(
    parlay.date || getTodayDate(),
    parlay.name,
    JSON.stringify(parlay.legs),
    parlay.estimatedOdds || parlay.estimated_odds,
    parlay.reasoning || '',
    parlay.units || 1.0
  );
}

function updateParlayResult(id, result) {
  return db.prepare('UPDATE parlays SET result = ? WHERE id = ?').run(result, id);
}

// Record & Stats
function getAllTimeRecord() {
  const normalizeCounts = (row) => Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, value ?? 0])
  );

  const decidedRows = db.prepare(`
    SELECT sport, odds, units, result, is_lock
    FROM picks
    WHERE result IN ('W', 'L', 'Push')
  `).all();

  const picks = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN result = 'W' THEN 1 ELSE 0 END) as wins,
      SUM(CASE WHEN result = 'L' THEN 1 ELSE 0 END) as losses,
      SUM(CASE WHEN result = 'Push' THEN 1 ELSE 0 END) as pushes,
      SUM(CASE WHEN result = 'Pending' THEN 1 ELSE 0 END) as pending
    FROM picks
  `).get();

  const locks = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN result = 'W' THEN 1 ELSE 0 END) as wins,
      SUM(CASE WHEN result = 'L' THEN 1 ELSE 0 END) as losses,
      SUM(CASE WHEN result = 'Push' THEN 1 ELSE 0 END) as pushes
    FROM picks WHERE is_lock = 1
  `).get();

  const parlays = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN result = 'W' THEN 1 ELSE 0 END) as wins,
      SUM(CASE WHEN result = 'L' THEN 1 ELSE 0 END) as losses,
      SUM(CASE WHEN result = 'Push' THEN 1 ELSE 0 END) as pushes
    FROM parlays
  `).get();

  const safePicks = normalizeCounts(picks);
  const safeLocks = normalizeCounts(locks);
  const safeParlays = normalizeCounts(parlays);

  const totalRisk = decidedRows.reduce((sum, pick) => sum + (Number(pick.units) || 1), 0);
  const totalProfit = decidedRows.reduce((sum, pick) => sum + getPickProfit(pick), 0);
  const roi = totalRisk > 0 ? ((totalProfit / totalRisk) * 100).toFixed(1) : '0.0';

  // Current streak (all picks)
  const recentPicks = db.prepare(
    "SELECT result FROM picks WHERE result IN ('W', 'L') ORDER BY date DESC, id DESC LIMIT 20"
  ).all();

  // Lock streak
  const recentLocks = db.prepare(
    "SELECT result FROM picks WHERE is_lock = 1 AND result IN ('W', 'L') ORDER BY date DESC, id DESC LIMIT 20"
  ).all();
  let lockStreak = 0, lockStreakType = '';
  for (const p of recentLocks) {
    if (lockStreakType === '') lockStreakType = p.result;
    if (p.result === lockStreakType) lockStreak++;
    else break;
  }
  let streak = 0;
  let streakType = '';
  for (const p of recentPicks) {
    if (streakType === '') streakType = p.result;
    if (p.result === streakType) streak++;
    else break;
  }

  // Per-sport breakdown
  const sportRows = db.prepare(`
    SELECT
      sport,
      COUNT(*) as total,
      SUM(CASE WHEN result = 'W' THEN 1 ELSE 0 END) as wins,
      SUM(CASE WHEN result = 'L' THEN 1 ELSE 0 END) as losses,
      SUM(CASE WHEN result = 'Push' THEN 1 ELSE 0 END) as pushes,
      SUM(CASE WHEN result = 'Pending' THEN 1 ELSE 0 END) as pending
    FROM picks
    GROUP BY sport
    ORDER BY (SUM(CASE WHEN result = 'W' THEN 1 ELSE 0 END) + SUM(CASE WHEN result = 'L' THEN 1 ELSE 0 END)) DESC
  `).all();

  const bySport = sportRows.map(row => {
    const sportRowsDecided = decidedRows.filter(p => p.sport === row.sport);
    const sportRisk = sportRowsDecided.reduce((sum, pick) => sum + (Number(pick.units) || 1), 0);
    const sportProfit = sportRowsDecided.reduce((sum, pick) => sum + getPickProfit(pick), 0);
    const decided = row.wins + row.losses;
    return {
      sport: row.sport,
      total: row.total,
      wins: row.wins,
      losses: row.losses,
      pushes: row.pushes,
      pending: row.pending,
      winRate: decided > 0 ? ((row.wins / decided) * 100).toFixed(1) : '0.0',
      roi: sportRisk > 0 ? ((sportProfit / sportRisk) * 100).toFixed(1) : '0.0'
    };
  });

  const lockRows = decidedRows.filter(row => row.is_lock === 1);
  const lockRisk = lockRows.reduce((sum, pick) => sum + (Number(pick.units) || 1), 0);
  const lockProfit = lockRows.reduce((sum, pick) => sum + getPickProfit(pick), 0);
  const decided = safePicks.wins + safePicks.losses;

  return {
    picks: { ...safePicks, winRate: decided > 0 ? ((safePicks.wins / decided) * 100).toFixed(1) : '0.0' },
    locks: {
      ...safeLocks,
      streak: lockStreak > 0 ? `${lockStreak}${lockStreakType}` : null,
      roi: lockRisk > 0 ? ((lockProfit / lockRisk) * 100).toFixed(1) : '0.0'
    },
    parlays: safeParlays,
    roi,
    streak: streak > 0 ? `${streak}${streakType}` : '0-0',
    bySport
  };
}

function getHistory(page = 1, limit = 50) {
  const offset = (page - 1) * limit;
  const picks = db.prepare('SELECT * FROM picks ORDER BY date DESC, id DESC LIMIT ? OFFSET ?').all(limit, offset);
  const total = db.prepare('SELECT COUNT(*) as count FROM picks').get().count;
  return { picks, total, page, totalPages: Math.ceil(total / limit) };
}

function getAllPicksForExport() {
  return db.prepare('SELECT date, sport, matchup, pick, bet_type, odds, confidence, is_lock, result, units, reasoning FROM picks ORDER BY date DESC, id DESC').all();
}

function resetAllRecords() {
  const reset = db.transaction(() => {
    db.prepare('DELETE FROM picks').run();
    db.prepare('DELETE FROM parlays').run();
    db.prepare('DELETE FROM signal_performance').run();
    db.prepare('DELETE FROM situational_patterns').run();
    db.prepare('DELETE FROM official_tendencies').run();
    db.prepare('DELETE FROM model_learnings').run();
    db.prepare('DELETE FROM learning_runs').run();
    db.prepare('DELETE FROM daily_analysis').run();
    db.prepare(`
      DELETE FROM sqlite_sequence
      WHERE name IN (
        'picks',
        'parlays',
        'signal_performance',
        'situational_patterns',
        'official_tendencies',
        'model_learnings',
        'learning_runs',
        'daily_analysis'
      )
    `).run();
  });

  reset();
}

function getSignalPerformance() {
  return db.prepare('SELECT * FROM signal_performance ORDER BY appearances DESC').all();
}

function getCLVStats() {
  const picks = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN clv > 0 THEN 1 ELSE 0 END) as positive_clv,
      SUM(CASE WHEN clv < 0 THEN 1 ELSE 0 END) as negative_clv,
      AVG(clv) as avg_clv,
      SUM(CASE WHEN clv > 0 AND result = 'W' THEN 1 ELSE 0 END) as clv_pos_wins,
      SUM(CASE WHEN clv > 0 AND result = 'L' THEN 1 ELSE 0 END) as clv_pos_losses,
      SUM(CASE WHEN clv < 0 AND result = 'W' THEN 1 ELSE 0 END) as clv_neg_wins,
      SUM(CASE WHEN clv < 0 AND result = 'L' THEN 1 ELSE 0 END) as clv_neg_losses
    FROM picks WHERE clv IS NOT NULL AND result IN ('W','L','Push')
  `).get();
  return picks;
}

module.exports = {
  db,
  getTodayDate,
  getTodayPicks,
  getTodayLock,
  getPicksByDate,
  insertPick,
  updatePickResult,
  todayPicksExist,
  clearTodayPicks,
  getTodayParlays,
  insertParlay,
  updateParlayResult,
  getAllTimeRecord,
  getHistory,
  getAllPicksForExport,
  resetAllRecords,
  getSignalPerformance,
  getCLVStats
};
