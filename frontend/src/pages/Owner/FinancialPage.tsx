import { useCallback, useEffect, useMemo, useState } from 'react';
import { ownerApi } from '@services/api';
import type { OwnerFinancialOverview } from '@services/api';
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

export function OwnerFinancialPage() {
  const { showToast } = useToast();
  const [period, setPeriod] = useState<Period>('month');
  const [reference, setReference] = useState(todayIso);
  const [data, setData] = useState<OwnerFinancialOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const res = await ownerApi.getFinancial(period, reference);
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

  /**
   * Os rótulos vêm prontos do servidor, formatados no fuso do salão.
   *
   * Antes o front fazia `new Date(d.date).toLocaleDateString(...)`: a chave
   * "2026-10-01" é meia-noite UTC e em São Paulo (UTC-3) saía 30/09 — o dia
   * ao lado do dia errado, sem nenhum aviso.
   */
  const chartData = useMemo(() => {
    if (!data) return [];
    return data.series.map((p) => ({
      label: p.label,
      value: p.revenue,
      fullLabel: p.fullLabel,
      meta: `${p.fullLabel} · ${p.count} atendimento${p.count !== 1 ? 's' : ''}`,
    }));
  }, [data]);

  const maxEmployeeRevenue = useMemo(
    () => Math.max(...(data?.employees.map((e) => e.revenue) ?? [0])),
    [data]
  );

  // Enquanto troca o período, os números antigos ficam na tela com a lista
  // nova chegando depois: dariam a impressão de total errado.
  const trocando = loading && !!data;

  const onPeriodChange = useCallback((p: Period) => {
    setPeriod(p);
    // Trocar de granularidade mantendo a data faz sentido: o dia 15 continua
    // sendo dia 15, agora visto como mês ou ano.
  }, []);

  if (loading && !data) return <PageSpinner />;

  return (
    <Container size="full" className="!px-0">
      <PageHeader
        title="Financeiro"
        // A descrição não repete o período: o seletor já mostra o rótulo
        // ("Outubro de 2026") logo ao lado. Duas vezes o mesmo texto na mesma
        // linha é ruído, e o usuário não sabe qual dos dois manda.
        description="Faturamento do salão por período"
        action={
          <PeriodSelector
            value={period}
            onChange={onPeriodChange}
            reference={reference}
            onReferenceChange={setReference}
            label={data?.label}
          />
        }
      />

      {/* `auto-rows-fr`: sem ela, a linha de cima (cards sem dica) ficava
          22px mais baixa que a de baixo (cards com dica) e a grade saía
          desalinhada — que é o que se vê ao olhar o painel. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8 auto-rows-fr">
        <StatCard size="sm" label="Faturamento" value={formatCurrency(data?.totals.revenue ?? 0)} />
        <StatCard size="sm" label="Concluídos" value={data?.totals.appointments ?? 0} />
        <StatCard size="sm" label="Ticket médio" value={formatCurrency(data?.totals.averageTicket ?? 0)} />
        <StatCard
          size="sm"
          label="A receber"
          value={formatCurrency(data?.totals.scheduled ?? 0)}
          hint="Agendado, ainda não concluído"
        />
      </div>

      <Card className="mb-6">
        <div className="px-5 md:px-6 py-4 border-b border-brand-gray">
          <h2 className="font-display font-semibold text-body">{SERIES_AXIS[period]}</h2>
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
                    {emp.photoUrl ? (
                      <img
                        src={emp.photoUrl}
                        alt=""
                        className="w-9 h-9 object-cover flex-shrink-0 border border-brand-gray"
                      />
                    ) : (
                      <div className="w-9 h-9 bg-brand-black text-brand-white flex items-center justify-center font-display font-bold flex-shrink-0">
                        {emp.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-display font-medium text-body truncate">{emp.name}</p>
                      <div className="mt-2">
                        <ProgressBar value={emp.revenue} total={maxEmployeeRevenue} showLabel={false} />
                      </div>
                      <p className="text-caption text-brand-grayMid mt-1.5">
                        {emp.appointments} atendimento{emp.appointments !== 1 ? 's' : ''} &middot; ticket{' '}
                        {formatCurrency(emp.averageTicket)}
                      </p>
                    </div>
                    <span className="font-display font-medium text-body flex-shrink-0 tabular-nums">
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
                    <p className="font-display font-medium text-body-sm truncate">{svc.name}</p>
                    <p className="text-caption text-brand-grayMid mt-0.5">
                      {svc.count} atendimento{svc.count !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <span className="font-display font-medium text-body-sm flex-shrink-0 tabular-nums">
                    {formatCurrency(svc.revenue)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Agendamentos do período, um a um.
          Era o buraco da visão "dia": o gráfico de barras com um único dia
          ficava quase vazio e o dono concluía que não tinha havido
          atendimento. A lista responde a pergunta diretamente. */}
      <Card className="mt-6">
        <div className="px-5 md:px-6 py-4 border-b border-brand-gray">
          <h2 className="font-display font-semibold text-body">
            {period === 'day' ? 'Agendamentos do dia' : 'Agendamentos do período'}
          </h2>
          <p className="text-caption text-brand-grayMid mt-0.5">
            {data?.appointments.length ?? 0} registro{(data?.appointments.length ?? 0) !== 1 ? 's' : ''}
            {' · '}
            {data?.totals.completed ?? 0} concluído{(data?.totals.completed ?? 0) !== 1 ? 's' : ''}
            {' · '}
            {(data?.appointments.length ?? 0) - (data?.totals.completed ?? 0)} em aberto
          </p>
        </div>

        {!data?.appointments.length ? (
          <EmptyState
            title="Nenhum agendamento no período"
            description="Assim que houver agendamentos, eles aparecem aqui com cliente, serviço e valor."
            action={
              // Sem isto o dono fica preso: o período pode estar vazio e não
              // haver botão nenhum para voltar ao de hoje.
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
              const hour = new Date(apt.startsAt).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              });
              const day = new Date(apt.startsAt).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
              });

              return (
                <li
                  key={apt.id}
                  className="px-5 md:px-6 py-4 flex items-center gap-4 border-b border-brand-gray last:border-b-0 hover:bg-brand-grayLight transition-colors duration-fast"
                >
                  <div className="flex-shrink-0 w-14">
                    <p className="font-display font-bold text-body tabular-nums leading-none">
                      {hour}
                    </p>
                    <p className="text-caption text-brand-grayMid mt-1 tabular-nums">{day}</p>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-display font-medium text-body-sm truncate">
                      {clientLabel(apt.client)}
                    </p>
                    <p className="text-caption text-brand-grayMid truncate mt-0.5">
                      {apt.serviceName} &middot; {apt.employeeName}
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

export default OwnerFinancialPage;
