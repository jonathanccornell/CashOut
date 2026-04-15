const OPTIONS = [
  { key: 'W', label: 'Win', value: 'W', active: 'text-neon bg-neon/16 border-neon/24 shadow-[0_0_24px_rgba(0,255,133,0.12)]' },
  { key: 'L', label: 'Loss', value: 'L', active: 'text-red-400 bg-red-400/14 border-red-400/20 shadow-[0_0_24px_rgba(248,113,113,0.1)]' },
  { key: 'Push', label: 'Push', value: 'Push', active: 'text-gold bg-gold/14 border-gold/20 shadow-[0_0_24px_rgba(240,192,64,0.1)]' },
];

function ResultChip({ result, compact = false }) {
  const option = OPTIONS.find(item => item.value === result);
  if (!option) return null;

  const baseLabel = compact ? option.key : option.label;
  const colorClass =
    result === 'W' ? 'text-neon' :
    result === 'L' ? 'text-red-400' :
    'text-gold';

  return (
    <div className={`result-chip inline-flex items-center gap-2 rounded-full border ${compact ? 'px-2.5 py-1 text-[10px]' : 'px-3 py-1.5 text-xs'} font-bold uppercase tracking-[0.18em] ${colorClass}`}>
      <span className={`status-dot ${colorClass}`} />
      <span>{baseLabel}</span>
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
          className={`active-press rounded-full border ${compact ? 'px-2.5 py-1' : 'px-3 py-1.5'} text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/45 border-transparent hover:text-white hover:border-white/10 transition-all ${option.active}`}
        >
          {compact ? option.key : option.label}
        </button>
      ))}
    </div>
  );
}
