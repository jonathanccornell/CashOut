const Anthropic = require('@anthropic-ai/sdk');
const { db } = require('./db');

const client = new Anthropic();

// Migrate: create learnings tables
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
    CREATE TABLE IF NOT EXISTS daily_analysis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      pick_id INTEGER,
      matchup TEXT,
      pick TEXT,
      result TEXT,
      why TEXT,
      key_factor TEXT,
      lesson TEXT,
      created_at TEXT DEFAULT (datetime('now'))
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

  // Signal performance
  const signalPerf = db.prepare(`
    SELECT tag, appearances, wins, losses,
      ROUND(CAST(wins AS FLOAT) / NULLIF(wins+losses, 0) * 100, 1) as win_rate,
      ROUND(total_clv / NULLIF(appearances, 0), 2) as avg_clv
    FROM signal_performance
    WHERE appearances >= 3
    ORDER BY avg_clv DESC
  `).all();

  // CLV performance
  const clvStats = db.prepare(`
    SELECT
      SUM(CASE WHEN clv > 0 THEN 1 ELSE 0 END) as beat_market,
      SUM(CASE WHEN clv < 0 THEN 1 ELSE 0 END) as lost_market,
      SUM(CASE WHEN clv IS NULL THEN 1 ELSE 0 END) as no_clv_data,
      AVG(CASE WHEN clv IS NOT NULL THEN clv END) as avg_clv,
      SUM(CASE WHEN clv > 0 AND result = 'W' THEN 1 ELSE 0 END) as clv_pos_wins,
      SUM(CASE WHEN clv > 0 AND result = 'L' THEN 1 ELSE 0 END) as clv_pos_losses,
      SUM(CASE WHEN clv < 0 AND result = 'W' THEN 1 ELSE 0 END) as clv_neg_wins,
      SUM(CASE WHEN clv < 0 AND result = 'L' THEN 1 ELSE 0 END) as clv_neg_losses
    FROM picks WHERE result IN ('W','L','Push')
  `).get();

  // Situational pattern performance
  const situationalPerf = db.prepare(`
    SELECT pattern,
      COUNT(*) as appearances,
      SUM(CASE WHEN result = 'W' THEN 1 ELSE 0 END) as wins,
      SUM(CASE WHEN result = 'L' THEN 1 ELSE 0 END) as losses,
      ROUND(AVG(CASE WHEN clv IS NOT NULL THEN clv END), 2) as avg_clv
    FROM situational_patterns
    WHERE result IN ('W','L','Push')
    GROUP BY pattern
    HAVING appearances >= 3
    ORDER BY appearances DESC
  `).all();

  // Official tendencies summary
  const officialTendencies = getOfficialTendencies();

  // Adversarial simulation: what if we had bet the opposite?
  const oppositeSimulation = {
    wins: decided.length > 0 ? decided.filter(p => p.result === 'L').length : 0,
    losses: decided.length > 0 ? decided.filter(p => p.result === 'W').length : 0,
    note: `If Cash had bet opposite every pick: ${decided.filter(p => p.result === 'L').length}W-${decided.filter(p => p.result === 'W').length}L`
  };

  // CLV-only simulation: how did picks with positive CLV perform vs negative CLV?
  const clvPositivePicks = db.prepare(`SELECT result FROM picks WHERE clv > 0 AND result IN ('W','L')`).all();
  const clvNegativePicks = db.prepare(`SELECT result FROM picks WHERE clv < 0 AND result IN ('W','L')`).all();

  return {
    decided, bySport, byBetType, byConfidence, byDay, lockPerf, recentWins, recentTotal: recentPicks.length,
    allDecided, totalDecided: decided.length,
    signalPerf, clvStats, situationalPerf, officialTendencies, oppositeSimulation,
    clvPositivePicks, clvNegativePicks
  };
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

  const clvSection = data.clvStats ? `
CLV PERFORMANCE (Closing Line Value — did you beat the market?):
Picks that beat closing line: ${data.clvStats.beat_market || 0}
Picks that lost to closing line: ${data.clvStats.lost_market || 0}
Average CLV across all picks: ${data.clvStats.avg_clv?.toFixed(2) || 'N/A'}
When CLV was POSITIVE → W/L: ${data.clvStats.clv_pos_wins || 0}W-${data.clvStats.clv_pos_losses || 0}L
When CLV was NEGATIVE → W/L: ${data.clvStats.clv_neg_wins || 0}W-${data.clvStats.clv_neg_losses || 0}L
` : 'CLV data not yet available (needs more graded picks with closing lines)';

  const signalSection = data.signalPerf && data.signalPerf.length > 0 ? `
SIGNAL ATTRIBUTION (which signals actually predicted outcomes):
${formatTable(data.signalPerf, ['tag','appearances','wins','losses','win_rate','avg_clv'])}
` : 'Signal attribution data not yet available.';

  const situationalSection = data.situationalPerf && data.situationalPerf.length > 0 ? `
SITUATIONAL PATTERN PERFORMANCE:
${formatTable(data.situationalPerf, ['pattern','appearances','wins','losses','avg_clv'])}
` : 'Situational pattern data not yet available.';

  const officialSection = data.officialTendencies && data.officialTendencies.length > 0 ? `
OFFICIAL/REFEREE TENDENCIES (games with known officials):
${data.officialTendencies.map(o => `${o.official_name} (${o.sport}): ${o.games} games, ${o.overs} overs/${o.unders} unders, avg total ${o.avg_total?.toFixed(0)}`).join('\n')}
` : 'Official tendency data building (needs more games).';

  const adversarialSection = `
ADVERSARIAL SIMULATION:
${data.oppositeSimulation.note}
Picks with POSITIVE CLV: ${data.clvPositivePicks?.filter(p=>p.result==='W').length||0}W-${data.clvPositivePicks?.filter(p=>p.result==='L').length||0}L
Picks with NEGATIVE CLV: ${data.clvNegativePicks?.filter(p=>p.result==='W').length||0}W-${data.clvNegativePicks?.filter(p=>p.result==='L').length||0}L
`;

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

