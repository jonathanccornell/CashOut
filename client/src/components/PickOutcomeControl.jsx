const OPTIONS = [
  {
    key: 'W',
    label: 'Win',
    value: 'W',
    buttonClass: 'text-neon bg-neon/12 border-neon/18 hover:bg-neon/18 hover:border-neon/30',
    chipClass: 'text-neon bg-[linear-gradient(180deg,rgba(0,255,133,0.22),rgba(0,255,133,0.08))] border-neon/24 shadow-[0_0_30px_rgba(0,255,133,0.12)]',
    orbClass: 'bg-neon',
    resultLabel: 'Cashed',
  },
  {
    key: 'L',
    label: 'Loss',
    value: 'L',
    buttonClass: 'text-red-400 bg-red-400/10 border-red-400/16 hover:bg-red-400/16 hover:border-red-400/28',
    chipClass: 'text-red-300 bg-[linear-gradient(180deg,rgba(248,113,113,0.18),rgba(248,113,113,0.06))] border-red-400/20 shadow-[0_0_26px_rgba(248,113,113,0.1)]',
    orbClass: 'bg-red-400',
    resultLabel: 'Missed',
  },
  {
    key: 'Push',
    label: 'Push',
    value: 'Push',
    buttonClass: 'text-gold bg-gold/10 border-gold/16 hover:bg-gold/16 hover:border-gold/28',
    chipClass: 'text-gold bg-[linear-gradient(180deg,rgba(240,192,64,0.18),rgba(240,192,64,0.06))] border-gold/20 shadow-[0_0_26px_rgba(240,192,64,0.1)]',
    orbClass: 'bg-gold',
    resultLabel: 'Pushed',
  },
];

function ResultChip({ result, compact = false }) {
  const option = OPTIONS.find(item => item.value === result);
  if (!option) return null;

  const label = compact ? option.key : option.resultLabel;

  return (
    <div className={`result-chip inline-flex items-center gap-2 rounded-full border ${compact ? 'px-2.5 py-1 text-[10px]' : 'px-3.5 py-1.5 text-[11px]'} font-bold uppercase tracking-[0.18em] ${option.chipClass}`}>
      <span className={`status-dot shadow-[0_0_18px_currentColor] ${option.orbClass}`} />
      <span>{label}</span>
    </div>
  );
}

export default function PickOutcomeControl({ result, id, onUpdate, compact = false }) {
  if (result !== 'Pending') {
    return <ResultChip result={result} compact={compact} />;
  }

  return (
    <div className={`result-switch inline-flex items-center gap-1 rounded-full p-1 ${compact ? '' : 'min-h-[42px]'}`}>
      {OPTIONS.map(option => (
        <button
          key={option.key}
          onClick={() => onUpdate(id, option.value)}
          className={`active-press rounded-full border ${compact ? 'px-2.5 py-1' : 'px-3 py-1.5'} text-[10px] font-extrabold uppercase tracking-[0.18em] transition-all ${option.buttonClass}`}
        >
          {compact ? option.key : option.label}
        </button>
      ))}
    </div>
  );
}
