import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { employeeApi } from '@services/api';
import { useToast } from '@contexts/ToastContext';
import { formatTodayLong } from '@utils/date';
import type { Appointment } from '@types';
import { Container, Card, CardContent, Button } from '@components/ui';
import { PageHeader, EmptyState, PageSpinner, StatusBadge } from '@components/Dashboard';
import { AppointmentCard } from '@components/AppointmentCard';
import { MonthCalendar, localDateKey } from '@components/MonthCalendar';
import { ListIcon, GridIcon } from '@components/icons';

/** Teto de itens por requisição. Acima disso o backend devolve 400. */
const MAX_LIMIT = 100;

const statusDe = (s: Appointment['status']) => s;

export function EmployeeSchedulePage() {
  const { showToast } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Estado do calendário — mesmo componente e mesmas regras da agenda do
  // dono. O profissional tem a mesma necessidade: ver o mês inteiro para
  // saber onde estão os buracos.
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [monthData, setMonthData] = useState<Appointment[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    loadTodayAppointments();
  }, []);

  const loadTodayAppointments = async () => {
    setLoading(true);
    try {
      const res = await employeeApi.getTodayAppointments();
      setAppointments(res.appointments);
    } catch (err: any) {
      showToast({ type: 'error', title: 'Erro', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  /**
   * `/employee/appointments` filtra por quem está logado (o employeeId vem
   * do token), então a agenda do mês é sempre a do próprio profissional.
   */
  const loadMonth = useCallback(async () => {
    setCalendarLoading(true);
    try {
      const first = new Date(month.getFullYear(), month.getMonth(), 1);
      const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);

      const res = await employeeApi.getAppointments({
        startDate: localDateKey(first),
        endDate: localDateKey(last),
        limit: MAX_LIMIT,
      });

      setMonthData(res.appointments);
      setTruncated((res.pagination?.total ?? 0) > res.appointments.length);
    } catch (err: any) {
      showToast({ type: 'error', title: 'Erro', message: err.message });
    } finally {
      setCalendarLoading(false);
    }
  }, [month, showToast]);

  useEffect(() => {
    if (viewMode === 'calendar') void loadMonth();
  }, [viewMode, loadMonth]);

  const handleStatusChange = async (appointment: Appointment, newStatus: Appointment['status']) => {
    setUpdatingId(appointment.id);
    try {
      await employeeApi.updateAppointmentStatus(appointment.id, newStatus);
      showToast({ type: 'success', title: `Agendamento ${newStatus === 'COMPLETED' ? 'concluído' : 'atualizado'}` });
      setAppointments((prev) =>
        prev.map((a) => (a.id === appointment.id ? { ...a, status: newStatus } : a))
      );
      // o mês também precisa refletir a mudança
      setMonthData((prev) =>
        prev.map((a) => (a.id === appointment.id ? { ...a, status: newStatus } : a))
      );
    } catch (err: any) {
      showToast({ type: 'error', title: 'Erro', message: err.message });
    } finally {
      setUpdatingId(null);
    }
  };

  const remaining = appointments.filter((a) => a.status === 'SCHEDULED').length;

  const selectedDay = selectedDate
    ? monthData
        .filter((a) => localDateKey(new Date(a.startsAt)) === selectedDate)
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    : [];

  const header = (
    <PageHeader
      title="Minha Agenda"
      description={viewMode === 'list' ? formatTodayLong() : 'Visão do mês por dia'}
      action={
        <div className="tabs" role="tablist" aria-label="Modo de visualização">
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'list'}
            onClick={() => setViewMode('list')}
            className={`tab ${viewMode === 'list' ? 'tab-active' : 'tab-inactive'}`}
          >
            <ListIcon className="w-3.5 h-3.5" />
            Lista
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'calendar'}
            onClick={() => setViewMode('calendar')}
            className={`tab ${viewMode === 'calendar' ? 'tab-active' : 'tab-inactive'}`}
          >
            <GridIcon className="w-3.5 h-3.5" />
            Calendário
          </button>
        </div>
      }
    />
  );

  if (viewMode === 'list') {
    if (loading) return <PageSpinner />;

    return (
      <Container size="full" className="!px-0">
        {header}

        {remaining > 0 && (
          <p className="text-body-sm text-brand-grayMid mb-6">
            {remaining} atendimento{remaining !== 1 ? 's' : ''} pendente{remaining !== 1 ? 's' : ''} hoje.
          </p>
        )}

        <Card>
          {appointments.length === 0 ? (
            <EmptyState
              title="Nenhum agendamento hoje"
              description="Sua agenda do dia está livre. Aproveite o dia."
              action={
                <Link to="/funcionario/agendamentos">
                  <Button variant="outline">Ver próximos agendamentos</Button>
                </Link>
              }
            />
          ) : (
            <ul>
              {appointments.map((apt) => (
                <AppointmentCard
                  key={apt.id}
                  appointment={apt}
                  compactTime
                  onStatusChange={handleStatusChange}
                  updating={updatingId === apt.id}
                />
              ))}
            </ul>
          )}
        </Card>
      </Container>
    );
  }

  return (
    <Container size="full" className="!px-0">
      {header}

      <div className="grid xl:grid-cols-3 gap-6 items-start">
        <Card className="xl:col-span-2 overflow-hidden">
          <MonthCalendar
            month={month}
            onMonthChange={setMonth}
            appointments={monthData}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />

          {calendarLoading && (
            <p className="px-5 md:px-6 py-3 border-t border-brand-gray text-caption text-brand-grayMid">
              Carregando...
            </p>
          )}

          {truncated && !calendarLoading && (
            <p className="px-5 md:px-6 py-3 border-t border-brand-gray text-caption text-brand-grayMid">
              Mostrando os {MAX_LIMIT} agendamentos mais recentes do mês.
            </p>
          )}
        </Card>

        {/* Detalhe do dia, com os botões de status — é por aqui que o
            profissional conclui um atendimento. */}
        <Card className="xl:sticky xl:top-6">
          <div className="px-5 md:px-6 py-4 border-b border-brand-gray flex items-center justify-between gap-3">
            <h3 className="font-display font-semibold text-body truncate">
              {selectedDate
                ? new Date(`${selectedDate}T12:00:00`).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'long',
                  })
                : 'Selecione um dia'}
            </h3>
            {selectedDate && (
              <button
                type="button"
                onClick={() => setSelectedDate(null)}
                aria-label="Fechar detalhe do dia"
                className="p-2 text-brand-grayMid hover:text-brand-black hover:bg-brand-grayLight border border-transparent hover:border-brand-gray transition-colors duration-fast flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          <CardContent>
            {!selectedDate ? (
              <p className="text-body-sm text-brand-grayMid">
                Clique em um dia no calendário para ver os atendimentos dele.
              </p>
            ) : selectedDay.length === 0 ? (
              <p className="text-body-sm text-brand-grayMid">Nenhum atendimento neste dia.</p>
            ) : (
              <ul className="divide-y divide-brand-gray">
                {selectedDay.map((apt) => (
                  <li key={apt.id} className="py-3.5 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-display font-bold text-body tabular-nums leading-none pt-0.5">
                        {new Date(apt.startsAt).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      <StatusBadge
                        tone={
                          statusDe(apt.status) === 'COMPLETED'
                            ? 'success'
                            : statusDe(apt.status) === 'CANCELLED'
                              ? 'danger'
                              : statusDe(apt.status) === 'NO_SHOW'
                                ? 'warning'
                                : 'info'
                        }
                      >
                        {statusDe(apt.status) === 'SCHEDULED'
                          ? 'Agendado'
                          : statusDe(apt.status) === 'COMPLETED'
                            ? 'Concluído'
                            : statusDe(apt.status) === 'CANCELLED'
                              ? 'Cancelado'
                              : 'Não compareceu'}
                      </StatusBadge>
                    </div>
                    <p className="text-body-sm mt-2">{apt.client?.fullName || 'Cliente'}</p>
                    <p className="text-caption text-brand-grayMid mt-0.5">{apt.service?.name}</p>
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

export default EmployeeSchedulePage;