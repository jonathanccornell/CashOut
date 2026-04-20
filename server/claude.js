const Anthropic = require('@anthropic-ai/sdk');
const { getCurrentLearnings } = require('./learning');

const anthropicClient = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const PROVIDER_LABELS = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  gemini: 'Gemini',
};

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

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

function getProviderOrder() {
  const requested = String(process.env.AI_PROVIDER_ORDER || 'anthropic,openai,gemini')
    .split(',')
    .map(provider => provider.trim().toLowerCase())
    .filter(Boolean);

  return [...new Set(requested)].filter(providerHasCredentials);
}

function providerHasCredentials(provider) {
  if (provider === 'anthropic') return Boolean(process.env.ANTHROPIC_API_KEY);
  if (provider === 'openai') return Boolean(process.env.OPENAI_API_KEY);
  if (provider === 'gemini') return Boolean(process.env.GEMINI_API_KEY);
  return false;
}

function extractOpenAIText(data) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim();
  }

  return (data?.output || [])
    .filter(item => item.type === 'message')
    .flatMap(item => item.content || [])
    .filter(part => part.type === 'output_text' || part.type === 'text')
    .map(part => part.text || '')
    .join('')
    .trim();
}

function extractGeminiText(data) {
  return (data?.candidates || [])
    .flatMap(candidate => candidate?.content?.parts || [])
    .map(part => part.text || '')
    .join('')
    .trim();
}

function formatChatTranscript(messages) {
  return (messages || [])
    .map(message => `${String(message.role || 'user').toUpperCase()}: ${message.content}`)
    .join('\n\n');
}

function formatProviderError(prefix, responseData) {
  if (!responseData) return prefix;
  if (typeof responseData === 'string') return `${prefix}: ${responseData}`;
  if (responseData.error?.message) return `${prefix}: ${responseData.error.message}`;
  return `${prefix}: ${JSON.stringify(responseData).slice(0, 400)}`;
}

async function invokeAnthropic({ system, prompt, model, maxTokens, maxSearches }) {
  if (!anthropicClient) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  let messages = [{ role: 'user', content: prompt }];
  let finalText = '';
  let turnsRemaining = 8;

  while (turnsRemaining > 0) {
    const response = await anthropicClient.messages.create({
      model,
      max_tokens: maxTokens,
      system,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: maxSearches }],
      messages,
    });

    const turnText = response.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('');

    if (turnText) finalText = turnText;

    if (response.stop_reason !== 'tool_use') break;

    messages.push({ role: 'assistant', content: response.content });
    const toolUseBlocks = response.content.filter(block => block.type === 'tool_use');
    if (toolUseBlocks.length > 0) {
      messages.push({
        role: 'user',
        content: toolUseBlocks.map(block => ({
          type: 'tool_result',
          tool_use_id: block.id,
          content: 'Search completed. Continue.',
        })),
      });
    }
    turnsRemaining -= 1;
  }

  if (!finalText.trim()) {
    throw new Error('Empty Anthropic response');
  }

  return finalText.trim();
}

async function invokeOpenAI({ system, prompt, model, maxTokens, searchContextSize = 'high' }) {
  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      instructions: system,
      input: prompt,
      max_output_tokens: maxTokens,
      tool_choice: 'auto',
      tools: [{ type: 'web_search', search_context_size: searchContextSize }],
    }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(formatProviderError('OpenAI request failed', data));
  }

  const text = extractOpenAIText(data);
  if (!text) {
    throw new Error('Empty OpenAI response');
  }

  return text;
}

