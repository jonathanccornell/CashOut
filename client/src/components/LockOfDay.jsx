import { useState } from 'react';

function copyToClipboard(lock) {
  const text = `♛ LOCK OF THE DAY\n${lock.sport} | ${lock.matchup}\n${lock.pick} ${lock.odds}\nConfidence: ${lock.confidence}/100\n\nvia CashOut — King of Cappers`;
  navigator.clipboard?.writeText(text).catch(() => {});
}

export default function LockOfDay({ lock, onUpdateResult }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!lock) return null;

  const signals = lock.signals
    ? (typeof lock.signals === 'string' ? JSON.parse(lock.signals) : lock.signals)
    : [];

  const handleCopy = () => {
    copyToClipboard(lock);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleResult = (r) => {
    if (onUpdateResult) onUpdateResult(lock.id, r === 'P' ? 'Push' : r);
  };

  const confPct = Math.min(100, Math.max(0, lock.confidence));

  return (
    <div className="mb-4 relative rounded-2xl overflow-hidden border border-neon/20 neon-pulse">
      <div className="absolute inset-0 bg-gradient-to-br from-neon/[0.07] via-transparent to-transparent" />
      <div className="absolute inset-0 bg-black/70" />

      <div className="relative px-6 py-5">
        {/* Top row */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-gold text-base">♛</span>
              <span className="text-[10px] font-black text-gold uppercase tracking-[0.25em]">Lock of the Day</span>
              <span className="text-[10px] font-bold text-white/20">· Best Bet #1</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider">{lock.sport}</span>
              <span className="text-white/10">·</span>
              <span className="text-[10px] text-white/20 capitalize">{lock.bet_type || lock.betType}</span>
              {lock.created_at && (
                <>
                  <span className="text-white/10">·</span>
                  <span className="text-[10px] text-white/15">
                    {new Date(lock.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Copy button */}
            <button onClick={handleCopy} title="Copy pick"
              className="text-white/15 hover:text-neon/50 transition-colors">
              {copied
                ? <span className="text-[10px] text-neon font-bold">Copied!</span>
                : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                  </svg>
              }
            </button>

            {lock.result && lock.result !== 'Pending' && (
              <span className={`text-xs font-bold px-3 py-1 rounded-lg border ${
                lock.result === 'W' ? 'bg-neon/10 text-neon border-neon/20' :
                lock.result === 'L' ? 'bg-red-400/10 text-red-400 border-red-400/20' :
                'bg-gold/10 text-gold border-gold/20'
              }`}>{lock.result}</span>
            )}
            {lock.result === 'Pending' && (
              <div className="flex gap-1">
                {['W','L','P'].map(r => (
                  <button key={r} onClick={() => handleResult(r)}
                    className={`active-press text-[10px] font-bold px-2 py-1 rounded-lg border transition-colors ${
                      r === 'W' ? 'bg-neon/5 text-neon border-neon/15 hover:bg-neon/15' :
                      r === 'L' ? 'bg-red-400/5 text-red-400 border-red-400/15 hover:bg-red-400/15' :
                      'bg-gold/5 text-gold border-gold/15 hover:bg-gold/15'
                    }`}>{r}</button>
                ))}
              </div>
            )}

            {/* Confidence */}
            <div className="text-right">
              <div className="text-neon font-black text-3xl tabular leading-none">{lock.confidence}</div>
              <div className="text-[9px] text-white/15 uppercase tracking-wider mt-0.5">conf</div>
            </div>
          </div>
        </div>

        {/* Confidence bar */}
        <div className="h-[2px] w-full bg-white/5 rounded-full mb-4 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-neon/60 to-neon rounded-full transition-all"
            style={{ width: `${confPct}%` }} />
        </div>

        {/* Matchup + Pick */}
        <p className="text-white/40 text-sm mb-2">{lock.matchup}</p>
        <div className="flex items-baseline gap-3 mb-4">
          <span className="text-neon font-black text-3xl tracking-tight leading-none">{lock.pick}</span>
          <span className="text-white/25 text-xl">{lock.odds}</span>
        </div>

        {/* Sharp signals */}
        {signals.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {signals.map((s, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[11px] text-neon/60 bg-neon/5 border border-neon/10 rounded-lg px-2.5 py-1">
                <div className="w-1 h-1 rounded-full bg-neon/50 shrink-0" />
                {s}
              </div>
            ))}
          </div>
        )}

        {lock.reasoning && (
          <>
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[10px] text-white/15 hover:text-neon/50 transition-colors flex items-center gap-1"
            >
              <svg className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 24 24">
                <path d="M7 10l5 5 5-5z"/>
              </svg>
              {expanded ? 'Hide analysis' : "Read Cash's full analysis"}
            </button>
            {expanded && (
              <div className="mt-3 text-sm text-white/40 leading-relaxed bg-black/30 rounded-xl p-4 border border-white/[0.04]">
                {lock.reasoning}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
