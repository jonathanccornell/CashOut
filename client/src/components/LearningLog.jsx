import { useState, useEffect } from 'react';

const API_BASE = '';

const CATEGORY_STYLE = {
  sport:      { color: 'text-neon',      bg: 'bg-neon/10',      label: 'Sport' },
  bet_type:   { color: 'text-blue-400',  bg: 'bg-blue-400/10',  label: 'Bet Type' },
  confidence: { color: 'text-gold',      bg: 'bg-gold/10',      label: 'Confidence' },
  day:        { color: 'text-purple-400',bg: 'bg-purple-400/10',label: 'Day' },
  signal:     { color: 'text-orange-400',bg: 'bg-orange-400/10',label: 'Signal' },
  general:    { color: 'text-white/50',  bg: 'bg-white/5',      label: 'General' },
};

export default function LearningLog() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/learnings`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function triggerRun() {
    setRunning(true);
    try {
      const res = await fetch(`${API_BASE}/api/learnings/run`, { method: 'POST' });
      const result = await res.json();
      if (result.result) {
        const refresh = await fetch(`${API_BASE}/api/learnings`).then(r => r.json());
        setData(refresh);
      } else {
        alert(result.message || 'Not enough data yet');
      }
    } catch {}
    setRunning(false);
  }

  if (loading) return <div className="text-center py-16 text-white/20 text-sm">Loading...</div>;

  const learnings = data?.learnings;
  const runs = data?.runs || [];

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-white font-bold text-lg">Model Self-Learning</h2>
          <p className="text-white/25 text-xs mt-1">Cash analyzes his own results every Sunday to improve future picks.</p>
        </div>
        <button
          onClick={triggerRun}
          disabled={running}
          className="text-[10px] font-black uppercase tracking-wider px-3 py-2 rounded-xl border border-neon/30 text-neon/70 hover:border-neon hover:text-neon transition-all disabled:opacity-40"
        >
          {running ? 'Analyzing...' : 'Run Now'}
        </button>
      </div>

      {/* No learnings yet */}
      {!learnings ? (
        <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-10 text-center">
          <div className="text-3xl mb-3">🧠</div>
          <div className="text-white/40 font-semibold text-sm">No learnings yet</div>
          <div className="text-white/20 text-xs mt-2">Cash needs 10+ graded picks before he can analyze patterns.</div>
          <div className="text-white/15 text-xs mt-1">Learnings run automatically every Sunday. You can also trigger manually above.</div>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="bg-white/[0.03] border border-neon/15 rounded-2xl p-5">
            <div className="text-[10px] font-black text-neon uppercase tracking-widest mb-2">Latest Analysis</div>
            <p className="text-white/70 text-sm leading-relaxed">{learnings.summary}</p>
            {learnings.lastRan && (
              <div className="text-[10px] text-white/20 mt-3">Last ran: {new Date(learnings.lastRan).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
            )}
          </div>

          {/* Insights */}
          <div>
            <h3 className="text-white/60 text-xs font-black uppercase tracking-widest mb-3">Learned Insights</h3>
            <div className="space-y-3">
              {learnings.insights.map((insight, i) => {
                const style = CATEGORY_STYLE[insight.category] || CATEGORY_STYLE.general;
                const adj = insight.confidence_adjustment;
                return (
                  <div key={i} className="bg-white/[0.025] border border-white/[0.06] rounded-2xl p-4">
                    <div className="flex items-start gap-3">
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full shrink-0 mt-0.5 ${style.color} ${style.bg}`}>
                        {style.label}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-white/80 text-sm leading-snug">{insight.insight}</div>
                        {insight.data && (
                          <div className="text-white/25 text-xs mt-1 font-mono">{insight.data}</div>
                        )}
                      </div>
                      {adj !== 0 && (
                        <span className={`text-xs font-black shrink-0 ${adj > 0 ? 'text-neon' : 'text-red-400'}`}>
                          {adj > 0 ? '+' : ''}{adj} conf
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Run history */}
      {runs.length > 0 && (
        <div>
          <h3 className="text-white/60 text-xs font-black uppercase tracking-widest mb-3">Analysis History</h3>
          <div className="space-y-2">
            {runs.map((run, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                <div className="text-white/40 text-xs">{new Date(run.ran_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                <div className="text-white/25 text-xs">{run.picks_analyzed} picks analyzed</div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
