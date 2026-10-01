import { useState, useEffect, useMemo } from 'react';
import { employeeApi } from '@services/api';
import type { FinancialSummary } from '@services/api';
import { useToast } from '@contexts/ToastContext';
import { formatCurrency } from '@utils/date';
import { clientLabel } from '@utils/client';
import { Card, CardContent, Container, BarChart, ProgressBar } from '@components/ui';
import { PageHeader, StatCard, PageSpinner, EmptyState, StatusBadge } from '@components/Dashboard';
import { PeriodSelector, type Period } from '@components/PeriodSelector';

export function EmployeeFinancialPage() {
  const { showToast } = useToast();
  const [period, setPeriod] = useState<Period>('month');
  const [data, setData] = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const res = await employeeApi.getFinancials(period);
        if (!cancelled) setData(res.financial);
      } catch (err: any) {
        if (!cancelled) showToast({ type: 'error', title: 'Erro', message: err.message });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [period, showToast]);

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.daily.map((d) => ({
      label: new Date(d.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      value: d.revenue,
      meta: `${d.count} atendimento${d.count !== 1 ? 's' : ''}`,
    }));
  }, [data]);

  const maxServiceRevenue = useMemo(
    () => Math.max(...(data?.byService.map((s) => s.revenue) ?? [0])),
    [data]
  );

  if (loading && !data) return <PageSpinner />;

  const totals = data?.totals;

  return (
    <Container size="full" className="!px-0">
      <PageHeader
        title="Meu Faturamento"
        description="Quanto você produziu, por período"
        action={<PeriodSelector value={period} onChange={setPeriod} />}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
        <StatCard size="sm" label="Faturamento" value={formatCurrency(totals?.revenue ?? 0)} />
        <StatCard size="sm" label="Atendimentos concluídos" value={totals?.completed ?? 0} />
        <StatCard size="sm" label="Ticket médio" value={formatCurrency(totals?.averageTicket ?? 0)} />
        <StatCard
          size="sm"
          label="Agendamentos no período"
          value={totals?.appointments ?? 0}
          hint={`${totals?.cancelled ?? 0} cancelado(s)`}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <div className="px-5 md:px-6 py-4 border-b border-brand-gray">
            <h2 className="font-display font-semibold text-body">Evolução do faturamento</h2>
            <p className="text-caption text-brand-grayMid mt-0.5">
              Somente atendimentos concluídos
            </p>
          </div>
          <CardContent>
            <BarChart
              data={chartData}
              height={200}
              formatValue={formatCurrency}
              emptyMessage="Nenhum atendimento concluído neste período"
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
                      <span className="font-display font-medium text-body-sm">
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
          <h2 className="font-display font-semibold text-body">Agendamentos do período</h2>
          <p className="text-caption text-brand-grayMid mt-0.5">
            {data?.appointments.length ?? 0} registro{(data?.appointments.length ?? 0) !== 1 ? 's' : ''}
          </p>
        </div>

        {!data?.appointments.length ? (
          <EmptyState
            title="Nenhum agendamento no período"
            description="Quando você tiver atendimentos marcados, eles aparecem aqui."
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