${clvSection}

${signalSection}

${situationalSection}

${officialSection}

${adversarialSection}

SIGNAL SAMPLES (what won vs lost recently):
${data.allDecided.slice(0, 30).map(p => `[${p.result}] ${p.signals}`).join('\n')}

Based on ALL this data, you must:
1. Assess your CLV performance — are you genuinely sharp (beating closing lines) or just getting lucky?
2. Identify which signals have the highest win rate AND positive CLV (real edge vs noise)
3. Identify which signals have negative CLV (noise — reduce their weight)
4. Analyze situational patterns — which spots consistently produce value?
5. Evaluate official tendencies and how to exploit them
6. Run the adversarial analysis: what does the opposite simulation tell you?
7. Calibrate confidence scores based on actual win rates at each band
8. Recommend specific adjustments to the pick generation process

Return ONLY a JSON object:
{
  "summary": "2-3 sentence overall assessment including CLV sharpness rating",
  "sharpness_rating": "sharp|developing|square (based on CLV data)",
  "insights": [
    {
      "category": "sport|bet_type|confidence|day|signal|clv|situational|official|adversarial|general",
      "insight": "Specific, actionable finding",
      "action": "What to do differently going forward",
      "confidence_adjustment": -10 to +10,
      "data": "The specific numbers supporting this insight"
    }
  ],
  "priority_adjustments": ["In order of importance: specific changes to make to the pick generation process"],
  "target_areas": ["Sports/bet types/signals/situations to focus on more"],
  "avoid_areas": ["Sports/bet types/signals/situations to reduce or avoid"],
  "kelly_calibration": "Assessment of whether current unit sizing is appropriate based on results"
}`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
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
  const postGame = getRecentPostGameAnalyses();

  if (learnings.length === 0 && postGame.length === 0) return null;

  return {
    summary: lastRun?.summary || '',
    insights: learnings,
    lastRan: lastRun?.ran_at || null,
    postGameAnalyses: postGame
  };
}

// Run post-game analysis on yesterday's graded picks
async function runDailyPostGameAnalysis() {
  // Get yesterday's date
  const yDate = new Date(Date.now() - 86400000).toLocaleDateString('en-CA', {
    timeZone: 'America/New_York'
  });

  // Check if we already ran for this date
  const existing = db.prepare('SELECT id FROM daily_analysis WHERE date = ? LIMIT 1').get(yDate);
  if (existing) {
    console.log(`[PostGame] Analysis already exists for ${yDate}, skipping.`);
    return null;
  }

  // Get graded picks from yesterday
  const picks = db.prepare(`
    SELECT * FROM picks WHERE date = ? AND result IN ('W', 'L', 'Push')
  `).all(yDate);

  if (picks.length === 0) {
    console.log(`[PostGame] No graded picks found for ${yDate}.`);
    return null;
  }

  console.log(`[PostGame] Analyzing ${picks.length} picks from ${yDate}...`);

  const pickSummaries = picks.map(p =>
    `ID:${p.id} | ${p.sport} | ${p.matchup} | Pick: ${p.pick} (${p.bet_type}) | Odds: ${p.odds} | Confidence: ${p.confidence} | Result: ${p.result} | Reasoning was: ${p.reasoning}`
  ).join('\n\n');

  const prompt = `You are Cash — an elite AI sports betting analyst. You placed the following bets on ${yDate} and need to research and understand WHY each one won or lost.

