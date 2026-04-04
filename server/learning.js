const Anthropic = require('@anthropic-ai/sdk');
const { db } = require('./db');

const client = new Anthropic();

// Migrate: create learnings table
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS model_learnings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      insight TEXT NOT NULL,
      data TEXT,
      confidence_adjustment INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS learning_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      picks_analyzed INTEGER,
      summary TEXT,
      ran_at TEXT DEFAULT (datetime('now'))
    );
  `);
} catch {}

// Pull all performance data from the DB
function getPerformanceData() {
  const decided = db.prepare(`
    SELECT * FROM picks WHERE result IN ('W', 'L', 'Push')
    ORDER BY date ASC
  `).all();

  if (decided.length < 10) return null; // Need at least 10 decided picks

  // By sport
  const bySport = db.prepare(`
    SELECT sport,
      COUNT(*) as total,
      SUM(CASE WHEN result='W' THEN 1 ELSE 0 END) as wins,
      SUM(CASE WHEN result='L' THEN 1 ELSE 0 END) as losses,
      SUM(CASE WHEN result='Push' THEN 1 ELSE 0 END) as pushes,
      AVG(confidence) as avg_confidence
    FROM picks WHERE result IN ('W','L','Push')
    GROUP BY sport ORDER BY total DESC
  `).all();

  // By bet type
  const byBetType = db.prepare(`
    SELECT bet_type,
      COUNT(*) as total,
      SUM(CASE WHEN result='W' THEN 1 ELSE 0 END) as wins,
      SUM(CASE WHEN result='L' THEN 1 ELSE 0 END) as losses
    FROM picks WHERE result IN ('W','L','Push')
    GROUP BY bet_type ORDER BY total DESC
  `).all();

  // By confidence band
  const byConfidence = db.prepare(`
    SELECT
      CASE
        WHEN confidence >= 90 THEN '90-100'
        WHEN confidence >= 85 THEN '85-89'
        WHEN confidence >= 80 THEN '80-84'
        WHEN confidence >= 75 THEN '75-79'
        ELSE '70-74'
      END as band,
      COUNT(*) as total,
      SUM(CASE WHEN result='W' THEN 1 ELSE 0 END) as wins,
      SUM(CASE WHEN result='L' THEN 1 ELSE 0 END) as losses
    FROM picks WHERE result IN ('W','L','Push')
    GROUP BY band ORDER BY band DESC
  `).all();

  // By day of week
  const byDay = db.prepare(`
    SELECT
      CASE strftime('%w', date)
        WHEN '0' THEN 'Sunday' WHEN '1' THEN 'Monday' WHEN '2' THEN 'Tuesday'
        WHEN '3' THEN 'Wednesday' WHEN '4' THEN 'Thursday'
        WHEN '5' THEN 'Friday' WHEN '6' THEN 'Saturday'
      END as day_of_week,
      COUNT(*) as total,
      SUM(CASE WHEN result='W' THEN 1 ELSE 0 END) as wins,
      SUM(CASE WHEN result='L' THEN 1 ELSE 0 END) as losses
    FROM picks WHERE result IN ('W','L','Push')
    GROUP BY day_of_week ORDER BY total DESC
  `).all();

  // Lock performance
  const lockPerf = db.prepare(`
    SELECT COUNT(*) as total,
      SUM(CASE WHEN result='W' THEN 1 ELSE 0 END) as wins,
      SUM(CASE WHEN result='L' THEN 1 ELSE 0 END) as losses
    FROM picks WHERE is_lock=1 AND result IN ('W','L','Push')
  `).get();

  // Recent trend (last 20 picks vs first 20 picks)
  const recentPicks = db.prepare(`
    SELECT result FROM picks WHERE result IN ('W','L','Push')
    ORDER BY date DESC, id DESC LIMIT 20
  `).all();
  const recentWins = recentPicks.filter(p => p.result === 'W').length;

  // Signals analysis (which signal keywords appear in winning vs losing picks)
  const allDecided = db.prepare(`
    SELECT signals, result FROM picks WHERE result IN ('W','L') AND signals IS NOT NULL AND signals != '[]'
  `).all();

  return { decided, bySport, byBetType, byConfidence, byDay, lockPerf, recentWins, recentTotal: recentPicks.length, allDecided, totalDecided: decided.length };
}

// Run the learning analysis
async function runLearningAnalysis() {
  const data = getPerformanceData();
  if (!data) {
    console.log('[Learning] Not enough data yet (need 10+ decided picks).');
    return null;
  }

  console.log(`[Learning] Analyzing ${data.totalDecided} decided picks...`);

  const formatTable = (rows, keys) => rows.map(r =>
    keys.map(k => `${k}:${typeof r[k] === 'number' && !Number.isInteger(r[k]) ? r[k].toFixed(1) : r[k]}`).join(' | ')
  ).join('\n');

  const prompt = `You are Cash — an AI sports betting analyst reviewing your own historical performance to improve future picks.