async function invokeGemini({ system, prompt, model, maxTokens }) {
  const response = await fetch(`${GEMINI_API_BASE}/${model}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': process.env.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      system_instruction: system ? { parts: [{ text: system }] } : undefined,
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
      generationConfig: {
        maxOutputTokens: maxTokens,
      },
    }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(formatProviderError('Gemini request failed', data));
  }

  const text = extractGeminiText(data);
  if (!text) {
    throw new Error('Empty Gemini response');
  }

  return text;
}

async function invokeProvider(provider, {
  system,
  prompt,
  anthropicModel,
  openaiModel,
  geminiModel,
  maxTokens,
  anthropicSearches = 8,
  openaiSearchContextSize = 'high',
}) {
  if (provider === 'anthropic') {
    return invokeAnthropic({
      system,
      prompt,
      model: anthropicModel,
      maxTokens,
      maxSearches: anthropicSearches,
    });
  }

  if (provider === 'openai') {
    return invokeOpenAI({
      system,
      prompt,
      model: openaiModel,
      maxTokens,
      searchContextSize: openaiSearchContextSize,
    });
  }

  if (provider === 'gemini') {
    return invokeGemini({
      system,
      prompt,
      model: geminiModel,
      maxTokens,
    });
  }

  throw new Error(`Unknown provider: ${provider}`);
}

async function runPromptAcrossProviders({
  taskName,
  system,
  prompt,
  anthropicModel,
  openaiModel,
  geminiModel,
  maxTokens,
  anthropicSearches = 8,
  openaiSearchContextSize = 'high',
}) {
  const providers = getProviderOrder();
  if (providers.length === 0) {
    throw new Error('No AI provider configured. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY.');
  }

  const failures = [];

  for (const provider of providers) {
    try {
      const text = await invokeProvider(provider, {
        system,
        prompt,
        anthropicModel,
        openaiModel,
        geminiModel,
        maxTokens,
        anthropicSearches,
        openaiSearchContextSize,
      });
      if (!text) continue;

      console.log(`[CashOut] ${taskName} succeeded via ${PROVIDER_LABELS[provider] || provider}.`);
      return { text, provider };
    } catch (error) {
      const label = PROVIDER_LABELS[provider] || provider;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[CashOut] ${taskName} failed via ${label}:`, message);
      failures.push(`${label}: ${message}`);
    }
  }

  throw new Error(`${taskName} failed across providers: ${failures.join(' | ')}`);
}

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

function countNumericEvidence(signals, reasoning = '') {
  const text = `${Array.isArray(signals) ? signals.join(' ') : String(signals || '')} ${reasoning || ''}`;
  return (text.match(/\b\d+(?:\.\d+)?%?\b/g) || []).length;
}

function getPickEvidenceProfile(pick) {
  const signals = Array.isArray(pick.signals) ? pick.signals : [];
  const reasoning = String(pick.reasoning || '');
  const signalTags = extractSignalTags(signals, reasoning);
  const marketSignalCount = signalTags.filter(tag => ['rlm', 'steam', 'public_split', 'line_movement'].includes(tag)).length;
  const advancedSignalCount = signalTags.filter(tag => ['injury', 'schedule', 'weather', 'advanced_metric', 'prop_form'].includes(tag)).length;
  const numericEvidenceCount = countNumericEvidence(signals, reasoning);

  return {
    signals,
    reasoning,
    signalTags,
    marketSignalCount,
    advancedSignalCount,
    numericEvidenceCount,
  };
}

function isPlayableFallbackCandidate(pick) {
  const { marketSignalCount, advancedSignalCount, numericEvidenceCount, reasoning } = getPickEvidenceProfile(pick);
  return (
    (Number(pick.confidence) || 0) >= 72 &&
    (Number(pick.selection_score) || 0) >= 73 &&
    reasoning.length >= 120 &&
    numericEvidenceCount >= 3 &&
    (marketSignalCount >= 1 || advancedSignalCount >= 2)
  );
}

function qualifyLockCandidate(lockPick, rankedPicks, learnings) {
  const profile = buildLockProfile(lockPick, rankedPicks, learnings);
  return profile?.lock_tier ? profile : null;
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
  const { signals, reasoning, signalTags, marketSignalCount, advancedSignalCount, numericEvidenceCount } = getPickEvidenceProfile(pick);
  const combinedText = `${signals.join(' ')} ${reasoning}`.toLowerCase();
  const betType = pick.betType || 'spread';

  let score = Number(pick.confidence) || 0;
  score += Math.min(8, signals.length * 2);
  score += Math.min(8, marketSignalCount * 4);
  score += Math.min(6, advancedSignalCount * 2);
  score += Math.min(6, numericEvidenceCount);
  if (pick.line) score += 2;
  if (reasoning.length >= 150) score += 3;
  if (reasoning.length < 90) score -= 5;
  if (numericEvidenceCount < 2) score -= 6;
  if (numericEvidenceCount >= 5) score += 2;

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

function rescueBestAvailablePicks(rankedPicks) {
  return rankedPicks
    .filter(isPlayableFallbackCandidate)
    .slice(0, 2);
}

function sanitizeGeneratedPick(pick) {
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
    selection_score: Number.isFinite(pick.selection_score) ? pick.selection_score : null,
    lock_score: Number.isFinite(pick.lock_score) ? pick.lock_score : null,
    lock_tier: pick.lock_tier || null,
    kelly_units: calculateKellyUnits(conf, oddsStr)
  };
}

