import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { clientApi } from '@services/api';
import { useToast } from '@contexts/ToastContext';
import { formatDateTime, formatCurrency } from '@utils/date';
import type { Appointment } from '@types';
import { Container, Card, Button, Modal } from '@components/ui';
import { PageHeader, StatusBadge, EmptyState, PageSpinner } from '@components/Dashboard';
import { PlusIcon, CloseIcon } from '@components/icons';

type Filter = 'all' | 'upcoming' | 'past';

const TABS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'upcoming', label: 'Próximos' },
  { key: 'past', label: 'Anteriores' },
];

const STATUS_LABEL: Record<Appointment['status'], string> = {
  SCHEDULED: 'Agendado',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
  NO_SHOW: 'Não compareceu',
};

const STATUS_TONE: Record<Appointment['status'], 'info' | 'success' | 'danger' | 'warning'> = {
  SCHEDULED: 'info',
  COMPLETED: 'success',
  CANCELLED: 'danger',
  NO_SHOW: 'warning',
};

export function ClientAppointmentsPage() {
  const { showToast } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [confirmCancel, setConfirmCancel] = useState<Appointment | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    loadAppointments();
  }, []);

  const loadAppointments = async () => {
    setLoading(true);
    try {
      const res = await clientApi.getAppointments();
      setAppointments(res.appointments);
    } catch (err: any) {
      showToast({ type: 'error', title: 'Erro', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirmCancel) return;
    setCancelling(true);
    try {
      await clientApi.cancelAppointment(confirmCancel.id);
      showToast({ type: 'success', title: 'Agendamento cancelado' });
      setAppointments((prev) =>
        prev.map((a) => (a.id === confirmCancel.id ? { ...a, status: 'CANCELLED' as const } : a))
      );
      setConfirmCancel(null);
    } catch (err: any) {
      showToast({ type: 'error', title: 'Erro', message: err.message });
    } finally {
      setCancelling(false);
    }
  };

  const filtered = appointments.filter((apt) => {
    const isPast = new Date(apt.endsAt) < new Date();
    if (filter === 'upcoming') return !isPast && apt.status === 'SCHEDULED';
    if (filter === 'past') return isPast || apt.status !== 'SCHEDULED';
    return true;
  });

  if (loading) return <PageSpinner />;

  const upcomingCount = appointments.filter(
    (a) => a.status === 'SCHEDULED' && new Date(a.startsAt) > new Date()
  ).length;

  return (
    <Container size="lg" className="py-10 md:py-16">
      <PageHeader
        title="Meus Agendamentos"
        description={
          upcomingCount > 0
            ? `${upcomingCount} atendimento${upcomingCount !== 1 ? 's' : ''} marcado${upcomingCount !== 1 ? 's' : ''}`
            : 'Você não tem agendamentos futuros'
        }
        action={
          <Link to="/agendar">
            <Button>
              <PlusIcon className="w-4 h-4" />
              Novo agendamento
            </Button>
          </Link>
        }
      />

      <div className="tabs mb-6" role="tablist" aria-label="Filtrar agendamentos">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={filter === tab.key}
            onClick={() => setFilter(tab.key)}
            className={`tab ${filter === tab.key ? 'tab-active' : 'tab-inactive'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState
            title="Nenhum agendamento"
            description={
              filter === 'upcoming'
                ? 'Você não tem agendamentos futuros.'
                : filter === 'past'
                  ? 'Nenhum agendamento anterior.'
                  : 'Agende seu primeiro serviço.'
            }
            action={
              filter !== 'all' ? undefined : (
                <Link to="/agendar">
                  <Button>Agendar horário</Button>
                </Link>
              )
            }
          />
        ) : (
          <ul>
            {filtered.map((apt) => {
              const canCancel = apt.status === 'SCHEDULED' && new Date(apt.startsAt) > new Date();

              return (
                <li
                  key={apt.id}
                  className="px-5 md:px-6 py-5 flex flex-col md:flex-row md:items-center gap-4 border-b border-brand-gray last:border-b-0 hover:bg-brand-grayLight transition-colors duration-fast"
                >
                  {/* Data */}
                  <div className="flex-shrink-0 md:w-24">
                    <p className="font-display font-bold text-body-lg tabular-nums leading-none">
                      {new Date(apt.startsAt).toLocaleDateString('pt-BR', { day: '2-digit' })}
                    </p>
                    <p className="text-caption text-brand-grayMid mt-1">
                      {new Date(apt.startsAt).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}
                    </p>
                    <p className="text-caption text-brand-grayMid tabular-nums">
                      {new Date(apt.startsAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="font-display font-medium text-body">
                        {apt.service?.name || 'Serviço'}
                      </h3>
                    </div>
                    <p className="text-body-sm text-brand-grayMid mt-0.5">
                      {formatDateTime(apt.startsAt)}
                    </p>

                    {/* Com quem o cliente vai fazer o atendimento */}
                    {apt.employee && (
                      <div className="flex items-center gap-2 mt-3">
                        <span className="w-7 h-7 flex-shrink-0 bg-brand-grayLight border border-brand-gray overflow-hidden flex items-center justify-center">
                          {apt.employee.photoUrl ? (
                            <img
                              src={apt.employee.photoUrl}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="font-display font-bold text-caption text-brand-grayMid">
                              {apt.employee.name.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </span>
                        <span className="text-caption text-brand-grayMid truncate">
                          {apt.employee.name}
                        </span>
                      </div>
                    )}

                    {apt.notes && (
                      <p className="text-caption text-brand-grayMid mt-1.5 border-l-2 border-brand-gray pl-2">
                        {apt.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-4 md:gap-6 flex-shrink-0">
                    <span className="font-display font-medium text-body tabular-nums">
                      {formatCurrency(apt.service?.price || 0)}
                    </span>
                    <StatusBadge tone={STATUS_TONE[apt.status]}>
                      {STATUS_LABEL[apt.status]}
                    </StatusBadge>
                    {canCancel && (
                      <button
                        type="button"
                        onClick={() => setConfirmCancel(apt)}
                        title="Cancelar agendamento"
                        aria-label={`Cancelar agendamento de ${apt.service?.name || 'serviço'}`}
                        className="p-2.5 text-brand-grayMid hover:text-brand-black hover:bg-brand-white border border-transparent hover:border-brand-gray transition-colors duration-fast"
                      >
                        <CloseIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Modal
        open={Boolean(confirmCancel)}
        onClose={() => setConfirmCancel(null)}
        title="Cancelar agendamento"
        description={
          confirmCancel
            ? `${confirmCancel.service?.name || 'Serviço'} em ${formatDateTime(confirmCancel.startsAt)}. O horário será liberado para outros clientes.`
            : undefined
        }
        size="sm"
      >
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={() => setConfirmCancel(null)} disabled={cancelling}>
            Manter
          </Button>
          <Button onClick={handleCancel} disabled={cancelling} loading={cancelling}>
            Cancelar agendamento
          </Button>
        </div>
      </Modal>
    </Container>
  );
}

export default ClientAppointmentsPage;
