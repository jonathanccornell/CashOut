import { useState } from 'react';
import PickOutcomeControl from './PickOutcomeControl';

function parseSignals(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function copyToClipboard(lock) {
  const text = `♛ LOCK OF THE DAY\n${lock.sport} | ${lock.matchup}\n${lock.pick} ${lock.odds}\nConfidence: ${lock.confidence}/100\n\nvia CashOut`;
  navigator.clipboard?.writeText(text).catch(() => {});
}

export default function LockOfDay({ lock }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!lock) return null;

  const signals = parseSignals(lock.signals);

  const handleCopy = () => {
    copyToClipboard(lock);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const confPct = Math.min(100, Math.max(0, lock.confidence));
  const lineValue = lock.line ?? (typeof lock.pick === 'string' ? lock.pick.match(/([+-]?\d+(?:\.\d+)?)/)?.[1] : null);

  return (
    <div className="mb-4 premium-panel gold-frame texture-grid market-grid relative rounded-[32px] overflow-hidden border border-neon/16 shadow-[0_22px_70px_rgba(0,255,133,0.08)]">
      <div className="absolute inset-0 bg-gradient-to-br from-neon/[0.14] via-transparent to-blue-400/[0.05]" />
      <div className="absolute inset-0 bg-black/72" />

      <div className="relative px-6 py-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-gold text-base">♛</span>
              <span className="text-[10px] font-black text-neon uppercase tracking-[0.28em]">Lock of the Day</span>
              <span className="rounded-full border border-neon/14 bg-neon/[0.06] px-2 py-0.5 text-[9px] font-bold text-neon/85 uppercase tracking-[0.18em]">
                Flagship play
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-white/36 uppercase tracking-[0.18em]">{lock.sport}</span>
              <span className="text-white/10">•</span>
              <span className="text-[10px] text-white/26 uppercase tracking-[0.16em]">{lock.bet_type || lock.betType}</span>
              {lineValue && (
                <>
                  <span className="text-white/10">•</span>
                  <span className="text-[10px] text-white/26 uppercase tracking-[0.16em]">Line {lineValue}</span>
                </>
              )}
              {lock.created_at && (
                <>
                  <span className="text-white/10">•</span>
                  <span className="text-[10px] text-white/15">
                    {new Date(lock.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={handleCopy} title="Copy pick"
              className="text-white/18 hover:text-neon/80 transition-colors">
              {copied
                ? <span className="text-[10px] text-neon font-bold">Copied!</span>
                : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                  </svg>
              }
            </button>

            <PickOutcomeControl result={lock.result} pendingLabel="Awaiting final" />

            <div className="premium-panel rounded-[22px] px-3.5 py-2.5 min-w-[88px] text-right">
              <div className="font-display text-neon font-bold text-[1.7rem] tabular leading-none tracking-[-0.05em]">{lock.confidence}</div>
              <div className="text-[9px] text-white/18 uppercase tracking-[0.22em] mt-1">Model grade</div>
            </div>
          </div>
        </div>

        <div className="h-[4px] w-full bg-white/5 rounded-full mb-5 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-neon via-[#57ffc0] to-blue-300 rounded-full transition-all"
            style={{ width: `${confPct}%` }} />
        </div>

        <p className="text-white/35 text-[11px] uppercase tracking-[0.2em] mb-2">{lock.matchup}</p>
        <div className="flex flex-wrap items-end gap-3 mb-5">
          <span className="font-display text-white font-bold text-[2rem] sm:text-[2.3rem] tracking-[-0.05em] leading-[0.98]">{lock.pick}</span>
          <span className="rounded-full border border-neon/18 bg-neon/[0.07] px-3 py-1.5 text-neon/90 text-sm font-bold uppercase tracking-[0.16em]">
            {lock.odds}
          </span>
        </div>

        {signals.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-5">
            {signals.map((s, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[11px] text-white/78 bg-white/[0.04] border border-white/[0.07] rounded-full px-3 py-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-neon/80 shrink-0" />
                {s}
              </div>
            ))}
          </div>
        )}

        {lock.reasoning && (
          <>
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[10px] text-white/22 hover:text-neon/80 transition-colors flex items-center gap-1 uppercase tracking-[0.18em]"
            >
              <svg className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 24 24">
                <path d="M7 10l5 5 5-5z"/>
              </svg>
              {expanded ? 'Hide analysis' : 'Why this is the best number on the board'}
            </button>
            {expanded && (
              <div className="mt-3 text-sm text-white/44 leading-relaxed bg-black/30 rounded-2xl p-4 border border-white/[0.05]">
                {lock.reasoning}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
