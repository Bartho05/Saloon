import type { Appointment } from '@types';
import { formatDateTime, formatCurrency } from '@utils/date';
import { formatPhone } from '@utils/validation';
import { StatusBadge } from '@components/Dashboard';
import { CheckIcon, CloseIcon, AlertIcon } from '@components/icons';

export const STATUS_LABEL: Record<Appointment['status'], string> = {
  SCHEDULED: 'Agendado',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
  NO_SHOW: 'Não compareceu',
};

export const STATUS_TONE: Record<Appointment['status'], 'info' | 'success' | 'danger' | 'warning'> = {
  SCHEDULED: 'info',
  COMPLETED: 'success',
  CANCELLED: 'danger',
  NO_SHOW: 'warning',
};

/** Transições permitidas a partir de cada status. */
export const NEXT_STATUSES: Record<Appointment['status'], Appointment['status'][]> = {
  SCHEDULED: ['COMPLETED', 'CANCELLED', 'NO_SHOW'],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

const ACTION_META: Record<string, { label: string; icon: typeof CheckIcon }> = {
  COMPLETED: { label: 'Concluir', icon: CheckIcon },
  CANCELLED: { label: 'Cancelar', icon: CloseIcon },
  NO_SHOW: { label: 'Não compareceu', icon: AlertIcon },
};

interface AppointmentCardProps {
  appointment: Appointment;
  onStatusChange?: (apt: Appointment, status: Appointment['status']) => void;
  updating?: boolean;
  /** mostra data completa (lista) ou só o horário (agenda do dia) */
  compactTime?: boolean;
  /**
   * Mostra a foto de quem atende. Na agenda do profissional é redundante —
   * é a agenda DELLE —, então fica desligado por padrão e o cliente liga.
   */
  showEmployee?: boolean;
}

/**
 * Card de agendamento compartilhado entre "Minha Agenda" e
 * "Meus Agendamentos" — os dois precisam ter exatamente a mesma aparência.
 */
export function AppointmentCard({
  appointment,
  onStatusChange,
  updating,
  compactTime,
  showEmployee = false,
}: AppointmentCardProps) {
  const isPast = new Date(appointment.endsAt) < new Date();
  const overdue = appointment.status === 'SCHEDULED' && isPast;
  const actions = onStatusChange ? NEXT_STATUSES[appointment.status] : [];

  const startsAt = new Date(appointment.startsAt);
  const endsAt = new Date(appointment.endsAt);

  return (
    <li
      className={[
        'px-5 md:px-6 py-5 flex flex-col xl:flex-row xl:items-center gap-4 xl:gap-5',
        'border-b border-brand-gray last:border-b-0 transition-colors duration-fast',
        overdue ? 'bg-brand-grayLight' : 'hover:bg-brand-grayLight',
      ].join(' ')}
    >
      {/* Horário em bloco fixo */}
      <div className="flex-shrink-0 xl:w-20">
        <p className="font-display font-bold text-body-lg tabular-nums leading-none">
          {startsAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </p>
        <p className="text-caption text-brand-grayMid mt-1 tabular-nums">
          {endsAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </p>
        {!compactTime && (
          <p className="text-caption text-brand-grayMid mt-0.5">
            {startsAt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')}
          </p>
        )}
      </div>

      {/* Cliente */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h3 className="font-display font-medium text-body">
            {appointment.client?.fullName || 'Cliente'}
          </h3>
          {overdue && <span className="badge badge-muted">Atrasado</span>}
        </div>
        <p className="text-body-sm text-brand-grayMid truncate mt-0.5">
          {appointment.service?.name}
          {appointment.client?.phone ? ` · ${formatPhone(appointment.client.phone)}` : ''}
        </p>
        {!compactTime && (
          <p className="text-caption text-brand-grayMid mt-0.5">
            {formatDateTime(appointment.startsAt)}
          </p>
        )}
      </div>

      {/* Profissional — com foto, para o cliente reconhecer quem vai atender */}
      {showEmployee && appointment.employee && (
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <span className="w-9 h-9 flex-shrink-0 bg-brand-grayLight border border-brand-gray overflow-hidden flex items-center justify-center">
            {appointment.employee.photoUrl ? (
              <img
                src={appointment.employee.photoUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="font-display font-bold text-caption text-brand-grayMid">
                {appointment.employee.name.charAt(0).toUpperCase()}
              </span>
            )}
          </span>
          <span className="text-body-sm truncate max-w-[10rem]">
            {appointment.employee.name}
          </span>
        </div>
      )}

      {/* Valor + status + ações */}
      <div className="flex items-center gap-4 xl:gap-6 flex-shrink-0 flex-wrap">
        <span className="font-display font-medium text-body tabular-nums">
          {formatCurrency(appointment.service?.price || 0)}
        </span>

        <StatusBadge tone={STATUS_TONE[appointment.status]}>
          {STATUS_LABEL[appointment.status]}
        </StatusBadge>

        {actions.length > 0 && (
          <div className="flex items-center gap-1">
            {actions.map((status) => {
              const meta = ACTION_META[status];
              const Icon = meta.icon;
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => onStatusChange?.(appointment, status)}
                  disabled={updating}
                  title={meta.label}
                  aria-label={`${meta.label} — agendamento de ${appointment.client?.fullName || 'cliente'}`}
                  className="p-2.5 text-brand-grayMid hover:text-brand-black hover:bg-brand-white border border-transparent hover:border-brand-gray transition-colors duration-fast disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </li>
  );
}

export default AppointmentCard;
