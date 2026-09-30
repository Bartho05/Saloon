type Period = 'day' | 'month' | 'year';

const OPTIONS: { value: Period; label: string }[] = [
  { value: 'day', label: 'Hoje' },
  { value: 'month', label: 'Mês' },
  { value: 'year', label: 'Ano' },
];

interface PeriodSelectorProps {
  value: Period;
  onChange: (p: Period) => void;
}

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  return (
    <div className="tabs" role="tablist" aria-label="Selecionar período">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={value === opt.value}
          onClick={() => onChange(opt.value)}
          data-state={value === opt.value ? 'active' : 'inactive'}
          className="tab"
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export type { Period };
