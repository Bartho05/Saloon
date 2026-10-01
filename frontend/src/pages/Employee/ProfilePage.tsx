import { useState, useEffect } from 'react';
import { employeeApi, uploadApi } from '@services/api';
import { useToast } from '@contexts/ToastContext';
import { formatPhone } from '@utils/validation';
import { Container, Card, CardContent, Button } from '@components/ui';
import { PageHeader, PageSpinner } from '@components/Dashboard';
import { ImageUpload } from '@components/ImageUpload';
import { PhoneIcon, ShieldIcon, CopyIcon, CheckIcon, ClockIcon } from '@components/icons';

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
      showToast({ type: 'success', title: 'Código copiado' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast({ type: 'error', title: 'Erro', message: 'Não foi possível copiar' });
    }
  };

  if (loading) return <PageSpinner />;

  return (
    <Container size="full" className="!px-0">
      <PageHeader title="Meu Perfil" description="Seus dados e código de acesso" />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Identificação */}
        <Card className="lg:col-span-1">
          <CardContent>
            <div className="flex flex-col items-center text-center pb-6 border-b border-brand-gray">
              {profile?.photoUrl ? (
                <img
                  src={profile.photoUrl}
                  alt={`Foto de ${profile?.name || 'funcionário'}`}
                  className="w-20 h-20 object-cover mb-4"
                />
              ) : (
                <div className="w-20 h-20 bg-brand-black text-brand-white flex items-center justify-center font-display font-bold text-display-md mb-4">
                  {(profile?.name || '?').charAt(0).toUpperCase()}
                </div>
              )}
              <h2 className="font-display font-bold text-display-sm">{profile?.name || 'Funcionário'}</h2>
              <p className="text-caption text-brand-grayMid mt-1">Profissional do salão</p>
            </div>

            <dl className="space-y-5 pt-6">
              <div className="flex items-start gap-3">
                <PhoneIcon className="w-4 h-4 text-brand-grayMid mt-0.5 flex-shrink-0" />
                <div>
                  <dt className="text-caption text-brand-grayMid">Telefone</dt>
                  <dd className="text-body-sm mt-0.5">
                    {profile?.phone ? formatPhone(profile.phone) : 'Não informado'}
                  </dd>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <ClockIcon className="w-4 h-4 text-brand-grayMid mt-0.5 flex-shrink-0" />
                <div>
                  <dt className="text-caption text-brand-grayMid">Cadastrado em</dt>
                  <dd className="text-body-sm mt-0.5">
                    {profile?.createdAt
                      ? new Date(profile.createdAt).toLocaleDateString('pt-BR')
                      : '-'}
                  </dd>
                </div>
              </div>
            </dl>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          {/* Código de acesso */}
          <Card>
            <div className="px-5 md:px-6 py-4 border-b border-brand-gray flex items-center gap-2">
              <ShieldIcon className="w-4 h-4 text-brand-grayMid" />
              <h3 className="font-display font-semibold text-body">Código de acesso</h3>
            </div>
            <CardContent>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-mono text-3xl font-bold tracking-[0.3em]">{profile?.accessCode || '------'}</p>
                  <p className="text-caption text-brand-grayMid mt-2">
                    Use este código em "Entrar" &rarr; "Funcionário" para acessar sua agenda.
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => copyToClipboard(profile?.accessCode || '')}
                >
                  {copied ? <CheckIcon className="w-4 h-4" /> : <CopyIcon className="w-4 h-4" />}
                  {copied ? 'Copiado' : 'Copiar'}
                </Button>
              </div>
              <p className="text-caption text-brand-grayMid mt-5 pt-5 border-t border-brand-gray">
                Guarde o código com segurança. Se suspeitar que alguém teve acesso, peça ao
                proprietário para gerar um novo.
              </p>
            </CardContent>
          </Card>

          {/* Foto do rosto */}
          <Card>
            <div className="px-5 md:px-6 py-4 border-b border-brand-gray">
              <h3 className="font-display font-semibold text-body">Minha foto</h3>
              <p className="text-caption text-brand-grayMid mt-0.5">
                É a foto que o cliente vê ao escolher você.
              </p>
            </div>
            <CardContent>
              <ImageUpload
                label=""
                shape="circle"
                value={profile?.photoUrl ?? null}
                onUpload={async (file) => {
                  await uploadApi.myPhoto(file);
                  const res = await employeeApi.getProfile();
                  setProfile(res.employee);
                  showToast({ type: 'success', title: 'Foto atualizada' });
                }}
                onRemove={async () => {
                  const res = await uploadApi.removeMyPhoto();
                  setProfile(res.employee);
                  showToast({ type: 'success', title: 'Foto removida' });
                }}
                hint="Uma foto boa e nítida gera mais confiança no agendamento. JPEG, PNG ou WEBP, até 4MB."
              />
            </CardContent>
          </Card>

          {/* Especialidades */}
          <Card>
            <div className="px-5 md:px-6 py-4 border-b border-brand-gray">
              <h3 className="font-display font-semibold text-body">Especialidades</h3>
            </div>
            <CardContent>
              {profile?.specialties?.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {profile.specialties.map((spec: string) => (
                    <span key={spec} className="badge badge-muted">{spec}</span>
                  ))}
                </div>
              ) : (
                <p className="text-body-sm text-brand-grayMid">
                  Nenhuma especialidade definida. Fale com o proprietário.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Container>
  );
}

export default EmployeeProfilePage;
