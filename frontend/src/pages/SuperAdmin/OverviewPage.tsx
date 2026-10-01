import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { superadminApi, type SuperAdminOverview } from '@services/api';
import { useToast } from '@contexts/ToastContext';
import { formatDateTime } from '@utils/date';
import { Card, CardContent, Container, Button } from '@components/ui';
import { StatCard, PageSpinner, EmptyState } from '@components/Dashboard';
import { SuperAdminHeader } from '@layouts/SuperAdminLayout';
import { CheckCircleIcon, AlertIcon, ArrowRightIcon } from '@components/icons';

/**
 * Visão geral da instalação.
 *
 * A pergunta que esta tela responde é "o que ainda falta para isso funcionar?",
 * não "quantos usuários existem". Num sistema recém-instalado os dois conjuntos
 * são quase o mesmo, mas a ordem importa: um dono criado e nenhum serviço
 * cadastrado ainda é um sistema parado, e o número de usuários não denuncia
 * isso.
 */
export function SuperAdminOverviewPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [data, setData] = useState<SuperAdminOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    superadminApi
      .getOverview()
      .then((res) => { if (!cancelled) setData(res.status); })
      .catch((err) => {
        if (!cancelled) showToast({ type: 'error', title: 'Erro', message: err.message });
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [showToast]);

  if (loading && !data) return <PageSpinner />;

  const pendentes = data?.steps.filter((s) => !s.done) ?? [];
  const concluidos = data?.steps.filter((s) => s.done) ?? [];

  return (
    <Container size="full" className="!px-0">
      <SuperAdminHeader
        title="Visão geral"
        description={
          data?.ready
            ? 'Instalação completa'
            : `${pendentes.length} etapa${pendentes.length !== 1 ? 's' : ''} pendente${pendentes.length !== 1 ? 's' : ''} para o sistema ficar operante`
        }
      />

      {/* Números da instalação */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8 auto-rows-fr">
        <StatCard size="sm" label="Proprietários" value={data?.counts.owners ?? 0} />
        <StatCard size="sm" label="Profissionais" value={data?.counts.employees ?? 0} />
        <StatCard size="sm" label="Serviços" value={data?.counts.services ?? 0} />
        <StatCard size="sm" label="Agendamentos" value={data?.counts.appointments ?? 0} />
      </div>

      {/*
        Lista de instalação antes de qualquer gráfico: enquanto não houver
        proprietário, um dashboard de faturamento seria uma tela bonita
        mostrando zero sem explicar por quê.
      */}
      <Card className="mb-6">
        <div className="px-5 md:px-6 py-4 border-b border-brand-gray">
          <h2 className="font-display font-semibold text-body">O que falta para funcionar</h2>
          <p className="text-caption text-brand-grayMid mt-0.5">
            Nesta ordem — cada passo destrava o seguinte
          </p>
        </div>

        <ul>
          {[...pendentes, ...concluidos].map((step, index) => (
            <li
              key={step.key}
              className="px-5 md:px-6 py-4 flex items-center gap-4 border-b border-brand-gray last:border-b-0 hover:bg-brand-grayLight transition-colors duration-fast"
            >
              <span
                className={`w-8 h-8 flex-shrink-0 flex items-center justify-center ${
                  step.done
                    ? 'bg-brand-black text-brand-white'
                    : 'border border-brand-gray text-brand-grayMid'
                }`}
              >
                {step.done ? (
                  <CheckCircleIcon className="w-4 h-4" />
                ) : (
                  <span className="font-display font-bold text-caption">{index + 1}</span>
                )}
              </span>

              <div className="flex-1 min-w-0">
                <p className="font-display font-medium text-body truncate">{step.label}</p>
                <p className="text-caption text-brand-grayMid mt-0.5">{step.detail}</p>
              </div>

              {/* O link só existe quando o passo está por fazer E tem para
                  onde ir. Um "ver" apontando para a tela do dono no passo
                  "crie o proprietário" seria um beco sem saída. */}
              {!step.done && step.route && (
                <Link
                  to={step.route}
                  className="flex items-center gap-2 text-caption font-display font-medium text-brand-black hover:gap-3 transition-all duration-fast flex-shrink-0"
                >
                  Resolver
                  <ArrowRightIcon className="w-3.5 h-3.5" />
                </Link>
              )}

              {!step.done && !step.route && (
                <span className="text-caption text-brand-grayMid flex-shrink-0">
                  automático
                </span>
              )}
            </li>
          ))}
        </ul>
      </Card>

      {data && !data.ready && (
        <Card className="mb-6 border-l-2 border-l-brand-black">
          <CardContent>
            <div className="flex items-start gap-3">
              <AlertIcon className="w-5 h-5 text-brand-black flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-display font-semibold text-body mb-1">
                  O sistema ainda não está operante
                </p>
                <p className="text-body-sm text-brand-grayMid">
                  Sem proprietário não existe quem abra o painel, cadastre serviço ou
                  receba agendamento. Enquanto a etapa acima estiver pendente, o site
                  continua no ar mas não atende ninguém.
                </p>
                <Button
                  variant="solid"
                  className="mt-4"
                  onClick={() => navigate('/superadmin/proprietarios')}
                >
                  Criar proprietário
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <div className="px-5 md:px-6 py-4 border-b border-brand-gray">
            <h2 className="font-display font-semibold text-body">Instalação</h2>
          </div>
          <CardContent>
            <dl className="space-y-3">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-body-sm text-brand-grayMid">Salão</dt>
                <dd className="font-display font-medium text-body-sm text-right truncate">
                  {data?.salonName || <span className="text-brand-grayMid">não configurado</span>}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-body-sm text-brand-grayMid">Clientes</dt>
                <dd className="font-display font-medium text-body-sm tabular-nums">
                  {data?.counts.clients ?? 0}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-body-sm text-brand-grayMid">Contas de superadmin</dt>
                <dd className="font-display font-medium text-body-sm tabular-nums">
                  {data?.counts.superAdmins ?? 0}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-body-sm text-brand-grayMid">Último acesso</dt>
                <dd className="font-display font-medium text-body-sm text-right">
                  {data?.lastLoginAt ? formatDateTime(data.lastLoginAt) : '—'}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <div className="px-5 md:px-6 py-4 border-b border-brand-gray">
            <h2 className="font-display font-semibold text-body">Tentativas de acesso</h2>
            <p className="text-caption text-brand-grayMid mt-0.5">
              Logins de superadmin que falharam
            </p>
          </div>
          <CardContent>
            {data && data.failedLoginAttempts > 0 ? (
              <>
                <p className="font-display font-bold text-display-sm tabular-nums">
                  {data.failedLoginAttempts}
                </p>
                <p className="text-body-sm text-brand-grayMid mt-2">
                  Todas as tentativas ficam registradas com data e endereço de origem na
                  auditoria. Um volume alto aqui é alguém tentando adivinhar o código.
                </p>
                <Link
                  to="/superadmin/auditoria"
                  className="inline-flex items-center gap-2 text-caption font-display font-medium text-brand-black hover:gap-3 transition-all duration-fast mt-4"
                >
                  Ver auditoria
                  <ArrowRightIcon className="w-3.5 h-3.5" />
                </Link>
              </>
            ) : (
              <EmptyState
                title="Nenhuma tentativa registrada"
                description="Ninguém errou o código de acesso desde a instalação."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}

export default SuperAdminOverviewPage;
