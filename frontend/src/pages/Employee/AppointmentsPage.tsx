import { useState, useEffect } from 'react';
import { employeeApi } from '@services/api';
import { useToast } from '@contexts/ToastContext';
import type { Appointment } from '@types';
import { Container, Card } from '@components/ui';
import { PageHeader, EmptyState, PageSpinner } from '@components/Dashboard';
import { AppointmentCard } from '@components/AppointmentCard';

type Filter = 'all' | 'upcoming' | 'past';

const TABS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'upcoming', label: 'Próximos' },
  { key: 'past', label: 'Anteriores' },
];

export function EmployeeAppointmentsPage() {
  const { showToast } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    loadAppointments();
  }, []);

  const loadAppointments = async () => {
    setLoading(true);
    try {
      const res = await employeeApi.getAppointments();
      setAppointments(res.appointments);
    } catch (err: any) {
      showToast({ type: 'error', title: 'Erro', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (appointment: Appointment, newStatus: Appointment['status']) => {
    setUpdatingId(appointment.id);
    try {
      await employeeApi.updateAppointmentStatus(appointment.id, newStatus);
      showToast({
        type: 'success',
        title: newStatus === 'COMPLETED' ? 'Atendimento concluído' : 'Status atualizado',
      });
      setAppointments((prev) =>
        prev.map((a) => (a.id === appointment.id ? { ...a, status: newStatus } : a))
      );
    } catch (err: any) {
      showToast({ type: 'error', title: 'Erro', message: err.message });
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = appointments.filter((apt) => {
    const isPast = new Date(apt.endsAt) < new Date();
    if (filter === 'upcoming') return !isPast && apt.status === 'SCHEDULED';
    if (filter === 'past') return isPast || apt.status !== 'SCHEDULED';
    return true;
  });

  if (loading) return <PageSpinner />;

  return (
    <Container size="full" className="!px-0">
      <PageHeader
        title="Meus Agendamentos"
        description={`${appointments.length} no total`}
        action={
          <div className="tabs" role="tablist" aria-label="Filtrar agendamentos">
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
        }
      />

      <Card>
        {filtered.length === 0 ? (
          <EmptyState
            title="Nenhum agendamento"
            description={
              filter === 'all'
                ? 'Quando você receber agendamentos, eles aparecem aqui.'
                : 'Nenhum agendamento neste filtro.'
            }
          />
        ) : (
          <ul>
            {filtered.map((apt) => (
              <AppointmentCard
                key={apt.id}
                appointment={apt}
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

export default EmployeeAppointmentsPage;
