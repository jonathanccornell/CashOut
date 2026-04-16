const SPORT_STYLE = {
  NFL:   { color: 'text-emerald-400', border: 'border-emerald-400/20' },
  NBA:   { color: 'text-orange-400',  border: 'border-orange-400/20' },
  MLB:   { color: 'text-red-400',     border: 'border-red-400/20' },
  NHL:   { color: 'text-blue-400',    border: 'border-blue-400/20' },
  NCAAF: { color: 'text-lime-400',    border: 'border-lime-400/20' },
  NCAAB: { color: 'text-purple-400',  border: 'border-purple-400/20' },
  MLS:   { color: 'text-teal-400',    border: 'border-teal-400/20' },
};

function WinBar({ wins, losses }) {
  const total = wins + losses;
  if (total === 0) return <div className="h-1.5 w-full bg-white/5 rounded-full" />;
  const pct = (wins / total) * 100;
  return (
    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
      <div className="h-full bg-neon rounded-full transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

function MetricCard({ label, value, detail, tone = 'text-white' }) {
  return (
    <div className="premium-panel metric-glow rounded-2xl p-4">
      <div className="text-[9px] text-white/20 uppercase tracking-[0.2em]">{label}</div>
      <div className={`font-display text-[2rem] tracking-[-0.05em] mt-2 tabular ${tone}`}>{value}</div>
      {detail && <div className="text-[11px] text-white/30 mt-1">{detail}</div>}
    </div>
  );
}

export default function RecordDashboard({ record }) {
  if (!record) {
    return <div className="text-center py-16 text-white/20 text-sm">Generate picks to start tracking your record.</div>;
  }

  const { picks, locks, parlays, roi, streak, bySport = [] } = record;
  const roiPositive = parseFloat(roi) >= 0;
  const freshStart = picks.total === 0 && parlays.total === 0;
  const decided = picks.wins + picks.losses;
  const lockDecided = locks.wins + locks.losses;
  const parlayDecided = parlays.wins + parlays.losses;
  const winRateValue = Number(picks.winRate || 0);
  const performanceLabel =
    winRateValue >= 57 ? 'Alpha territory' :
    winRateValue >= 53 ? 'Positive edge' :
    winRateValue >= 50 ? 'Building sample' :
    'Needs lift';

  if (freshStart) {
    return (
      <div className="space-y-6">
        <div className="premium-panel gold-frame market-grid rounded-[32px] px-6 py-7 panel-hover">
          <div className="section-label mb-3">Fresh Start</div>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-display text-white text-[2.35rem] font-bold tracking-[-0.05em] leading-none">
                Performance cockpit
              </h2>
              <p className="text-white/40 text-sm leading-relaxed mt-3 max-w-xl">
                The record has been reset. New picks will build a clean public track record from here, and every win or loss will feed the timeline, sport splits, and lock accountability.
              </p>
            </div>
            <div className="premium-panel rounded-[24px] px-4 py-4 min-w-[180px]">
              <div className="text-[9px] text-white/18 uppercase tracking-[0.2em]">Status</div>
              <div className="font-display text-neon text-[1.9rem] tracking-[-0.05em] mt-2">Ready</div>
              <div className="text-[11px] text-white/32 mt-1">Waiting for the first graded card.</div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          <MetricCard label="W-L" value="0-0" />
          <MetricCard label="Win Rate" value="0.0%" />
          <MetricCard label="ROI" value="0.0%" />
          <MetricCard label="Pending" value="0" detail="CashOut reconciles automatically" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            ['Results Timeline', 'Every graded pick lands here with clean context around edge, sport, and result state.'],
            ['Sport Breakdown', 'As volume builds, the board separates what actually performs by market and league.'],
            ['Lock Tracking', 'Flagship plays stay isolated so the best bet earns or loses trust on its own merits.'],
          ].map(([title, copy]) => (
            <div key={title} className="premium-panel rounded-2xl p-5 panel-hover">
              <div className="text-sm font-bold text-white">{title}</div>
              <p className="text-xs text-white/32 leading-relaxed mt-2">{copy}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="premium-panel gold-frame market-grid rounded-[32px] px-6 py-7 panel-hover">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="section-label mb-3">Performance Layer</div>
            <h2 className="font-display text-white text-[2.45rem] font-bold tracking-[-0.05em] leading-none">
              Record that feels
              <br />
              alive
            </h2>
            <p className="text-white/38 text-sm leading-relaxed mt-3 max-w-xl">
              This is the proof layer of the product: every settled pick feeds the brand, the confidence loop, and what users come back to check.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:w-[260px]">
            <MetricCard label="Total Record" value={`${picks.wins}-${picks.losses}`} />
            <MetricCard label="ROI" value={`${roiPositive ? '+' : ''}${roi}%`} tone={roiPositive ? 'text-neon' : 'text-red-400'} />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          <MetricCard label="Win Rate" value={`${picks.winRate}%`} detail={performanceLabel} tone={winRateValue >= 53 ? 'text-neon' : 'text-white'} />
          <MetricCard label="Decided" value={decided} detail="Resolved bets on record" />
          <MetricCard label="Streak" value={streak} detail="Current run" tone="text-gold" />
          <MetricCard label="Pending" value={picks.pending} detail="Auto-reconciling in background" tone="text-white/80" />
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-white/24 mb-2">
            <span>Overall hit rate</span>
            <span>{decided > 0 ? `${picks.winRate}%` : 'Waiting for volume'}</span>
          </div>
          <WinBar wins={picks.wins} losses={picks.losses} />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-white text-[1.8rem] font-bold tracking-[-0.04em] leading-none">Record by Sport</h2>
          <span className="text-[10px] text-white/20 uppercase tracking-wider">All picks • All-time</span>
        </div>

        {bySport.length === 0 ? (
          <div className="premium-panel rounded-2xl p-8 text-center text-white/20 text-sm">
            Records will appear here as picks are graded.
          </div>
        ) : (
          <div className="space-y-3">
            {bySport.map(s => {
              const style = SPORT_STYLE[s.sport] || { color: 'text-white/40', border: 'border-white/10' };
              const sportDecided = s.wins + s.losses;
              const roiPos = parseFloat(s.roi) >= 0;
              return (
                <div key={s.sport} className={`premium-panel panel-hover border rounded-[24px] px-5 py-4 ${style.border}`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-16 shrink-0 text-xs font-black ${style.color}`}>{s.sport}</div>
                    <div className="shrink-0">
                      <span className="text-white font-black text-lg tabular">{s.wins}</span>
                      <span className="text-white/20 text-sm mx-1">-</span>
                      <span className="text-white/50 font-bold text-lg tabular">{s.losses}</span>
                      {s.pushes > 0 && <span className="text-white/20 text-xs ml-1">({s.pushes}P)</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <WinBar wins={s.wins} losses={s.losses} />
                    </div>
                    <div className="shrink-0 text-right">
                      <div className={`text-sm font-bold tabular ${parseFloat(s.winRate) >= 55 ? 'text-neon' : parseFloat(s.winRate) >= 50 ? 'text-white/60' : 'text-red-400/70'}`}>
                        {sportDecided > 0 ? `${s.winRate}%` : '—'}
                      </div>
                    </div>
                    <div className="shrink-0 text-right w-14">
                      <div className={`text-xs font-bold tabular ${roiPos ? 'text-neon/70' : 'text-red-400/60'}`}>
                        {sportDecided > 0 ? `${roiPos ? '+' : ''}${s.roi}%` : '—'}
                      </div>
                      <div className="text-[9px] text-white/15 uppercase tracking-wider">ROI</div>
                    </div>
                    {s.pending > 0 && (
                      <div className="shrink-0">
                        <span className="text-[9px] text-white/20 bg-white/5 border border-white/8 rounded-full px-2 py-0.5">
                          {s.pending} pending
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="premium-panel panel-hover border border-neon/15 rounded-[28px] p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-gold">♛</span>
            <span className="text-[10px] font-black text-gold uppercase tracking-widest">Lock of the Day</span>
            {locks.total > 0 && <span className="ml-auto text-[9px] text-white/20 uppercase tracking-wider">{locks.total} total</span>}
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <div className="font-display text-[2rem] text-white tabular tracking-[-0.05em]">
                {locks.wins}-{locks.losses}{locks.pushes > 0 ? `-${locks.pushes}` : ''}
              </div>
              <div className="text-[10px] text-white/20 mt-0.5">W-L{locks.pushes > 0 ? '-P' : ''}</div>
            </div>
            <div className="h-8 w-px bg-white/5" />
            <div>
              <div className="font-display text-[2rem] text-neon tabular tracking-[-0.05em]">
                {lockDecided > 0 ? ((locks.wins / lockDecided) * 100).toFixed(0) : '—'}%
              </div>
              <div className="text-[10px] text-white/20 mt-0.5">hit rate</div>
            </div>
            <div className="h-8 w-px bg-white/5" />
            <div>
              {(() => {
                const lockRoi = locks.roi;
                const hasLockRoi = lockRoi !== undefined && lockRoi !== null;
                const pos = hasLockRoi && parseFloat(lockRoi) >= 0;
                return (
                  <>
                    <div className={`font-display text-[2rem] tracking-[-0.05em] tabular ${hasLockRoi ? (pos ? 'text-neon' : 'text-red-400') : 'text-white/20'}`}>
                      {hasLockRoi ? `${pos ? '+' : ''}${lockRoi}%` : '—'}
                    </div>
                    <div className="text-[10px] text-white/20 mt-0.5">lock ROI</div>
                  </>
                );
              })()}
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1"><WinBar wins={locks.wins} losses={locks.losses} /></div>
            {locks.streak && (
              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${locks.streak.endsWith('W') ? 'text-neon bg-neon/10' : 'text-red-400 bg-red-400/10'}`}>
                {locks.streak} streak
              </span>
            )}
          </div>
        </div>

        <div className="premium-panel panel-hover border border-white/[0.06] rounded-[28px] p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Parlays</span>
          </div>
          <div className="flex items-center gap-6">
            <div>
              <div className="font-display text-[2rem] text-white tabular tracking-[-0.05em]">{parlays.wins}-{parlays.losses}</div>
              <div className="text-xs text-white/20 mt-0.5">W-L</div>
            </div>
            <div className="h-8 w-px bg-white/5" />
            <div>
              <div className="font-display text-[2rem] text-gold tabular tracking-[-0.05em]">
                {parlayDecided > 0 ? ((parlays.wins / parlayDecided) * 100).toFixed(0) : 0}%
              </div>
              <div className="text-xs text-white/20 mt-0.5">hit rate</div>
            </div>
            <div className="h-8 w-px bg-white/5" />
            <div>
              <div className="font-display text-[2rem] text-white/30 tabular tracking-[-0.05em]">{parlays.total}</div>
              <div className="text-xs text-white/20 mt-0.5">total</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
