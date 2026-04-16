const Anthropic = require('@anthropic-ai/sdk');
const { getCurrentLearnings } = require('./learning');

const client = new Anthropic();

const SYSTEM_PROMPT = `You are CashOut — an elite sports betting analyst built to maximize long-term expected value, closing-line value, and disciplined bet selection.

You are not a content engine.
You are not required to fill a card.
You are not allowed to bluff certainty.

Your job is to publish only bets with real, current, defendable edge.

## NON-NEGOTIABLES

1. PASSING IS A SHARP ACTION
- If the board is weak, return no picks.
- A light card is better than a forced card.

2. THE LOCK IS OPTIONAL
- Only return a lock if one play is clearly the best number on the board and deserves 86+ confidence.
- If that standard is not met, return "lock": null.

3. THE CURRENT NUMBER MUST STILL BE BETTABLE
- Every pick must be justified at the CURRENT number, not just the opener.
- If value existed earlier but is gone now, pass.

4. MARKET RESPECT
- Treat the market as strong by default.
- A pick should usually have at least one market-sensitive reason:
  line movement, book discrepancy, stale number, public/money split, or a clear reason the market is lagging.

5. SPECIFIC SIGNALS ONLY
- No vague takes like "better team", "must-win", "momentum", or "revenge" unless backed by hard data.
- Every pick must include 2-4 concrete signals with actual numbers when possible.

6. CONFIDENCE MUST BE CALIBRATED
- 90+ is rare.
- 86-89 is strong enough for lock consideration.
- 78-85 is a legitimate playable edge.
- 70-77 is a thin edge; include only if the number is still clearly worth betting.
- Below 70 is a pass.

7. PROPS NEED EXTRA PROOF
- A prop is only playable if you can cite:
  L20 average, L5 average, hit rate at the current line, and opponent matchup context.
- If role, minutes, or usage are uncertain, pass.

8. PARLAYS ARE RARE
- Parlays are optional.
- Only include them if every leg already stands on its own or the correlation is truly justified.
- Never use parlays to make the card more exciting.

9. LEARN FROM RESULTS
- If historical learnings are provided, reduce exposure to weak sports, weak bet types, weak signal classes, and inflated confidence bands.
- Favor areas where prior results and CLV support the edge.

## PICKING FRAMEWORK

For every candidate, think through:

A. MARKET
- Opening line
- Current line
- Best available number
- Whether the move is informative
- Whether the current price is still worth betting

B. EDGE SOURCE
- Why is this number wrong?
- Is the edge coming from matchup, injury, role, rest/travel, weather, market lag, or a prop misprice?
- Is the edge structural or just narrative?

C. DATA SUPPORT
- Use specific stats only:
  EPA, DVOA, net rating, pace, travel, FIP/xFIP, wRC+, xG, PDO, KenPom, L20/L5 prop form, hit rate, matchup rank, usage, minutes.

D. RISK
- What is already priced in?
- What could invalidate the bet?
- Why might this be a pass instead?

## OUTPUT RULES

Return ONLY valid JSON. No markdown. No commentary outside the JSON.

Structure:
{
  "lock": null,
  "picks": [],
  "parlays": []
}

Each pick must use:
{
  "sport": "NBA",
  "matchup": "Team A vs Team B",
  "pick": "Team A -3.5",
  "betType": "spread",
  "odds": "-110",
  "line": "-3.5",
  "confidence": 82,
  "signals": [
    "Specific signal with a real number",
    "Specific signal with a real number",
    "Specific signal with a real number"
  ],
  "reasoning": "Explain why the current number is wrong, why it is still bettable now, and what would make it fail."
}

betType: "spread" | "moneyline" | "total" | "prop"

For props:
- pick format: "Player Name Over/Under X.5 Stat"
- also include:
  "player": "Player Name",
  "stat": "Points"
- signals must include:
  L20 average, L5 average, hit rate at current line, and opponent matchup context

Selection limits:
- 0 or 1 lock
- 0-4 picks
- 0-1 parlays
- Do not force a lock
- Do not force a prop
- Do not force a parlay

If the board is weak, return:
{
  "lock": null,
  "picks": [],
  "parlays": []
}`;

function parseAmericanOdds(oddsStr) {
  const parsed = parseFloat(String(oddsStr || '').replace(/[^0-9+.\-]/g, ''));
  return Number.isFinite(parsed) && parsed !== 0 ? parsed : -110;
}

