import { useState, useEffect } from 'react';
import PickOutcomeControl from './PickOutcomeControl';

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
        <div>
          <h2 className="font-display text-white text-[2rem] font-bold tracking-[-0.04em] leading-none">Results Feed</h2>
          <p className="text-white/24 text-[11px] uppercase tracking-[0.2em] mt-2">Every settled pick, in one running timeline</p>
        </div>
        <a
          href={`${API_BASE}/api/record/export`}
          target="_blank"
          rel="noreferrer"
          className="text-xs px-3 py-1.5 rounded-full border border-white/10 text-white/40 hover:text-white/70 hover:border-white/20 transition-colors"
        >
          Export CSV
        </a>
      </div>

      {Object.entries(groupedByDate).map(([date, datePicks]) => (
        <div key={date}>
          <div className="text-[10px] text-white/25 uppercase tracking-widest mb-3 pl-1">
            {new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
          <div className="premium-panel rounded-[26px] overflow-hidden border border-white/[0.06]">
            {datePicks.map((pick, idx) => (
              <div key={pick.id} className={`px-4 py-4 ${idx !== datePicks.length - 1 ? 'border-b border-white/[0.05]' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className="w-16 shrink-0 pt-0.5">
                    <div className="text-[10px] font-bold text-neon uppercase tracking-[0.16em]">{pick.sport}</div>
                    {pick.is_lock === 1 && <div className="text-[10px] text-gold mt-1 uppercase tracking-[0.16em]">Lock</div>}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-white/26 text-[10px] uppercase tracking-[0.16em] truncate">{pick.matchup}</div>
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      <div className="font-display text-white text-[1.05rem] font-bold tracking-[-0.03em] truncate">
                        {pick.pick}
                      </div>
                      <span className="rounded-full border border-neon/14 bg-neon/[0.06] px-2 py-0.5 text-[10px] font-bold text-neon/85 uppercase tracking-[0.14em]">
                        {pick.odds}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-bold ${pick.confidence >= 85 ? 'text-neon' : pick.confidence >= 65 ? 'text-gold' : 'text-white/30'}`}>
                        {pick.confidence} model
                      </span>
                      <span className="text-white/12">•</span>
                      <span className="text-[10px] text-white/22 uppercase tracking-[0.16em]">{pick.bet_type || pick.betType || 'Pick'}</span>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center">
                    {pick.result === 'Pending' ? (
                      <PickOutcomeControl result={pick.result} id={pick.id} onUpdate={updateResult} compact />
                    ) : (
                      <PickOutcomeControl result={pick.result} id={pick.id} onUpdate={updateResult} compact />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {history.picks.length === 0 && (
        <div className="premium-panel gold-frame market-grid rounded-[28px] px-6 py-12 text-center">
          <div className="section-label mb-3">History</div>
          <h3 className="font-display text-white text-[2rem] font-bold tracking-[-0.04em]">No settled picks yet</h3>
          <p className="text-white/35 text-sm leading-relaxed mt-3 max-w-lg mx-auto">
            The slate has been reset. As new cards are graded, this screen will become the running timeline of every bet, result, and closing performance snapshot.
          </p>
        </div>
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
