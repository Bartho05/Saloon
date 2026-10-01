import { useState, useEffect } from 'react';
import { salonApi, uploadApi } from '@services/api';
import { useToast } from '@contexts/ToastContext';
import { formatPhone } from '@utils/validation';
import { Container, Card, CardContent, Button, Input, Textarea } from '@components/ui';
import { PageHeader, PageSpinner } from '@components/Dashboard';
import { ImageUpload } from '@components/ImageUpload';
import { PhoneIcon, MailIcon, MapPinIcon, ClockIcon } from '@components/icons';

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

/**
 * Dados do salão vistos pelo funcionário.
 *
 * Edita apenas a identidade (nome, telefone, e-mail, endereço, descrição e
 * logo). Os parâmetros de operação — horários, intervalo entre
 * atendimentos, cancelamento, WhatsApp — ficam com o proprietário, porque
 * afetam a agenda de todos.
 */
export function EmployeeSalonPage() {
  const { showToast } = useToast();
  const [settings, setSettings] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    description: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await salonApi.get();
        setSettings(res.settings);
        setFormData({
          name: res.settings.name || '',
          phone: res.settings.phone || '',
          email: res.settings.email || '',
          address: res.settings.address || '',
          description: res.settings.description || '',
        });
      } catch (err: any) {
        showToast({ type: 'error', title: 'Erro', message: err.message });
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [showToast]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await salonApi.update(formData);
      setSettings(res.settings);
      showToast({ type: 'success', title: 'Dados do salão atualizados' });
    } catch (err: any) {
      showToast({ type: 'error', title: 'Erro', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageSpinner />;

  const hours = (settings?.businessHours ?? {}) as Record<string, { open: string; close: string } | null>;

  return (
    <Container size="full" className="!px-0">
      <PageHeader
        title="Salão"
        description="Informações que o cliente vê ao agendar"
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardContent>
            <p className="field-label mb-3">Logo</p>
            <ImageUpload
              label=""
              shape="wide"
              value={settings?.logoUrl ?? null}
              onUpload={async (file) => {
                await uploadApi.employeeSalonLogo(file);
                const res = await salonApi.get();
                setSettings(res.settings);
                showToast({ type: 'success', title: 'Logo atualizada' });
              }}
              hint="Proporção horizontal funciona melhor. JPEG, PNG ou WEBP, até 4MB."
            />

            <div className="mt-8 pt-6 border-t border-brand-gray space-y-5">
              <div className="flex items-start gap-3">
                <PhoneIcon className="w-4 h-4 text-brand-grayMid mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-caption text-brand-grayMid">Telefone</p>
                  <p className="text-body-sm mt-0.5">
                    {settings?.phone ? formatPhone(settings.phone) : 'Não informado'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MailIcon className="w-4 h-4 text-brand-grayMid mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-caption text-brand-grayMid">E-mail</p>
                  <p className="text-body-sm mt-0.5 break-all">{settings?.email || 'Não informado'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPinIcon className="w-4 h-4 text-brand-grayMid mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-caption text-brand-grayMid">Endereço</p>
                  <p className="text-body-sm mt-0.5">{settings?.address || 'Não informado'}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <Card>
            <div className="px-5 md:px-6 py-4 border-b border-brand-gray">
              <h3 className="font-display font-semibold text-body">Editar dados</h3>
            </div>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-5">
                <Input
                  label="Nome do salão"
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                  required
                />

                <div className="grid sm:grid-cols-2 gap-5">
                  <Input
                    label="Telefone (WhatsApp)"
                    type="tel"
                    inputMode="numeric"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, phone: e.target.value.replace(/\D/g, '').slice(0, 11) }))
                    }
                    placeholder="31999999999"
                  />
                  <Input
                    label="E-mail"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                    placeholder="contato@salon.com.br"
                  />
                </div>

                <Input
                  label="Endereço"
                  value={formData.address}
                  onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))}
                  placeholder="Rua, número — bairro, cidade"
                />

                <Textarea
                  label="Descrição"
                  value={formData.description}
                  onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                  rows={3}
                  placeholder="Um texto curto sobre o salão, exibido ao cliente."
                  hint="Aparece na página inicial."
                />

                <Button type="submit" disabled={saving} loading={saving}>
                  Salvar alterações
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <div className="px-5 md:px-6 py-4 border-b border-brand-gray flex items-center gap-2">
              <ClockIcon className="w-4 h-4 text-brand-grayMid" />
              <h3 className="font-display font-semibold text-body">Horário de funcionamento</h3>
            </div>
            <CardContent>
              <p className="text-caption text-brand-grayMid mb-4">
                Definido pelo proprietário. Define quais horários aparecem na agenda.
              </p>
              <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-2">
                {WEEKDAYS.map((day, i) => {
                  const h = hours[i];
                  return (
                    <li key={day} className="flex items-center justify-between text-body-sm border-b border-brand-gray py-2 last:border-0">
                      <span>{day}</span>
                      <span className={h ? 'font-display' : 'text-brand-grayMid'}>
                        {h ? `${h.open} — ${h.close}` : 'Fechado'}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </Container>
  );
}

export default EmployeeSalonPage;
