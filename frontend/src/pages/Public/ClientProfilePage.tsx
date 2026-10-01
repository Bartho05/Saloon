import { useState, useEffect } from 'react';
import { useAuth } from '@hooks/useAuth';
import { useToast } from '@contexts/ToastContext';
import { formatPhone } from '@utils/validation';
import { Container, Card, CardContent, Button } from '@components/ui';
import { PageHeader, StatCard, PageSpinner } from '@components/Dashboard';
import { CalendarIcon, PhoneIcon, ClockIcon, UserIcon } from '@components/icons';

export function ClientProfilePage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const client = user && 'fullName' in user ? user : null;

  useEffect(() => {
    const load = async () => {
      try {
        const { clientApi } = await import('@services/api');
        const res = await clientApi.getAppointments();
        setAppointments(res.appointments);
      } catch (err: any) {
        showToast({ type: 'error', title: 'Erro', message: err.message });
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [showToast]);

  if (loading) return <PageSpinner />;

  const upcoming = appointments.filter(
    (a) => a.status === 'SCHEDULED' && new Date(a.startsAt) > new Date()
  );
  const done = appointments.filter((a) => a.status === 'COMPLETED');
  const totalSpent = done.reduce((sum, a) => sum + (a.service?.price || 0), 0);
  const lastVisit = done[0]?.startsAt;

  return (
    <Container size="full" className="!px-0">
      <PageHeader title="Meu Perfil" description="Seus dados e histórico" />

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardContent>
            <div className="flex flex-col items-center text-center pb-6 border-b border-brand-gray">
              <div className="w-20 h-20 bg-brand-black text-brand-white flex items-center justify-center font-display font-bold text-display-md mb-4">
                {(client?.fullName || '?').charAt(0).toUpperCase()}
              </div>
              <h2 className="font-display font-bold text-display-sm">
                {client?.fullName || 'Cliente'}
              </h2>
              <p className="text-caption text-brand-grayMid mt-1">Cliente</p>
            </div>

            <dl className="space-y-5 pt-6">
              <div className="flex items-start gap-3">
                <PhoneIcon className="w-4 h-4 text-brand-grayMid mt-0.5 flex-shrink-0" />
                <div>
                  <dt className="text-caption text-brand-grayMid">Telefone</dt>
                  <dd className="text-body-sm mt-0.5">
                    {client?.phone ? formatPhone(client.phone) : 'Não informado'}
                  </dd>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <ClockIcon className="w-4 h-4 text-brand-grayMid mt-0.5 flex-shrink-0" />
                <div>
                  <dt className="text-caption text-brand-grayMid">Última visita</dt>
                  <dd className="text-body-sm mt-0.5">
                    {lastVisit
                      ? new Date(lastVisit).toLocaleDateString('pt-BR')
                      : 'Sem visitas concluídas'}
                  </dd>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CalendarIcon className="w-4 h-4 text-brand-grayMid mt-0.5 flex-shrink-0" />
                <div>
                  <dt className="text-caption text-brand-grayMid">Cliente desde</dt>
                  <dd className="text-body-sm mt-0.5">
                    {client?.createdAt
                      ? new Date(client.createdAt).toLocaleDateString('pt-BR')
                      : '-'}
                  </dd>
                </div>
              </div>
            </dl>

            <p className="text-caption text-brand-grayMid mt-6 pt-6 border-t border-brand-gray">
              Para atualizar seus dados, fale com o salão. O telefone é a sua chave de acesso.
            </p>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <StatCard size="sm" label="Agendamentos futuros" value={upcoming.length} />
            <StatCard size="sm" label="Atendimentos concluídos" value={done.length} />
            <StatCard size="sm" label="Total investido" value={totalSpent.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
          </div>

          <Card>
            <div className="px-5 md:px-6 py-4 border-b border-brand-gray flex items-center justify-between">
              <h3 className="font-display font-semibold text-body">Próximos atendimentos</h3>
              <a href="/agendar" className="btn-minimal">Agendar</a>
            </div>
            <CardContent>
              {upcoming.length === 0 ? (
                <p className="text-body-sm text-brand-grayMid py-6 text-center">
                  Nenhum agendamento futuro.
                </p>
              ) : (
                <ul className="space-y-4">
                  {upcoming.slice(0, 5).map((a) => (
                    <li key={a.id} className="flex items-center gap-4">
                      <div className="w-14 flex-shrink-0">
                        <p className="font-display font-bold text-body tabular-nums leading-none">
                          {new Date(a.startsAt).toLocaleDateString('pt-BR', { day: '2-digit' })}
                        </p>
                        <p className="text-caption text-brand-grayMid mt-0.5">
                          {new Date(a.startsAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="font-display text-body-sm">{a.service?.name}</p>
                        <p className="text-caption text-brand-grayMid">{a.employee?.name}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <div className="px-5 md:px-6 py-4 border-b border-brand-gray">
              <h3 className="font-display font-semibold text-body">Como acessar</h3>
            </div>
            <CardContent>
              <p className="text-body-sm text-brand-grayMid">
                Você entra com o seu telefone. Não precisa digitar código toda vez — o acesso
                fica salvo por 15 dias. Depois disso, enviamos um código novo pelo WhatsApp.
              </p>
              <Button variant="outline" className="mt-5" onClick={() => showToast({ type: 'info', title: 'Dica', message: 'Basta acessar com o mesmo telefone' })}>
                <UserIcon className="w-4 h-4" />
                Entendi
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </Container>
  );
}

export default ClientProfilePage;
