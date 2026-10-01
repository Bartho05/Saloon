import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { superadminApi } from '@services/api';
import { useAuth } from '@hooks/useAuth';
import { useToast } from '@contexts/ToastContext';
import { Button, Card, CardContent, Input, Separator } from '@components/ui';
import { DevCredits } from '@components/DevCredits';

/**
 * Marca do painel de administração.
 *
 * Não é o `SalonBrand`: o superadmin controla a instalação, não um salão. Ver
 * a nota em `SuperAdminLayout`.
 */
function BrandMark({ center = false }: { center?: boolean }) {
  return (
    <p className={`font-display font-bold tracking-tight ${center ? 'text-center' : ''}`}>
      Administração
    </p>
  );
}

/**
 * Campo de código do superadmin.
 *
 * O código tem 24 caracteres em grupos de 4. Campo de texto comum em vez dos
 * 6 quadradinhos do WhatsApp: digitar 24 caracteres em seis caixinhas de um
 * dígito seria lento, e é o superadmin — ele digita esse código com
 * frequência, não uma vez por sessão de cliente.
 */
function CodeField({
  value,
  onChange,
  disabled,
  onEnter,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  onEnter: () => void;
}) {
  // Só maiúsculas e sem espaços por dentro: o agrupamento é cosmetic.
  const clean = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

  // Reagrupa em blocos de 4 para o campo poder continuar sendo <input>.
  const grouped = clean.match(/.{1,4}/g)?.join(' ') ?? '';

  return (
    <Input
      label="Código de acesso"
      type="text"
      value={grouped}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onEnter();
      }}
      placeholder="XXXX XXXX XXXX XXXX XXXX XXXX"
      autoComplete="off"
      spellCheck={false}
      className="font-display tracking-widest"
      disabled={disabled}
      // O campo aceita o valor reagrupado, que tem espaços a mais que o
      // limite de caracteres padrão.
      maxLength={29}
      required
    />
  );
}

/**
 * Tela que mostra o código uma única vez.
 *
 * Não existe como recuperar depois: o servidor guarda só o hash. Por isso a
 * tela insiste em três coisas — mostrar, copiar, e avisar que rotacionar é a
 * saída se perder.
 */
function CodeReveal({
  code,
  onDone,
  context,
}: {
  code: string;
  onDone: () => void;
  context: string;
}) {
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
        message: 'Selecione o código e copie manualmente.',
      });
    }
  };

  return (
    <Card>
      <CardContent>
        <div className="text-center mb-8">
          <BrandMark center />
          <h1 className="font-display font-bold text-display-sm mt-6">Anote seu código</h1>
          <p className="text-body-sm text-brand-grayMid mt-2">{context}</p>
        </div>

        <div className="border-2 border-brand-black p-6 text-center mb-4">
          <p className="font-display font-bold text-display-sm tracking-widest select-all">
            {code.replace(/(.{4})/g, '$1 ').trim()}
          </p>
        </div>

        <div className="bg-brand-grayLight border-l-2 border-brand-black p-4 mb-6">
          <p className="text-body-sm">
            <strong>Este código aparece uma única vez.</strong> O servidor guarda apenas um
            hash dele — não existe como ler de volta, nem por ele mesmo. Se perder, a
            única forma de entrar de novo é gerar um novo.
          </p>
        </div>

        <Button variant="solid" size="lg" className="w-full" onClick={copiar}>
          {copied ? 'Copiado' : 'Copiar código'}
        </Button>
        <Button variant="ghost" className="w-full mt-2" onClick={onDone}>
          Já anotei, continuar
        </Button>
      </CardContent>
    </Card>
  );
}

