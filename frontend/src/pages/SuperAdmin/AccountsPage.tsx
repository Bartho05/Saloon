import { useEffect, useState } from 'react';
import { superadminApi } from '@services/api';
import type { SuperAdmin } from '@types';
import { useToast } from '@contexts/ToastContext';
import { formatDateTime } from '@utils/date';
import { Card, CardContent, Container, Button, Badge } from '@components/ui';
import { PageSpinner, EmptyState, StatusBadge } from '@components/Dashboard';
import { SuperAdminHeader } from '@layouts/SuperAdminLayout';
import { KeyIcon, RefreshIcon, CheckIcon } from '@components/icons';

/**
 * Tela que mostra o código UMA vez.
 *
 * Existe porque o código não tem volta: o banco guarda só o hash. Depois de
 * fechar esta tela, a única forma de voltar a entrar é gerar outro — e por
 * isso o botão de copiar é o elemento mais importante da tela, e o aviso de
 * "não dá para recuperar" fica acima dele, não escondido embaixo.
 */
function CodeReveal({ code, onClose }: { code: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(code.replace(/\s/g, ''));
      setCopied(true);
      showToast({ type: 'success', title: 'Código copiado' });
    } catch {
      showToast({
        type: 'error',
        title: 'Não foi possível copiar',
        message: 'Selecione e copie manualmente.',
      });
    }
  };

  return (
    <Card className="mb-6 border-2 border-brand-black">
      <CardContent>
        <p className="font-display text-caption uppercase tracking-wider text-brand-grayMid mb-2">
          Código novo
        </p>

        <p className="font-display font-bold text-display-sm tracking-widest select-all mb-4">
          {code.replace(/(.{4})/g, '$1 ').trim()}
        </p>

        <div className="bg-brand-grayLight border-l-2 border-brand-black p-4 mb-5 text-body-sm">
          <strong>Guarde agora.</strong> O antigo já deixou de valer e este não
          pode ser recuperado — o servidor guarda apenas um hash. Se você fechar
          esta tela sem copiar, será preciso gerar outro.
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button variant="solid" onClick={copiar}>
            {copied ? <CheckIcon className="w-4 h-4 mr-2" /> : null}
            {copied ? 'Copiado' : 'Copiar código'}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Já guardei
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function SuperAdminAccountsPage() {
  const { showToast } = useToast();
  const [admins, setAdmins] = useState<SuperAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [novoCodigo, setNovoCodigo] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const carregar = async () => {
    try {
      const res = await superadminApi.getAccounts();
      setAdmins(res.superAdmins);
    } catch (err: any) {
      showToast({ type: 'error', title: 'Erro', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rotacionar = async () => {
    try {
      const res = await superadminApi.rotateCode();
      setNovoCodigo(res.accessCode);
      await carregar();
    } catch (err: any) {
      showToast({ type: 'error', title: 'Erro', message: err.message });
    }
  };

  const alternar = async (admin: SuperAdmin) => {
    try {
      await superadminApi.setActive(admin.id, !admin.isActive);
      showToast({
        type: 'success',
        title: admin.isActive ? 'Conta desativada' : 'Conta reativada',
      });
      await carregar();
    } catch (err: any) {
      showToast({ type: 'error', title: 'Erro', message: err.message });
    }
  };

  const destravar = async (admin: SuperAdmin) => {
    try {
      await superadminApi.unlock(admin.id);
      setOcupado(null);
      showToast({ type: 'success', title: 'Conta destravada' });
      await carregar();
    } catch (err: any) {
      showToast({ type: 'error', title: 'Erro', message: err.message });
    }
  };

  if (loading) return <PageSpinner />;

  return (
    <Container size="full" className="!px-0">
      <SuperAdminHeader
        title="Contas de acesso"
        description="Quem tem acesso máximo à instalação"
        action={
          <Button variant="outline" onClick={rotacionar}>
            <RefreshIcon className="w-4 h-4 mr-2" />
            Gerar novo código
          </Button>
        }
      />

      {novoCodigo && (
        <CodeReveal code={novoCodigo} onClose={() => setNovoCodigo(null)} />
      )}

      <Card className="mb-6">
        <div className="px-5 md:px-6 py-4 border-b border-brand-gray">
          <h2 className="font-display font-semibold text-body">Como o código é guardado</h2>
        </div>
        <CardContent>
          <ul className="space-y-3 text-body-sm">
            <li className="flex items-start gap-3">
              <KeyIcon className="w-4 h-4 mt-0.5 flex-shrink-0 text-brand-grayMid" />
              <span>
                O código nunca é gravado. O banco guarda só o resultado de um{' '}
                <strong>scrypt</strong> com um sal própria e uma chave do servidor
                (o <em>pepper</em>), que fica no arquivo de ambiente — fora do banco.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <KeyIcon className="w-4 h-4 mt-0.5 flex-shrink-0 text-brand-grayMid" />
              <span>
                Não existe função que transforme o hash de volta no código. Nem o
                superadmin, nem quem tiver o banco inteiro em mãos.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <KeyIcon className="w-4 h-4 mt-0.5 flex-shrink-0 text-brand-grayMid" />
              <span>
                Perdeu o código? Gere outro. O antigo deixa de valer na mesma hora, e
                a troca fica registrada na auditoria.
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <div className="px-5 md:px-6 py-4 border-b border-brand-gray">
          <h2 className="font-display font-semibold text-body">Contas</h2>
        </div>

        {!admins.length ? (
          <EmptyState title="Nenhuma conta" description="Nenhum acesso de superadmin existe." />
        ) : (
          <ul>
            {admins.map((admin) => (
              <li
                key={admin.id}
                className="px-5 md:px-6 py-4 border-b border-brand-gray last:border-b-0"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-display font-medium text-body truncate">{admin.name}</p>
                      <StatusBadge tone={admin.isActive ? 'success' : 'danger'}>
                        {admin.isActive ? 'Ativo' : 'Inativo'}
                      </StatusBadge>
                    </div>
                    <p className="text-caption text-brand-grayMid mt-1 truncate">{admin.email}</p>
                  </div>

                  <div className="text-caption text-brand-grayMid sm:text-right flex-shrink-0">
                    <p>
                      Código <span className="font-display">{admin.codeFingerprint}</span>
                    </p>
                    <p className="mt-0.5">
                      Criado em {formatDateTime(admin.codeCreatedAt || '').split(' ')[0]}
                      {admin.codeRotatedAt
                        ? ` · trocado em ${formatDateTime(admin.codeRotatedAt).split(' ')[0]}`
                        : ''}
                    </p>
                    <p className="mt-0.5">
                      {admin.lastLoginAt
                        ? `Entrou ${formatDateTime(admin.lastLoginAt)}`
                        : 'Nunca entrou'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {admin.id === (admins[0]?.id ?? -1) ? (
                      // Desativar a própria conta deixaria o operador fora do
                      // painel sem ninguém para reativar.
                      <Badge variant="muted">você</Badge>
                    ) : (
                      <Button variant="ghost" onClick={() => alternar(admin)}>
                        {admin.isActive ? 'Desativar' : 'Reativar'}
                      </Button>
                    )}
                  </div>
                </div>

                {ocupado === admin.email && (
                  <div className="mt-4 p-4 bg-brand-grayLight border-l-2 border-brand-black text-body-sm">
                    Esta conta está travada por excesso de tentativas erradas. Destravar
                    também zera a contagem.
                    <Button variant="outline" className="ml-3" onClick={() => destravar(admin)}>
                      Destravar
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Container>
  );
}

export default SuperAdminAccountsPage;
