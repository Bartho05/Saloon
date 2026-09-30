import { useState, useEffect, useMemo } from 'react';
import { employeeApi } from '@services/api';
import type { FinancialSummary } from '@services/api';
import { useToast } from '@contexts/ToastContext';
import { formatCurrency } from '@utils/date';
import { Card, CardContent, Container, BarChart, ProgressBar } from '@components/ui';
import { PageHeader, StatCard, PageSpinner } from '@components/Dashboard';
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Faturamento" value={formatCurrency(totals?.revenue ?? 0)} />
        <StatCard label="Atendimentos concluídos" value={totals?.completed ?? 0} />
        <StatCard label="Ticket médio" value={formatCurrency(totals?.averageTicket ?? 0)} />
        <StatCard
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
          <CardContent className="p-5 md:p-6">
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
          <CardContent className="p-5 md:p-6">
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
    </Container>
  );
}

export default EmployeeFinancialPage;
