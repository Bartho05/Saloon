import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { PhoneInput } from '@components/PhoneInput';
import { useAuth } from '@hooks/useAuth';
import { useToast } from '@contexts/ToastContext';
import { formatPhone, onlyDigits } from '@utils/validation';

type UserType = 'client' | 'owner' | 'employee';

const TABS: { key: UserType; label: string; icon: string }[] = [
  { key: 'client', label: 'Cliente', icon: '👤' },
  { key: 'owner', label: 'Proprietário', icon: '👑' },
  { key: 'employee', label: 'Funcionário', icon: '💼' },
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
    <div className="flex justify-center gap-2">
      {Array.from({ length: 6 }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
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
          className="w-11 h-12 sm:w-12 sm:h-14 text-center text-2xl font-semibold rounded-xl border-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none disabled:bg-gray-100"
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Entrar</h1>
          <p className="text-sm text-gray-600 mt-1">Escolha como você quer acessar</p>
        </div>

        {/* Abas */}
        <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1" role="tablist">
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
              className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                userType === tab.key
                  ? 'bg-white text-blue-600 shadow'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span aria-hidden>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* ------------------------------------------------------------ CLIENTE */}
        {userType === 'client' && step === 'phone' && (
          <div className="space-y-5">
            <p className="text-sm text-gray-600 text-center">
              Digite seu telefone para receber o código de acesso via WhatsApp
            </p>
            <PhoneInput
              label="Telefone (WhatsApp)"
              value={phone}
              onChange={(v) => {
                setPhone(v);
                setError(null);
              }}
              required
              error={error || undefined}
              onEnterPress={() => handlePhoneSubmit(phone)}
            />
            <button
              type="button"
              onClick={() => handlePhoneSubmit(phone)}
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium disabled:opacity-50 transition-colors"
            >
              {loading ? 'Enviando...' : 'Enviar código'}
            </button>
          </div>
        )}

        {userType === 'client' && step === 'code' && (
          <div className="space-y-5">
            <div className="text-center">
              <p className="text-sm text-gray-600">Código enviado para</p>
              <p className="font-semibold text-gray-900 text-lg">{formatPhone(phone)}</p>
            </div>

            {devCode && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-center">
                <p className="text-xs text-amber-800">
                  <strong>Modo desenvolvimento</strong> — o código foi preenchido automaticamente e
                  também aparece no terminal do backend.
                </p>
              </div>
            )}

            <CodeInput value={code} onChange={setCode} onComplete={handleCodeSubmit} disabled={loading} />

            {error && (
              <p className="text-center text-sm text-red-600" role="alert">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={handleCodeSubmit}
              disabled={loading || code.length !== 6}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium disabled:opacity-50 transition-colors"
            >
              {loading ? 'Verificando...' : 'Confirmar'}
            </button>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={handleResend}
                disabled={loading}
                className="text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
              >
                Reenviar código
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep('phone');
                  setCode('');
                  setError(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                Trocar número
              </button>
            </div>
          </div>
        )}

        {/* --------------------------------------------------------------- DONO */}
        {userType === 'owner' && (
          <form onSubmit={handleOwnerLogin} className="space-y-5">
            <div>
              <label htmlFor="owner-email" className="block text-sm font-medium text-gray-700 mb-1">
                E-mail
              </label>
              <input
                id="owner-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                placeholder="seu@email.com"
              />
            </div>
            <div>
              <label htmlFor="owner-password" className="block text-sm font-medium text-gray-700 mb-1">
                Senha
              </label>
              <input
                id="owner-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                placeholder="••••••"
              />
            </div>
            {error && (
              <p className="text-center text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium disabled:opacity-50 transition-colors"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        )}

        {/* ------------------------------------------------------- FUNCIONÁRIO */}
        {userType === 'employee' && (
          <form onSubmit={handleEmployeeLogin} className="space-y-5">
            <p className="text-sm text-gray-600 text-center">
              Digite o código de acesso de 6 dígitos recebido do salão
            </p>
            <div>
              <label htmlFor="emp-code" className="sr-only">
                Código de acesso
              </label>
              <input
                id="emp-code"
                type="text"
                inputMode="numeric"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                maxLength={6}
                autoComplete="one-time-code"
                className="w-full px-4 py-4 border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-center text-3xl tracking-[0.5em] font-semibold"
                placeholder="000000"
              />
            </div>
            {error && (
              <p className="text-center text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading || accessCode.length !== 6}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium disabled:opacity-50 transition-colors"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default LoginPage;
