import { useState, useEffect } from 'react';
import { employeeApi } from '@services/api';
import { useToast } from '@contexts/ToastContext';

export function EmployeeProfilePage() {
  const { showToast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const res = await employeeApi.getProfile();
      setProfile(res.employee);
    } catch (err: any) {
      showToast({ type: 'error', title: 'Erro', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      showToast({ type: 'success', title: 'Copiado!', message: 'Código de acesso copiado' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast({ type: 'error', title: 'Erro', message: 'Não foi possível copiar' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-brand-black border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-brand-black">Meu Perfil</h1>

      {/* Profile Card */}
      <div className="bg-brand-white  border border-brand-gray p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-20 h-20 bg-brand-gray rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-brand-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-brand-black">{profile?.name || 'Funcionário'}</h2>
            <p className="text-brand-grayMid">Profissional do Salão</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-brand-grayLight ">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-brand-grayMid" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <div>
                <p className="text-sm text-brand-grayMid">Telefone</p>
                <p className="font-medium text-brand-black">{profile?.phone || 'Não informado'}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-brand-grayLight ">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-brand-grayMid" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <div>
                <p className="text-sm text-brand-grayMid">Código de Acesso</p>
                <div className="flex items-center gap-2">
                  <code className="font-mono text-lg font-bold text-brand-black bg-brand-gray px-3 py-1 rounded">{profile?.accessCode || '------'}</code>
                  <button
                    onClick={() => copyToClipboard(profile?.accessCode || '')}
                    className={`p-2  transition-colors ${copied ? 'bg-green-50 text-green-700' : 'bg-brand-gray text-brand-grayMid hover:bg-gray-200'}`}
                    aria-label={copied ? 'Copiado!' : 'Copiar código'}
                  >
                    {copied ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 012-2h10a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V5z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {profile?.specialties && profile.specialties.length > 0 && (
            <div className="flex items-start gap-3 p-4 bg-brand-grayLight ">
              <svg className="w-5 h-5 text-brand-grayMid mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 3.101v3.867M9 14.25v2.25m-2.247-3.375l1.515 1.515m0 0l1.515 1.516m-1.515-1.515l-1.515 1.515M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <div>
                <p className="text-sm text-brand-grayMid">Especialidades</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {profile.specialties.map((spec: string) => (
                    <span key={spec} className="px-2 py-1 text-sm bg-brand-gray text-brand-black rounded-full">
                      {spec}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 p-4 bg-brand-grayLight ">
            <svg className="w-5 h-5 text-brand-grayMid" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm text-brand-grayMid">Cadastrado em</p>
              <p className="font-medium text-brand-black">{profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('pt-BR') : '-'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Help Card */}
      <div className="bg-brand-grayLight border border-brand-gray  p-6">
        <h3 className="font-semibold text-brand-black mb-2 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Como acessar sua agenda
        </h3>
        <div className="space-y-2 text-sm text-brand-black">
          <p>1. Acesse o site do salão</p>
          <p>2. Clique em "Entrar" → "Funcionário"</p>
          <p>3. Digite seu código de acesso: <strong className="font-mono">{profile?.accessCode || '------'}</strong></p>
          <p>4. Você verá sua agenda e poderá atualizar status dos agendamentos</p>
        </div>
        <p className="text-xs text-brand-black mt-3">
          ⚠️ Guarde seu código com segurança. Não compartilhe com ninguém.
        </p>
      </div>
    </div>
  );
}