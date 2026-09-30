import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { employeeApi } from '@services/api';
import { useToast } from '@contexts/ToastContext';
import { formatTodayLong } from '@utils/date';
import type { Appointment } from '@types';
import { Container, Card, Button } from '@components/ui';
import { PageHeader, EmptyState, PageSpinner } from '@components/Dashboard';
import { AppointmentCard } from '@components/AppointmentCard';

export function EmployeeSchedulePage() {
  const { showToast } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

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

  const handleStatusChange = async (appointment: Appointment, newStatus: Appointment['status']) => {
    setUpdatingId(appointment.id);
    try {
      await employeeApi.updateAppointmentStatus(appointment.id, newStatus);
      showToast({ type: 'success', title: `Agendamento ${newStatus === 'COMPLETED' ? 'concluído' : 'atualizado'}` });
      setAppointments((prev) =>
        prev.map((a) => (a.id === appointment.id ? { ...a, status: newStatus } : a))
      );
    } catch (err: any) {
      showToast({ type: 'error', title: 'Erro', message: err.message });
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) return <PageSpinner />;

  const remaining = appointments.filter((a) => a.status === 'SCHEDULED').length;

  return (
    <Container size="full" className="!px-0">
      <PageHeader
        title="Minha Agenda"
        description={formatTodayLong()}
        action={
          <Link to="/funcionario/agendamentos">
            <Button variant="outline">Ver todos</Button>
          </Link>
        }
      />

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

export default EmployeeSchedulePage;