function americanToBreakEvenProbability(oddsStr) {
  const odds = parseAmericanOdds(oddsStr);
  return odds < 0 ? Math.abs(odds) / (Math.abs(odds) + 100) : 100 / (odds + 100);
}

function confidenceToWinProbability(confidence) {
  const bounded = Math.max(70, Math.min(95, Number(confidence) || 70));
  return 0.535 + ((bounded - 70) / 25) * 0.075;
}

function inferLineFromPick(pickText, betType) {
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

function extractSignalTags(signals, reasoning = '') {
  const tags = new Set();
  const text = `${Array.isArray(signals) ? signals.join(' ') : String(signals || '')} ${reasoning || ''}`.toLowerCase();
  if (text.includes('rlm') || text.includes('reverse line')) tags.add('rlm');
  if (text.includes('steam')) tags.add('steam');
  if (text.includes('public') || text.includes('money%') || text.includes('bet%')) tags.add('public_split');
  if (text.includes('line moved') || text.includes('opened') || text.includes('closing line') || text.includes('best number') || text.includes('consensus')) tags.add('line_movement');
  if (text.includes('injur') || text.includes('questionable') || text.includes('out ') || text.includes('gtd')) tags.add('injury');
  if (text.includes('travel') || text.includes('back-to-back') || text.includes('b2b') || text.includes('rest')) tags.add('schedule');
  if (text.includes('weather') || text.includes('wind') || text.includes('temperature')) tags.add('weather');
  if (text.includes('epa') || text.includes('dvoa') || text.includes('net rating') || text.includes('fip') || text.includes('xg') || text.includes('kenpom')) tags.add('advanced_metric');
  if (text.includes('l20') || text.includes('l5') || text.includes('hit rate') || text.includes('usage') || text.includes('minutes')) tags.add('prop_form');
  return [...tags];
}

function applyLearningsAdjustment(pick, learnings) {
  if (!learnings?.insights?.length) return 0;

  const betType = (pick.betType || '').toLowerCase();
  const sport = (pick.sport || '').toLowerCase();
  const signalTags = extractSignalTags(pick.signals, pick.reasoning);
  let adjustment = 0;

  for (const insight of learnings.insights) {
    const amount = Number(insight.confidence_adjustment) || 0;
    if (!amount) continue;

    const category = String(insight.category || '').toLowerCase();
    const text = `${insight.insight || ''} ${insight.data || ''}`.toLowerCase();

    if (category === 'sport' && sport && text.includes(sport)) adjustment += amount;
    if (category === 'bet_type' && betType && text.includes(betType)) adjustment += amount;
    if (category === 'signal' && signalTags.some(tag => text.includes(tag.replace('_', ' ')) || text.includes(tag))) adjustment += amount;
    if (category === 'confidence') {
      if (pick.confidence >= 85 && /(85|86|87|88|89|90|high confidence)/.test(text)) adjustment += amount;
      if (pick.confidence >= 70 && pick.confidence <= 74 && /(70|74|thin|low confidence)/.test(text)) adjustment += amount;
    }
    if (category === 'clv') {
      const hasMarketSignal = signalTags.includes('rlm') || signalTags.includes('steam') || signalTags.includes('public_split') || signalTags.includes('line_movement');
      if (hasMarketSignal) adjustment += amount;
      else adjustment += Math.min(0, amount);
    }
  }

  return Math.max(-12, Math.min(12, adjustment));
}

function scorePickQuality(pick, learnings) {
  const signals = Array.isArray(pick.signals) ? pick.signals : [];
  const reasoning = String(pick.reasoning || '');
  const combinedText = `${signals.join(' ')} ${reasoning}`.toLowerCase();
  const betType = pick.betType || 'spread';
  const signalTags = extractSignalTags(signals, reasoning);
  const marketSignalCount = signalTags.filter(tag => ['rlm', 'steam', 'public_split', 'line_movement'].includes(tag)).length;
  const advancedSignalCount = signalTags.filter(tag => ['injury', 'schedule', 'weather', 'advanced_metric', 'prop_form'].includes(tag)).length;

  let score = Number(pick.confidence) || 0;
  score += Math.min(8, signals.length * 2);
  score += Math.min(8, marketSignalCount * 4);
  score += Math.min(6, advancedSignalCount * 2);
  if (pick.line) score += 2;
  if (reasoning.length >= 150) score += 3;
  if (reasoning.length < 90) score -= 5;

  if (betType === 'prop') {
    const hasPropProof = ['l20', 'l5', 'hit rate', 'matchup', 'usage', 'minutes'].every(term => combinedText.includes(term));
    if (hasPropProof) score += 4;
    else score -= 10;
  } else if (marketSignalCount === 0) {
    score -= 6;
  }

  const odds = parseAmericanOdds(pick.odds);
  if (betType === 'moneyline' && odds < -180) score -= 8;
  if (odds > 160) score -= 3;

  if (/(revenge|must-win|wants it more|statement game|due\b|bounce back)/i.test(combinedText)) score -= 6;

  score += applyLearningsAdjustment(pick, learnings);
  return Math.round(score);
}

function dedupeAndRankPicks(candidates, learnings) {
  const ranked = candidates
    .map(pick => ({ ...pick, selection_score: scorePickQuality(pick, learnings) }))
    .sort((a, b) => b.selection_score - a.selection_score || b.confidence - a.confidence);

  const kept = [];
  const matchupExposure = new Map();
  const propKeys = new Set();

  for (const pick of ranked) {
    const matchupKey = `${pick.sport}::${pick.matchup}`.toLowerCase();
    const isProp = pick.betType === 'prop';
    const propKey = isProp ? `${matchupKey}::${(pick.player || pick.pick).toLowerCase()}::${(pick.stat || '').toLowerCase()}` : null;
    const exposure = matchupExposure.get(matchupKey) || 0;

    if (pick.selection_score < 74) continue;
    if (!isProp && exposure >= 1) continue;
    if (isProp && propKey && propKeys.has(propKey)) continue;
    if (isProp && exposure >= 2) continue;

    kept.push(pick);
    matchupExposure.set(matchupKey, exposure + 1);
    if (propKey) propKeys.add(propKey);
  }

  const strongestScore = kept[0]?.selection_score || 0;
  const maxPicks = strongestScore >= 90 ? 4 : strongestScore >= 84 ? 3 : 2;
  return kept.slice(0, maxPicks);
}

// Kelly Criterion unit sizing using conservative win-prob mapping and 1/8 Kelly
function calculateKellyUnits(confidence, oddsStr) {
  const p = confidenceToWinProbability(confidence);
  const q = 1 - p;
  const odds = parseAmericanOdds(oddsStr);
  const breakEven = americanToBreakEvenProbability(oddsStr);
  const b = odds < 0 ? 100 / Math.abs(odds) : odds / 100;
  const fullKelly = (b * p - q) / b;
  if ((p - breakEven) <= 0.015 || fullKelly <= 0.01) return 0.5;
  const eighthKelly = fullKelly / 8;
  const units = eighthKelly * 40;
  return Math.max(0.5, Math.min(2.5, Math.round(units * 2) / 2));
}

async function generatePicks() {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  // Inject self-learned performance insights + post-game analyses
  const learnings = getCurrentLearnings();

  const weeklyInsightsBlock = (learnings && learnings.insights.length > 0) ? `
## YOUR PERFORMANCE LEARNINGS (from your own track record — follow these)

Summary: ${learnings.summary}

Specific insights from your results:
${learnings.insights.map(i => `- [${i.category.toUpperCase()}] ${i.insight}${i.confidence_adjustment !== 0 ? ` (adjust confidence ${i.confidence_adjustment > 0 ? '+' : ''}${i.confidence_adjustment} for this category)` : ''} | Data: ${i.data}`).join('\n')}

Apply these learnings NOW when selecting and weighting today's picks. Double down on what's working. Avoid what isn't.
` : '';

  const postGameBlock = (learnings && learnings.postGameAnalyses && learnings.postGameAnalyses.length > 0) ? `
## RECENT POST-GAME ANALYSIS (WHY your last bets won/lost — learn from this)

${learnings.postGameAnalyses.map(a => `[${a.date}] ${a.matchup} | ${a.pick} → ${a.result}
  WHY: ${a.why}
  KEY FACTOR: ${a.key_factor}
  LESSON: ${a.lesson}`).join('\n\n')}

Use these lessons to avoid repeating mistakes and double down on what's working.
` : '';

  const learningsBlock = weeklyInsightsBlock + postGameBlock;

  const userPrompt = `Today is ${today}. Execute the full CashOut sharp analysis pipeline:
${learningsBlock}

PHASE 1 — SCAN THE SLATE
- Search the active board across NFL, NBA, MLB, NHL, NCAAF, NCAAB, MLS/Soccer.
- Identify only markets that are realistically bettable right now.

PHASE 2 — MARKET CHECK
- For every serious candidate, check current lines across DraftKings, FanDuel, BetMGM, and another major book if possible.
- Note opener vs current number.
- Flag public/money splits, reverse line movement, steam, and best-number discrepancies when available.
- If the edge is gone at the current number, pass.

PHASE 3 — NEWS / ROLE / CONTEXT
- Check official injury reports, lineup news, goalie/starter confirmations, and role changes.
- Downgrade any bet that depends on uncertain minutes, usage, or availability.

PHASE 4 — PROP RESEARCH ONLY IF REAL
- Props are optional, not mandatory.
- Only include a prop if you can verify: L20 average, L5 average, hit rate at the current line, and opponent matchup context.
- If those are weak or incomplete, pass.

PHASE 5 — ADVANCED METRICS AND SITUATIONALS
- Use relevant advanced metrics (EPA, DVOA, Net Rating, FIP/xFIP, wRC+, xG, KenPom, usage, pace).
- Check rest, travel, back-to-backs, weather, and any other situational factors that materially affect the number.

PHASE 6 — RANK BY TRUE EDGE
- Rank candidates by:
  1. current number value
  2. likely CLV
  3. strength of data support
  4. risk / uncertainty
- Return only the bets that truly clear 70+ confidence.
- Return a lock only if one play clearly deserves 86+ confidence.
- Return no parlays unless they are clearly justified by already-strong legs.

Return ONLY the JSON object. Nothing else.`;

  try {
    let messages = [{ role: 'user', content: userPrompt }];
    let finalText = '';
    let maxTurns = 10;

    while (maxTurns > 0) {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 20 }],
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
            type: 'tool_result', tool_use_id: block.id,
            content: 'Search completed. Continue analysis.'
          }))
        });
      }
      maxTurns--;
    }

    const jsonMatch = finalText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No valid JSON in response');

    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.picks) throw new Error('Missing picks array');
    if (!parsed.parlays) parsed.parlays = [];

    const sanitize = (pick) => {
      const conf = Math.min(100, Math.max(0, parseInt(pick.confidence) || 0));
      const oddsStr = pick.odds || '-110';
      const betType = pick.betType || pick.bet_type || 'spread';
      return {
        sport: pick.sport || 'MULTI',
        matchup: pick.matchup || '',
        pick: pick.pick || '',
        betType,
        odds: oddsStr,
        line: pick.line || inferLineFromPick(pick.pick, betType),
        confidence: conf,
        signals: Array.isArray(pick.signals) ? pick.signals : [],
        reasoning: pick.reasoning || '',
        player: pick.player || null,
        stat: pick.stat || null,
        kelly_units: calculateKellyUnits(conf, oddsStr)
      };
    };

    parsed.lock = parsed.lock ? sanitize(parsed.lock) : null;
    parsed.picks = parsed.picks.map(sanitize).filter(p => p.confidence >= 70);

    if (parsed.lock && parsed.lock.confidence < 86) {
      parsed.picks.unshift(parsed.lock);
      parsed.lock = null;
    }

    const rankedPicks = dedupeAndRankPicks(parsed.picks, learnings);
    parsed.picks = rankedPicks;

    if (parsed.lock) {
      parsed.lock.selection_score = scorePickQuality(parsed.lock, learnings);
      if (parsed.lock.selection_score < 84) {
        parsed.picks = dedupeAndRankPicks([parsed.lock, ...parsed.picks], learnings);
        parsed.lock = null;
      }
    }

    if (!parsed.lock) {
      parsed.picks = parsed.picks.filter(p => p.selection_score >= 76);
    }

    const strongestPickScore = parsed.lock?.selection_score || parsed.picks[0]?.selection_score || 0;
    if (strongestPickScore < 82) parsed.parlays = [];
    if (parsed.parlays.length > 1) parsed.parlays = parsed.parlays.slice(0, 1);

    console.log(`[CashOut] Generated: 1 Lock + ${parsed.picks.length} picks + ${parsed.parlays.length} parlays`);
    return parsed;
  } catch (err) {
    console.error('[CashOut] Generation error:', err);
    throw err;
  }
}

