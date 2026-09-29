import { useState, useEffect } from 'react';
import { employeeApi } from '@services/api';
import { useToast } from '@contexts/ToastContext';
import { formatDateTime, formatDate } from '@utils/date';
import type { Appointment } from '@types';

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Agendado',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
  NO_SHOW: 'Não compareceu',
};

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
  NO_SHOW: 'bg-gray-100 text-gray-800',
};

export function EmployeeAppointmentsPage() {
  const { showToast } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'upcoming' | 'past'>('all');
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

  const handleStatusChange = async (appointment: Appointment, newStatus: string) => {
    setUpdatingId(appointment.id);
    try {
      await employeeApi.updateAppointmentStatus(appointment.id, newStatus as any);
      showToast({ type: 'success', title: 'Status atualizado' });
      setAppointments(prev => prev.map(a => a.id === appointment.id ? { ...a, status: newStatus as any } : a));
    } catch (err: any) {
      showToast({ type: 'error', title: 'Erro', message: err.message });
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredAppointments = appointments.filter(apt => {
    const isPast = new Date(apt.endsAt) < new Date();
    if (activeTab === 'upcoming') return !isPast && apt.status === 'SCHEDULED';
    if (activeTab === 'past') return isPast || apt.status !== 'SCHEDULED';
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Meus Agendamentos</h1>

      <div className="flex gap-2 bg-gray-100 rounded-xl p-1">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'all' ? 'bg-white text-blue-600 shadow' : 'text-gray-600'}`}
        >
          Todos
        </button>
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'upcoming' ? 'bg-white text-blue-600 shadow' : 'text-gray-600'}`}
        >
          Próximos
        </button>
        <button
          onClick={() => setActiveTab('past')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'past' ? 'bg-white text-blue-600 shadow' : 'text-gray-600'}`}
        >
          Anteriores
        </button>
      </div>

      {filteredAppointments.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-2xl">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-1">
            {activeTab === 'upcoming' ? 'Nenhum agendamento futuro' : 
             activeTab === 'past' ? 'Nenhum agendamento anterior' : 
             'Nenhum agendamento'}
          </h3>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAppointments.map(apt => (
            <EmployeeAppointmentCard
              key={apt.id}
              appointment={apt}
              onStatusChange={handleStatusChange}
              updating={updatingId === apt.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EmployeeAppointmentCard({ 
  appointment, 
  onStatusChange, 
  updating 
}: { 
  appointment: Appointment; 
  onStatusChange: (apt: Appointment, status: string) => void;
  updating?: boolean;
}) {
  const isPast = new Date(appointment.endsAt) < new Date();
  const availableStatuses = getAvailableStatuses(appointment.status, isPast);

  return (
    <div className={`bg-white rounded-xl border p-4 transition-colors ${
      appointment.status === 'SCHEDULED' && isPast ? 'border-amber-200 bg-amber-50' : 'border-gray-200'
    }`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="text-lg font-bold text-blue-600">
              {formatDateTime(appointment.startsAt).split(' ')[1]}
            </div>
            <h3 className="font-semibold text-gray-900">{appointment.client?.fullName || 'Cliente'}</h3>
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[appointment.status]}`}>
              {STATUS_LABELS[appointment.status]}
            </span>
          </div>
          
          <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-gray-600">
            <span>{formatDateTime(appointment.startsAt)} - {formatDateTime(appointment.endsAt).split(' ')[1]}</span>
            <span>{appointment.service?.name}</span>
            <span className="font-medium text-blue-600">R$ {appointment.service?.price.toFixed(2) || '0.00'}</span>
          </div>

          {appointment.client?.phone && (
            <p className="mt-2 text-sm text-gray-500">
              📱 {formatPhone(appointment.client.phone)}
            </p>
          )}
        </div>

        {availableStatuses.length > 0 && (
          <div className="flex flex-col gap-2">
            {availableStatuses.map(status => (
              <button
                key={status}
                onClick={() => onStatusChange(appointment, status)}
                disabled={updating}
                className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  status === 'COMPLETED' ? 'bg-green-600 text-white hover:bg-green-700' :
                  status === 'CANCELLED' ? 'bg-red-600 text-white hover:bg-red-700' :
                  'bg-gray-600 text-white hover:bg-gray-700'
                }`}
              >
                {updating ? '...' : STATUS_LABELS[status]}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function getAvailableStatuses(currentStatus: string, isPast: boolean): string[] {
  if (currentStatus !== 'SCHEDULED') return [];
  if (isPast) return ['COMPLETED', 'NO_SHOW', 'CANCELLED'];
  return ['COMPLETED', 'CANCELLED', 'NO_SHOW'];
}

function formatPhone(phone: string): string {
  const numbers = phone.replace(/\D/g, '');
  if (numbers.length === 11) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
  }
  if (numbers.length === 10) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
  }
  return phone;
}