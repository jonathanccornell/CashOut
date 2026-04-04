import { useState, useEffect } from 'react';
import LockOfDay from './components/LockOfDay';
import PickCard from './components/PickCard';
import ParlayBuilder from './components/ParlayBuilder';
import RecordDashboard from './components/RecordDashboard';
import HistoryLog from './components/HistoryLog';
import ChatDrawer from './components/ChatDrawer';
import DisclaimerModal from './components/DisclaimerModal';

const API_BASE = import.meta.env.VITE_API_URL || '';

const TABS = [
  { id: 'picks',   label: "Today's Picks", icon: '⚡' },
  { id: 'parlays', label: 'Parlays',        icon: '🎯' },
  { id: 'record',  label: 'Record',         icon: '📊' },
  { id: 'history', label: 'History',        icon: '📋' },
];

const SPORTS = ['ALL', 'NFL', 'NBA', 'MLB', 'NHL', 'NCAAF', 'NCAAB', 'MLS'];

/* ── Hero ── */
function HeroEmpty({ onGenerate, loading }) {
  return (
    <div className="hero-mesh min-h-[calc(100vh-120px)] flex flex-col items-center justify-center px-6 py-10 text-center">
      {/* Crown pill */}
      <div className="inline-flex items-center gap-2 bg-gold/10 border border-gold/25 rounded-full px-4 py-1.5 mb-7 backdrop-blur">
        <span className="text-gold">♛</span>
        <span className="text-gold text-[11px] font-black uppercase tracking-[0.2em]">King of Cappers</span>
        <span className="text-gold">♛</span>
      </div>

      <h1 className="text-[clamp(2.4rem,8vw,4rem)] font-black text-white leading-[1.02] mb-5 max-w-lg tracking-tight">
        The World's Most<br/>
        <span className="text-neon drop-shadow-[0_0_20px_rgba(0,255,133,0.4)]">Accurate</span> Sports Picks.
      </h1>

      <p className="text-white/40 text-sm sm:text-base leading-relaxed mb-2 max-w-sm">
        Cash scans every line, injury report, and sharp money signal.
        Only calls games he's <span className="text-white/70 font-semibold">genuinely confident in</span>.
      </p>
      <p className="text-white/20 text-xs mb-8 max-w-xs">
        No filler. No guesses. Pure edge.
      </p>

      {/* Stats */}
      <div className="flex gap-8 mb-9">
        {[['7','Sports'],['15+','Sharp Signals'],['20+','Data Sources']].map(([v,l]) => (
          <div key={l} className="text-center">
            <div className="text-neon font-black text-2xl tabular drop-shadow-[0_0_8px_rgba(0,255,133,0.3)]">{v}</div>
            <div className="text-white/20 text-[9px] uppercase tracking-wider mt-0.5">{l}</div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <button
        onClick={onGenerate}
        disabled={loading}
        className="active-press w-full max-w-xs flex items-center justify-center gap-3 px-7 py-4 bg-neon text-black font-black text-base rounded-2xl shadow-[0_0_30px_rgba(0,255,133,0.3),0_0_60px_rgba(0,255,133,0.1)] hover:shadow-[0_0_40px_rgba(0,255,133,0.5)] transition-all duration-300 disabled:opacity-50"
      >
        {loading ? (
          <><div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"/>Cash is analyzing...</>
        ) : (
          <><span>♛</span>Get Today's Picks</>
        )}
      </button>

      <p className="text-white/15 text-[10px] mt-4 uppercase tracking-widest">70+ confidence minimum · Zero fluff</p>
    </div>
  );
}

/* ── Loading ── */
function LoadingState() {
  const steps = ['Scanning today\'s game slate','Checking sharp money signals','Analyzing injury reports','Finding edge'];
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep(s => (s + 1) % steps.length), 2200);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="hero-mesh min-h-[calc(100vh-120px)] flex flex-col items-center justify-center gap-8 px-6 text-center">
      <div className="relative w-20 h-20">
        <div className="absolute inset-0 rounded-full border border-neon/10"/>
        <div className="absolute inset-0 rounded-full border-[2.5px] border-transparent border-t-neon animate-spin"/>
        <div className="absolute inset-[7px] rounded-full border border-neon/15"/>
        <div className="absolute inset-0 flex items-center justify-center text-2xl select-none">♛</div>
      </div>
      <div>
        <p className="text-white font-bold text-lg mb-2">Cash is on it</p>
        <p className="text-neon/60 text-sm transition-all duration-500">{steps[step]}</p>
        <p className="text-white/15 text-xs mt-2">Only the sharpest plays will make the cut</p>
      </div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState('picks');
  const [picks, setPicks] = useState([]);
  const [lock, setLock] = useState(null);
  const [parlays, setParlays] = useState([]);
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sportFilter, setSportFilter] = useState('ALL');
  const [error, setError] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [serverOnline, setServerOnline] = useState(true);

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });

  useEffect(() => {
    fetchTodayData().then(result => {
      // result: true = has picks, false = no picks but server online, null = offline
      if (result === false) generatePicks(false);
    });
    fetchRecord();
  }, []);

  async function fetchTodayData() {
    try {
      const [a, b, c] = await Promise.all([
        fetch(`${API_BASE}/api/picks/today`),
        fetch(`${API_BASE}/api/picks/lock`),
        fetch(`${API_BASE}/api/parlays/today`),
      ]);
      setServerOnline(true);
      const picksData = await a.json();
      setPicks(picksData);
      setLock(await b.json());
      setParlays(await c.json());
      return picksData.length > 0 ? true : false; // true=has picks, false=online but empty
    } catch {
      setServerOnline(false);
      return null; // null = server offline, don't auto-generate
    }
  }

  async function fetchRecord() {
    try { setRecord(await (await fetch(`${API_BASE}/api/record`)).json()); } catch {}
  }

  async function generatePicks(force = false) {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/picks/generate${force ? '?force=true' : ''}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      await fetchTodayData(); await fetchRecord();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function updatePickResult(id, result) {
    try {
      await fetch(`${API_BASE}/api/picks/${id}/result`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ result }) });
      await fetchTodayData(); await fetchRecord();
      showToast(result === 'W' ? '✓ Marked as Win' : result === 'L' ? '✗ Marked as Loss' : '~ Marked as Push');
    } catch {}
  }

  async function updateParlayResult(id, result) {
    try {
      await fetch(`${API_BASE}/api/parlays/${id}/result`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ result }) });
      await fetchTodayData(); await fetchRecord();
      showToast(result === 'W' ? '✓ Parlay Win!' : result === 'L' ? '✗ Parlay Loss' : '~ Push');
    } catch {}
  }

  const nonLockPicks = picks.filter(p => !p.is_lock);
  const filteredPicks = sportFilter === 'ALL' ? nonLockPicks : nonLockPicks.filter(p => p.sport === sportFilter);
  const activeSports = [...new Set(picks.map(p => p.sport))];
  const hasPicks = picks.length > 0;

  return (
    <div className="min-h-screen bg-[#080808] text-white font-sans">

      {/* ── TOP HEADER ── */}
      <header className="sticky top-0 z-40 bg-[#080808]/90 backdrop-blur-xl border-b border-white/[0.04]">
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex items-center justify-between py-3.5">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <img src="/cashout-icon.png" alt="CashOut" className="h-8 w-auto" onError={e => { e.target.style.display='none'; document.getElementById('lf').style.display='flex'; }}/>
                <div id="lf" className="w-8 h-8 rounded-xl bg-neon items-center justify-center font-black text-black text-lg hidden drop-shadow-[0_0_10px_rgba(0,255,133,0.5)]">$</div>
              </div>
              <div>
                <div className="text-white font-black text-lg tracking-tight leading-none">CashOut</div>
                <div className="text-[8px] text-gold/60 uppercase tracking-[0.2em] font-bold leading-none mt-0.5">King of Cappers</div>
              </div>
            </div>

            {/* Stats + chat */}
            <div className="flex items-center gap-3">
              {record && (
                <div className="flex items-center gap-3">
                  <div className="hidden sm:block text-right">
                    <div className="text-neon font-black text-sm tabular leading-none">{record.picks.wins}-{record.picks.losses}</div>
                    <div className="text-[8px] text-white/20 uppercase tracking-wider">Record</div>
                  </div>
                  <div className="text-right">
                    <div className={`font-black text-sm tabular leading-none ${parseFloat(record.roi) >= 0 ? 'text-neon' : 'text-red-400'}`}>
                      {parseFloat(record.roi) >= 0 ? '+' : ''}{record.roi}%
                    </div>
                    <div className="text-[8px] text-white/20 uppercase tracking-wider">ROI</div>
                  </div>
                </div>
              )}
              <button onClick={() => setChatOpen(true)}
                className="active-press flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.07] hover:border-neon/30 hover:bg-neon/5 transition-all group">
                <svg className="w-3.5 h-3.5 text-white/40 group-hover:text-neon transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                </svg>
                <span className="text-xs text-white/40 group-hover:text-neon transition-colors font-semibold">Ask Cash</span>
              </button>
            </div>
          </div>

          {/* Date */}
          <div className="text-[9px] text-white/15 uppercase tracking-[0.25em] -mt-1.5 pb-3">{today}</div>

          {/* Desktop tabs */}
          {hasPicks && (
            <nav className="hidden sm:flex -mb-px overflow-x-auto">
              {TABS.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`px-5 py-2.5 text-sm font-medium transition-all whitespace-nowrap border-b-2 ${
                    tab === t.id ? 'border-neon text-neon' : 'border-transparent text-white/25 hover:text-white/60'
                  }`}>
                  {t.label}
                  {t.id === 'picks' && (
                    <span className="ml-1.5 text-[9px] bg-neon/15 text-neon rounded-full px-1.5 py-0.5">{picks.length}</span>
                  )}
                </button>
              ))}
            </nav>
          )}
        </div>
      </header>

      {/* ── MAIN ── */}
      <main className="max-w-2xl mx-auto px-4 py-5 pb-28 sm:pb-10">

        {!serverOnline && (
          <div className="mb-5 p-4 bg-red-500/5 border border-red-500/15 rounded-2xl flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-red-400 shrink-0 animate-pulse" />
            <div>
              <p className="text-red-400/80 text-sm font-semibold">Server offline</p>
              <p className="text-red-400/40 text-xs mt-0.5">Start the server: <code className="bg-white/5 px-1.5 py-0.5 rounded text-[10px]">npm run dev</code> in the edgecaller directory</p>
            </div>
          </div>
        )}
        {error && <div className="mb-5 p-4 bg-red-500/5 border border-red-500/15 rounded-2xl text-red-400/80 text-sm">{error}</div>}

        {loading && <LoadingState />}

        {/* No picks yet */}
        {!hasPicks && !loading && serverOnline && <HeroEmpty onGenerate={() => generatePicks(false)} loading={loading} />}

        {/* TODAY'S PICKS */}
        {tab === 'picks' && !loading && hasPicks && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-white font-bold text-base leading-none">Cash's 5 Best Bets</h2>
                <p className="text-white/20 text-[10px] mt-0.5 uppercase tracking-wider">Deep research · Sharp signals only</p>
              </div>
              <button onClick={() => generatePicks(true)}
                className="active-press text-[11px] px-3 py-1.5 border border-white/[0.07] text-white/25 rounded-lg hover:border-white/15 hover:text-white/50 transition-all">
                ↺ Refresh
              </button>
            </div>

            {lock && <LockOfDay lock={lock} onUpdateResult={updatePickResult} />}

            {/* Sport filters */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
              {SPORTS.filter(s => s === 'ALL' || activeSports.includes(s)).map(sport => (
                <button key={sport} onClick={() => setSportFilter(sport)}
                  className={`active-press px-3 py-1.5 text-[11px] font-bold rounded-full transition-all whitespace-nowrap flex-shrink-0 ${
                    sportFilter === sport
                      ? 'bg-neon text-black shadow-[0_0_12px_rgba(0,255,133,0.3)]'
                      : 'glass text-white/30 hover:text-white/60'
                  }`}>
                  {sport}
                </button>
              ))}
            </div>

            {/* Picks */}
            <div className="space-y-2">
              {filteredPicks.map((pick, idx) => (
                <div key={pick.id} className="fade-up" style={{ animationDelay: `${idx * 50}ms` }}>
                  <PickCard pick={pick} onUpdateResult={updatePickResult} rank={idx + 2} />
                </div>
              ))}
            </div>

            {filteredPicks.length === 0 && nonLockPicks.length > 0 && (
              <div className="text-center py-10 text-white/20 text-sm">
                No {sportFilter} plays with edge today.
              </div>
            )}

            {/* Bottom strip */}
            <div className="pt-5 border-t border-white/[0.04]">
              <div className="flex flex-wrap items-center justify-center gap-4 text-[9px] text-white/12 uppercase tracking-widest">
                <span>♛ King of Cappers</span>
                <span>·</span><span>Sharp money signals only</span>
                <span>·</span><span>70+ confidence minimum</span>
              </div>
            </div>
          </div>
        )}

        {tab === 'parlays' && hasPicks && (
          <ParlayBuilder parlays={parlays} picks={nonLockPicks} onUpdateParlayResult={updateParlayResult} />
        )}
        {tab === 'record' && <RecordDashboard record={record} />}
        {tab === 'history' && <HistoryLog />}

        {/* Allow record/history without picks */}
        {!hasPicks && !loading && tab === 'record' && <RecordDashboard record={record} />}
        {!hasPicks && !loading && tab === 'history' && <HistoryLog />}
      </main>

      {/* ── MOBILE BOTTOM NAV ── */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#080808]/95 backdrop-blur-xl border-t border-white/[0.06] pb-safe">
        <div className="flex">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`active-press flex-1 flex flex-col items-center gap-1 py-3 transition-all ${
                tab === t.id ? 'text-neon' : 'text-white/25'
              }`}>
              <span className="text-base leading-none">{t.icon}</span>
              <span className="text-[9px] font-semibold uppercase tracking-wider">{t.label.split("'")[0].trim()}</span>
              {tab === t.id && <div className="absolute bottom-0 w-1 h-1 rounded-full bg-neon" />}
            </button>
          ))}
          <button onClick={() => setChatOpen(true)}
            className="active-press flex-1 flex flex-col items-center gap-1 py-3 text-white/25 hover:text-neon transition-all">
            <span className="text-base leading-none">💬</span>
            <span className="text-[9px] font-semibold uppercase tracking-wider">Cash</span>
          </button>
        </div>
      </nav>

      {/* Floating chat (desktop) */}
      {!chatOpen && (
        <button onClick={() => setChatOpen(true)}
          className="hidden sm:flex fixed bottom-6 right-6 z-30 w-13 h-13 bg-neon rounded-2xl items-center justify-center shadow-[0_0_25px_rgba(0,255,133,0.35)] hover:shadow-[0_0_40px_rgba(0,255,133,0.5)] hover:scale-105 active-press transition-all duration-200">
          <svg className="w-5 h-5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
          </svg>
        </button>
      )}

      <ChatDrawer open={chatOpen} onClose={() => setChatOpen(false)} />
      <DisclaimerModal />

      {/* ── TOAST ── */}
      {toast && (
        <div className="fixed bottom-24 sm:bottom-8 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 bg-[#181818] border border-white/10 rounded-2xl text-white/80 text-sm font-semibold shadow-2xl whitespace-nowrap pointer-events-none">
          {toast}
        </div>
      )}

      {/* ── LEGAL FOOTER ── */}
      <footer className="sm:pb-0 pb-20 border-t border-white/[0.04] bg-[#080808]">
        <div className="max-w-2xl mx-auto px-4 py-5 space-y-3">
          <div className="flex items-center justify-center gap-2">
            <span className="text-[9px] text-white/15 uppercase tracking-widest">📞 Problem Gambling Helpline:</span>
            <span className="text-[9px] text-neon/40 font-bold tracking-widest uppercase">1-800-GAMBLER</span>
          </div>
          <p className="text-center text-[10px] text-white/10 leading-relaxed">
            CashOut is for informational and entertainment purposes only. Not financial or betting advice. Must be 21+ (18+ in select jurisdictions) to participate in legal sports wagering. Sports betting involves substantial financial risk — never wager more than you can afford to lose. Past performance does not guarantee future results.
          </p>
          <div className="flex items-center justify-center gap-4 text-[9px] text-white/8 uppercase tracking-widest">
            <span>© {new Date().getFullYear()} CashOut</span>
            <span>·</span>
            <span>Play Responsibly</span>
            <span>·</span>
            <span>18+/21+ Only</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

