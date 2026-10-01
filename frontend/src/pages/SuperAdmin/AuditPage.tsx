import { useEffect, useState } from 'react';
import { superadminApi, type AuditEntry } from '@services/api';
import { useToast } from '@contexts/ToastContext';
import { formatDateTime } from '@utils/date';
import { Card, CardContent, Container } from '@components/ui';
import { PageSpinner, EmptyState, StatusBadge } from '@components/Dashboard';
import { SuperAdminHeader } from '@layouts/SuperAdminLayout';
import { RefreshIcon, AlertIcon, CheckCircleIcon, UserPlusIcon, KeyIcon } from '@components/icons';

/**
 * Como cada ação aparece na trilha.
 *
 * O rótulo precisa ser humano. "LOGIN_FAILED" numa coluna estreita obriga a
 * traduzir mentalmente enquanto se procura um problema — e a utilidade de um
 * log é essa leitura rápida.
 */
const ACTION_META: Record<string, { label: string; tone: 'info' | 'success' | 'danger' | 'warning' | 'neutral' }> = {
  BOOTSTRAP: { label: 'Primeiro acesso criado', tone: 'success' },
  BOOTSTRAP_DENIED: { label: 'Instalação recusada', tone: 'danger' },
  LOGIN_SUCCESS: { label: 'Entrou', tone: 'success' },
  LOGIN_FAILED: { label: 'Código errado', tone: 'danger' },
  LOCKED: { label: 'Conta travada', tone: 'warning' },
  UNLOCK: { label: 'Conta destravada', tone: 'info' },
  ROTATE_CODE: { label: 'Código trocado', tone: 'warning' },
  CREATE_OWNER: { label: 'Proprietário criado', tone: 'success' },
  CREATE_OWNER_DENIED: { label: 'Criação recusada', tone: 'danger' },
  ACTIVATE: { label: 'Conta reativada', tone: 'info' },
  DEACTIVATE: { label: 'Conta desativada', tone: 'warning' },
};

const ICON_POR_ACAO: Record<string, any> = {
  BOOTSTRAP: KeyIcon,
  BOOTSTRAP_DENIED: AlertIcon,
  LOGIN_SUCCESS: CheckCircleIcon,
  LOGIN_FAILED: AlertIcon,
  LOCKED: AlertIcon,
  UNLOCK: CheckCircleIcon,
  ROTATE_CODE: KeyIcon,
  CREATE_OWNER: UserPlusIcon,
  CREATE_OWNER_DENIED: AlertIcon,
  ACTIVATE: CheckCircleIcon,
  DEACTIVATE: AlertIcon,
};

export function SuperAdminAuditPage() {
  const { showToast } = useToast();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [recarregando, setRecarregando] = useState(false);

  const carregar = async () => {
    try {
      const res = await superadminApi.getAudit(200);
      setEntries(res.entries);
    } catch (err: any) {
      showToast({ type: 'error', title: 'Erro', message: err.message });
    } finally {
      setLoading(false);
      setRecarregando(false);
    }
  };

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recarregar = () => {
    setRecarregando(true);
    void carregar();
  };

  if (loading) return <PageSpinner />;

  const falhas = entries.filter((e) => e.action.includes('DENIED') || e.action.includes('FAILED')).length;

  return (
    <Container size="full" className="!px-0">
      <SuperAdminHeader
        title="Auditoria"
        description="Quem entrou, o que criou e o que tentou"
        action={
          <button
            onClick={recarregar}
            disabled={recarregando}
            className="flex items-center gap-2 text-caption text-brand-grayMid hover:text-brand-black transition-colors duration-fast disabled:opacity-40"
          >
            <RefreshIcon className={`w-4 h-4 ${recarregando ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        }
      />

      {entries.length > 0 && (
        <div className="flex items-center gap-4 mb-6 text-body-sm">
          <span className="text-brand-grayMid">
            <strong className="font-display text-brand-black">{entries.length}</strong> registro(s)
          </span>
          {falhas > 0 && (
            <span className="text-brand-grayMid">
              <strong className="font-display text-brand-black">{falhas}</strong> falha(s)
            </span>
          )}
        </div>
      )}

      <Card>
        <div className="px-5 md:px-6 py-4 border-b border-brand-gray">
          <h2 className="font-display font-semibold text-body">Histórico</h2>
          <p className="text-caption text-brand-grayMid mt-0.5">
            Mais recente primeiro
          </p>
        </div>

        {!entries.length ? (
          <EmptyState
            title="Nada registrado ainda"
            description="Toda entrada e saída do acesso máximo fica registrada aqui."
          />
        ) : (
          <ul>
            {entries.map((entry) => {
              const meta = ACTION_META[entry.action] ?? {
                label: entry.action,
                tone: 'neutral' as const,
              };
              const Icon = ICON_POR_ACAO[entry.action] ?? RefreshIcon;

              return (
                <li
                  key={entry.id}
                  className="px-5 md:px-6 py-4 flex items-start gap-4 border-b border-brand-gray last:border-b-0"
                >
                  <span className="w-8 h-8 flex-shrink-0 border border-brand-gray flex items-center justify-center text-brand-grayMid">
                    <Icon className="w-4 h-4" />
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-display font-medium text-body-sm">{meta.label}</p>
                      <StatusBadge tone={meta.tone}>{entry.action}</StatusBadge>
                    </div>

                    {entry.detail && (
                      <p className="text-caption text-brand-grayMid mt-1 break-words">
                        {entry.detail}
                      </p>
                    )}

                    <p className="text-caption text-brand-grayMid mt-1">
                      {formatDateTime(entry.createdAt)}
                      {entry.ip ? ` · ${entry.ip}` : ''}
                      {entry.superAdmin ? ` · ${entry.superAdmin.name}` : ''}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/*
        Aviso sobre o que NÃO aparece aqui. Uma trilha de auditoria que deixa a
        pessoa supor que guarda tudo é pior do que não existir: ela para de
        procurar algo que nunca foi gravado. O código de acesso, por definição,
        não entra.
      */}
      <Card className="mt-6">
        <CardContent>
          <div className="flex items-start gap-3">
            <AlertIcon className="w-5 h-5 text-brand-grayMid flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-display font-medium text-body-sm mb-1">
                O que não é registrado
              </p>
              <p className="text-body-sm text-brand-grayMid">
                O código de acesso nunca aparece aqui nem no banco — só o hash dele.
                A auditoria registra <em>que</em> a ação aconteceu, com data e origem, mas
                não guarda segredos. Senhas de proprietário também não entram: só o evento
                de criação.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Container>
  );
}

export default SuperAdminAuditPage;
