import type { ReactNode } from 'react';
import { Card, CardContent, Badge as BaseBadge } from '@components/ui';

type Tone = 'neutral' | 'success' | 'danger' | 'warning' | 'info';

/**
 * Badges monocromáticos.
 *
 * A distinção é feita por PESO, não por matiz: preto sólido > preenchimento
 * claro > contorno sólido > contorno tracejado. Uma escada visual que se lê
 * em cinza — funciona em tela, em impressão e para quem não distingue verde
 * de vermelho.
 */
const toneClasses: Record<Tone, string> = {
  neutral: 'bg-brand-grayLight text-brand-grayDark border border-brand-gray',
  // concluído: o estado mais forte, preto cheio
  success: 'bg-brand-black text-brand-white border border-brand-black',
  // cancelado: contornado — a ausência de preenchimento diz "não conta"
  danger: 'bg-brand-white text-brand-black border border-brand-black',
  // não compareceu: tracejado, recua
  warning: 'bg-brand-white text-brand-grayMid border border-dashed border-brand-grayMid',
  // agendado: preenchimento leve, ainda em aberto
  info: 'bg-brand-gray text-brand-black border border-brand-gray',
};

export function StatusBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`badge ${toneClasses[tone]}`}>{children}</span>;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8 pb-6 border-b border-brand-gray">
      <div>
        <h1 className="text-display-md md:text-display-lg">{title}</h1>
        {description && <p className="text-body text-brand-grayMid mt-2">{description}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  /** 'sm' para grades densas (6 colunas), 'md' para cards avulsos */
  size?: 'sm' | 'md';
}

export function StatCard({ label, value, hint, size = 'md' }: StatCardProps) {
  return (
    <Card variant="hover">
      <CardContent>
        <p className="font-display text-caption text-brand-grayMid">{label}</p>
        {/* Escala responsiva: em grids de 2 colunas no mobile o card fica com
            ~120px de conteudo, e "R$ 1.820,00" a 24px nao cabe. O
            whitespace-nowrap evita a quebra feia no meio do valor. */}
        <p
          className={`font-display font-bold mt-2 tabular-nums whitespace-nowrap ${
            size === 'sm' ? 'text-lg sm:text-2xl' : 'text-xl sm:text-3xl'
          }`}
        >
          {value}
        </p>
        {hint && <p className="text-caption text-brand-grayMid mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="py-16 px-6 text-center">
      <div className="w-12 h-12 mx-auto mb-4 border border-brand-gray flex items-center justify-center">
        <svg className="w-5 h-5 text-brand-grayMid" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
      <p className="font-display font-medium text-body">{title}</p>
      {description && <p className="text-body-sm text-brand-grayMid mt-1 max-w-sm mx-auto">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <div
      className={`w-6 h-6 border-2 border-brand-black border-t-transparent rounded-full animate-spin ${className}`}
      role="status"
      aria-label="Carregando"
    />
  );
}

export function PageSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <Spinner className="w-8 h-8" />
    </div>
  );
}

export { BaseBadge };
