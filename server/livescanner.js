const Anthropic = require('@anthropic-ai/sdk');
const { broadcastPush } = require('./routes/alerts');
const { db } = require('./db');

const client = new Anthropic();

// Track alerts already sent today to avoid duplicates
const sentAlerts = new Set();

async function scanLiveBets() {
  const now = new Date();
  const hour = now.getHours();

  // Only run during game hours: 11am–midnight
  if (hour < 11 || hour >= 24) {
    console.log('[LiveScanner] Outside game hours, skipping.');
    return;
  }

  console.log('[LiveScanner] Scanning for live betting opportunities...');

  const prompt = `You are Cash — a sharp sports betting AI. Right now it is ${now.toLocaleString('en-US', { timeZone: 'America/New_York' })} ET.

Search for games currently IN PROGRESS or starting within the next 60 minutes across NBA, MLB, NHL, NFL, NCAAB, NCAAB, MLS. Look for live betting opportunities where the current live line offers real value — situations like:
- A strong team down early but line hasn't adjusted to reflect their quality
- A key player just went out, but the live line hasn't moved yet
- A game where pace or score makes a live total dramatically mispriced
- Sharp money hitting a live line creating reverse line movement

For each opportunity you find with 80+ confidence, return it. If no strong live opportunities exist right now, return an empty array.

Return ONLY a JSON array:
[
  {
    "matchup": "Lakers vs Celtics",
    "situation": "Lakers down 8 at halftime, live line now +6.5",
    "pick": "Lakers +6.5 live",
    "odds": "-110",
    "confidence": 84,
    "alert": "🔒 LIVE PLAY: Lakers +6.5 — Sharp money loading up at half. Public fading them but line held, value here.",
    "reasoning": "Brief sharp reason why this has value right now"
  }
]

If nothing meets 80+ confidence, return: []`;

  try {
    let messages = [{ role: 'user', content: prompt }];
    let finalText = '';
    let maxTurns = 5;

    while (maxTurns > 0) {
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 6 }],
        messages
      });

      let turnText = '';
      for (const block of response.content) {
        if (block.type === 'text') turnText += block.text;
      }
      if (turnText) finalText = turnText;
      if (response.stop_reason !== 'tool_use') break;

      messages.push({ role: 'assistant', content: response.content });
      const toolBlocks = response.content.filter(b => b.type === 'tool_use');
      messages.push({
        role: 'user',
        content: toolBlocks.map(b => ({ type: 'tool_result', tool_use_id: b.id, content: 'Searched.' }))
      });
      maxTurns--;
    }

    const jsonMatch = finalText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) { console.log('[LiveScanner] No JSON returned.'); return; }

    const opportunities = JSON.parse(jsonMatch[0]);
    if (!opportunities.length) { console.log('[LiveScanner] No live opportunities found.'); return; }

    for (const opp of opportunities) {
      if (opp.confidence < 80) continue;

      // Deduplicate: don't send same alert twice
      const key = `${opp.matchup}-${opp.pick}`;
      if (sentAlerts.has(key)) continue;
      sentAlerts.add(key);

      console.log(`[LiveScanner] LIVE ALERT: ${opp.pick} (${opp.confidence}%)`);

      // Save to DB for display on site
      try {
        db.exec(`CREATE TABLE IF NOT EXISTS live_alerts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          matchup TEXT, pick TEXT, odds TEXT, confidence INTEGER,
          situation TEXT, alert TEXT, reasoning TEXT,
          sent_at TEXT DEFAULT (datetime('now'))
        )`);
        db.prepare(`INSERT INTO live_alerts (matchup, pick, odds, confidence, situation, alert, reasoning)
          VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(opp.matchup, opp.pick, opp.odds, opp.confidence, opp.situation, opp.alert, opp.reasoning);
      } catch {}

      // Broadcast push notification
      await broadcastPush(
        '🔒 Cash spotted a live play',
        opp.alert,
        { url: 'https://cashout.inc', pick: opp.pick, odds: opp.odds, confidence: opp.confidence }
      );
    }
  } catch (err) {
    console.error('[LiveScanner] Error:', err.message);
  }
}

// Schedule: every 20 minutes
function startLiveScanner() {
  console.log('[LiveScanner] Starting — scans every 20 minutes during game hours.');
  scanLiveBets(); // run once on startup
  setInterval(scanLiveBets, 20 * 60 * 1000);
}

module.exports = { startLiveScanner, scanLiveBets };
