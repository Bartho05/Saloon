import { useState, useEffect } from 'react';
import { clientApi } from '@services/api';
import { useToast } from '@contexts/ToastContext';
import { formatDateTime } from '@utils/date';
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

export function ClientAppointmentsPage() {
  const { showToast } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'upcoming' | 'past'>('all');
  const [cancellingId, setCancellingId] = useState<string | null>(null);

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

  const handleCancel = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja cancelar este agendamento?')) return;

    setCancellingId(id);
    try {
      await clientApi.cancelAppointment(id);
      showToast({ type: 'success', title: 'Agendamento cancelado' });
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'CANCELLED' as const } : a));
    } catch (err: any) {
      showToast({ type: 'error', title: 'Erro', message: err.message });
    } finally {
      setCancellingId(null);
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
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-brand-black border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand-black">Meus Agendamentos</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-brand-gray  p-1">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2  text-sm font-medium transition-colors ${
            activeTab === 'all' ? 'bg-brand-white text-brand-black shadow' : 'text-brand-grayMid hover:text-brand-black'
          }`}
        >
          Todos
        </button>
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`px-4 py-2  text-sm font-medium transition-colors ${
            activeTab === 'upcoming' ? 'bg-brand-white text-brand-black shadow' : 'text-brand-grayMid hover:text-brand-black'
          }`}
        >
          Próximos
        </button>
        <button
          onClick={() => setActiveTab('past')}
          className={`px-4 py-2  text-sm font-medium transition-colors ${
            activeTab === 'past' ? 'bg-brand-white text-brand-black shadow' : 'text-brand-grayMid hover:text-brand-black'
          }`}
        >
          Anteriores
        </button>
      </div>

      {/* Lista */}
      {filteredAppointments.length === 0 ? (
        <div className="text-center py-12 bg-brand-grayLight ">
          <svg className="w-16 h-16 text-brand-grayMid mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h3 className="text-lg font-medium text-brand-black mb-1">Nenhum agendamento</h3>
          <p className="text-brand-grayMid mb-4">
            {activeTab === 'upcoming' 
              ? 'Você não tem agendamentos futuros.' 
              : activeTab === 'past' 
                ? 'Nenhum agendamento anterior.' 
                : 'Comece agendando seu primeiro serviço!'}
          </p>
          <a href="/agendar" className="inline-flex items-center gap-2 px-6 py-3 bg-brand-black text-white  font-medium hover:bg-brand-grayDark">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Agendar Horário
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAppointments.map(apt => (
            <AppointmentCard
              key={apt.id}
              appointment={apt}
              onCancel={apt.status === 'SCHEDULED' && new Date(apt.startsAt) > new Date() ? () => handleCancel(apt.id) : undefined}
              cancelling={cancellingId === apt.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AppointmentCard({ appointment, onCancel, cancelling }: { 
  appointment: Appointment; 
  onCancel?: () => void;
  cancelling?: boolean;
}) {
  const isPast = new Date(appointment.endsAt) < new Date();
  const canCancel = onCancel && !isPast;

  return (
    <div className="bg-brand-white  border border-brand-gray p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="font-semibold text-brand-black">{appointment.service?.name || 'Serviço'}</h3>
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[appointment.status]}`}>
              {STATUS_LABELS[appointment.status] || appointment.status}
            </span>
          </div>
          
          <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-brand-grayMid">
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {formatDateTime(appointment.startsAt)} - {formatDateTime(appointment.endsAt).split(' ')[1]}
            </span>
            {appointment.employee && (
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                {appointment.employee.name}
              </span>
            )}
            <span className="font-medium text-brand-black">R$ {appointment.service?.price.toFixed(2) || '0.00'}</span>
          </div>

          {appointment.notes && (
            <p className="mt-2 text-sm text-brand-grayMid bg-brand-grayLight px-3 py-2 ">
              {appointment.notes}
            </p>
          )}
        </div>

        {canCancel && (
          <button
            onClick={onCancel}
            disabled={cancelling}
            className="flex-shrink-0 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50  border border-red-200 disabled:opacity-50"
          >
            {cancelling ? 'Cancelando...' : 'Cancelar'}
          </button>
        )}
      </div>
    </div>
  );
}