export function SuperAdminLoginPage() {
  const navigate = useNavigate();
  const { loginSuperAdmin } = useAuth();
  const { showToast } = useToast();

  const [mode, setMode] = useState<'loading' | 'login' | 'bootstrap'>('loading');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [seed, setSeed] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    superadminApi
      .getBootstrapStatus()
      .then((res) => {
        if (!cancelled) setMode(res.hasSuperAdmin ? 'login' : 'bootstrap');
      })
      .catch(() => {
        if (!cancelled) setMode('login');
      });

    return () => { cancelled = true; };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await loginSuperAdmin(email, code);
      showToast({ type: 'success', title: 'Acesso autorizado' });
      navigate('/superadmin', { replace: true });
    } catch (err: any) {
      setError(err.message || 'E-mail ou código inválido');
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleBootstrap = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await superadminApi.bootstrap({ name, email, seed });
      // O código só existe nesta resposta. Nenhuma tela depois mostra ele.
      setCreatedCode(res.accessCode);
    } catch (err: any) {
      setError(err.message || 'Não foi possível criar o acesso');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center">
      <div className="w-full max-w-md mx-auto px-4 py-12">
        {mode === 'loading' && (
          <div className="text-center text-body-sm text-brand-grayMid py-16">
            Verificando a instalação…
          </div>
        )}

        {createdCode && (
          <CodeReveal
            code={createdCode}
            context="Primeiro acesso de superadmin criado."
            onDone={() => {
              setCreatedCode(null);
              setMode('login');
            }}
          />
        )}

        {mode === 'login' && !createdCode && (
          <Card>
            <CardContent>
              <div className="text-center mb-8">
                <BrandMark center />
                <h1 className="font-display font-bold text-display-sm mt-6">
                  Acesso do administrador
                </h1>
                <p className="text-body-sm text-brand-grayMid mt-2">
                  Controle total da instalação
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                <Input
                  label="E-mail"
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  placeholder="admin@exemplo.com"
                  autoComplete="username"
                  required
                  disabled={loading}
                />
                <CodeField
                  value={code}
                  onChange={(v) => { setCode(v); setError(''); }}
                  disabled={loading}
                  onEnter={() => handleLogin(new Event('submit') as unknown as React.FormEvent)}
                />

                {error && (
                  <div
                    className="p-4 bg-red-50 border border-red-200 text-red-700 text-body-sm"
                    role="alert"
                  >
                    {error}
                  </div>
                )}

                <Button
                  variant="solid"
                  size="lg"
                  className="w-full"
                  type="submit"
                  disabled={loading || code.replace(/\s/g, '').length < 8}
                >
                  {loading ? 'Verificando...' : 'Entrar'}
                </Button>
              </form>

              <Separator className="my-8" />
              <p className="text-caption text-brand-grayMid">
                O código é o mesmo do primeiro acesso. Cinco tentativas erradas travam a conta
                por alguns minutos.
              </p>
              <DevCredits className="mt-3" />
            </CardContent>
          </Card>
        )}

        {mode === 'bootstrap' && !createdCode && (
          <Card>
            <CardContent>
              <div className="text-center mb-8">
                <BrandMark center />
                <h1 className="font-display font-bold text-display-sm mt-6">
                  Instalar o primeiro acesso
                </h1>
                <p className="text-body-sm text-brand-grayMid mt-2">
                  Nenhum administrador existe ainda
                </p>
              </div>

              <form onSubmit={handleBootstrap} className="space-y-5">
                <Input
                  label="Seu nome"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setError(''); }}
                  placeholder="Nome do administrador"
                  required
                  disabled={loading}
                />
                <Input
                  label="E-mail"
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  placeholder="admin@exemplo.com"
                  autoComplete="username"
                  required
                  disabled={loading}
                />
                <Input
                  label="Semente de instalação"
                  type="password"
                  value={seed}
                  onChange={(e) => { setSeed(e.target.value); setError(''); }}
                  placeholder="Valor definido no servidor"
                  autoComplete="off"
                  required
                  disabled={loading}
                />

                <div className="bg-brand-grayLight border-l-2 border-brand-black p-4 text-body-sm">
                  A semente é a única autorização para criar o primeiro acesso. Ela fica
                  no arquivo de ambiente do servidor — se ainda não houver uma lá, este
                  formulário não funciona, por desenho.
                </div>

                {error && (
                  <div
                    className="p-4 bg-red-50 border border-red-200 text-red-700 text-body-sm"
                    role="alert"
                  >
                    {error}
                  </div>
                )}

                <Button
                  variant="solid"
                  size="lg"
                  className="w-full"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? 'Criando...' : 'Criar acesso'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default SuperAdminLoginPage;
