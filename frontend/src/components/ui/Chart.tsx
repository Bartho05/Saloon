import { useId, useMemo, useState } from 'react';

export interface ChartPoint {
  label: string;
  value: number;
  meta?: string;
}

interface BarChartProps {
  data: ChartPoint[];
  height?: number;
  formatValue?: (value: number) => string;
  emptyMessage?: string;
}

/**
 * Gráfico de barras em SVG puro.
 *
 * Sem dependência de chart lib: são ~10 linhas de geometria e evita
 * adicionar ~100kB de bundle para um gráfico de barras.
 */
export function BarChart({
  data,
  height = 160,
  formatValue = (v) => String(v),
  emptyMessage = 'Sem dados no período',
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

  const gap = data.length > 40 ? 1 : 3;
  const barWidth = 100 / data.length - gap;

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
        role="img"
        aria-label="Gráfico de faturamento por período"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#111111" />
            <stop offset="100%" stopColor="#666666" />
          </linearGradient>
        </defs>

        {data.map((point, i) => {
          const barHeight = (point.value / max) * (height - 8);
          const x = i * (100 / data.length) + gap / 2;
          const y = height - barHeight;

          return (
            <rect
              key={`${point.label}-${i}`}
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(barHeight, point.value > 0 ? 1.5 : 0)}
              fill={hover === i ? '#000000' : `url(#${gradientId})`}
              opacity={hover === null || hover === i ? 1 : 0.45}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{ transition: 'opacity 150ms, fill 150ms' }}
            >
              <title>{`${point.label}: ${formatValue(point.value)}`}</title>
            </rect>
          );
        })}
      </svg>

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
          <span className="opacity-70">{data[hover].meta ?? data[hover].label}</span>
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
