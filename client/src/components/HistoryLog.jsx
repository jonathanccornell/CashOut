import { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '';

export default function HistoryLog() {
  const [history, setHistory] = useState({ picks: [], total: 0, page: 1, totalPages: 1 });
  const [page, setPage] = useState(1);

  useEffect(() => { fetchHistory(); }, [page]);

  async function fetchHistory() {
    try {
      const res = await fetch(`${API_BASE}/api/record/history?page=${page}&limit=25`);
      setHistory(await res.json());
    } catch (err) {
      console.error(err);
    }
  }

  async function updateResult(id, result) {
    try {
      await fetch(`${API_BASE}/api/picks/${id}/result`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result })
      });
      fetchHistory();
    } catch (err) {
      console.error(err);
    }
  }

  const groupedByDate = history.picks.reduce((acc, pick) => {
    if (!acc[pick.date]) acc[pick.date] = [];
    acc[pick.date].push(pick);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-bold text-lg">Pick History</h2>
        <a
          href={`${API_BASE}/api/record/export`}
          target="_blank"
          rel="noreferrer"
          className="text-xs px-3 py-1.5 rounded-lg border border-black-border text-white/40 hover:text-white/70 hover:border-white/20 transition-colors"
        >
          Export CSV
        </a>
      </div>

      {Object.entries(groupedByDate).map(([date, datePicks]) => (
        <div key={date}>
          <div className="text-[10px] text-white/25 uppercase tracking-widest mb-2 pl-1">
            {new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
          <div className="bg-black-card border border-black-border rounded-2xl overflow-hidden">
            {datePicks.map((pick, idx) => (
              <div key={pick.id} className={`flex items-center gap-3 px-4 py-3 ${idx !== datePicks.length - 1 ? 'border-b border-black-border' : ''}`}>
                {/* Sport */}
                <div className="w-14 shrink-0">
                  <span className="text-[10px] font-bold text-neon">{pick.sport}</span>
                  {pick.is_lock === 1 && <span className="ml-1 text-[10px] text-gold">★</span>}
                </div>
                {/* Matchup */}
                <div className="flex-1 min-w-0">
                  <div className="text-white/30 text-[10px] truncate">{pick.matchup}</div>
                  <div className="text-white text-xs font-semibold truncate">{pick.pick} <span className="text-white/30 font-normal">{pick.odds}</span></div>
                </div>
                {/* Confidence */}
                <div className={`w-8 text-right text-xs font-bold tabular ${
                  pick.confidence >= 85 ? 'text-neon' : pick.confidence >= 65 ? 'text-gold' : 'text-white/30'
                }`}>
                  {pick.confidence}
                </div>
                {/* Result */}
                <div className="w-20 flex justify-end">
                  {pick.result === 'Pending' ? (
                    <div className="flex gap-1">
                      <button onClick={() => updateResult(pick.id, 'W')}
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-neon/10 text-neon border border-neon/20 hover:bg-neon/20">W</button>
                      <button onClick={() => updateResult(pick.id, 'L')}
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20">L</button>
                      <button onClick={() => updateResult(pick.id, 'Push')}
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gold/10 text-gold border border-gold/20 hover:bg-gold/20">P</button>
                    </div>
                  ) : (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      pick.result === 'W' ? 'bg-neon/10 text-neon' :
                      pick.result === 'L' ? 'bg-red-500/10 text-red-400' :
                      'bg-gold/10 text-gold'
                    }`}>{pick.result}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {history.picks.length === 0 && (
        <div className="text-center py-16 text-white/20 text-sm">No picks recorded yet.</div>
      )}

      {history.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="text-xs px-3 py-1.5 rounded-lg border border-black-border text-white/40 disabled:opacity-20 hover:border-white/20 hover:text-white/60 transition-colors">
            Previous
          </button>
          <span className="text-xs text-white/25">{history.page} / {history.totalPages}</span>
          <button onClick={() => setPage(p => Math.min(history.totalPages, p + 1))} disabled={page === history.totalPages}
            className="text-xs px-3 py-1.5 rounded-lg border border-black-border text-white/40 disabled:opacity-20 hover:border-white/20 hover:text-white/60 transition-colors">
            Next
          </button>
        </div>
      )}
    </div>
  );
}
