import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { PhoneInput } from '@components/PhoneInput';
import { useAuth } from '@hooks/useAuth';
import { useToast } from '@contexts/ToastContext';
import { formatPhone, onlyDigits } from '@utils/validation';
import { Button, Card, CardContent, Container, Section, Input, Separator } from '@components/ui';

type UserType = 'client' | 'owner' | 'employee';

const TABS: { key: UserType; label: string }[] = [
  { key: 'client', label: 'Cliente' },
  { key: 'owner', label: 'Proprietário' },
  { key: 'employee', label: 'Funcionário' },
];

function CodeInput({
  value,
  onChange,
  onComplete,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: () => void;
  disabled?: boolean;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  const setDigit = (index: number, raw: string) => {
    const digit = raw.replace(/\D/g, '').slice(-1);
    const next = value.split('');
    while (next.length < 6) next.push('');
    next[index] = digit;
    const joined = next.join('').slice(0, 6);
    onChange(joined);
    if (digit && index < 5) refs.current[index + 1]?.focus();
    if (joined.length === 6) onComplete?.();
  };

  return (
    <div className="flex justify-center gap-3">
      {Array.from({ length: 6 }, (_, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          disabled={disabled}
          value={value[i] || ''}
          onChange={(e) => setDigit(i, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !value[i] && i > 0) {
              e.preventDefault();
              refs.current[i - 1]?.focus();
            }
          }}
          onPaste={(e) => {
            e.preventDefault();
            const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
            onChange(digits);
            refs.current[Math.min(digits.length, 5)]?.focus();
            if (digits.length === 6) onComplete?.();
          }}
          className="w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl sm:text-3xl font-display font-bold
                     border-2 border-brand-gray rounded-none
                     focus:border-brand-black focus:outline-none focus:ring-0
                     disabled:bg-brand-grayLight disabled:cursor-not-allowed
                     transition-colors duration-fast"
          aria-label={`Dígito ${i + 1}`}
        />
      ))}
    </div>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { requestClientCode, verifyClientCode, loginOwner, loginEmployee } = useAuth();
  const { showToast } = useToast();

  const [userType, setUserType] = useState<UserType>('client');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);

  const from = (location.state as any)?.from?.pathname;

  useEffect(() => {
    setError(null);
    setDevCode(null);
    setCode('');
  }, [userType]);

  // ---------------------------------------------------------------- cliente
  const handlePhoneSubmit = async (phoneValue: string) => {
    const digits = onlyDigits(phoneValue);
    if (digits.length < 10) {
      setError('Digite um telefone válido com DDD');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const codeFromDev = await requestClientCode(digits);
      setPhone(digits);
      setDevCode(codeFromDev);
      setStep('code');
      if (codeFromDev) {
        setCode(codeFromDev);
        showToast({ type: 'info', title: `Código: ${codeFromDev}`, message: 'Ambiente de desenvolvimento' });
      } else {
        showToast({ type: 'info', title: 'Código enviado', message: 'Verifique seu WhatsApp' });
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar código');
    } finally {
      setLoading(false);
    }
  };

  const handleCodeSubmit = async () => {
    if (code.length !== 6) {
      setError('O código tem 6 dígitos');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await verifyClientCode(phone, code);
      showToast({ type: 'success', title: 'Login realizado com sucesso!' });
      navigate(from || '/meus-agendamentos', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Código inválido');
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setLoading(true);
    setError(null);
    try {
      const codeFromDev = await requestClientCode(phone);
      setDevCode(codeFromDev);
      if (codeFromDev) setCode(codeFromDev);
      showToast({ type: 'info', title: 'Novo código enviado' });
    } catch (err: any) {
      setError(err.message || 'Erro ao reenviar código');
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------------------ dono
  const handleOwnerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await loginOwner(email, password);
      showToast({ type: 'success', title: 'Bem-vindo ao painel!' });
      navigate('/owner/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.message || 'E-mail ou senha inválidos');
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------------ funcionário
  const handleEmployeeLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await loginEmployee(accessCode);
      showToast({ type: 'success', title: 'Bem-vindo!' });
      navigate('/funcionario/agenda', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Código de acesso inválido');
    } finally {
      setLoading(false);
    }
  };

  return (
    // min-h-screen no wrapper (não no Section) para centralizar sem
    // brigar com o padding que o Section já aplica.
    <div className="min-h-screen flex items-center">
      <Section size="sm" className="w-full flex items-center justify-center">
      <Container size="sm">
        <Card variant="padded">
          <CardContent>
            {/* Logo */}
            <div className="text-center mb-10">
              <span className="font-display font-bold text-display-sm tracking-tight">MR. CUT</span>
              <p className="text-body-sm text-brand-grayMid mt-2">Acesse sua conta</p>
            </div>

            {/* Tabs */}
            <div className="tabs mb-8" role="tablist">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={userType === tab.key}
                  onClick={() => {
                    setUserType(tab.key);
                    setStep('phone');
                    setError(null);
                  }}
                  className={`tab ${userType === tab.key ? 'tab-active' : 'tab-inactive'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-body-sm text-center" role="alert">
                {error}
              </div>
            )}

            {/* ------------------------------------------------------------ CLIENTE */}
            {userType === 'client' && step === 'phone' && (
              <div className="space-y-6">
                <PhoneInput
                  label="Telefone (WhatsApp)"
                  value={phone}
                  onChange={(v) => { setPhone(v); setError(null); }}
                  required
                  error={error || undefined}
                  onEnterPress={() => handlePhoneSubmit(phone)}
                />
                <Button variant="solid" size="lg" className="w-full" disabled={loading} onClick={() => handlePhoneSubmit(phone)}>
                  {loading ? 'Enviando...' : 'Enviar código'}
                </Button>
              </div>
            )}

            {userType === 'client' && step === 'code' && (
              <div className="space-y-6">
                <div className="text-center">
                  <p className="text-body-sm text-brand-grayMid">Código enviado para</p>
                  <p className="font-display font-semibold text-body-lg mt-1">{formatPhone(phone)}</p>
                </div>

                {devCode && (
                  <div className="p-4 bg-brand-grayLight border border-brand-gray text-center">
                    <p className="text-caption text-brand-grayMid">
                      <strong>Modo desenvolvimento</strong> — o código foi preenchido automaticamente e
                      também aparece no terminal do backend.
                    </p>
                  </div>
                )}

                <CodeInput value={code} onChange={setCode} onComplete={handleCodeSubmit} disabled={loading} />

                <Button variant="solid" size="lg" className="w-full" disabled={loading || code.length !== 6} onClick={handleCodeSubmit}>
                  {loading ? 'Verificando...' : 'Confirmar'}
                </Button>

                <div className="flex items-center justify-between text-body-sm">
                  <button type="button" onClick={handleResend} disabled={loading} className="btn-minimal">
                    Reenviar código
                  </button>
                  <button type="button" onClick={() => { setStep('phone'); setCode(''); setError(null); }} className="btn-minimal">
                    Trocar número
                  </button>
                </div>
              </div>
            )}

            {/* --------------------------------------------------------------- DONO */}
            {userType === 'owner' && (
              <form onSubmit={handleOwnerLogin} className="space-y-5">
                <Input
                  label="E-mail"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="seu@email.com"
                />
                <Input
                  label="Senha"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••"
                />
                <Button variant="solid" size="lg" type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Entrando...' : 'Entrar'}
                </Button>
              </form>
            )}

            {/* ------------------------------------------------------- FUNCIONÁRIO */}
            {userType === 'employee' && (
              <form onSubmit={handleEmployeeLogin} className="space-y-6">
                <p className="text-body-sm text-brand-grayMid text-center">
                  Digite o código de acesso de 6 dígitos recebido do salão
                </p>
                <div>
                  <label htmlFor="emp-code" className="field-label">Código de acesso</label>
                  <input
                    id="emp-code"
                    type="text"
                    inputMode="numeric"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    maxLength={6}
                    autoComplete="one-time-code"
                    className="w-full bg-transparent border-none border-b-2 border-brand-gray
                               px-0 py-3 text-center text-3xl sm:text-4xl font-display font-bold
                               tracking-[0.3em] text-brand-black placeholder:text-brand-grayMid
                               focus:border-brand-black focus:outline-none focus:ring-0
                               transition-colors duration-fast"
                    placeholder="000000"
                  />
                </div>
                <Button variant="solid" size="lg" type="submit" className="w-full" disabled={loading || accessCode.length !== 6}>
                  {loading ? 'Entrando...' : 'Entrar'}
                </Button>
              </form>
            )}

            <Separator className="my-8" />
            <p className="text-caption text-brand-grayMid text-center">
              MR. CUT — Barbearia Premium
            </p>
          </CardContent>
        </Card>
      </Container>
      </Section>
    </div>
  );
}

export default LoginPage;