PICKS FROM ${yDate}:
${pickSummaries}

For EACH pick above:
1. Search the web to find the actual final score and key events of that game
2. Research what happened: injuries, player performance, line movement after tip-off/kick-off, key plays
3. Identify the PRIMARY reason the pick hit or missed (e.g. "Star player scored only 14pts vs expected 28", "Blowout in 4th quarter covered spread", "Pitcher got hurt in 3rd inning", etc.)
4. Extract a LESSON: What should Cash do differently next time? What signal was missed or overweighted?

Return ONLY a JSON array — one object per pick:
[
  {
    "pick_id": 123,
    "matchup": "Team A vs Team B",
    "pick": "Team A -3.5",
    "result": "W",
    "why": "One sentence: the actual reason this won or lost based on what happened in the game",
    "key_factor": "The single most important thing that determined the outcome (e.g. 'LeBron 41pts', 'Starting pitcher ejected', '4th quarter blowout')",
    "lesson": "One actionable lesson for Cash going forward (e.g. 'Check closer save% before backing teams with shaky closers in MLB')"
  }
]

Search the web for each game result. Be specific and factual — cite actual stats and scores.`;

  try {
    let messages = [{ role: 'user', content: prompt }];
    let finalText = '';
    let maxTurns = 12;

    while (maxTurns > 0) {
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 8000,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 15 }],
        messages
      });

      let turnText = '';
      for (const block of response.content) {
        if (block.type === 'text') turnText += block.text;
      }
      if (turnText) finalText = turnText;

      if (response.stop_reason !== 'tool_use') break;

      messages.push({ role: 'assistant', content: response.content });
      const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');
      if (toolUseBlocks.length > 0) {
        messages.push({
          role: 'user',
          content: toolUseBlocks.map(block => ({
            type: 'tool_result',
            tool_use_id: block.id,
            content: 'Search completed. Continue analysis.'
          }))
        });
      }
      maxTurns--;
    }

    const jsonMatch = finalText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array in response');

    const analyses = JSON.parse(jsonMatch[0]);

    // Save each pick analysis
    const insert = db.prepare(`
      INSERT INTO daily_analysis (date, pick_id, matchup, pick, result, why, key_factor, lesson)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const a of analyses) {
      insert.run(yDate, a.pick_id, a.matchup, a.pick, a.result, a.why, a.key_factor, a.lesson);
    }

    console.log(`[PostGame] Saved ${analyses.length} post-game analyses for ${yDate}.`);
    return analyses;
  } catch (err) {
    console.error('[PostGame] Error:', err.message);
    return null;
  }
}

// Get recent post-game analyses (last 7 days) for injection into picks
function getRecentPostGameAnalyses() {
  return db.prepare(`
    SELECT * FROM daily_analysis
    WHERE date >= date('now', '-7 days')
    ORDER BY date DESC, id ASC
  `).all();
}