function buildLockProfile(lockPick, rankedPicks, learnings) {
  if (!lockPick) return null;

  const scoredLock = {
    ...lockPick,
    selection_score: Number.isFinite(lockPick.selection_score)
      ? lockPick.selection_score
      : scorePickQuality(lockPick, learnings),
  };

  const { marketSignalCount, advancedSignalCount, numericEvidenceCount, reasoning } = getPickEvidenceProfile(scoredLock);
  const nextBestScore = rankedPicks[0]?.selection_score || 0;
  const scoreGap = scoredLock.selection_score - nextBestScore;

  const qualificationChecks = [
    { ok: (Number(scoredLock.confidence) || 0) >= 86, label: '86+ confidence' },
    { ok: scoredLock.selection_score >= 88, label: '88+ selection score' },
    { ok: reasoning.length >= 140, label: 'full thesis depth' },
    { ok: numericEvidenceCount >= 4, label: 'numeric proof' },
    { ok: marketSignalCount >= 1 || advancedSignalCount >= 3, label: 'market or matchup edge' },
    { ok: scoreGap >= 3, label: 'clear top-play separation' },
  ];

  let lockTier = null;
  if (
    (Number(scoredLock.confidence) || 0) >= 90 &&
    scoredLock.selection_score >= 92 &&
    numericEvidenceCount >= 6 &&
    scoreGap >= 5 &&
    marketSignalCount >= 1
  ) {
    lockTier = 'Apex';
  } else if (qualificationChecks.every(check => check.ok) && scoredLock.selection_score >= 90) {
    lockTier = 'Elite';
  } else if (qualificationChecks.every(check => check.ok)) {
    lockTier = 'Qualified';
  }

  return {
    ...scoredLock,
    lock_score: scoredLock.selection_score,
    lock_tier: lockTier,
    lock_checks: qualificationChecks
      .filter(check => check.ok)
      .map(check => check.label),
    score_gap: scoreGap,
    numeric_evidence_count: numericEvidenceCount,
    market_signal_count: marketSignalCount,
    advanced_signal_count: advancedSignalCount,
  };
}

function finalizeGeneratedCard(parsed, learnings) {
  if (!parsed.picks) throw new Error('Missing picks array');
  if (!parsed.parlays) parsed.parlays = [];

  parsed.lock = parsed.lock ? sanitizeGeneratedPick(parsed.lock) : null;
  parsed.picks = parsed.picks.map(sanitizeGeneratedPick).filter(p => p.confidence >= 70);

  if (parsed.lock && parsed.lock.confidence < 86) {
    parsed.picks.unshift(parsed.lock);
    parsed.lock = null;
  }

  const rankedPicks = dedupeAndRankPicks(parsed.picks, learnings);
  parsed.picks = rankedPicks;

  const qualifiedLock = qualifyLockCandidate(parsed.lock, parsed.picks, learnings);
  if (qualifiedLock) {
    parsed.lock = qualifiedLock;
  } else if (parsed.lock) {
    parsed.picks = dedupeAndRankPicks([parsed.lock, ...parsed.picks], learnings);
    parsed.lock = null;
  }

  parsed.picks = parsed.picks.filter(p => p.selection_score >= 76);
  if (parsed.picks.length === 0) {
    parsed.picks = rescueBestAvailablePicks(rankedPicks);
  }

  const strongestPickScore = parsed.lock?.selection_score || parsed.picks[0]?.selection_score || 0;
  if (strongestPickScore < 82) parsed.parlays = [];
  if (parsed.parlays.length > 1) parsed.parlays = parsed.parlays.slice(0, 1);

  return parsed;
}

