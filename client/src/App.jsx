import { useState, useEffect } from 'react';
import LockOfDay from './components/LockOfDay';
import PickCard from './components/PickCard';
import ParlayBuilder from './components/ParlayBuilder';
import RecordDashboard from './components/RecordDashboard';
import HistoryLog from './components/HistoryLog';
import ChatDrawer from './components/ChatDrawer';
import DisclaimerModal from './components/DisclaimerModal';
import PushAlerts from './components/PushAlerts';
import PricingModal from './components/PricingModal';
import { useSubscription } from './hooks/useSubscription';

const API_BASE = import.meta.env.VITE_API_URL || '';

const TABS = [
  { id: 'picks', label: 'Board' },
  { id: 'parlays', label: 'Parlays' },
  { id: 'record', label: 'Record' },
  { id: 'history', label: 'History' },
];

const SPORTS = ['ALL', 'NFL', 'NBA', 'MLB', 'NHL', 'NCAAF', 'NCAAB', 'MLS'];

function BoardTicker({ record, picks, lock, avgConfidence }) {
  const items = [
    `Live board`,
    `${picks.length} active plays`,
    lock ? `Lock ${lock.pick} ${lock.odds}` : 'No forced lock',
    record ? `${record.picks.wins}-${record.picks.losses} tracked` : 'Record syncing',
    record ? `${parseFloat(record.roi) >= 0 ? '+' : ''}${record.roi}% roi` : 'ROI tracking',
    `${avgConfidence || 0} avg confidence`,
    'Selective card only',
    'Market-grade pricing',
  ];

  const doubled = [...items, ...items];

  return (
    <div className="premium-panel ticker-shell rounded-full px-2 py-2 border border-white/[0.06]">
      <div className="ticker-track">
        {doubled.map((item, idx) => (
          <div key={`${item}-${idx}`} className="ticker-item">
            <span className="status-dot text-neon" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatSyncStatus(lastSyncAt, serverOnline, isSyncing) {
  if (!serverOnline) return 'Offline';
  if (isSyncing) return 'Syncing now';
  if (!lastSyncAt) return 'Connecting';

  const diffSeconds = Math.max(0, Math.round((Date.now() - lastSyncAt.getTime()) / 1000));
  if (diffSeconds < 15) return 'Just synced';
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const diffMinutes = Math.round(diffSeconds / 60);
  return `${diffMinutes}m ago`;
}

/* ── Hero ── */
function HeroEmpty({ onGenerate, loading }) {
  return (
    <div className="hero-mesh premium-panel gold-frame texture-grid market-grid relative overflow-hidden min-h-[calc(100vh-120px)] flex flex-col items-center justify-center rounded-[36px] px-6 py-12 text-center">
      <div className="hero-float-card hidden lg:block left-6 top-8 rounded-[24px] px-4 py-3 text-left max-w-[180px]">
        <div className="text-[9px] text-white/22 uppercase tracking-[0.18em]">Board Pulse</div>
        <div className="font-display text-white text-2xl tracking-[-0.04em] mt-2">0 filler</div>
        <div className="text-[11px] text-white/38 mt-1">Only real edges survive the cut.</div>
      </div>
      <div className="hero-float-card delay-2 hidden lg:block right-6 top-16 rounded-[24px] px-4 py-3 text-left max-w-[190px]">
        <div className="text-[9px] text-white/22 uppercase tracking-[0.18em]">Habit Loop</div>
        <div className="font-display text-neon text-2xl tracking-[-0.04em] mt-2">Live results</div>
        <div className="text-[11px] text-white/38 mt-1">Every pick settles into the record in real time.</div>
      </div>
      <div className="hero-float-card delay-3 hidden lg:block left-12 bottom-10 rounded-[24px] px-4 py-3 text-left max-w-[190px]">
        <div className="text-[9px] text-white/22 uppercase tracking-[0.18em]">Feel</div>
        <div className="font-display text-blue-300 text-2xl tracking-[-0.04em] mt-2">Trading app</div>
        <div className="text-[11px] text-white/38 mt-1">Fintech clarity, not casino chaos.</div>
      </div>
      <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-neon/60 to-transparent" />
      <div className="inline-flex items-center gap-2 bg-neon/8 border border-neon/18 rounded-full px-4 py-1.5 mb-7 backdrop-blur">
        <span className="status-dot text-neon" />
        <span className="text-neon text-[11px] font-black uppercase tracking-[0.22em]">Market Grade Betting AI</span>
      </div>

      <div className="section-label mb-4">Modern Betting Intelligence</div>
      <h1 className="font-display text-[clamp(3rem,9vw,5.35rem)] font-bold text-white leading-[0.92] mb-5 max-w-2xl tracking-[-0.05em]">
        The Robinhood of
        <br />
        <span className="text-neon">sports betting</span>
      </h1>

      <p className="text-white/44 text-sm sm:text-base leading-relaxed mb-2 max-w-xl">
        CashOut is built like a premium finance product for bettors: clean market reads, selective cards, and a running performance layer that makes every result feel live.
      </p>
      <p className="text-white/20 text-xs mb-8 max-w-sm uppercase tracking-[0.26em]">
        Price discipline. Sharp reads. No forced action.
      </p>

      <div className="grid grid-cols-3 gap-3 mb-9 w-full max-w-xl">
        {[['0 filler','Only edge'],['Live record','Tracked'],['Fast scan','Daily']].map(([v,l]) => (
          <div key={l} className="premium-panel rounded-2xl px-3 py-4">
            <div className="text-neon font-display font-bold text-2xl leading-none">{v}</div>
            <div className="text-white/25 text-[10px] uppercase tracking-[0.18em] mt-2">{l}</div>
          </div>
        ))}
      </div>

      <button
        onClick={onGenerate}
        disabled={loading}
        className="active-press w-full max-w-xs flex items-center justify-center gap-3 px-7 py-4 rounded-2xl bg-gradient-to-r from-neon via-[#4dffad] to-neon text-black font-extrabold text-base shadow-[0_18px_50px_rgba(0,255,133,0.24)] hover:shadow-[0_22px_60px_rgba(0,255,133,0.34)] transition-all duration-300 disabled:opacity-50"
      >
        {loading ? (
          <><div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"/>Cash is analyzing...</>
        ) : (
          <><span>↗</span>Open Today&apos;s Board</>
        )}
      </button>

      <p className="text-white/15 text-[10px] mt-4 uppercase tracking-[0.28em]">70+ confidence threshold</p>
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
    <div className="hero-mesh premium-panel gold-frame market-grid relative overflow-hidden min-h-[calc(100vh-120px)] flex flex-col items-center justify-center gap-8 rounded-[32px] px-6 text-center">
      <div className="relative w-20 h-20">
        <div className="absolute inset-0 rounded-full border border-neon/10"/>
        <div className="absolute inset-0 rounded-full border-[2.5px] border-transparent border-t-neon animate-spin"/>
        <div className="absolute inset-[7px] rounded-full border border-neon/15"/>
        <div className="absolute inset-0 flex items-center justify-center text-2xl select-none">♛</div>
      </div>
      <div>
        <p className="font-display text-white text-4xl leading-none mb-2">Building the card</p>
        <p className="text-neon/70 text-sm transition-all duration-500 uppercase tracking-[0.18em]">{steps[step]}</p>
        <p className="text-white/15 text-xs mt-2 uppercase tracking-[0.18em]">Filtering for edge only</p>
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
  const [serverOnline, setServerOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [showPricing, setShowPricing] = useState(false);
  const { startCheckout } = useSubscription();

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });

  async function refreshAppData({ foreground = false } = {}) {
    if (foreground) setIsSyncing(true);
    try {
      const [a, b, c, d] = await Promise.all([
        fetch(`${API_BASE}/api/picks/today`),
        fetch(`${API_BASE}/api/picks/lock`),
        fetch(`${API_BASE}/api/parlays/today`),
        fetch(`${API_BASE}/api/record`),
      ]);
      if (!a.ok || !b.ok || !c.ok || !d.ok) throw new Error('Sync failed');
      setServerOnline(true);
      const picksData = await a.json();
      setPicks(picksData);
      setLock(await b.json());
      setParlays(await c.json());
      setRecord(await d.json());
      setLastSyncAt(new Date());
      return picksData.length > 0 ? true : false; // true=has picks, false=online but empty
    } catch {
      setServerOnline(false);
      return null; // null = server offline, don't auto-generate
    } finally {
      if (foreground) setIsSyncing(false);
    }
  }

  useEffect(() => {
    let active = true;

    (async () => {
      const result = await refreshAppData({ foreground: true });
      if (active && result === false) generatePicks(false);
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const syncIfVisible = () => {
      if (document.visibilityState === 'visible' && !loading) {
        refreshAppData();
      }
    };

    const intervalId = setInterval(syncIfVisible, 60 * 1000);
    window.addEventListener('focus', syncIfVisible);
    document.addEventListener('visibilitychange', syncIfVisible);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', syncIfVisible);
      document.removeEventListener('visibilitychange', syncIfVisible);
    };
  }, [loading]);

  async function generatePicks(force = false) {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/picks/generate${force ? '?force=true' : ''}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      await refreshAppData({ foreground: true });
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  const nonLockPicks = picks.filter(p => !p.is_lock);
  const filteredPicks = sportFilter === 'ALL' ? nonLockPicks : nonLockPicks.filter(p => p.sport === sportFilter);
  const activeSports = [...new Set(picks.map(p => p.sport))];
  const hasPicks = picks.length > 0;
  const avgConfidence = picks.length ? Math.round(picks.reduce((sum, p) => sum + (Number(p.confidence) || 0), 0) / picks.length) : 0;
  const settledCount = picks.filter(p => p.result && p.result !== 'Pending').length;
  const syncStatus = formatSyncStatus(lastSyncAt, serverOnline, isSyncing);

  const NAV_ICONS = {
    picks: (
      <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 7h16M4 12h10M4 17h7" strokeLinecap="round" />
        <circle cx="18" cy="12" r="2.5" />
      </svg>
    ),
    parlays: (
      <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M5 7h5l2 3 3-5 4 7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 17h16" strokeLinecap="round" />
      </svg>
    ),
    record: (
      <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M5 19V9M12 19V5M19 19v-7" strokeLinecap="round" />
      </svg>
    ),
    history: (
      <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 8v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M20 12a8 8 0 1 1-2.34-5.66" strokeLinecap="round" />
      </svg>
    ),
  };

  return (
    <div className="app-shell min-h-screen bg-[#080808] text-white font-sans">

      {/* ── TOP HEADER ── */}
      <header className="sticky top-0 z-40 bg-[#080808]/86 backdrop-blur-2xl border-b border-white/[0.05]">
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex items-center justify-between py-3.5">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div className="relative premium-panel gold-frame rounded-2xl p-2">
                <img src="/cashout-icon.png" alt="CashOut" className="h-7 w-auto" onError={e => { e.target.style.display='none'; document.getElementById('lf').style.display='flex'; }}/>
                <div id="lf" className="w-7 h-7 rounded-xl bg-neon items-center justify-center font-black text-black text-lg hidden">$</div>
              </div>
              <div>
                <div className="font-display text-white text-[1.65rem] font-bold leading-none tracking-[-0.05em]">CashOut</div>
                <div className="text-[8px] text-blue-300/60 uppercase tracking-[0.24em] font-bold leading-none mt-0.5">Market-Grade Sports Betting</div>
              </div>
            </div>

            {/* Stats + chat */}
            <div className="flex items-center gap-3">
              {record && (
                <div className="hidden sm:flex items-center gap-2 premium-panel rounded-2xl px-3 py-2">
                  <div className="text-right">
                    <div className="text-neon font-black text-sm tabular leading-none">{record.picks.wins}-{record.picks.losses}</div>
                    <div className="text-[8px] text-white/20 uppercase tracking-[0.18em]">W-L</div>
                  </div>
                  <div className="h-7 w-px bg-white/[0.06]" />
                  <div className="text-right">
                    <div className={`font-black text-sm tabular leading-none ${parseFloat(record.roi) >= 0 ? 'text-neon' : 'text-red-400'}`}>
                      {parseFloat(record.roi) >= 0 ? '+' : ''}{record.roi}%
                    </div>
                    <div className="text-[8px] text-white/20 uppercase tracking-[0.18em]">ROI</div>
                  </div>
                </div>
              )}
              <button onClick={() => setChatOpen(true)}
                className="active-press flex items-center gap-1.5 px-3 py-2 rounded-xl premium-panel hover:border-neon/30 hover:bg-neon/5 transition-all group">
                <svg className="w-3.5 h-3.5 text-white/40 group-hover:text-neon transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                </svg>
                <span className="text-xs text-white/40 group-hover:text-neon transition-colors font-semibold">Ask Cash</span>
              </button>
              <PushAlerts />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 -mt-1 pb-3">
            <div className="text-[9px] text-white/15 uppercase tracking-[0.3em]">{today}</div>
            <div className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[9px] uppercase tracking-[0.18em] ${
              serverOnline
                ? 'border-neon/15 bg-neon/[0.05] text-neon/85'
                : 'border-red-400/18 bg-red-400/[0.06] text-red-300'
            }`}>
              <span className={`status-dot ${serverOnline ? 'text-neon' : 'text-red-400'}`} />
              <span>{serverOnline ? 'CashOut Sync' : 'Offline'}</span>
              <span className="text-white/30">•</span>
              <span className={serverOnline ? 'text-white/60' : 'text-red-300/70'}>{syncStatus}</span>
            </div>
          </div>

          {/* Desktop tabs */}
          {hasPicks && (
            <nav className="hidden sm:flex items-center gap-1 pb-3 overflow-x-auto">
              {TABS.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`px-4 py-2.5 text-sm font-medium transition-all whitespace-nowrap rounded-full ${
                    tab === t.id ? 'premium-panel text-neon' : 'text-white/25 hover:text-white/60'
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
        {hasPicks && !loading && (
          <div className="mb-4">
            <BoardTicker record={record} picks={picks} lock={lock} avgConfidence={avgConfidence} />
          </div>
        )}

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
            <div className="premium-panel gold-frame market-grid rounded-[28px] px-5 py-5 panel-hover">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="section-label mb-2">Today&apos;s Card</div>
                  <h2 className="font-display text-white text-[2.35rem] font-bold leading-none tracking-[-0.05em]">Live Board</h2>
                  <p className="text-white/22 text-[11px] mt-2 uppercase tracking-[0.2em]">Selective card • tracked results • sharp pricing only</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="hidden sm:inline-flex items-center gap-2 rounded-full border border-blue-400/14 bg-blue-400/[0.06] px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-blue-200/85">
                    <span className="status-dot text-blue-300" />
                    <span>Auto-settles every 30m</span>
                  </div>
                  <button onClick={() => generatePicks(true)}
                    className="active-press text-[11px] px-3 py-1.5 border border-white/[0.07] text-white/25 rounded-full hover:border-neon/25 hover:text-neon transition-all">
                    Refresh Card
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-5">
                <div className="premium-panel metric-glow rounded-2xl px-4 py-3">
                  <div className="text-[9px] text-white/18 uppercase tracking-[0.22em]">Tracked plays</div>
                  <div className="font-display text-white text-2xl leading-none tracking-[-0.04em] mt-2">{picks.length}</div>
                </div>
                <div className="premium-panel metric-glow rounded-2xl px-4 py-3">
                  <div className="text-[9px] text-white/18 uppercase tracking-[0.22em]">Avg confidence</div>
                  <div className="font-display text-neon text-2xl leading-none tracking-[-0.04em] mt-2">{avgConfidence}</div>
                </div>
                <div className="premium-panel metric-glow rounded-2xl px-4 py-3">
                  <div className="text-[9px] text-white/18 uppercase tracking-[0.22em]">Board pulse</div>
                  <div className="font-display text-white text-2xl leading-none tracking-[-0.04em] mt-2">{settledCount}</div>
                  <div className="text-[10px] text-white/24 mt-1">settled today</div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                <div className="premium-panel rounded-2xl px-4 py-3">
                  <div className="text-[9px] text-white/18 uppercase tracking-[0.2em]">Card posture</div>
                  <div className="text-sm text-white/78 mt-2">Selective, confidence-weighted, no volume for volume&apos;s sake.</div>
                </div>
                <div className="premium-panel rounded-2xl px-4 py-3">
                  <div className="text-[9px] text-white/18 uppercase tracking-[0.2em]">Result loop</div>
                  <div className="text-sm text-white/78 mt-2">CashOut auto-settles picks and updates record, history, and lock accountability on its own.</div>
                </div>
                <div className="premium-panel rounded-2xl px-4 py-3">
                  <div className="text-[9px] text-white/18 uppercase tracking-[0.2em]">Why it feels live</div>
                  <div className="text-sm text-white/78 mt-2">Odds, edge grade, and result state all read in a single glance.</div>
                </div>
              </div>
              <div className="lux-divider mt-5" />
            </div>

            {lock && <LockOfDay lock={lock} />}

            {/* Sport filters */}
            <div className="flex items-center justify-between px-1">
              <div>
                <h3 className="text-white font-semibold text-sm leading-none">Board filter</h3>
                <p className="text-white/20 text-[10px] mt-1 uppercase tracking-[0.18em]">Slice the card by active sport</p>
              </div>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
              {SPORTS.filter(s => s === 'ALL' || activeSports.includes(s)).map(sport => (
                <button key={sport} onClick={() => setSportFilter(sport)}
                  className={`active-press px-3 py-1.5 text-[11px] font-bold rounded-full transition-all whitespace-nowrap flex-shrink-0 ${
                    sportFilter === sport
                      ? 'bg-neon text-black shadow-[0_0_12px_rgba(0,255,133,0.3)]'
                      : 'premium-panel text-white/30 hover:text-white/60'
                  }`}>
                  {sport}
                </button>
              ))}
            </div>

            {/* Picks */}
            <div className="space-y-2">
              {filteredPicks.map((pick, idx) => (
                <div key={pick.id} className="fade-up" style={{ animationDelay: `${idx * 50}ms` }}>
                  <PickCard pick={pick} rank={idx + 2} />
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
                <span>♛ CashOut Board</span>
                <span>·</span><span>Market-sensitive picks</span>
                <span>·</span><span>Auto-settled results</span>
              </div>
            </div>
          </div>
        )}

        {tab === 'parlays' && hasPicks && (
          <ParlayBuilder parlays={parlays} picks={nonLockPicks} />
        )}
        {tab === 'record' && <RecordDashboard record={record} />}
        {tab === 'history' && <HistoryLog />}

        {/* Allow record/history without picks */}
        {!hasPicks && !loading && tab === 'record' && <RecordDashboard record={record} />}
        {!hasPicks && !loading && tab === 'history' && <HistoryLog />}
      </main>

      {/* ── MOBILE BOTTOM NAV ── */}
      <nav className="sm:hidden fixed bottom-3 left-3 right-3 z-40 pb-safe">
        <div className="premium-panel rounded-[28px] border border-white/[0.08] px-2 py-2 shadow-[0_24px_60px_rgba(0,0,0,0.46)]">
          <div className="flex items-center gap-1.5">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`active-press relative flex-1 rounded-[20px] px-2 py-2.5 transition-all ${
                  tab === t.id
                    ? 'bg-[linear-gradient(180deg,rgba(0,255,133,0.16),rgba(0,255,133,0.06))] text-neon border border-neon/18 shadow-[0_10px_25px_rgba(0,255,133,0.08)]'
                    : 'text-white/32 border border-transparent'
                }`}
              >
                <div className="flex flex-col items-center gap-1">
                  <span>{NAV_ICONS[t.id]}</span>
                  <span className="text-[9px] font-semibold uppercase tracking-[0.16em]">{t.label}</span>
                </div>
              </button>
            ))}
            <button
              onClick={() => setChatOpen(true)}
              className="active-press shrink-0 rounded-[22px] px-3 py-3 bg-neon text-black shadow-[0_12px_28px_rgba(0,255,133,0.22)]"
              aria-label="Open Cash chat"
            >
              <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </button>
          </div>
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
      {showPricing && <PricingModal onClose={() => setShowPricing(false)} startCheckout={startCheckout} />}

      {/* ── TOAST ── */}
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
