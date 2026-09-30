import { useState, useEffect } from 'react';
import { ownerApi, servicesApi, employeesApi } from '@services/api';
import { useToast } from '@contexts/ToastContext';
import { formatDateTime, formatCurrency } from '@utils/date';
import type { Appointment, Service, Employee } from '@types';

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
      const [todayRes, servicesRes, employeesRes] = await Promise.all([
        ownerApi.getDashboard(),
        servicesApi.getAll(),
        employeesApi.getActive(),
      ]);

      setTodayAppointments(todayRes.appointments);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const todayAppointmentsFiltered = todayRes.appointments.filter(
        (a: Appointment) => new Date(a.startsAt) >= today && new Date(a.startsAt) < tomorrow
      );

      const todayRevenue = todayAppointmentsFiltered
        .filter((a: Appointment) => a.status !== 'CANCELLED')
        .reduce((sum: number, a: Appointment) => sum + (a.service?.price || 0), 0);

      // Stats do mês (simplificado)
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthAppointments = todayRes.appointments.filter(
        (a: Appointment) => new Date(a.startsAt) >= monthStart
      );
      const monthRevenue = monthAppointments
        .filter((a: Appointment) => a.status === 'COMPLETED')
        .reduce((sum: number, a: Appointment) => sum + (a.service?.price || 0), 0);

      setStats({
        todayCount: todayAppointmentsFiltered.length,
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          title="Agendamentos Hoje"
          value={stats.todayCount}
          icon=""
          color="blue"
        />
        <StatCard
          title="Faturamento Hoje"
          value={formatCurrency(stats.todayRevenue)}
          icon=""
          color="green"
        />
        <StatCard
          title="Agendamentos Mês"
          value={stats.monthCount}
          icon=""
          color="purple"
        />
        <StatCard
          title="Faturamento Mês"
          value={formatCurrency(stats.monthRevenue)}
          icon=""
          color="emerald"
        />
        <StatCard
          title="Funcionários Ativos"
          value={stats.activeEmployees}
          icon=""
          color="orange"
        />
        <StatCard
          title="Serviços Ativos"
          value={stats.activeServices}
          icon=""
          color="pink"
        />
      </div>

      {/* Próximos Agendamentos */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Agendamentos de Hoje</h2>
          <a href="/owner/agenda" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
            Ver todos →
          </a>
        </div>
        
        {todayAppointments.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p>Nenhum agendamento para hoje</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {todayAppointments.slice(0, 10).map(apt => (
              <div className="px-6 py-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{apt.client?.fullName || 'Cliente'}</p>
                  <p className="text-sm text-gray-500 flex items-center gap-2">
                    <span>{formatDateTime(apt.startsAt).split(' ')[1]}</span>
                    <span>•</span>
                    <span>{apt.service?.name}</span>
                    <span>•</span>
                    <span>{apt.employee?.name}</span>
                    <span className="font-medium text-blue-600">{formatCurrency(apt.service?.price || 0)}</span>
                  </p>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  apt.status === 'SCHEDULED' ? 'bg-blue-100 text-blue-800' :
                  apt.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                  apt.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {apt.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }: { title: string; value: string | number; icon: string; color: string }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    orange: 'bg-orange-50 text-orange-600',
    pink: 'bg-pink-50 text-pink-600',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`${colors[color as keyof typeof colors] || colors.blue} w-12 h-12 rounded-xl flex items-center justify-center text-2xl`}>
          {icon}
        </div>
      </div>
    </div>
  );
}