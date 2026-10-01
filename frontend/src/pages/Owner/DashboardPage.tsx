import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ownerApi } from '@services/api';
import { useToast } from '@contexts/ToastContext';
import { formatDateTime, formatCurrency } from '@utils/date';
import { clientLabel } from '@utils/client';
import type { Appointment, Service, Employee } from '@types';
import { Card, Button, Container } from '@components/ui';
import { PageHeader, StatCard, StatusBadge, EmptyState, PageSpinner } from '@components/Dashboard';

const statusLabels: Record<Appointment['status'], string> = {
  SCHEDULED: 'Agendado',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
  NO_SHOW: 'Não compareceu',
};

const statusTone: Record<Appointment['status'], 'info' | 'success' | 'danger' | 'warning'> = {
  SCHEDULED: 'info',
  COMPLETED: 'success',
  CANCELLED: 'danger',
  NO_SHOW: 'warning',
};

export function OwnerDashboardPage() {
  const { showToast } = useToast();
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);
  const [stats, setStats] = useState({
    todayCount: 0,
    todayRevenue: 0,
    monthCount: 0,
    monthRevenue: 0,
    activeEmployees: 0,
    activeServices: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      // Usa as rotas autenticadas do owner: as públicas (/services,
      // /employees/active) não devolvem `isActive`, então filtrar por ele
      // resultava sempre em zero.
      const [todayRes, servicesRes, employeesRes] = await Promise.all([
        ownerApi.getDashboard(),
        ownerApi.getServices(),
        ownerApi.getEmployees(),
      ]);

      setTodayAppointments(todayRes.appointments);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const todayFiltered = todayRes.appointments.filter(
        (a: Appointment) => new Date(a.startsAt) >= today && new Date(a.startsAt) < tomorrow
      );

      const todayRevenue = todayFiltered
        .filter((a: Appointment) => a.status !== 'CANCELLED')
        .reduce((sum: number, a: Appointment) => sum + (a.service?.price || 0), 0);

      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthAppointments = todayRes.appointments.filter(
        (a: Appointment) => new Date(a.startsAt) >= monthStart
      );
      const monthRevenue = monthAppointments
        .filter((a: Appointment) => a.status === 'COMPLETED')
        .reduce((sum: number, a: Appointment) => sum + (a.service?.price || 0), 0);

      setStats({
        todayCount: todayFiltered.length,
        todayRevenue,
        monthCount: monthAppointments.length,
        monthRevenue,
        activeEmployees: employeesRes.employees.filter((e: Employee) => e.isActive).length,
        activeServices: servicesRes.services.filter((s: Service) => s.isActive).length,
      });
    } catch (err: any) {
      showToast({ type: 'error', title: 'Erro', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <PageSpinner />;

  return (
    <Container size="full" className="!px-0">
      <PageHeader
        title="Dashboard"
        description="Visão geral do salão hoje e neste mês"
        action={
          <Link to="/owner/agenda">
            <Button variant="outline">Ver agenda completa</Button>
          </Link>
        }
      />

      {/* `auto-rows-fr` mantém as linhas com a mesma altura em 2 e 3 colunas,
          onde a grade quebra e cada linha se dimensionaria pelo seu conteúdo. */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-10 auto-rows-fr">
        <StatCard size="sm" label="Agendamentos hoje" value={stats.todayCount} />
        <StatCard size="sm" label="Faturamento hoje" value={formatCurrency(stats.todayRevenue)} />
        <StatCard size="sm" label="Agendamentos no mês" value={stats.monthCount} />
        <StatCard size="sm" label="Faturamento no mês" value={formatCurrency(stats.monthRevenue)} />
        <StatCard size="sm" label="Funcionários ativos" value={stats.activeEmployees} />
        <StatCard size="sm" label="Serviços ativos" value={stats.activeServices} />
      </div>

      <Card>
        <div className="px-6 py-4 border-b border-brand-gray flex items-center justify-between">
          <h2 className="font-display font-semibold text-body">Agendamentos de hoje</h2>
          <Link to="/owner/agenda" className="btn-minimal">Ver todos</Link>
        </div>

        {todayAppointments.length === 0 ? (
          <EmptyState
            title="Nenhum agendamento para hoje"
            description="Quando houver agendamentos para o dia de hoje, eles aparecem aqui."
          />
        ) : (
          <ul>
            {todayAppointments.slice(0, 10).map((apt) => (
              <li
                key={apt.id}
                className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-brand-gray last:border-b-0 hover:bg-brand-grayLight transition-colors duration-fast"
              >
                <div className="min-w-0">
                  <p className="font-display font-medium text-body">
                    {clientLabel(apt.client)}
                  </p>
                  <p className="text-body-sm text-brand-grayMid mt-1">
                    {formatDateTime(apt.startsAt).split(' ')[1]} &middot; {apt.service?.name} &middot; {apt.employee?.name}
                  </p>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <span className="font-display font-medium text-body">
                    {formatCurrency(apt.service?.price || 0)}
                  </span>
                  <StatusBadge tone={statusTone[apt.status]}>{statusLabels[apt.status]}</StatusBadge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Container>
  );
}

export default OwnerDashboardPage;