Here is your complete performance data so far:

TOTAL DECIDED PICKS: ${data.totalDecided}

BY SPORT:
${formatTable(data.bySport, ['sport','total','wins','losses','avg_confidence'])}

BY BET TYPE:
${formatTable(data.byBetType, ['bet_type','total','wins','losses'])}

BY CONFIDENCE BAND:
${formatTable(data.byConfidence, ['band','total','wins','losses'])}

BY DAY OF WEEK:
${formatTable(data.byDay, ['day_of_week','total','wins','losses'])}

LOCK PERFORMANCE: ${data.lockPerf.wins}-${data.lockPerf.losses} (${data.lockPerf.total} total)

RECENT TREND (last ${data.recentTotal} picks): ${data.recentWins}W-${data.recentTotal - data.recentWins}L

SIGNAL ANALYSIS (samples of what won vs lost):
${data.allDecided.slice(0, 30).map(p => `[${p.result}] ${p.signals}`).join('\n')}

Based on this data, you must:
1. Identify your strongest edges (what's working well, keep doing more of this)
2. Identify your weaknesses (what's losing, do less or avoid)
3. Find patterns in the data that should change HOW you pick in the future
4. Calibrate your confidence scores — if 85+ picks are only hitting 55%, you're overconfident
5. Recommend specific adjustments to your signal weighting

Return ONLY a JSON object:
{
  "summary": "2-3 sentence overall assessment of performance and biggest takeaway",
  "insights": [
    {
      "category": "sport|bet_type|confidence|day|signal|general",
      "insight": "Specific, actionable finding (e.g. 'NHL totals are 7-2 (78%), prioritize these')",
      "action": "What to do differently going forward",
      "confidence_adjustment": -10 to +10 (how to adjust confidence scores for this category, 0 if no change),
      "data": "The specific numbers supporting this insight"
    }
  ],
  "priority_adjustments": [
    "In order of importance: specific changes to make to the pick generation process"
  ],
  "target_areas": ["Sports/bet types/situations to focus on more"],
  "avoid_areas": ["Sports/bet types/situations to reduce or avoid"]
}`;

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');

    const analysis = JSON.parse(jsonMatch[0]);

    // Clear old learnings and save new ones
    db.prepare('DELETE FROM model_learnings').run();
    for (const insight of analysis.insights || []) {
      db.prepare(`
        INSERT INTO model_learnings (category, insight, data, confidence_adjustment)
        VALUES (?, ?, ?, ?)
      `).run(
        insight.category,
        `${insight.insight} → ${insight.action}`,
        insight.data || '',
        insight.confidence_adjustment || 0
      );
    }

    // Log the run
    db.prepare(`
      INSERT INTO learning_runs (picks_analyzed, summary)
      VALUES (?, ?)
    `).run(data.totalDecided, analysis.summary);

    console.log(`[Learning] Analysis complete. ${analysis.insights?.length} insights saved.`);
    console.log(`[Learning] Summary: ${analysis.summary}`);
    return analysis;
  } catch (err) {
    console.error('[Learning] Error:', err.message);
    return null;
  }
}

// Get current learnings to inject into pick generation
function getCurrentLearnings() {
  const learnings = db.prepare('SELECT * FROM model_learnings ORDER BY id DESC').all();
  const lastRun = db.prepare('SELECT * FROM learning_runs ORDER BY id DESC LIMIT 1').get();

  if (learnings.length === 0) return null;

  return {
    summary: lastRun?.summary || '',
    insights: learnings,
    lastRan: lastRun?.ran_at || null
  };
}

// Schedule: run every Sunday at midnight
function scheduleLearning() {
  function msUntilNextSunday() {
    const now = new Date();
    const day = now.getDay(); // 0=Sun
    const daysUntil = day === 0 ? 7 : 7 - day;
    const next = new Date(now);
    next.setDate(now.getDate() + daysUntil);
    next.setHours(0, 5, 0, 0); // 12:05 AM Sunday
    return next - now;
  }

  const ms = msUntilNextSunday();
  console.log(`[Learning] Weekly analysis scheduled (${Math.round(ms / 3600000)}h from now).`);
  setTimeout(() => {
    runLearningAnalysis();
    setInterval(runLearningAnalysis, 7 * 24 * 60 * 60 * 1000);
  }, ms);
}

module.exports = { runLearningAnalysis, getCurrentLearnings, scheduleLearning };
