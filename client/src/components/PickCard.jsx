import { useState } from 'react';
import PickOutcomeControl from './PickOutcomeControl';

const SPORT_STYLE = {
  NFL: 'text-emerald-400 bg-emerald-400/8 border-emerald-400/15',
  NBA: 'text-orange-400 bg-orange-400/8 border-orange-400/15',
  MLB: 'text-red-400 bg-red-400/8 border-red-400/15',
  NHL: 'text-blue-400 bg-blue-400/8 border-blue-400/15',
  NCAAF: 'text-lime-400 bg-lime-400/8 border-lime-400/15',
  NCAAB: 'text-purple-400 bg-purple-400/8 border-purple-400/15',
  MLS: 'text-teal-400 bg-teal-400/8 border-teal-400/15',
  Soccer: 'text-teal-400 bg-teal-400/8 border-teal-400/15',
};

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

function CopyBtn({ pick }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    const text = `#${pick._rank ? pick._rank : ''} ${pick.sport} | ${pick.matchup}\n${pick.pick} ${pick.odds} | Conf: ${pick.confidence}\n\nvia CashOut`;
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} title="Copy pick"
      className="text-white/15 hover:text-white/40 transition-colors flex-shrink-0">
      {copied
        ? <span className="text-[9px] text-neon font-bold">✓</span>
        : <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
          </svg>
      }
    </button>
  );
}

export default function PickCard({ pick, rank }) {
  const [expanded, setExpanded] = useState(false);
  const conf = pick.confidence;
  const confColor = conf >= 85 ? 'text-neon' : conf >= 78 ? 'text-blue-300' : 'text-white/55';
  const sportStyle = SPORT_STYLE[pick.sport] || 'text-white/40 bg-white/4 border-white/8';
  const signals = parseSignals(pick.signals);
  const pickWithRank = { ...pick, _rank: rank };
  const edgeLabel = conf >= 85 ? 'A+' : conf >= 80 ? 'A' : conf >= 75 ? 'B+' : 'B';
  const betType = pick.bet_type || pick.betType;
  const lineValue = pick.line ?? (typeof pick.pick === 'string' ? pick.pick.match(/([+-]?\d+(?:\.\d+)?)/)?.[1] : null);
  const isSettled = pick.result && pick.result !== 'Pending';
  const resultGlow =
    pick.result === 'W' ? 'border-neon/18 shadow-[0_18px_55px_rgba(0,255,133,0.08)]' :
    pick.result === 'L' ? 'border-red-400/14 shadow-[0_18px_55px_rgba(248,113,113,0.06)]' :
    pick.result === 'Push' ? 'border-gold/18 shadow-[0_18px_55px_rgba(240,192,64,0.06)]' :
    'border-white/[0.06] shadow-[0_18px_55px_rgba(0,0,0,0.32)]';

  return (
    <div className={`group premium-panel market-grid rounded-[28px] px-5 py-4 transition-all hover:-translate-y-[1px] ${resultGlow}`}>
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-3">
            {rank && <span className="text-[10px] font-black text-white/18">#{rank}</span>}
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${sportStyle}`}>{pick.sport}</span>
            <span className="text-[10px] text-white/24 uppercase tracking-[0.18em]">{betType}</span>
            <span className="text-[10px] font-bold text-blue-200/80 bg-blue-400/10 border border-blue-400/10 rounded-full px-2.5 py-1 uppercase tracking-[0.18em]">
              Edge {edgeLabel}
            </span>
            {isSettled && (
              <span className="text-[10px] text-white/22 uppercase tracking-[0.18em]">Settled</span>
            )}
          </div>

          <p className="text-white/30 text-[11px] uppercase tracking-[0.2em] truncate">{pick.matchup}</p>

          <div className="mt-2 flex items-end justify-between gap-4">
            <div className="min-w-0">
              <div className="font-display text-white font-bold text-[1.22rem] sm:text-[1.35rem] leading-[1.05] tracking-[-0.04em]">
                {pick.pick}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-white/28">
                {lineValue && (
                  <span className="rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1">
                    Line {lineValue}
                  </span>
                )}
                <span className="rounded-full border border-neon/16 bg-neon/[0.06] px-2.5 py-1 text-neon/85">
                  {pick.odds}
                </span>
                {pick.created_at && (
                  <span className="rounded-full border border-white/8 bg-white/[0.02] px-2.5 py-1">
                    {new Date(pick.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>

            <div className="shrink-0 flex items-start gap-3">
              <CopyBtn pick={pickWithRank} />
              <div className="premium-panel rounded-[20px] px-3 py-2.5 min-w-[82px] text-right">
                <div className={`font-display text-[1.55rem] font-bold tabular leading-none tracking-[-0.05em] ${confColor}`}>{conf}</div>
                <div className="text-[9px] text-white/22 mt-1 uppercase tracking-[0.22em]">Model grade</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-white/22 mb-2">
          <span>Edge strength</span>
          <span className={confColor}>{conf >= 85 ? 'Top tier' : conf >= 78 ? 'Live' : 'Thin edge'}</span>
        </div>
        <div className="h-[4px] w-full bg-white/5 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${conf >= 85 ? 'bg-gradient-to-r from-neon via-[#60ffbb] to-[#98ffd1]' : conf >= 78 ? 'bg-gradient-to-r from-blue-400 via-blue-300 to-neon/80' : 'bg-white/25'}`}
            style={{ width: `${conf}%` }}
          />
        </div>
      </div>

      {signals.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {signals.slice(0, 4).map((s, i) => (
            <span key={i} className="text-[10px] text-white/72 bg-white/[0.04] border border-white/[0.07] rounded-full px-2.5 py-1 leading-relaxed">
              {s}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] text-white/22 uppercase tracking-[0.2em]">Result</div>
          <div className="text-[11px] text-white/36 mt-1">{isSettled ? 'Booked on the record' : 'Awaiting verified final'}</div>
        </div>
        <PickOutcomeControl result={pick.result} compact pendingLabel="Awaiting final" />
      </div>

      {pick.reasoning && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-4 text-[10px] text-white/22 hover:text-neon/70 transition-colors flex items-center gap-1 uppercase tracking-[0.18em]"
          >
            <svg className={`w-2.5 h-2.5 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 24 24">
              <path d="M7 10l5 5 5-5z"/>
            </svg>
            {expanded ? 'Hide analysis' : 'Why it made the card'}
          </button>
          {expanded && (
            <div className="mt-3 text-sm text-white/42 leading-relaxed bg-black/25 rounded-2xl p-4 border border-white/[0.05]">
              {pick.reasoning}
            </div>
          )}
        </>
      )}
    </div>
  );
}