function parseGeneratedCard(finalText, learnings) {
  const jsonMatch = finalText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No valid JSON in response');
  return finalizeGeneratedCard(JSON.parse(jsonMatch[0]), learnings);
}

function attachProviderMetadata(card, provider) {
  const decorate = (pick) => ({
    ...pick,
    ai_provider: provider,
  });

  return {
    ...card,
    provider,
    lock: card.lock ? decorate(card.lock) : null,
    picks: (card.picks || []).map(decorate),
  };
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
- If the slate is playable but thin, prefer 1-2 best available bets over a dead-empty card.
- Only return a fully empty card when you genuinely cannot defend a single actionable number on the board.

Return ONLY the JSON object. Nothing else.`;

  const thinSlatePrompt = `Today is ${today}. Your prior scan returned an empty card.
${learningsBlock}

Run a second-pass thin-slate search with these rules:
- Focus on the most active major sports today first: NBA, NHL, MLB, then any other clearly active board.
- Prefer sides and totals over props unless a prop is unusually well-supported.
- Find the best 1-2 currently bettable numbers on the board right now.
- A thin but defendable edge is acceptable if the number is still live and the support is specific.
- Do not force a lock.
- Do not include parlays on this rescue pass.
- Only return an empty card if you genuinely cannot defend even one current number after this narrower scan.

Return ONLY the JSON object. Nothing else.`;

  try {
    const providers = getProviderOrder();
    if (providers.length === 0) {
      throw new Error('No AI provider configured. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY.');
    }

    const providerConfig = {
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      anthropicModel: process.env.ANTHROPIC_GENERATION_MODEL || process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
      openaiModel: process.env.OPENAI_GENERATION_MODEL || process.env.OPENAI_MODEL || 'gpt-5',
      geminiModel: process.env.GEMINI_GENERATION_MODEL || process.env.GEMINI_MODEL || 'gemini-2.5-pro',
      maxTokens: 16000,
      anthropicSearches: 20,
      openaiSearchContextSize: 'high',
    };

    let bestEmptyCard = null;
    const failures = [];

    for (const provider of providers) {
      try {
        const finalText = await invokeProvider(provider, providerConfig);
        const parsed = parseGeneratedCard(finalText, learnings);

        if (parsed.lock || parsed.picks.length > 0 || parsed.parlays.length > 0) {
          console.log(`[CashOut] Generated via ${provider}: 1 Lock + ${parsed.picks.length} picks + ${parsed.parlays.length} parlays`);
          return attachProviderMetadata(parsed, provider);
        }

        console.log(`[CashOut] ${PROVIDER_LABELS[provider] || provider} returned an empty card, retrying narrow-slate rescue...`);

        const rescueText = await invokeProvider(provider, {
          ...providerConfig,
          prompt: thinSlatePrompt,
        });
        const rescueCard = parseGeneratedCard(rescueText, learnings);

        if (rescueCard.lock || rescueCard.picks.length > 0 || rescueCard.parlays.length > 0) {
          console.log(`[CashOut] Rescue card generated via ${provider}: 1 Lock + ${rescueCard.picks.length} picks + ${rescueCard.parlays.length} parlays`);
          return attachProviderMetadata(rescueCard, provider);
        }

        console.log(`[CashOut] ${PROVIDER_LABELS[provider] || provider} rescue scan still returned an empty card, trying next provider...`);
        bestEmptyCard = rescueCard;
      } catch (error) {
        const label = PROVIDER_LABELS[provider] || provider;
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[CashOut] Pick generation failed via ${label}:`, message);
        failures.push(`${label}: ${message}`);
      }
    }

    if (bestEmptyCard) {
      console.log('[CashOut] All configured providers returned an empty card.');
      return bestEmptyCard;
    }

    throw new Error(`Pick generation failed across providers: ${failures.join(' | ')}`);
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

  const { text } = await runPromptAcrossProviders({
    taskName: 'Chat response',
    system: chatSystem,
    prompt: formatChatTranscript(messages),
    anthropicModel: process.env.ANTHROPIC_CHAT_MODEL || process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001',
    openaiModel: process.env.OPENAI_CHAT_MODEL || process.env.OPENAI_MODEL || 'gpt-5-mini',
    geminiModel: process.env.GEMINI_CHAT_MODEL || process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    maxTokens: 1024,
    anthropicSearches: 5,
    openaiSearchContextSize: 'medium',
  });

  return text;
}

