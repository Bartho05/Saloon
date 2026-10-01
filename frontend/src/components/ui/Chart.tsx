import { useId, useMemo, useState } from 'react';

export interface ChartPoint {
  /** Rótulo curto do eixo. Vazio = sem rótulo (dia em que o salão está fechado). */
  label: string;
  value: number;
  meta?: string;
  /** Rótulo completo para o tooltip, quando `meta` não é usado. */
  fullLabel?: string;
}

interface BarChartProps {
  data: ChartPoint[];
  height?: number;
  formatValue?: (value: number) => string;
  emptyMessage?: string;
  /** Rótulo do eixo, à esquerda acima do gráfico. */
  axisTitle?: string;
}

/**
 * Gráfico de barras em SVG puro.
 *
 * Sem dependência de chart lib: são ~10 linhas de geometria e evita
 * adicionar ~100kB de bundle para um gráfico de barras.
 *
 * Três coisas que o gráfico precisa ter e a versão anterior não tinha:
 *
 * 1. **Rótulo embaixo de cada barra.** Sem eixo, o gráfico só valia com o
 *    mouse em cima de cada barra — e o dono do salão vai olhar isso pelo
 *    celular, onde não tem hover. Quando passam many bars, mostra-se uma de
 *    cada `step` para não amontoar.
 * 2. **Largura de barra limitada.** Com uma barra só (visão de dia) a
 *    largura virava 97% do gráfico e parecia quebrado. O limite mantém a
 *    barra com proporção de dado, não de moldura.
 * 3. **Linha de base e valor de topo.** Sem referência, não dá para saber se
 *    a barra alta é muito alta ou só a maior do período.
 */
export function BarChart({
  data,
  height = 160,
  formatValue = (v) => String(v),
  emptyMessage = 'Sem dados no período',
  axisTitle,
}: BarChartProps) {
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);

  const max = useMemo(() => Math.max(...data.map((d) => d.value), 0), [data]);

  if (data.length === 0 || max === 0) {
    return (
      <div className="flex items-center justify-center text-body-sm text-brand-grayMid" style={{ height }}>
        {emptyMessage}
      </div>
    );
  }

  /**
   * Geometria da barra.
   *
   * O gap é PROPORCIONAL à vaga, nunca fixo. Com gap fixo de 3 (3% do
   * viewBox) e 31 barras, cada vaga tem só 3,2% e sobrava 0,2% — a barra
   * virava um traço de 1px, e o gráfico parecia quebrado. A barra ocupa uma
   * fração da vaga, e ainda tem teto: com poucas barras (as 11 horas de um
   * dia) elas não viram blocos gigantes preenchendo o card.
   */
  const slot = 100 / data.length;
  const barWidth = Math.min(slot * 0.65, 14);

  // Um rótulo a cada N barras, para caber sem amontoar. Barra com `label`
  // vazio (dia em que o salão está fechado) nunca é rotulada: ela não tem
  // dia para mostrar, e o espaço em branco no eixo já informa o fechamento.
  const step = Math.max(1, Math.ceil(data.length / 12));
  const plot = height - 8;

  return (
    <div className="relative w-full">
      {/* `axisTitle` NÃO é desenhado: o card que envolve o gráfico já tem um
          <h2> com o mesmo texto, e repetir "Faturamento por dia" duas vezes
          na mesma tela é ruído. Ele serve para o aria-label. */}
      <div className="flex items-baseline justify-end mb-2">
        <span className="text-caption text-brand-grayMid tabular-nums">
          máximo {formatValue(max)}
        </span>
      </div>

      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
        role="img"
        aria-label={axisTitle ? `Gráfico: ${axisTitle}` : 'Gráfico de faturamento por período'}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#111111" />
            <stop offset="100%" stopColor="#666666" />
          </linearGradient>
        </defs>

        {data.map((point, i) => {
          const barHeight = (point.value / max) * plot;
          const x = i * slot;
          const y = height - barHeight;
          const semRotulo = point.label === '';
          // Dia de salão aberto sem atendimento nenhum: um traço de 2px,
          // para o dia continuar visível como dia. Sem ele o mês com um só
          // dia de faturamento vira um risco solitário e o gráfico parece
          // quebrado. Dia fechado não recebe traço — o vazio é a informação.
          const stub = point.value === 0 && !semRotulo;

          return (
            <rect
              key={`${point.label || 'fechado'}-${i}`}
              x={x}
              y={stub ? height - 2 : y}
              width={barWidth}
              height={stub ? 2 : Math.max(barHeight, point.value > 0 ? 1.5 : 0)}
              fill={hover === i ? '#000000' : `url(#${gradientId})`}
              // Dia aberto sem atendimento: bem claro. Fecha o dia inteiro
              // numa cor só. A diferença entre "não vendeu" e "não abriu" é o
              // que o gráfico precisa mostrar.
              opacity={stub ? 0.3 : hover === null || hover === i ? 1 : 0.45}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{ transition: 'opacity 150ms, fill 150ms' }}
            >
              <title>
                {`${point.meta ?? (point.fullLabel || point.label || 'Dia')}: ${formatValue(point.value)}`}
              </title>
            </rect>
          );
        })}

        {/* Linha de base: dá apoio para o olho e separa o gráfico do card. */}
        <line
          x1="0"
          y1={height}
          x2="100"
          y2={height}
          stroke="#EDEDED"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* Eixo X. Fica fora do SVG porque `preserveAspectRatio="none"`
          esticaria o texto na horizontal. */}
      <div className="relative h-4 mt-1" aria-hidden="true">
        {data.map((point, i) =>
          point.label && i % step === 0 ? (
            <span
              key={`eixo-${point.label}-${i}`}
              className="absolute text-caption text-brand-grayMid tabular-nums -translate-x-1/2 whitespace-nowrap"
              style={{ left: `${((i + 0.5) / data.length) * 100}%` }}
            >
              {point.label}
            </span>
          ) : null
        )}
      </div>

      {hover !== null && (
        <div
          className="pointer-events-none absolute -top-1 px-2.5 py-1.5 bg-brand-black text-brand-white text-caption whitespace-nowrap z-10"
          style={{
            left: `${Math.min(Math.max(((hover + 0.5) / data.length) * 100, 8), 92)}%`,
            transform: 'translateX(-50%)',
          }}
          role="status"
        >
          <span className="block font-display">{formatValue(data[hover].value)}</span>
          <span className="opacity-70">
            {data[hover].meta ?? data[hover].fullLabel ?? data[hover].label ?? '—'}
          </span>
        </div>
      )}
    </div>
  );
}

interface ProgressBarProps {
  value: number;
  total: number;
  className?: string;
  showLabel?: boolean;
}

export function ProgressBar({ value, total, className = '', showLabel = true }: ProgressBarProps) {
  const pct = total > 0 ? Math.min((value / total) * 100, 100) : 0;

  return (
    <div className={className}>
      <div
        className="h-1.5 w-full bg-brand-gray"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full bg-brand-black transition-all duration-normal ease-sharp" style={{ width: `${pct}%` }} />
      </div>
      {showLabel && (
        <p className="text-caption text-brand-grayMid mt-1.5">{Math.round(pct)}%</p>
      )}
    </div>
  );
}
