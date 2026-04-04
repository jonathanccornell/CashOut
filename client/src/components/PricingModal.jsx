export default function PricingModal({ onClose, startCheckout, highlightFeature }) {

  const plans = [
    {
      key: null,
      name: 'Free',
      price: '$0',
      period: 'forever',
      color: 'border-white/10',
      badge: null,
      features: [
        { label: '4 AI picks daily', included: true },
        { label: 'Parlay builder', included: true },
        { label: 'Record & history', included: true },
        { label: 'Lock of the Day', included: false },
        { label: 'Ask Cash (AI chat)', included: false },
        { label: 'Live bet alerts', included: false },
      ],
      cta: null,
    },
    {
      key: 'sharp_monthly',
      name: 'Sharp',
      price: '$29',
      period: '/month',
      color: 'border-white/20',
      badge: null,
      features: [
        { label: '4 AI picks daily', included: true },
        { label: 'Parlay builder', included: true },
        { label: 'Record & history', included: true },
        { label: 'Lock of the Day', included: true },
        { label: 'Ask Cash (AI chat)', included: true },
        { label: 'Live bet alerts', included: false },
      ],
      cta: 'Go Sharp',
    },
    {
      key: 'elite_monthly',
      name: 'Elite',
      price: '$49',
      period: '/month',
      color: 'border-neon/40',
      badge: 'MOST POPULAR',
      features: [
        { label: '4 AI picks daily', included: true },
        { label: 'Parlay builder', included: true },
        { label: 'Record & history', included: true },
        { label: 'Lock of the Day', included: true },
        { label: 'Ask Cash (AI chat)', included: true },
        { label: 'Live bet push alerts', included: true },
      ],
      cta: 'Go Elite',
    },
    {
      key: 'season_pass',
      name: 'NFL Season Pass',
      price: '$199',
      period: 'one-time',
      color: 'border-gold/40',
      badge: 'BEST VALUE',
      features: [
        { label: 'Everything in Elite', included: true },
        { label: 'Full NFL season access', included: true },
        { label: 'Priority support', included: true },
        { label: 'Locked-in price forever', included: true },
      ],
      cta: 'Get Season Pass',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-4xl bg-[#0A0A0A] border border-white/10 rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 z-10 max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="text-center mb-8">
          <button onClick={onClose} className="absolute top-4 right-4 text-white/20 hover:text-white/60 text-2xl leading-none">×</button>
          <div className="text-[10px] font-black text-neon uppercase tracking-[0.3em] mb-2">Go Premium</div>
          <h2 className="text-2xl font-black text-white">Cash doesn't give his best picks for free.</h2>
          <p className="text-white/30 text-sm mt-2">Lock of the Day. Live alerts. The full edge.</p>
        </div>

        {/* Plans */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map(plan => (
            <div key={plan.name} className={`relative border rounded-2xl p-5 flex flex-col ${plan.color} ${plan.badge ? 'bg-white/[0.04]' : 'bg-white/[0.02]'}`}>
              {plan.badge && (
                <div className={`absolute -top-3 left-1/2 -translate-x-1/2 text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${plan.badge === 'BEST VALUE' ? 'bg-gold text-black' : 'bg-neon text-black'}`}>
                  {plan.badge}
                </div>
              )}

              <div className="mb-4">
                <div className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-1">{plan.name}</div>
                <div className="flex items-end gap-1">
                  <span className="text-3xl font-black text-white">{plan.price}</span>
                  <span className="text-white/30 text-xs mb-1">{plan.period}</span>
                </div>
              </div>

              <ul className="space-y-2 flex-1 mb-5">
                {plan.features.map(f => (
                  <li key={f.label} className="flex items-center gap-2 text-xs">
                    <span className={f.included ? 'text-neon' : 'text-white/15'}>
                      {f.included ? '✓' : '×'}
                    </span>
                    <span className={f.included ? 'text-white/70' : 'text-white/20'}>{f.label}</span>
                  </li>
                ))}
              </ul>

              {plan.cta ? (
                <button
                  onClick={() => { startCheckout(plan.key); onClose(); }}
                  className={`w-full py-2.5 rounded-xl text-sm font-black transition-all active:scale-95 ${
                    plan.key === 'elite_monthly'
                      ? 'bg-neon text-black hover:bg-neon/90'
                      : plan.key === 'season_pass'
                      ? 'bg-gold text-black hover:bg-gold/90'
                      : 'bg-white/10 text-white hover:bg-white/15'
                  }`}
                >
                  {plan.cta}
                </button>
              ) : (
                <div className="w-full py-2.5 rounded-xl text-sm font-bold text-center text-white/20 border border-white/5">Current Plan</div>
              )}
            </div>
          ))}
        </div>

        <p className="text-center text-[10px] text-white/15 mt-6">Cancel anytime. No questions asked. 21+ only. Not financial advice.</p>
      </div>
    </div>
  );
}
