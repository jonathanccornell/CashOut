import { useState } from 'react';

function americanToDecimal(odds) {
  const n = parseInt(odds);
  if (!n || n === 0) return 1.91; // assume -110
  return n > 0 ? (n / 100) + 1 : (100 / Math.abs(n)) + 1;
}

function decimalToAmerican(decimal) {
  if (decimal >= 2) return '+' + Math.round((decimal - 1) * 100);
  return '-' + Math.round(100 / (decimal - 1));
}

function calcParlayOdds(picks) {
  if (picks.length < 2) return null;
  const decimal = picks.reduce((acc, p) => acc * americanToDecimal(p.odds), 1);
  return { american: decimalToAmerican(decimal), decimal };
}

function calcPayout(decimal, units = 1) {
  return ((decimal - 1) * units).toFixed(2);
}

export default function ParlayBuilder({ parlays, picks, onUpdateParlayResult }) {
  const [customLegs, setCustomLegs] = useState([]);
  const [showCustom, setShowCustom] = useState(false);

  const toggleLeg = (pickId) => {
    setCustomLegs(prev =>
      prev.includes(pickId)
        ? prev.filter(id => id !== pickId)
        : prev.length >= 4 ? prev : [...prev, pickId]
    );
  };

  const customParlayPicks = picks.filter(p => customLegs.includes(p.id));
  const customOdds = calcParlayOdds(customParlayPicks);

  return (
    <div className="space-y-5">
      <h2 className="text-white font-bold text-lg">AI Parlays</h2>

      {parlays.length === 0 && (
        <div className="bg-white/[0.025] border border-white/[0.06] rounded-2xl p-8 text-center">
          <p className="text-white/30 text-sm">Generate today's picks first to see AI parlays.</p>
        </div>
      )}

      <div className="space-y-3">
        {parlays.map((parlay) => {
          const odds = calcParlayOdds(
            parlay.legs.map(leg => ({ odds: leg.match(/\(([^)]+)\)/)?.[1] || '-110' }))
          );
          return (
            <div key={parlay.id} className="bg-white/[0.025] border border-white/[0.06] rounded-2xl p-5 hover:border-white/10 transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="text-[10px] text-white/30 uppercase tracking-widest mb-1">{parlay.legs.length}-Leg Parlay</div>
                  <h3 className="text-white font-semibold">{parlay.name}</h3>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <div className="text-neon font-black text-xl tabular">{parlay.estimated_odds}</div>
                  <div className="text-[10px] text-white/20 mt-0.5">est. odds</div>
                </div>
              </div>

              {/* Legs */}
              <div className="space-y-2 mb-4">
                {parlay.legs.map((leg, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-neon/10 border border-neon/20 text-neon text-[10px] font-black flex items-center justify-center shrink-0">
                      {i + 1}
                    </div>
                    <span className="text-white/60 text-sm">{leg}</span>
                  </div>
                ))}
              </div>

              {parlay.reasoning && (
                <p className="text-xs text-white/25 leading-relaxed border-t border-white/5 pt-3 mb-3">{parlay.reasoning}</p>
              )}

              {/* Result */}
              <div className="flex gap-2">
                {parlay.result === 'Pending' ? (
                  <>
                    <button onClick={() => onUpdateParlayResult(parlay.id, 'W')}
                      className="active-press text-[10px] font-bold px-2.5 py-1 rounded-lg bg-neon/10 text-neon border border-neon/20 hover:bg-neon/20 transition-colors">WIN</button>
                    <button onClick={() => onUpdateParlayResult(parlay.id, 'L')}
                      className="active-press text-[10px] font-bold px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors">LOSS</button>
                    <button onClick={() => onUpdateParlayResult(parlay.id, 'Push')}
                      className="active-press text-[10px] font-bold px-2.5 py-1 rounded-lg bg-gold/10 text-gold border border-gold/20 hover:bg-gold/20 transition-colors">PUSH</button>
                  </>
                ) : (
                  <span className={`text-xs font-bold px-3 py-1 rounded-lg ${
                    parlay.result === 'W' ? 'bg-neon/10 text-neon border border-neon/20' :
                    parlay.result === 'L' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                    'bg-gold/10 text-gold border border-gold/20'
                  }`}>{parlay.result}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Custom builder */}
      <div className="border-t border-white/[0.05] pt-5">
        <button
          onClick={() => setShowCustom(!showCustom)}
          className="flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors font-medium"
        >
          <svg className={`w-4 h-4 transition-transform ${showCustom ? 'rotate-45' : ''}`} fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          {showCustom ? 'Close Builder' : 'Build Custom Parlay'}
        </button>

        {showCustom && (
          <div className="mt-4 space-y-2">
            <p className="text-xs text-white/25 mb-3">Select 2–4 picks to build a parlay:</p>
            {picks.map(pick => (
              <button
                key={pick.id}
                onClick={() => toggleLeg(pick.id)}
                className={`active-press w-full text-left p-3 rounded-xl border transition-all ${
                  customLegs.includes(pick.id)
                    ? 'border-neon/30 bg-neon/5 text-white'
                    : 'border-white/[0.06] bg-white/[0.02] text-white/40 hover:border-white/10 hover:text-white/60'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-bold text-neon shrink-0">{pick.sport}</span>
                    <span className="text-xs truncate">{pick.matchup}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-semibold text-white">{pick.pick}</span>
                    <span className="text-[10px] text-white/30">{pick.odds}</span>
                    {customLegs.includes(pick.id) && <span className="text-neon text-[10px] font-black">✓</span>}
                  </div>
                </div>
              </button>
            ))}

            {customParlayPicks.length >= 2 && customOdds && (
              <div className="mt-4 p-5 bg-white/[0.025] border border-neon/20 rounded-2xl">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="text-[10px] text-neon uppercase tracking-widest mb-1">{customParlayPicks.length}-Leg Custom Parlay</div>
                    <div className="text-white/30 text-xs">Your selections</div>
                  </div>
                  <div className="text-right">
                    <div className="text-neon font-black text-2xl tabular">{customOdds.american}</div>
                    <div className="text-[10px] text-white/20">est. odds</div>
                  </div>
                </div>

                <div className="space-y-1.5 mb-4">
                  {customParlayPicks.map((p, i) => (
                    <div key={p.id} className="flex items-center gap-2 text-sm text-white/60">
                      <div className="w-4 h-4 rounded-full bg-neon/10 border border-neon/20 text-neon text-[9px] font-black flex items-center justify-center shrink-0">{i + 1}</div>
                      <span className="flex-1 truncate">{p.pick}</span>
                      <span className="text-white/30 text-xs">{p.odds}</span>
                    </div>
                  ))}
                </div>

                {/* Payout table */}
                <div className="border-t border-white/[0.05] pt-3 grid grid-cols-3 gap-3">
                  {[['$10', 10], ['$25', 25], ['$50', 50]].map(([label, amount]) => (
                    <div key={label} className="text-center">
                      <div className="text-[9px] text-white/20 uppercase tracking-wider mb-1">Bet {label}</div>
                      <div className="text-neon font-black text-sm tabular">
                        ${(parseFloat(calcPayout(customOdds.decimal, amount)) + amount).toFixed(0)}
                      </div>
                      <div className="text-[9px] text-white/20">payout</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
