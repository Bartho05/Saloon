import { useState, useEffect, useMemo } from 'react';
import { ownerApi } from '@services/api';
import type { OwnerFinancialOverview } from '@services/api';
import { useToast } from '@contexts/ToastContext';
import { formatCurrency } from '@utils/date';
import { Card, CardContent, Container, BarChart, ProgressBar } from '@components/ui';
import { PageHeader, StatCard, PageSpinner, EmptyState } from '@components/Dashboard';
import { PeriodSelector, type Period } from '@components/PeriodSelector';

export function OwnerFinancialPage() {
  const { showToast } = useToast();
  const [period, setPeriod] = useState<Period>('month');
  const [data, setData] = useState<OwnerFinancialOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const res = await ownerApi.getFinancial(period);
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

  const maxEmployeeRevenue = useMemo(
    () => Math.max(...(data?.employees.map((e) => e.revenue) ?? [0])),
    [data]
  );

  if (loading && !data) return <PageSpinner />;

  return (
    <Container size="full" className="!px-0">
      <PageHeader
        title="Financeiro"
        description={data ? `Faturamento do salão — ${data.label}` : 'Faturamento do salão'}
        action={<PeriodSelector value={period} onChange={setPeriod} />}
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-8">
        <StatCard size="sm" label="Faturamento total" value={formatCurrency(data?.totals.revenue ?? 0)} />
        <StatCard size="sm" label="Atendimentos concluídos" value={data?.totals.appointments ?? 0} />
        <StatCard size="sm" label="Ticket médio" value={formatCurrency(data?.totals.averageTicket ?? 0)} />
      </div>

      <Card className="mb-6">
        <div className="px-5 md:px-6 py-4 border-b border-brand-gray">
          <h2 className="font-display font-semibold text-body">Faturamento por dia</h2>
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

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <div className="px-5 md:px-6 py-4 border-b border-brand-gray">
            <h2 className="font-display font-semibold text-body">Por funcionário</h2>
            <p className="text-caption text-brand-grayMid mt-0.5">Ranking por faturamento</p>
          </div>

          {!data?.employees.length ? (
            <EmptyState
              title="Sem dados no período"
              description="Assim que houver atendimentos concluídos, o ranking aparece aqui."
            />
          ) : (
            <ul>
              {data.employees.map((emp, index) => (
                <li
                  key={emp.id}
                  className="px-5 md:px-6 py-4 border-b border-brand-gray last:border-b-0 hover:bg-brand-grayLight transition-colors duration-fast"
                >
                  <div className="flex items-center gap-4">
                    <span className="font-display font-bold text-body-lg text-brand-grayMid w-6 flex-shrink-0">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div className="w-9 h-9 bg-brand-black text-brand-white flex items-center justify-center font-display font-bold flex-shrink-0">
                      {emp.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display font-medium text-body">{emp.name}</p>
                      <div className="mt-2">
                        <ProgressBar value={emp.revenue} total={maxEmployeeRevenue} showLabel={false} />
                      </div>
                      <p className="text-caption text-brand-grayMid mt-1.5">
                        {emp.appointments} atendimento{emp.appointments !== 1 ? 's' : ''} &middot; ticket{' '}
                        {formatCurrency(emp.averageTicket)}
                      </p>
                    </div>
                    <span className="font-display font-medium text-body flex-shrink-0">
                      {formatCurrency(emp.revenue)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="px-5 md:px-6 py-4 border-b border-brand-gray">
            <h2 className="font-display font-semibold text-body">Por serviço</h2>
          </div>

          {!data?.byService.length ? (
            <EmptyState
              title="Sem dados no período"
              description="Assim que houver atendimentos concluídos, os serviços aparecem aqui."
            />
          ) : (
            <ul>
              {data.byService.map((svc) => (
                <li
                  key={svc.name}
                  className="px-5 md:px-6 py-4 border-b border-brand-gray last:border-b-0 flex items-center justify-between gap-4 hover:bg-brand-grayLight transition-colors duration-fast"
                >
                  <div className="min-w-0">
                    <p className="font-display font-medium text-body-sm">{svc.name}</p>
                    <p className="text-caption text-brand-grayMid mt-0.5">
                      {svc.count} atendimento{svc.count !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <span className="font-display font-medium text-body-sm flex-shrink-0">
                    {formatCurrency(svc.revenue)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </Container>
  );
}

export default OwnerFinancialPage;
