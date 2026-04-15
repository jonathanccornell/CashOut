const SPORT_STYLE = {
  NFL:   { color: 'text-emerald-400', bar: 'bg-emerald-400', border: 'border-emerald-400/20', bg: 'bg-emerald-400/8' },
  NBA:   { color: 'text-orange-400',  bar: 'bg-orange-400',  border: 'border-orange-400/20',  bg: 'bg-orange-400/8' },
  MLB:   { color: 'text-red-400',     bar: 'bg-red-400',     border: 'border-red-400/20',     bg: 'bg-red-400/8' },
  NHL:   { color: 'text-blue-400',    bar: 'bg-blue-400',    border: 'border-blue-400/20',    bg: 'bg-blue-400/8' },
  NCAAF: { color: 'text-lime-400',    bar: 'bg-lime-400',    border: 'border-lime-400/20',    bg: 'bg-lime-400/8' },
  NCAAB: { color: 'text-purple-400',  bar: 'bg-purple-400',  border: 'border-purple-400/20',  bg: 'bg-purple-400/8' },
  MLS:   { color: 'text-teal-400',    bar: 'bg-teal-400',    border: 'border-teal-400/20',    bg: 'bg-teal-400/8' },
};

function WinBar({ wins, losses }) {
  const total = wins + losses;
  if (total === 0) return <div className="h-1 w-full bg-white/5 rounded-full" />;
  const pct = (wins / total) * 100;
  return (
    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
      <div className="h-full bg-neon rounded-full transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function RecordDashboard({ record }) {
  if (!record) return (
    <div className="text-center py-16 text-white/20 text-sm">Generate picks to start tracking your record.</div>
  );

  const { picks, locks, parlays, roi, streak, bySport = [] } = record;
  const roiPositive = parseFloat(roi) >= 0;
  const freshStart = picks.total === 0 && parlays.total === 0;

  if (freshStart) {
    return (
      <div className="space-y-6">
        <div className="premium-panel gold-frame market-grid rounded-[28px] px-6 py-7">
          <div className="section-label mb-3">Fresh Start</div>
          <h2 className="font-display text-white text-[2.15rem] font-bold tracking-[-0.04em] leading-none">
            New tracking season
          </h2>
          <p className="text-white/40 text-sm leading-relaxed mt-3 max-w-xl">
            The historical card has been cleared. New picks will build a clean record from this point forward, and the dashboard will populate as graded results come in.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            {[
              ['0-0', 'W-L'],
              ['0.0%', 'Win Rate'],
              ['0.0%', 'ROI'],
              ['0', 'Pending']
            ].map(([value, label]) => (
              <div key={label} className="premium-panel rounded-2xl p-4">
                <div className="text-[9px] text-white/20 uppercase tracking-[0.22em] mb-2">{label}</div>
                <div className="text-2xl font-black text-white tabular">{value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            ['Results Timeline', 'Every graded pick will land here with sport, edge, and result context.'],
            ['Sport Breakdown', 'As volume builds, the board will separate what actually performs by market.'],
            ['Lock Tracking', 'Lock ROI and streaks will stay isolated so the flagship play is judged honestly.']
          ].map(([title, copy]) => (
            <div key={title} className="premium-panel rounded-2xl p-5">
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

      {/* ── Overall headline stats ── */}
      <div>
        <h2 className="text-white font-bold text-lg mb-4">All-Time Record</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="premium-panel rounded-2xl p-5">
            <div className="text-[9px] text-white/25 uppercase tracking-widest mb-2">Overall</div>
            <div className="text-3xl font-black text-white tabular">{picks.wins}-{picks.losses}</div>
            <div className="text-neon text-xs font-semibold mt-1">{picks.winRate}% win rate</div>
          </div>
          <div className="premium-panel rounded-2xl p-5">
            <div className="text-[9px] text-white/25 uppercase tracking-widest mb-2">ROI</div>
            <div className={`text-3xl font-black tabular ${roiPositive ? 'text-neon' : 'text-red-400'}`}>
              {roiPositive ? '+' : ''}{roi}%
            </div>
            <div className="text-white/20 text-xs mt-1">tracked units</div>
          </div>
          <div className="premium-panel rounded-2xl p-5">
            <div className="text-[9px] text-white/25 uppercase tracking-widest mb-2">Streak</div>
            <div className="text-3xl font-black text-gold tabular">{streak}</div>
            <div className="text-white/20 text-xs mt-1">current run</div>
          </div>
          <div className="premium-panel rounded-2xl p-5">
            <div className="text-[9px] text-white/25 uppercase tracking-widest mb-2">Pending</div>
            <div className="text-3xl font-black text-white/30 tabular">{picks.pending}</div>
            <div className="text-white/20 text-xs mt-1">awaiting results</div>
          </div>
        </div>
      </div>

      {/* ── Sport-by-Sport Breakdown ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-bold text-lg">Record by Sport</h2>
          <span className="text-[10px] text-white/20 uppercase tracking-wider">All picks · All-time</span>
        </div>

        {bySport.length === 0 ? (
          <div className="premium-panel rounded-2xl p-8 text-center text-white/20 text-sm">
            Records will appear here as picks are graded.
          </div>
        ) : (
          <div className="space-y-3">
            {bySport.map(s => {
              const style = SPORT_STYLE[s.sport] || { color: 'text-white/40', bar: 'bg-white/20', border: 'border-white/10', bg: 'bg-white/5' };
              const decided = s.wins + s.losses;
              const roiPos = parseFloat(s.roi) >= 0;
              return (
                <div key={s.sport} className={`premium-panel border rounded-2xl px-5 py-4 ${style.border}`}>
                  <div className="flex items-center gap-4">
                    {/* Sport label */}
                    <div className={`w-16 shrink-0 text-xs font-black ${style.color}`}>{s.sport}</div>

                    {/* Record */}
                    <div className="shrink-0">
                      <span className="text-white font-black text-lg tabular">{s.wins}</span>
                      <span className="text-white/20 text-sm mx-1">-</span>
                      <span className="text-white/50 font-bold text-lg tabular">{s.losses}</span>
                      {s.pushes > 0 && <span className="text-white/20 text-xs ml-1">({s.pushes}P)</span>}
                    </div>

                    {/* Win rate bar */}
                    <div className="flex-1 min-w-0">
                      <WinBar wins={s.wins} losses={s.losses} />
                    </div>

                    {/* Win % */}
                    <div className="shrink-0 text-right">
                      <div className={`text-sm font-bold tabular ${parseFloat(s.winRate) >= 55 ? 'text-neon' : parseFloat(s.winRate) >= 50 ? 'text-white/60' : 'text-red-400/70'}`}>
                        {decided > 0 ? `${s.winRate}%` : '—'}
                      </div>
                    </div>

                    {/* ROI */}
                    <div className="shrink-0 text-right w-14">
                      <div className={`text-xs font-bold tabular ${roiPos ? 'text-neon/70' : 'text-red-400/60'}`}>
                        {decided > 0 ? `${roiPos ? '+' : ''}${s.roi}%` : '—'}
                      </div>
                      <div className="text-[9px] text-white/15 uppercase tracking-wider">ROI</div>
                    </div>

                    {/* Pending badge */}
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

      {/* ── Lock & Parlay Records ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="premium-panel border border-neon/15 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-gold">♛</span>
            <span className="text-[10px] font-black text-gold uppercase tracking-widest">Lock of the Day</span>
            {locks.total > 0 && (
              <span className="ml-auto text-[9px] text-white/20 uppercase tracking-wider">{locks.total} total</span>
            )}
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <div className="text-2xl font-black text-white tabular">
                {locks.wins}-{locks.losses}{locks.pushes > 0 ? `-${locks.pushes}` : ''}
              </div>
              <div className="text-[10px] text-white/20 mt-0.5">W-L{locks.pushes > 0 ? '-P' : ''}</div>
            </div>
            <div className="h-8 w-px bg-white/5" />
            <div>
              <div className="text-2xl font-black text-neon tabular">
                {(locks.wins + locks.losses) > 0
                  ? ((locks.wins / (locks.wins + locks.losses)) * 100).toFixed(0)
                  : '—'}%
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
                    <div className={`text-2xl font-black tabular ${hasLockRoi ? (pos ? 'text-neon' : 'text-red-400') : 'text-white/20'}`}>
                      {hasLockRoi ? `${pos ? '+' : ''}${lockRoi}%` : '—'}
                    </div>
                    <div className="text-[10px] text-white/20 mt-0.5">lock ROI</div>
                  </>
                );
              })()}
            </div>
          </div>
          {/* Lock win bar + streak */}
          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1"><WinBar wins={locks.wins} losses={locks.losses} /></div>
            {locks.streak && (
              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${locks.streak.endsWith('W') ? 'text-neon bg-neon/10' : 'text-red-400 bg-red-400/10'}`}>
                {locks.streak} streak
              </span>
            )}
          </div>
        </div>

        <div className="premium-panel border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Parlays</span>
          </div>
          <div className="flex items-center gap-6">
            <div>
              <div className="text-2xl font-black text-white tabular">{parlays.wins}-{parlays.losses}</div>
              <div className="text-xs text-white/20 mt-0.5">W-L</div>
            </div>
            <div className="h-8 w-px bg-white/5" />
            <div>
              <div className="text-2xl font-black text-gold tabular">
                {(parlays.wins + parlays.losses) > 0
                  ? ((parlays.wins / (parlays.wins + parlays.losses)) * 100).toFixed(0)
                  : 0}%
              </div>
              <div className="text-xs text-white/20 mt-0.5">hit rate</div>
            </div>
            <div className="h-8 w-px bg-white/5" />
            <div>
              <div className="text-2xl font-black text-white/30 tabular">{parlays.total}</div>
              <div className="text-xs text-white/20 mt-0.5">total</div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
