import { useState, useEffect, useMemo } from 'react';
import { employeeApi } from '@services/api';
import type { FinancialSummary } from '@services/api';
import { useToast } from '@contexts/ToastContext';
import { formatCurrency } from '@utils/date';
import { clientLabel } from '@utils/client';
import { Card, CardContent, Container, BarChart, ProgressBar } from '@components/ui';
import { PageHeader, StatCard, PageSpinner, EmptyState, StatusBadge } from '@components/Dashboard';
import { PeriodSelector, type Period } from '@components/PeriodSelector';

/** Hoje no fuso do navegador, em ISO curto. */
function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

const SERIES_AXIS: Record<Period, string> = {
  day: 'Faturamento por hora',
  month: 'Faturamento por dia',
  year: 'Faturamento por mês',
};

export function EmployeeFinancialPage() {
  const { showToast } = useToast();
  const [period, setPeriod] = useState<Period>('month');
  const [reference, setReference] = useState(todayIso);
  const [data, setData] = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const res = await employeeApi.getFinancials(period, reference);
        if (!cancelled) setData(res.financial);
      } catch (err: any) {
        if (!cancelled) showToast({ type: 'error', title: 'Erro', message: err.message });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [period, reference, showToast]);

  // Rótulos prontos do servidor, no fuso do salão. Ver a nota na página do
  // dono: remontar a data no front puxava o dia um para trás.
  const chartData = useMemo(() => {
    if (!data) return [];
    return data.series.map((p) => ({
      label: p.label,
      value: p.revenue,
      fullLabel: p.fullLabel,
      meta: `${p.fullLabel} · ${p.count} atendimento${p.count !== 1 ? 's' : ''}`,
    }));
  }, [data]);

  const maxServiceRevenue = useMemo(
    () => Math.max(...(data?.byService.map((s) => s.revenue) ?? [0])),
    [data]
  );

  if (loading && !data) return <PageSpinner />;

  const totals = data?.totals;
  const trocando = loading && !!data;

  return (
    <Container size="full" className="!px-0">
      <PageHeader
        title="Meu Faturamento"
        // O profissional precisa saber de que dia/mês os números são, senão
        // não tem como conferir o fechamento.
        description="Quanto você produzou, por período"
        action={
          <PeriodSelector
            value={period}
            onChange={setPeriod}
            reference={reference}
            onReferenceChange={setReference}
            label={data?.label}
          />
        }
      />

      {/* `auto-rows-fr`: iguala a altura das linhas. Sem ela a linha com os
          cards que têm dica ficava mais alta que a de cima, e a grade saía
          desalinhada. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8 auto-rows-fr">
        <StatCard size="sm" label="Faturamento" value={formatCurrency(totals?.revenue ?? 0)} />
        <StatCard size="sm" label="Concluídos" value={totals?.completed ?? 0} />
        <StatCard size="sm" label="Ticket médio" value={formatCurrency(totals?.averageTicket ?? 0)} />
        <StatCard
          size="sm"
          label="A receber"
          value={formatCurrency(totals?.scheduled ?? 0)}
          hint={`${totals?.cancelled ?? 0} cancelado(s)`}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <div className="px-5 md:px-6 py-4 border-b border-brand-gray">
            <h2 className="font-display font-semibold text-body">{SERIES_AXIS[period]}</h2>
            <p className="text-caption text-brand-grayMid mt-0.5">
              Somente atendimentos concluídos
            </p>
          </div>
          <CardContent className={trocando ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
            <BarChart
              data={chartData}
              height={200}
              formatValue={formatCurrency}
              emptyMessage="Nenhum atendimento concluído neste período"
              axisTitle={SERIES_AXIS[period]}
            />
          </CardContent>
        </Card>

        <Card>
          <div className="px-5 md:px-6 py-4 border-b border-brand-gray">
            <h2 className="font-display font-semibold text-body">Por serviço</h2>
          </div>
          <CardContent>
            {!data?.byService.length ? (
              <p className="text-body-sm text-brand-grayMid py-4 text-center">
                Sem atendimentos concluídos
              </p>
            ) : (
              <ul className="space-y-5">
                {data.byService.map((svc) => (
                  <li key={svc.serviceId}>
                    <div className="flex items-baseline justify-between gap-3 mb-2">
                      <span className="font-display text-body-sm">{svc.name}</span>
                      <span className="font-display font-medium text-body-sm tabular-nums">
                        {formatCurrency(svc.revenue)}
                      </span>
                    </div>
                    <ProgressBar
                      value={svc.revenue}
                      total={maxServiceRevenue}
                      showLabel={false}
                    />
                    <p className="text-caption text-brand-grayMid mt-1.5">
                      {svc.count} atendimento{svc.count !== 1 ? 's' : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Agendamentos um a um — mesma razão do dono: na visão "dia" o
          gráfico sozinho não mostra o que aconteceu. */}
      <Card className="mt-6">
        <div className="px-5 md:px-6 py-4 border-b border-brand-gray">
          <h2 className="font-display font-semibold text-body">
            {period === 'day' ? 'Agendamentos do dia' : 'Agendamentos do período'}
          </h2>
          <p className="text-caption text-brand-grayMid mt-0.5">
            {data?.appointments.length ?? 0} registro{(data?.appointments.length ?? 0) !== 1 ? 's' : ''}
            {' · '}
            {totals?.completed ?? 0} concluído{(totals?.completed ?? 0) !== 1 ? 's' : ''}
            {' · '}
            {(data?.appointments.length ?? 0) - (totals?.completed ?? 0)} em aberto
          </p>
        </div>

        {!data?.appointments.length ? (
          <EmptyState
            title="Nenhum agendamento no período"
            description="Quando você tiver atendimentos marcados, eles aparecem aqui."
            action={
              reference !== todayIso() ? (
                <button
                  type="button"
                  onClick={() => setReference(todayIso())}
                  className="text-body-sm underline underline-offset-4 hover:text-brand-black transition-colors duration-fast"
                >
                  Voltar para hoje
                </button>
              ) : undefined
            }
          />
        ) : (
          <ul>
            {data.appointments.map((apt) => {
              const when = new Date(apt.startsAt);
              return (
                <li
                  key={apt.id}
                  className="px-5 md:px-6 py-4 flex items-center gap-4 border-b border-brand-gray last:border-b-0 hover:bg-brand-grayLight transition-colors duration-fast"
                >
                  <div className="flex-shrink-0 w-14">
                    <p className="font-display font-bold text-body tabular-nums leading-none">
                      {when.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p className="text-caption text-brand-grayMid mt-1 tabular-nums">
                      {when.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </p>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-display font-medium text-body-sm truncate">
                      {clientLabel(apt.client)}
                    </p>
                    <p className="text-caption text-brand-grayMid truncate mt-0.5">
                      {apt.serviceName}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 flex-shrink-0">
                    <span className="font-display font-medium text-body-sm tabular-nums">
                      {formatCurrency(apt.price)}
                    </span>
                    <StatusBadge tone={APPT_TONE[apt.status]}>{APPT_LABEL[apt.status]}</StatusBadge>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </Container>
  );
}

const APPT_LABEL: Record<string, string> = {
  SCHEDULED: 'Agendado',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
  NO_SHOW: 'Não compareceu',
};

const APPT_TONE: Record<string, 'info' | 'success' | 'danger' | 'warning'> = {
  SCHEDULED: 'info',
  COMPLETED: 'success',
  CANCELLED: 'danger',
  NO_SHOW: 'warning',
};

export default EmployeeFinancialPage;