// Extract known signal tags from a signals array
function extractSignalTags(signals) {
  const tags = new Set();
  const text = (Array.isArray(signals) ? signals.join(' ') : String(signals || '')).toLowerCase();
  if (text.includes('rlm') || text.includes('reverse line')) tags.add('RLM');
  if (text.includes('steam')) tags.add('steam');
  if (text.includes('b2b') || text.includes('back-to-back') || text.includes('back to back')) tags.add('B2B');
  if (text.includes('travel') || text.includes('miles')) tags.add('travel');
  if (text.includes('injur') || text.includes(' out ') || text.includes('questionable') || text.includes('gtd')) tags.add('injury');
  if (text.includes('epa') || text.includes('dvoa')) tags.add('EPA_DVOA');
  if (text.includes('net rating') || text.includes('netrtg')) tags.add('net_rating');
  if (text.includes('% public') || text.includes('% of bets') || text.includes('public on') || text.includes('public betting')) tags.add('public_pct');
  if (text.includes('wind') || text.includes('weather') || text.includes('temperature') || text.includes('rain')) tags.add('weather');
  if (text.includes('fip') || text.includes('xfip') || text.includes('era')) tags.add('FIP_ERA');
  if (text.includes('l20') || text.includes('l5') || text.includes('hit rate') || text.includes('prop line') || text.includes('last 20')) tags.add('prop_trend');
  if (text.includes('divisional')) tags.add('divisional');
  if (text.includes('kenpom')) tags.add('KenPom');
  if (text.includes('look-ahead') || text.includes('lookahead') || text.includes('trap game')) tags.add('look_ahead');
  if (text.includes('bye week')) tags.add('bye_week');
  if (text.includes('pace')) tags.add('pace');
  if (text.includes('xg') || text.includes('expected goals')) tags.add('xG');
  if (text.includes('pdo')) tags.add('PDO');
  if (text.includes('line moved') || text.includes('line opened') || text.includes('line dropped')) tags.add('line_movement');
  if (tags.size === 0) tags.add('general');
  return [...tags];
}

// Update signal performance table after grading
function updateSignalPerformance(pick, result, clv) {
  if (!pick.signals) return;
  let signals;
  try { signals = typeof pick.signals === 'string' ? JSON.parse(pick.signals) : pick.signals; } catch { return; }
  const tags = extractSignalTags(signals);
  for (const tag of tags) {
    const existing = db.prepare('SELECT * FROM signal_performance WHERE tag = ?').get(tag);
    if (existing) {
      db.prepare(`
        UPDATE signal_performance SET
          appearances = appearances + 1,
          wins = wins + ?,
          losses = losses + ?,
          pushes = pushes + ?,
          total_clv = total_clv + ?,
          last_updated = datetime('now')
        WHERE tag = ?
      `).run(
        result === 'W' ? 1 : 0,
        result === 'L' ? 1 : 0,
        result === 'Push' ? 1 : 0,
        clv || 0,
        tag
      );
    } else {
      db.prepare(`
        INSERT INTO signal_performance (tag, appearances, wins, losses, pushes, total_clv)
        VALUES (?, 1, ?, ?, ?, ?)
      `).run(tag, result === 'W' ? 1 : 0, result === 'L' ? 1 : 0, result === 'Push' ? 1 : 0, clv || 0);
    }
  }
}

// Calculate CLV: positive = beat the market, negative = market was right
function calculateCLV(pick, closingLine) {
  if (!closingLine) return null;
  try {
    const openingLine = pick.line || pick.odds || '';
    const betType = pick.bet_type || '';
    const pickText = (pick.pick || '').toLowerCase();

    if (betType === 'spread' || betType === 'total' || betType === 'prop') {
      const openNum = parseFloat(String(openingLine).replace(/[^0-9.\-]/g, '')) || null;
      const closeNum = parseFloat(closingLine.replace(/[^0-9.\-]/g, '')) || null;
      if (openNum === null || closeNum === null) return null;

      if (betType === 'spread') {
        return openNum - closeNum;
      } else if (betType === 'total' || betType === 'prop') {
        const isOver = pickText.includes('over');
        if (isOver) {
          return closeNum - openNum;
        } else {
          return openNum - closeNum;
        }
      }
    } else if (betType === 'moneyline') {
      // Convert American odds to implied probability
      const toImplied = (ml) => {
        const n = parseFloat(ml);
        if (!n) return null;
        return n < 0 ? Math.abs(n) / (Math.abs(n) + 100) : 100 / (n + 100);
      };
      const openProb = toImplied(openingLine);
      const closeProb = toImplied(closingLine);
      if (!openProb || !closeProb) return null;
      // If we bet a team: getting them at lower implied prob = better value
      return (openProb - closeProb) * 100; // positive = we got better price
    }
    return null;
  } catch { return null; }
}

