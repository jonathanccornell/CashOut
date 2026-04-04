import { useEffect, useState } from 'react';

const STORAGE_KEY = 'cashout_disclaimer_v1';

export default function DisclaimerModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setOpen(true);
  }, []);

  function accept() {
    localStorage.setItem(STORAGE_KEY, '1');
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#0f0f0f] border border-white/[0.08] rounded-3xl p-7 shadow-[0_0_60px_rgba(0,0,0,0.8)]">

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center text-lg flex-shrink-0">
            ⚖️
          </div>
          <div>
            <h2 className="text-white font-black text-base leading-tight">Before You Continue</h2>
            <p className="text-white/30 text-xs mt-0.5">Important legal information</p>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-3 mb-6">
          <div className="flex gap-3">
            <span className="text-neon text-xs mt-0.5 flex-shrink-0">✓</span>
            <p className="text-white/50 text-xs leading-relaxed">
              CashOut is for <strong className="text-white/70">informational and entertainment purposes only</strong>. Nothing here constitutes financial, legal, or betting advice.
            </p>
          </div>
          <div className="flex gap-3">
            <span className="text-neon text-xs mt-0.5 flex-shrink-0">✓</span>
            <p className="text-white/50 text-xs leading-relaxed">
              You must be <strong className="text-white/70">21+ years of age</strong> (18+ in select jurisdictions) and located in a region where sports wagering is legal.
            </p>
          </div>
          <div className="flex gap-3">
            <span className="text-neon text-xs mt-0.5 flex-shrink-0">✓</span>
            <p className="text-white/50 text-xs leading-relaxed">
              <strong className="text-white/70">Past results do not guarantee future outcomes.</strong> Sports betting involves substantial risk. Never wager more than you can afford to lose.
            </p>
          </div>
          <div className="flex gap-3">
            <span className="text-neon text-xs mt-0.5 flex-shrink-0">✓</span>
            <p className="text-white/50 text-xs leading-relaxed">
              If you or someone you know has a gambling problem, call the National Problem Gambling Helpline:{' '}
              <strong className="text-white/80">1-800-522-4700</strong> or visit{' '}
              <span className="text-neon/70">ncpgambling.org</span>
            </p>
          </div>
        </div>

        {/* Problem gambling hotline strip */}
        <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl px-4 py-3 mb-5 flex items-center gap-3">
          <span className="text-base flex-shrink-0">📞</span>
          <div>
            <p className="text-white/60 text-[11px] font-bold">National Problem Gambling Helpline</p>
            <p className="text-neon text-sm font-black">1-800-GAMBLER</p>
            <p className="text-white/25 text-[10px]">24/7 confidential support · 1-800-426-2537</p>
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={accept}
          className="active-press w-full py-3.5 bg-neon text-black font-black text-sm rounded-2xl shadow-[0_0_20px_rgba(0,255,133,0.2)] hover:shadow-[0_0_30px_rgba(0,255,133,0.35)] transition-all">
          I'm 21+, I Understand — Let Me In
        </button>

        <p className="text-white/15 text-[10px] text-center mt-3 leading-relaxed">
          By continuing you confirm you are of legal age and acknowledge all risks associated with sports wagering.
        </p>
      </div>
    </div>
  );
}
