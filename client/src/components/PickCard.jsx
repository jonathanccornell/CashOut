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

function CopyBtn({ pick }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    const text = `#${pick._rank ? pick._rank : ''} ${pick.sport} | ${pick.matchup}\n${pick.pick} ${pick.odds} | Conf: ${pick.confidence}\n\nvia CashOut — King of Cappers`;
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

export default function PickCard({ pick, onUpdateResult, rank }) {
  const [expanded, setExpanded] = useState(false);
  const conf = pick.confidence;
  const confColor = conf >= 85 ? 'text-neon' : conf >= 70 ? 'text-gold' : 'text-white/40';
  const sportStyle = SPORT_STYLE[pick.sport] || 'text-white/40 bg-white/4 border-white/8';
  const signals = pick.signals ? (typeof pick.signals === 'string' ? JSON.parse(pick.signals) : pick.signals) : [];
  const pickWithRank = { ...pick, _rank: rank };
  const edgeLabel = conf >= 85 ? 'A+' : conf >= 80 ? 'A' : conf >= 75 ? 'B+' : 'B';

  return (
    <div className="group premium-panel market-grid rounded-[24px] px-5 py-4 hover:border-neon/18 hover:-translate-y-[1px] transition-all">
      <div className="flex items-start gap-3">

        {/* Left */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            {rank && (
              <span className="text-[10px] font-black text-white/20 w-5">#{rank}</span>
            )}
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${sportStyle}`}>
              {pick.sport}
            </span>
            <span className="text-[10px] text-white/20 uppercase tracking-[0.14em]">{pick.bet_type || pick.betType}</span>
            <span className="ml-auto text-[10px] font-bold text-blue-300/80 bg-blue-400/10 border border-blue-400/10 rounded-full px-2 py-0.5 uppercase tracking-[0.18em]">
              Edge {edgeLabel}
            </span>
            {pick.created_at && (
              <span className="text-[9px] text-white/10">
                {new Date(pick.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </span>
            )}
          </div>
          <p className="text-white/28 text-[11px] mb-1 uppercase tracking-[0.18em] truncate">{pick.matchup}</p>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-white font-bold text-[17px] leading-none">{pick.pick}</span>
            <span className="text-neon/80 text-sm font-bold">{pick.odds}</span>
          </div>
        </div>

        {/* Right */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <CopyBtn pick={pickWithRank} />
            <div className="text-right">
              <div className={`text-xl font-black tabular leading-none ${confColor}`}>{conf}</div>
              <div className="text-[9px] text-white/20 mt-0.5 uppercase tracking-[0.18em]">model</div>
            </div>
          </div>
        </div>
      </div>

      {/* Confidence bar */}
      <div className="mt-3 h-[3px] w-full bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${conf >= 85 ? 'bg-neon' : conf >= 70 ? 'bg-blue-400/80' : 'bg-white/20'}`}
          style={{ width: `${conf}%` }} />
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="text-[10px] text-white/20 uppercase tracking-[0.2em]">
          Grade Pick
        </div>
        <PickOutcomeControl result={pick.result} id={pick.id} onUpdate={onUpdateResult} compact />
      </div>

      {/* Sharp signals */}
      {signals.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {signals.map((s, i) => (
            <span key={i} className="text-[10px] text-blue-200/85 bg-blue-400/10 border border-blue-400/10 rounded-full px-2 py-0.5 leading-relaxed">
              {s}
            </span>
          ))}
        </div>
      )}

      {/* Toggle reasoning */}
      {pick.reasoning && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-3 text-[10px] text-white/18 hover:text-neon/70 transition-colors flex items-center gap-1 uppercase tracking-[0.18em]"
          >
            <svg className={`w-2.5 h-2.5 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 24 24">
              <path d="M7 10l5 5 5-5z"/>
            </svg>
            {expanded ? 'Hide' : 'Open Read'}
          </button>
          {expanded && (
            <div className="mt-2.5 text-xs text-white/35 leading-relaxed bg-black/20 rounded-xl p-4 border border-white/[0.04]">
              {pick.reasoning}
            </div>
          )}
        </>
      )}
    </div>
  );
}