// Conversational chat about games/parlays
async function chatAboutGames(messages, todayPicksContext) {
  const contextStr = todayPicksContext && todayPicksContext.length > 0
    ? `\n\nTODAY'S CURRENT PICKS IN THE SYSTEM:\n${todayPicksContext.map(p =>
        `- ${p.sport}: ${p.matchup} | Pick: ${p.pick} ${p.odds} | Confidence: ${p.confidence} | ${p.is_lock ? '★ LOCK' : ''}`
      ).join('\n')}`
    : '\n\nNo picks have been generated for today yet.';

  const chatSystem = `You are Cash — the sharpest AI sports betting analyst alive. You have deep expertise in sharp money signals, line movement, advanced sports analytics, and parlay construction. You are direct, confident, and data-driven. You talk like a professional bettor — not a hype guy, not a casual fan.

You can:
- Discuss any game being played today or upcoming
- Analyze specific matchups users ask about
- Help users build smart parlays (always following correlated parlay rules)
- Explain why a pick has value using sharp betting signals
- Give your honest read on games — including "I don't see edge here, pass"
- Discuss bankroll management and bet sizing

You are conversational but concise. No fluff. No filler. Sharp insight only.
${contextStr}

Use web search when you need current injury news, line information, or game data to answer properly.`;

  let messages2 = [...messages];
  let text = '';
  let maxTurns = 4;

  while (maxTurns > 0) {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: chatSystem,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
      messages: messages2
    });

    let turnText = '';
    for (const block of response.content) {
      if (block.type === 'text') turnText += block.text;
    }
    if (turnText) text = turnText;

    if (response.stop_reason !== 'tool_use') break;

    messages2.push({ role: 'assistant', content: response.content });
    const toolBlocks = response.content.filter(b => b.type === 'tool_use');
    messages2.push({
      role: 'user',
      content: toolBlocks.map(b => ({ type: 'tool_result', tool_use_id: b.id, content: 'Search completed.' }))
    });
    maxTurns--;
  }

  return text;
}