// Auto-grade picks + capture closing line for CLV tracking
async function gradePicks(pendingPicks) {
  if (!pendingPicks || pendingPicks.length === 0) return [];

  const pickList = pendingPicks.map(p =>
    `ID ${p.id}: ${p.sport} | ${p.matchup} | Pick: ${p.pick} ${p.odds} | BetType: ${p.bet_type} | OpeningLine: ${p.line || p.odds}`
  ).join('\n');

  const sourceRules = `AUTHORITATIVE SOURCE RULES BY SPORT
- NBA / WNBA: prefer NBA.com / WNBA.com official game page or official box score. ESPN or CBS Sports box score only as fallback.
- NFL / NCAAF: prefer NFL.com or official school/conference game book / NCAA official stats. ESPN gamecast/box score only as fallback.
- MLB: prefer MLB.com Gameday / official box score. ESPN box score only as fallback.
- NHL: prefer NHL.com Gamecenter / official box score. ESPN only as fallback.
- NCAAB / NCAAW: prefer NCAA or official school/conference box score. ESPN only as fallback.
- Soccer / MLS / EPL: prefer official league or club match center. ESPN / FotMob only as fallback.

If you cannot identify an authoritative source class for the game result, do NOT settle it. Return Pending.`;

  const prompt = `You are grading sports betting picks. Search for the OFFICIAL game status, final scores, and closing lines for these games.

PICKS TO GRADE:
${pickList}

${sourceRules}

For each pick:
1. Search for an authoritative game page or box score and determine whether the game is officially FINAL.
2. If the game is NOT officially final, return "Pending" and set "final_confirmed" to false.
3. Only if the game IS officially final, determine if the pick won (W), lost (L), or pushed (Push), and set "final_confirmed" to true.
4. Find the CLOSING LINE for the bet — the final spread/total/moneyline just before game time.
5. Identify the authoritative source used to verify final status.

Return ONLY a JSON array:
[
  {
    "id": 1,
    "final_confirmed": true,
    "result": "W",
    "reason": "Team A won 108-102, covered -3.5",
    "closing_line": "-5",
    "source_label": "NBA.com official box score",
    "source_type": "official_league",
    "source_url": "https://www.nba.com/game/..."
  }
]

For closing_line: return the closing spread (e.g. "-5"), closing total (e.g. "47.5"), or closing moneyline (e.g. "-165").
If you cannot find the closing line, return null for closing_line.
For source_type, use one of:
- official_league
- official_team
- official_school
- official_conference
- official_boxscore
- official_stats_feed
- fallback_scoreboard
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
    "closing_line": null,
    "source_label": null,
    "source_type": null,
    "source_url": null
  }
- Be extremely conservative: a false Pending is acceptable; a false win/loss is not.`;

  try {
    const { text: finalText, provider } = await runPromptAcrossProviders({
      taskName: 'Pick grading',
      system: '',
      prompt,
      anthropicModel: process.env.ANTHROPIC_GRADE_MODEL || process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001',
      openaiModel: process.env.OPENAI_GRADE_MODEL || process.env.OPENAI_MODEL || 'gpt-5-mini',
      geminiModel: process.env.GEMINI_GRADE_MODEL || process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      maxTokens: 3000,
      anthropicSearches: 10,
      openaiSearchContextSize: 'medium',
    });

    const jsonMatch = finalText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array in response');
    return JSON.parse(jsonMatch[0]).map(result => ({ ...result, graded_by: provider }));
  } catch (err) {
    console.error('[CashOut] Grade error:', err.message);
    return [];
  }
}

module.exports = { generatePicks, chatAboutGames, gradePicks, calculateKellyUnits };
