import { useState, useEffect } from 'react';
import { ownerApi, employeesApi } from '@services/api';
import { useToast } from '@contexts/ToastContext';
import { formatDateTime } from '@utils/date';
import type { Appointment, Employee } from '@types';

export function OwnerSchedulePage() {
  const { showToast } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    startDate: '',
    endDate: '',
    employeeId: '',
  });
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadAppointments();
  }, [filters]);

  const loadData = async () => {
    try {
      const empRes = await employeesApi.getActive();
      setEmployees(empRes.employees);
    } catch (err: any) {
      showToast({ type: 'error', title: 'Erro', message: err.message });
    }
  };

  const loadAppointments = async () => {
    setLoading(true);
    try {
      const res = await ownerApi.getAppointments(filters);
      setAppointments(res.appointments);
    } catch (err: any) {
      showToast({ type: 'error', title: 'Erro', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({ status: '', startDate: '', endDate: '', employeeId: '' });
  };

  const getEmployeeColor = (employeeId: string) => {
    const colors = [
      'bg-brand-black', 'bg-green-500', 'bg-purple-500', 'bg-orange-500',
      'bg-pink-500', 'bg-teal-500', 'bg-indigo-500', 'bg-red-500',
    ];
    let hash = 0;
    for (let i = 0; i < employeeId.length; i++) {
      hash = employeeId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-brand-black border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand-black">Agenda Geral</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2  text-sm font-medium ${viewMode === 'list' ? 'bg-brand-black text-white' : 'bg-brand-gray text-brand-black'}`}
          >
            Lista
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-4 py-2  text-sm font-medium ${viewMode === 'calendar' ? 'bg-brand-black text-white' : 'bg-brand-gray text-brand-black'}`}
          >
            Calendário
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-brand-white  border border-brand-gray p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-brand-black mb-1">Status</label>
            <select
              value={filters.status}
              onChange={e => handleFilterChange('status', e.target.value)}
              className="w-full px-4 py-2 border border-brand-gray  focus:border-brand-black focus:ring-2 focus:ring-brand-black/20 outline-none"
            >
              <option value="">Todos</option>
              <option value="SCHEDULED">Agendados</option>
              <option value="COMPLETED">Concluídos</option>
              <option value="CANCELLED">Cancelados</option>
              <option value="NO_SHOW">Não compareceu</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-black mb-1">Profissional</label>
            <select
              value={filters.employeeId}
              onChange={e => handleFilterChange('employeeId', e.target.value)}
              className="w-full px-4 py-2 border border-brand-gray  focus:border-brand-black focus:ring-2 focus:ring-brand-black/20 outline-none"
            >
              <option value="">Todos</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-black mb-1">Data Início</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={e => handleFilterChange('startDate', e.target.value)}
              className="w-full px-4 py-2 border border-brand-gray  focus:border-brand-black focus:ring-2 focus:ring-brand-black/20 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-black mb-1">Data Fim</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={e => handleFilterChange('endDate', e.target.value)}
              className="w-full px-4 py-2 border border-brand-gray  focus:border-brand-black focus:ring-2 focus:ring-brand-black/20 outline-none"
            />
          </div>
          <div className="flex items-end">
            <button onClick={clearFilters} className="w-full px-4 py-2 border border-brand-gray text-brand-black  hover:bg-brand-grayLight font-medium">
              Limpar Filtros
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'list' ? (
        <div className="bg-brand-white  border border-brand-gray">
          {appointments.length === 0 ? (
            <div className="text-center py-12 text-brand-grayMid">
              <svg className="w-12 h-12 mx-auto mb-3 text-brand-grayMid" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p>Nenhum agendamento encontrado</p>
            </div>
          ) : (
            <div className="divide-y divide-brand-gray">
              {appointments.map(apt => (
                <div key={apt.id} className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-brand-grayLight">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: getEmployeeColor(apt.employeeId) }} />
                    <div className="min-w-0">
                      <p className="font-medium text-brand-black truncate">{apt.client?.fullName || 'Cliente'}</p>
                      <p className="text-sm text-brand-grayMid flex items-center gap-2">
                        <span>{formatDateTime(apt.startsAt)}</span>
                        <span>•</span>
                        <span>{apt.service?.name}</span>
                        <span>•</span>
                        <span>{apt.employee?.name}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-medium text-brand-black">{formatCurrency(apt.service?.price || 0)}</span>
                    <span className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(apt.status)}`}>
                      {getStatusLabel(apt.status)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-brand-white  border border-brand-gray p-4">
          <p className="text-brand-grayMid text-center py-8">Visualização de calendário em desenvolvimento</p>
        </div>
      )}
    </div>
  );
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'SCHEDULED': return 'bg-brand-gray text-brand-black';
    case 'COMPLETED': return 'bg-green-50 text-green-800';
    case 'CANCELLED': return 'bg-red-100 text-red-800';
    case 'NO_SHOW': return 'bg-brand-gray text-brand-black';
    default: return 'bg-brand-gray text-brand-black';
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'SCHEDULED': return 'Agendado';
    case 'COMPLETED': return 'Concluído';
    case 'CANCELLED': return 'Cancelado';
    case 'NO_SHOW': return 'Não compareceu';
    default: return status;
  }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}