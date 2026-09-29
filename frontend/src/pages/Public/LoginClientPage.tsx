import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { PhoneInput } from '@components/PhoneInput';
import { authApi } from '@services/api';
import { useAuth } from '@hooks/useAuth';
import { useToast } from '@contexts/ToastContext';

export function LoginClientPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { requestClientCode, verifyClientCode } = useAuth();
  const { showToast } = useToast();
  
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = (location.state as any)?.from?.pathname || '/meus-agendamentos';

  const handlePhoneSubmit = async (phoneValue: string) => {
    setLoading(true);
    setError(null);
    try {
      await requestClientCode(phoneValue);
      setPhone(phoneValue);
      setStep('code');
      showToast({ type: 'info', title: 'Código enviado', message: 'Verifique seu WhatsApp' });
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar código');
    } finally {
      setLoading(false);
    }
  };

  const handleCodeSubmit = async () => {
    if (code.length !== 6) {
      setError('Código deve ter 6 dígitos');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await verifyClientCode(phone, code);
      showToast({ type: 'success', title: 'Login realizado!' });
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Código inválido');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setLoading(true);
    setError(null);
    try {
      await requestClientCode(phone);
      showToast({ type: 'info', title: 'Novo código enviado' });
    } catch (err: any) {
      setError(err.message || 'Erro ao reenviar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Entrar como Cliente</h1>
          <p className="text-gray-600 mt-2">Digite seu telefone para receber o código via WhatsApp</p>
        </div>

        {step === 'phone' ? (
          <div className="space-y-6">
            <PhoneInput
              label="Telefone (WhatsApp)"
              value={phone}
              onChange={setPhone}
              required
              error={error}
              onEnterPress={() => handlePhoneSubmit(phone)}
            />
            <button
              onClick={() => handlePhoneSubmit(phone)}
              disabled={loading}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium disabled:opacity-50"
            >
              {loading ? 'Enviando...' : 'Enviar Código'}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-gray-600">Enviamos um código para</p>
              <p className="font-medium text-gray-900">({phone.slice(0,2)}) {phone.slice(2,7)}-{phone.slice(7)}</p>
            </div>

            <div className="flex gap-3">
              {Array.from({ length: 6 }, (_, i) => (
                <input
                  key={i}
                  type="text"
                  maxLength={1}
                  value={code[i] || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^\d*$/.test(val)) {
                      const newCode = code.split('');
                      newCode[i] = val;
                      setCode(newCode.join(''));
                      if (val && i < 5) {
                        (document.querySelectorAll('input[type="text"]')[i + 1] as HTMLInputElement)?.focus();
                      }
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && !code[i] && i > 0) {
                      (document.querySelectorAll('input[type="text"]')[i - 1] as HTMLInputElement)?.focus();
                    }
                  }}
                  className="w-12 h-12 text-center text-2xl font-medium border-2 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                  inputMode="numeric"
                />
              ))}
            </div>

            {error && (
              <p className="text-center text-red-600 text-sm" role="alert">{error}</p>
            )}

            <button
              onClick={handleCodeSubmit}
              disabled={loading || code.length !== 6}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium disabled:opacity-50"
            >
              {loading ? 'Verificando...' : 'Confirmar'}
            </button>

            <button
              onClick={handleResendCode}
              disabled={loading}
              className="w-full py-2 text-gray-600 hover:text-gray-900 font-medium"
            >
              Não recebeu? Reenviar código
            </button>

            <button
              onClick={() => setStep('phone')}
              className="w-full py-2 text-gray-500 hover:text-gray-700 font-medium"
            >
              ← Voltar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}