// Auto-grade picks + capture closing line for CLV tracking
async function gradePicks(pendingPicks) {
  if (!pendingPicks || pendingPicks.length === 0) return [];

  const pickList = pendingPicks.map(p =>
    `ID ${p.id}: ${p.sport} | ${p.matchup} | Pick: ${p.pick} ${p.odds} | BetType: ${p.bet_type} | OpeningLine: ${p.line || p.odds}`
  ).join('\n');

  const prompt = `You are grading sports betting picks. Search for the OFFICIAL game status, final scores, and closing lines for these games.

PICKS TO GRADE:
${pickList}

For each pick:
1. Search for an authoritative game page or box score and determine whether the game is officially FINAL.
2. If the game is NOT officially final, return "Pending" and set "final_confirmed" to false.
3. Only if the game IS officially final, determine if the pick won (W), lost (L), or pushed (Push), and set "final_confirmed" to true.
4. Find the CLOSING LINE for the bet — the final spread/total/moneyline just before game time.

Return ONLY a JSON array:
[
  {
    "id": 1,
    "final_confirmed": true,
    "result": "W",
    "reason": "Team A won 108-102, covered -3.5",
    "closing_line": "-5"
  }
]

For closing_line: return the closing spread (e.g. "-5"), closing total (e.g. "47.5"), or closing moneyline (e.g. "-165").
If you cannot find the closing line, return null for closing_line.
Return ONLY the JSON array.

Rules:
- Spread: W if pick team covers, L if not, Push if exactly on number
- Total: W if total crosses the line, L if not, Push if exactly on number
- Moneyline: W if pick team wins, L if not
- Return Pending for unfinished games
- For player props, do NOT grade unless the game is officially final and an official player box score exists
- If there is any ambiguity, live status, or conflicting information, return:
  {
    "id": <id>,
    "final_confirmed": false,
    "result": "Pending",
    "reason": "Game not officially final",
    "closing_line": null
  }
- Be extremely conservative: a false Pending is acceptable; a false win/loss is not.`;

  try {
    let messages = [{ role: 'user', content: prompt }];
    let finalText = '';
    let maxTurns = 8;

    while (maxTurns > 0) {
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 3000,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 10 }],
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
            type: 'tool_result', tool_use_id: block.id,
            content: 'Search completed. Continue grading.'
          }))
        });
      }
      maxTurns--;
    }

    const jsonMatch = finalText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array in response');
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error('[CashOut] Grade error:', err.message);
    return [];
  }
}

module.exports = { generatePicks, chatAboutGames, gradePicks, calculateKellyUnits };
