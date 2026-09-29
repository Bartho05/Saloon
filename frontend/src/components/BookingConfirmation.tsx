import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { TimeSlot } from '@utils/schedule';
import type { Service, Employee, Client } from '@types';

interface BookingConfirmationProps {
  service: Service;
  employee: Employee;
  slot: TimeSlot;
  client: Client | { phone: string; fullName?: string; birthDate?: string };
  isNewClient: boolean;
  onConfirm: () => Promise<void>;
  onBack: () => void;
  loading?: boolean;
}

export function BookingConfirmation({
  service,
  employee,
  slot,
  client,
  isNewClient,
  onConfirm,
  onBack,
  loading = false,
}: BookingConfirmationProps) {
  const endTime = format(slot.end, 'HH:mm');
  const duration = Math.round((slot.end.getTime() - slot.start.getTime()) / 60000);

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-6">
        <div className="flex items-center justify-center mb-4">
          <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
        
        <h3 className="text-xl font-bold text-gray-900 text-center mb-1">Confirmar Agendamento</h3>
        <p className="text-gray-600 text-center text-sm mb-6">Revise os detalhes antes de finalizar</p>

        <dl className="space-y-4 text-sm">
          <div className="flex items-center justify-between py-2 border-b border-blue-100">
            <dt className="text-gray-500">Serviço</dt>
            <dd className="font-medium text-gray-900">{service.name}</dd>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-blue-100">
            <dt className="text-gray-500">Profissional</dt>
            <dd className="font-medium text-gray-900">{employee.name}</dd>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-blue-100">
            <dt className="text-gray-500">Data</dt>
            <dd className="font-medium text-gray-900">
              {format(slot.start, "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </dd>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-blue-100">
            <dt className="text-gray-500">Horário</dt>
            <dd className="font-medium text-gray-900">
              {format(slot.start, 'HH:mm')} - {endTime} ({duration}min)
            </dd>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-blue-100">
            <dt className="text-gray-500">Valor</dt>
            <dd className="font-bold text-lg text-blue-600">R$ {service.price.toFixed(2)}</dd>
          </div>

          <div className="pt-2 border-t border-blue-200">
            <dt className="text-gray-500 mb-1">Cliente</dt>
            <dd className="font-medium text-gray-900">{client.fullName || 'Não informado'}</dd>
            <dd className="text-gray-500 text-sm">{formatPhone(client.phone)}</dd>
            {client.birthDate && (
              <dd className="text-gray-500 text-sm">
                Nasc: {format(new Date(client.birthDate), 'dd/MM/yyyy', { locale: ptBR })}
              </dd>
            )}
            {isNewClient && (
              <dd className="text-green-600 text-sm font-medium flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Nova conta será criada
              </dd>
            )}
          </div>
        </dl>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="font-medium text-amber-800">Política de cancelamento</p>
            <p className="text-amber-700 text-sm mt-1">
              Cancelamentos com menos de 2 horas de antecedência podem gerar cobrança.
              Avise com antecedência para liberar o horário para outro cliente.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button
          onClick={onBack}
          disabled={loading}
          className="flex-1 py-3 px-6 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          ← Voltar e alterar
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="flex-1 py-3 px-6 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Confirmando...
            </>
          ) : (
            'Confirmar Agendamento ✓'
          )}
        </button>
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