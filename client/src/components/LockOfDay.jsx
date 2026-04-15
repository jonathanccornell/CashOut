import { useState } from 'react';
import PickOutcomeControl from './PickOutcomeControl';

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

  const handleResult = (_id, r) => {
    if (onUpdateResult) onUpdateResult(lock.id, r === 'P' ? 'Push' : r);
  };

  const confPct = Math.min(100, Math.max(0, lock.confidence));

  return (
    <div className="mb-4 premium-panel gold-frame texture-grid market-grid relative rounded-[28px] overflow-hidden neon-pulse">
      <div className="absolute inset-0 bg-gradient-to-br from-neon/[0.1] via-transparent to-transparent" />
      <div className="absolute inset-0 bg-black/72" />

      <div className="relative px-6 py-5">
        {/* Top row */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-gold text-base">♛</span>
              <span className="text-[10px] font-black text-neon uppercase tracking-[0.3em]">Lock of the Day</span>
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
              className="text-white/15 hover:text-neon/80 transition-colors">
              {copied
                ? <span className="text-[10px] text-neon font-bold">Copied!</span>
                : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                  </svg>
              }
            </button>

            <PickOutcomeControl result={lock.result} id={lock.id} onUpdate={handleResult} />

            {/* Confidence */}
            <div className="text-right">
              <div className="text-neon font-black text-3xl tabular leading-none">{lock.confidence}</div>
              <div className="text-[9px] text-white/15 uppercase tracking-[0.18em] mt-0.5">model</div>
            </div>
          </div>
        </div>

        {/* Confidence bar */}
        <div className="h-[3px] w-full bg-white/5 rounded-full mb-4 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-neon via-blue-400/90 to-blue-400 rounded-full transition-all"
            style={{ width: `${confPct}%` }} />
        </div>

        {/* Matchup + Pick */}
        <p className="text-white/35 text-[11px] uppercase tracking-[0.18em] mb-2">{lock.matchup}</p>
        <div className="flex items-baseline gap-3 mb-4">
          <span className="font-display text-white font-bold text-[2.35rem] tracking-tight leading-none">{lock.pick}</span>
          <span className="text-neon/85 text-xl font-bold">{lock.odds}</span>
        </div>

        {/* Sharp signals */}
        {signals.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {signals.map((s, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[11px] text-blue-200/85 bg-blue-400/10 border border-blue-400/14 rounded-lg px-2.5 py-1">
                <div className="w-1 h-1 rounded-full bg-blue-300/80 shrink-0" />
                {s}
              </div>
            ))}
          </div>
        )}

        {lock.reasoning && (
          <>
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[10px] text-white/15 hover:text-neon/80 transition-colors flex items-center gap-1 uppercase tracking-[0.18em]"
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
