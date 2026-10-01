import { ChevronLeftIcon, ChevronRightIcon } from '@components/icons';

type Period = 'day' | 'month' | 'year';

const OPTIONS: { value: Period; label: string }[] = [
  { value: 'day', label: 'Dia' },
  { value: 'month', label: 'Mês' },
  { value: 'year', label: 'Ano' },
];

interface PeriodSelectorProps {
  value: Period;
  onChange: (p: Period) => void;
  /**
   * Data de referência (YYYY-MM-DD) do período exibido.
   *
   * Antes o financeiro só mostrava "hoje", "este mês" e "este ano": o dono
   * não conseguia conferir o fechamento de ontem nem do mês passado, que é
   * justamente quando ele precisa do número. O servidor já aceitava
   * `reference` — faltava a navegação.
   */
  reference?: string;
  onReferenceChange?: (iso: string) => void;
  /** Rótulo do período vindo do servidor, que já sabe o fuso do salão. */
  label?: string;
}

/** Soma (ou subtrai) meses preservando o dia quando possível. */
function shiftMonth(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const alvo = new Date(y, m - 1 + delta, 1);
  // 31 de janeiro + 1 mês cairia em março: trava no último dia do mês destino.
  const ultimo = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
  const dia = Math.min(d, ultimo);
  return `${alvo.getFullYear()}-${String(alvo.getMonth() + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function shiftDay(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const alvo = new Date(y, m - 1, d + delta);
  return `${alvo.getFullYear()}-${String(alvo.getMonth() + 1).padStart(2, '0')}-${String(alvo.getDate()).padStart(2, '0')}`;
}

function shiftYear(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${y + delta}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function shift(iso: string, period: Period, delta: number): string {
  if (period === 'day') return shiftDay(iso, delta);
  if (period === 'month') return shiftMonth(iso, delta);
  return shiftYear(iso, delta);
}

/** Chave de comparação de período, para saber se já estamos no presente. */
function periodKey(iso: string, period: Period): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (period === 'day') return `${y}-${m}-${d}`;
  if (period === 'month') return `${y}-${m}`;
  return String(y);
}

export function PeriodSelector({
  value,
  onChange,
  reference,
  onReferenceChange,
  label,
}: PeriodSelectorProps) {
  const navegavel = !!reference && !!onReferenceChange;

  const hoje = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  })();

  // Sem referência (uso em outro lugar), a navegação fica desligada e o
  // componente continua sendo só as três abas.
  if (!navegavel) {
    return (
      <div className="tabs" role="tablist" aria-label="Selecionar período">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={value === opt.value}
            onClick={() => onChange(opt.value)}
            className={`tab ${value === opt.value ? 'tab-active' : 'tab-inactive'}`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    );
  }

  const noPresente = periodKey(reference!, value) === periodKey(hoje, value);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="tabs" role="tablist" aria-label="Selecionar período">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={value === opt.value}
            onClick={() => onChange(opt.value)}
            className={`tab ${value === opt.value ? 'tab-active' : 'tab-inactive'}`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onReferenceChange!(shift(reference!, value, -1))}
          className="p-2 text-brand-grayMid hover:text-brand-black hover:bg-brand-grayLight transition-colors duration-fast"
          aria-label="Período anterior"
          title="Período anterior"
        >
          <ChevronLeftIcon className="w-4 h-4" />
        </button>

        {/* Sem `capitalize` do Tailwind: ela maiúscula TODA palavra e
            "outubro de 2026" virava "Outubro De 2026". O servidor já
            devolve a primeira letra maiúscula. */}
        <span className="text-body-sm font-display font-medium min-w-[9rem] text-center truncate">
          {label ?? '—'}
        </span>

        <button
          type="button"
          onClick={() => onReferenceChange!(shift(reference!, value, 1))}
          // Não deixa avançar para o futuro: não há o que ver, e o botão
          // desligado explica por quê em vez de simplesmente sumir.
          disabled={noPresente}
          className="p-2 text-brand-grayMid hover:text-brand-black hover:bg-brand-grayLight transition-colors duration-fast disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-brand-grayMid"
          aria-label="Próximo período"
          title={noPresente ? 'Você já está no período atual' : 'Próximo período'}
        >
          <ChevronRightIcon className="w-4 h-4" />
        </button>

        {!noPresente && (
          <button
            type="button"
            onClick={() => onReferenceChange!(hoje)}
            className="text-caption text-brand-grayMid underline underline-offset-2 hover:text-brand-black transition-colors duration-fast ml-1"
          >
            Hoje
          </button>
        )}
      </div>
    </div>
  );
}

export type { Period };
export { shift as shiftPeriod };
