import { useEffect, useState } from 'react';
import { superadminApi } from '@services/api';
import { useToast } from '@contexts/ToastContext';
import { formatDateTime } from '@utils/date';
import { formatPhone, onlyDigits } from '@utils/validation';
import { Card, CardContent, Container, Input, Button, Badge } from '@components/ui';
import { EmptyState, PageSpinner } from '@components/Dashboard';
import { SuperAdminHeader } from '@layouts/SuperAdminLayout';
import { PhoneInput } from '@components/PhoneInput';
import { UserPlusIcon } from '@components/icons';

interface Owner {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

/**
 * Tela de proprietários.
 *
 * Existe porque a instalação começa sem dono: é o superadmin quem cria o
 * primeiro. Sem esta tela, quem instala teria que mexer no banco direto ou
 * esperar o primeiro cliente aparecer — e sem dono o cliente não tem nem o
 * que agendar.
 */
export function SuperAdminOwnersPage() {
  const { showToast } = useToast();
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [mostrarForm, setMostrarForm] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const carregar = async () => {
    try {
      const res = await superadminApi.getOwners();
      setOwners(res.owners);
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const digitos = onlyDigits(phone);
    if (digitos.length < 10) {
      setError('Telefone incompleto');
      return;
    }
    if (password.length < 6) {
      setError('A senha precisa de pelo menos 6 caracteres');
      return;
    }

    setSaving(true);
    try {
      await superadminApi.createOwner({ name, email, phone: digitos, password });
      showToast({
        type: 'success',
        title: 'Proprietário criado',
        message: 'Ele já pode entrar com e-mail e senha.',
      });
      setName('');
      setEmail('');
      setPhone('');
      setPassword('');
      setMostrarForm(false);
      await carregar();
    } catch (err: any) {
      setError(err.message || 'Não foi possível criar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageSpinner />;

  const semDono = owners.length === 0;

  return (
    <Container size="full" className="!px-0">
      <SuperAdminHeader
        title="Proprietários"
        description={
          semDono
            ? 'Nenhum dono cadastrado — o sistema não abre sem este passo'
            : `${owners.length} proprietário${owners.length !== 1 ? 's' : ''} com acesso ao painel`
        }
        action={
          !mostrarForm ? (
            <Button variant="solid" onClick={() => { setMostrarForm(true); setError(''); }}>
              <UserPlusIcon className="w-4 h-4 mr-2" />
              Novo proprietário
            </Button>
          ) : undefined
        }
      />

      {semDono && !mostrarForm && (
        <Card className="mb-6 border-l-2 border-l-brand-black">
          <CardContent>
            <p className="font-display font-semibold text-body mb-2">
              Comece por aqui
            </p>
            <p className="text-body-sm text-brand-grayMid mb-6">
              O proprietário é quem administra o salão: cadastra serviços, contrata
              profissionais e atende os agendamentos. Enquanto não existir um, o site
              fica no ar mas não há quem cuide dele.
            </p>
            <Button variant="solid" size="lg" onClick={() => setMostrarForm(true)}>
              Criar o primeiro proprietário
            </Button>
          </CardContent>
        </Card>
      )}

      {mostrarForm && (
        <Card className="mb-6">
          <div className="px-5 md:px-6 py-4 border-b border-brand-gray">
            <h2 className="font-display font-semibold text-body">
              {semDono ? 'Primeiro proprietário' : 'Novo proprietário'}
            </h2>
            <p className="text-caption text-brand-grayMid mt-0.5">
              A senha é guardada como hash — não existe como consultá-la depois
            </p>
          </div>
          <CardContent>
            <form onSubmit={submit} className="space-y-5 max-w-md">
              <Input
                label="Nome"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(''); }}
                placeholder="Nome completo"
                required
                disabled={saving}
              />
              <Input
                label="E-mail"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                placeholder="dono@exemplo.com"
                autoComplete="off"
                required
                disabled={saving}
              />
              <PhoneInput
                label="Telefone (WhatsApp)"
                value={phone}
                onChange={(v) => { setPhone(v); setError(''); }}
                required
                disabled={saving}
              />
              <Input
                label="Senha"
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                placeholder="Mínimo 6 caracteres"
                autoComplete="new-password"
                required
                minLength={6}
                disabled={saving}
              />

              {error && (
                <div
                  className="p-4 bg-red-50 border border-red-200 text-red-700 text-body-sm"
                  role="alert"
                >
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="solid" type="submit" disabled={saving}>
                  {saving ? 'Criando...' : 'Criar proprietário'}
                </Button>
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => { setMostrarForm(false); setError(''); }}
                  disabled={saving}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {owners.length > 0 && (
        <Card>
          <div className="px-5 md:px-6 py-4 border-b border-brand-gray">
            <h2 className="font-display font-semibold text-body">Proprietários cadastrados</h2>
          </div>
          <ul>
            {owners.map((owner) => (
              <li
                key={owner.id}
                className="px-5 md:px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 border-b border-brand-gray last:border-b-0"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-display font-medium text-body truncate">{owner.name}</p>
                    <Badge variant={owner.isActive ? 'muted' : 'outline'}>
                      {owner.isActive ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                  <p className="text-caption text-brand-grayMid mt-1 truncate">
                    {owner.email || 'sem e-mail'} &middot; {formatPhone(owner.phone)}
                  </p>
                </div>

                <div className="text-caption text-brand-grayMid sm:text-right flex-shrink-0">
                  <p>
                    Criado em {formatDateTime(owner.createdAt).split(' ')[0]}
                  </p>
                  <p className="mt-0.5">
                    {owner.lastLoginAt
                      ? `Último acesso ${formatDateTime(owner.lastLoginAt)}`
                      : 'Nunca entrou no painel'}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {owners.length === 0 && !mostrarForm && !semDono && (
        <EmptyState title="Nenhum proprietário" description="Crie o primeiro para liberar o sistema." />
      )}
    </Container>
  );
}

export default SuperAdminOwnersPage;