// Track which situational patterns fired on each pick
function detectSituations(pick) {
  const situations = [];
  const signals = (() => { try { return JSON.parse(pick.signals || '[]'); } catch { return []; } })();
  const text = signals.join(' ').toLowerCase() + ' ' + (pick.reasoning || '').toLowerCase();

  if (text.includes('% public') && (text.match(/(\d+)%/) || [])[1] > 60) situations.push('public_heavy');
  if (text.includes('reverse line') || text.includes('rlm')) situations.push('RLM');
  if (text.includes('b2b') || text.includes('back-to-back')) situations.push('B2B');
  if (text.includes('divisional')) situations.push('divisional');
  if (text.includes('dog') || (pick.pick || '').includes('+')) situations.push('underdog');
  if (text.includes('look-ahead') || text.includes('trap')) situations.push('look_ahead');
  if (text.includes('bye week')) situations.push('bye_week');
  if (text.includes('road') && (text.includes('dog') || text.includes('underdog'))) situations.push('road_dog');
  if (pick.is_lock) situations.push('lock');
  if (text.includes('steam')) situations.push('steam');
  return situations;
}

function saveSituationalPatterns(pick, result, clv) {
  const situations = detectSituations(pick);
  for (const pattern of situations) {
    db.prepare(`
      INSERT INTO situational_patterns (pattern, pick_id, game_date, result, clv)
      VALUES (?, ?, ?, ?, ?)
    `).run(pattern, pick.id, pick.date, result, clv || null);
  }
}

// Extract and store official tendency data from post-game analyses
function trackOfficialsFromAnalysis(postGameAnalyses) {
  if (!postGameAnalyses || postGameAnalyses.length === 0) return;
  // Schedules a background search for officials — runs async, no await needed
  (async () => {
    try {
      const gameList = postGameAnalyses.map(a => `${a.matchup} on ${a.date}`).join('\n');
      const prompt = `For each of these sports games, find the lead referee/umpire/official crew and whether the game was high-scoring or low-scoring relative to expectations:

${gameList}

Return ONLY a JSON array:
[
  {
    "matchup": "Team A vs Team B",
    "date": "2024-01-15",
    "sport": "NBA",
    "official": "Tony Brothers",
    "total_pts": 224,
    "went_over": true,
    "notes": "High foul game: 52 total fouls, 68 free throws"
  }
]

Only include games where you can find official information. Skip if data unavailable.`;

      // Handle tool_use in agentic loop
      let msgs = [{ role: 'user', content: prompt }];
      let finalText = '';
      let maxTurns = 6;
      while (maxTurns > 0) {
        const resp = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 3000,
          tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 8 }],
          messages: msgs
        });
        let t = '';
        for (const b of resp.content) { if (b.type === 'text') t += b.text; }
        if (t) finalText = t;
        if (resp.stop_reason !== 'tool_use') break;
        msgs.push({ role: 'assistant', content: resp.content });
        msgs.push({ role: 'user', content: resp.content.filter(b => b.type === 'tool_use').map(b => ({ type: 'tool_result', tool_use_id: b.id, content: 'Search done.' })) });
        maxTurns--;
      }

      const match = finalText.match(/\[[\s\S]*\]/);
      if (!match) return;
      const officials = JSON.parse(match[0]);
      for (const o of officials) {
        db.prepare(`
          INSERT INTO official_tendencies (sport, official_name, game_date, matchup, total_pts, went_over, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(o.sport || '', o.official || '', o.date || '', o.matchup || '', o.total_pts || null, o.went_over ? 1 : 0, o.notes || '');
      }
      console.log(`[Officials] Saved ${officials.length} official records.`);
    } catch (err) {
      console.error('[Officials] Error:', err.message);
    }
  })();
}

function getOfficialTendencies() {
  return db.prepare(`
    SELECT official_name, sport,
      COUNT(*) as games,
      SUM(went_over) as overs,
      COUNT(*) - SUM(went_over) as unders,
      AVG(total_pts) as avg_total
    FROM official_tendencies
    WHERE official_name != ''
    GROUP BY official_name, sport
    HAVING games >= 3
    ORDER BY games DESC
  `).all();
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

module.exports = {
  runLearningAnalysis, getCurrentLearnings, scheduleLearning,
  runDailyPostGameAnalysis,
  updateSignalPerformance, calculateCLV, saveSituationalPatterns, trackOfficialsFromAnalysis
};
