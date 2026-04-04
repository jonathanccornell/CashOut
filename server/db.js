const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'cashout.db'));

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

function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

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
    INSERT INTO picks (date, sport, matchup, pick, bet_type, odds, confidence, reasoning, is_lock, units, signals)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  return stmt.run(
    pick.date || getTodayDate(),
    pick.sport,
    pick.matchup,
    pick.pick,
    pick.betType || pick.bet_type,
    pick.odds,
    pick.confidence,
    pick.reasoning || '',
    pick.isLock ? 1 : 0,
    pick.units || 1.0,
    JSON.stringify(Array.isArray(pick.signals) ? pick.signals : [])
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

  // Calculate ROI (assuming flat 1 unit bets, -110 standard)
  const decided = picks.wins + picks.losses;
  const roi = decided > 0 ? (((picks.wins * 0.91 - picks.losses) / decided) * 100).toFixed(1) : '0.0';

  // Current streak
  const recentPicks = db.prepare(
    "SELECT result FROM picks WHERE result IN ('W', 'L') ORDER BY date DESC, id DESC LIMIT 20"
  ).all();
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
    const decided = row.wins + row.losses;
    return {
      sport: row.sport,
      total: row.total,
      wins: row.wins,
      losses: row.losses,
      pushes: row.pushes,
      pending: row.pending,
      winRate: decided > 0 ? ((row.wins / decided) * 100).toFixed(1) : '0.0',
      roi: decided > 0 ? (((row.wins * 0.91 - row.losses) / decided) * 100).toFixed(1) : '0.0'
    };
  });

  return {
    picks: { ...picks, winRate: decided > 0 ? ((picks.wins / decided) * 100).toFixed(1) : '0.0' },
    locks,
    parlays,
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
  getAllPicksForExport
};
