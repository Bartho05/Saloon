import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatBirthDate } from '@utils/date';
import type { TimeSlot } from '@utils/schedule';
import type { Service, Employee, Client } from '@types';
import { Button, Card, CardContent, Badge, Separator } from '@components/ui';

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
    <div className="max-w-xl mx-auto space-y-6">
      <Badge variant="outline" className="mb-2">CONFIRMAR</Badge>
      <h2 className="text-display-md mb-2">Revise e confirme</h2>
      <p className="text-body-lg text-brand-grayMid mb-8">Confira os detalhes antes de finalizar</p>

      <Card>
        <CardContent>
          <dl className="space-y-0">
            <Row label="Serviço" value={service.name} />
            <Row
              label="Profissional"
              value={
                <span className="inline-flex items-center gap-2">
                  {employee.photoUrl ? (
                    <img
                      src={employee.photoUrl}
                      alt=""
                      className="w-6 h-6 object-cover border border-brand-gray flex-shrink-0"
                    />
                  ) : (
                    <span className="w-6 h-6 bg-brand-grayLight border border-brand-gray flex items-center justify-center flex-shrink-0">
                      <span className="font-display font-bold text-caption text-brand-grayMid">
                        {employee.name.charAt(0).toUpperCase()}
                      </span>
                    </span>
                  )}
                  {employee.name}
                </span>
              }
            />
            <Row
              label="Data"
              value={format(slot.start, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            />
            <Row
              label="Horário"
              value={`${format(slot.start, 'HH:mm')} — ${endTime} (${duration} min)`}
            />

            <div className="flex items-center justify-between py-4 border-b border-brand-gray">
              <dt className="font-display text-caption text-brand-grayMid">Valor</dt>
              <dd className="font-display font-bold text-body-lg">
                R$ {service.price.toFixed(2).replace('.', ',')}
              </dd>
            </div>

            <div className="py-4">
              <dt className="font-display text-caption text-brand-grayMid mb-2">Cliente</dt>
              <dd className="font-display font-medium text-body">{client.fullName || 'Não informado'}</dd>
              <dd className="text-body-sm text-brand-grayMid">{formatPhone(client.phone)}</dd>
              {client.birthDate && (
                <dd className="text-body-sm text-brand-grayMid">
                  {/* `formatBirthDate`, não `new Date(...)`: "1993-08-21" é
                      interpretado como meia-noite UTC e exibido em São Paulo
                      (UTC-3) como 20/08/1993 — um dia antes do digitado. */}
                  Nasc: {formatBirthDate(client.birthDate)}
                </dd>
              )}
              {isNewClient && (
                <dd className="mt-2">
                  <Badge variant="muted">Nova conta será criada</Badge>
                </dd>
              )}
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card className="border-brand-gray bg-brand-grayLight">
        <CardContent>
          <p className="font-display font-medium text-body-sm mb-1">Política de cancelamento</p>
          <p className="text-body-sm text-brand-grayMid">
            Cancelamentos com menos de 2 horas de antecedência podem gerar cobrança.
            Avise com antecedência para liberar o horário para outro cliente.
          </p>
        </CardContent>
      </Card>

      <Separator className="my-2" />

      <div className="flex flex-col sm:flex-row gap-3">
        <Button variant="outline" size="lg" className="flex-1" onClick={onBack} disabled={loading}>
          Voltar e alterar
        </Button>
        <Button variant="solid" size="lg" className="flex-1" onClick={onConfirm} disabled={loading} loading={loading}>
          {loading ? 'Confirmando...' : 'Confirmar Agendamento'}
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-brand-gray">
      <dt className="font-display text-caption text-brand-grayMid">{label}</dt>
      <dd className="font-display font-medium text-body text-right">{value}</dd>
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