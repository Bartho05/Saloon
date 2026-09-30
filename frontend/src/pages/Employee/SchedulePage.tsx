import { useState, useEffect } from 'react';
import { employeeApi } from '@services/api';
import { useToast } from '@contexts/ToastContext';
import { formatTodayLong, formatTime } from '@utils/date';
import type { Appointment } from '@types';

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Agendado',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
  NO_SHOW: 'Não compareceu',
};

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: 'bg-brand-gray text-brand-black',
  COMPLETED: 'bg-green-50 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
  NO_SHOW: 'bg-brand-gray text-brand-black',
};

const NEXT_STATUSES: Record<string, string[]> = {
  SCHEDULED: ['COMPLETED', 'CANCELLED', 'NO_SHOW'],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

export function EmployeeSchedulePage() {
  const { showToast } = useToast();
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    loadTodayAppointments();
  }, []);

  const loadTodayAppointments = async () => {
    setLoading(true);
    try {
      const res = await employeeApi.getTodayAppointments();
      setTodayAppointments(res.appointments);
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
      setTodayAppointments(prev => prev.map(a => a.id === appointment.id ? { ...a, status: newStatus as any } : a));
    } catch (err: any) {
      showToast({ type: 'error', title: 'Erro', message: err.message });
    } finally {
      setUpdatingId(null);
    }
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
        <div>
          <h1 className="text-2xl font-bold text-brand-black">Minha Agenda</h1>
          <p className="text-brand-grayMid">{formatTodayLong()}</p>
        </div>
      </div>

      {todayAppointments.length === 0 ? (
        <div className="text-center py-16 bg-brand-grayLight ">
          <svg className="w-16 h-16 text-brand-grayMid mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h3 className="text-lg font-medium text-brand-black mb-1">Nenhum agendamento hoje</h3>
          <p className="text-brand-grayMid">Aproveite seu dia livre!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {todayAppointments.map(apt => (
            <AppointmentCard
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

function AppointmentCard({ 
  appointment, 
  onStatusChange, 
  updating 
}: { 
  appointment: Appointment; 
  onStatusChange: (apt: Appointment, status: string) => void;
  updating?: boolean;
}) {
  const isPast = new Date(appointment.endsAt) < new Date();
  const availableStatuses = NEXT_STATUSES[appointment.status] || [];
  const canUpdate = availableStatuses.length > 0 && !isPast;

  return (
    <div className={`bg-brand-white  border p-4 transition-colors ${
      appointment.status === 'SCHEDULED' && isPast ? 'border-amber-200 bg-amber-50' : 'border-brand-gray'
    }`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="text-2xl font-bold text-brand-black">
              {formatTime(appointment.startsAt)}
            </div>
            <h3 className="font-semibold text-brand-black">{appointment.client?.fullName || 'Cliente'}</h3>
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[appointment.status]}`}>
              {STATUS_LABELS[appointment.status]}
            </span>
          </div>
          
          <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-brand-grayMid">
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {formatTime(appointment.startsAt)} - {formatTime(appointment.endsAt)}
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              {appointment.service?.name}
            </span>
            <span className="font-medium text-brand-black">R$ {appointment.service?.price.toFixed(2) || '0.00'}</span>
          </div>

          {appointment.client?.phone && (
            <p className="mt-2 text-sm text-brand-grayMid flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              {formatPhone(appointment.client.phone)}
            </p>
          )}
        </div>

        {canUpdate && (
          <div className="flex flex-col gap-2">
            {availableStatuses.map(status => (
              <button
                key={status}
                onClick={() => onStatusChange(appointment, status)}
                disabled={updating}
                className={`px-3 py-2 text-sm font-medium  transition-colors ${
                  status === 'COMPLETED' ? 'bg-brand-black text-white hover:bg-brand-grayDark' :
                  status === 'CANCELLED' ? 'bg-brand-black text-white hover:bg-brand-grayDark' :
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