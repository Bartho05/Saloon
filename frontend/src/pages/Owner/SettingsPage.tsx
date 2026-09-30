import { useState, useEffect } from 'react';
import { ownerApi } from '@services/api';
import { useToast } from '@contexts/ToastContext';
import { PhoneInput } from '@components/PhoneInput';

export function OwnerSettingsPage() {
  const { showToast } = useToast();
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'hours' | 'whatsapp' | 'birthday'>('general');
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    birthdayMessage: '',
    cancellationHours: 2,
    bufferMinutes: 10,
    slotInterval: 30,
  });
  const [businessHours, setBusinessHours] = useState<Record<string, { open: string; close: string } | null>>({
    0: null,
    1: { open: '09:00', close: '19:00' },
    2: { open: '09:00', close: '19:00' },
    3: { open: '09:00', close: '19:00' },
    4: { open: '09:00', close: '19:00' },
    5: { open: '09:00', close: '19:00' },
    6: { open: '09:00', close: '17:00' },
  });
  const [whatsappConfig, setWhatsappConfig] = useState<{
    provider: 'zapi' | 'evolution' | 'meta';
    instanceId: string;
    token: string;
    apiUrl: string;
  }>({
    provider: 'zapi',
    instanceId: '',
    token: '',
    apiUrl: 'https://api.z-api.io',
  });
  const [testPhone, setTestPhone] = useState('');
  const [testingWhatsApp, setTestingWhatsApp] = useState(false);

  const DAYS = [
    { key: 0, name: 'Domingo', short: 'Dom' },
    { key: 1, name: 'Segunda', short: 'Seg' },
    { key: 2, name: 'Terça', short: 'Ter' },
    { key: 3, name: 'Qua', short: 'Qua' },
    { key: 4, name: 'Qui', short: 'Qui' },
    { key: 5, name: 'Sex', short: 'Sex' },
    { key: 6, name: 'Sábado', short: 'Sáb' },
  ];

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await ownerApi.getSettings();
      const s = res.settings;
      setSettings(s);
      setFormData({
        name: s.name || '',
        phone: s.phone || '',
        email: s.email || '',
        address: s.address || '',
        birthdayMessage: s.birthdayMessage || '',
        cancellationHours: s.cancellationHours || 2,
        bufferMinutes: s.bufferMinutes || 10,
        slotInterval: s.slotInterval || 30,
      });
      if (s.businessHours) {
        setBusinessHours(s.businessHours);
      }
      if (s.whatsappApiConfig) {
        setWhatsappConfig(s.whatsappApiConfig);
      }
    } catch (err: any) {
      showToast({ type: 'error', title: 'Erro', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = {
        ...formData,
        businessHours,
      };
      await ownerApi.updateSettings(data);
      showToast({ type: 'success', title: 'Configurações salvas' });
      loadSettings();
    } catch (err: any) {
      showToast({ type: 'error', title: 'Erro', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleWhatsAppSave = async () => {
    setSaving(true);
    try {
      await ownerApi.updateSettings({ whatsappApiConfig: whatsappConfig });
      showToast({ type: 'success', title: 'Configuração WhatsApp salva' });
      loadSettings();
    } catch (err: any) {
      showToast({ type: 'error', title: 'Erro', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleTestWhatsApp = async () => {
    if (!testPhone) {
      showToast({ type: 'error', title: 'Erro', message: 'Digite um telefone para teste' });
      return;
    }
    setTestingWhatsApp(true);
    try {
      const res = await ownerApi.testWhatsApp(testPhone);
      if (res.success) {
        showToast({ type: 'success', title: 'Sucesso', message: res.message });
      } else {
        showToast({ type: 'error', title: 'Erro', message: res.error });
      }
    } catch (err: any) {
      showToast({ type: 'error', title: 'Erro', message: err.message });
    } finally {
      setTestingWhatsApp(false);
    }
  };

  const handleRunBirthdayJob = async () => {
    try {
      await ownerApi.runBirthdayJob();
      showToast({ type: 'success', title: 'Job executado', message: 'Verifique os logs do servidor' });
    } catch (err: any) {
      showToast({ type: 'error', title: 'Erro', message: err.message });
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
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-2xl font-bold text-brand-black">Configurações</h1>

      {/* Tabs */}
      <div className="tabs mb-8" role="tablist" aria-label="Seções das configurações">
        {[
          { key: 'general', label: 'Geral' },
          { key: 'hours', label: 'Horários' },
          { key: 'whatsapp', label: 'WhatsApp' },
          { key: 'birthday', label: 'Aniversários' },
        ].map(tab => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`tab ${activeTab === tab.key ? 'tab-active' : 'tab-inactive'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* General */}
      {activeTab === 'general' && (
        <div className="bg-brand-white  border border-brand-gray p-6 space-y-6">
          <h2 className="text-lg font-semibold text-brand-black">Informações do Salão</h2>
          <div className="space-y-4">
            <div>
              <label className="field-label">Nome do Salão *</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
                className="field-input"
              />
            </div>
            <div>
              <label className="field-label">Telefone</label>
              <PhoneInput
                value={formData.phone}
                onChange={v => setFormData(prev => ({ ...prev, phone: v }))}
                label=""
              />
            </div>
            <div>
              <label className="field-label">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="field-input"
              />
            </div>
            <div>
              <label className="field-label">Endereço</label>
              <textarea
                value={formData.address}
                onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))}
                rows={2}
                className="field-input"
              />
            </div>
          </div>

          <h2 className="text-lg font-semibold text-brand-black border-t pt-6">Parâmetros de Agendamento</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="field-label">Horas para cancelamento</label>
              <input
                type="number"
                value={formData.cancellationHours}
                onChange={e => setFormData(prev => ({ ...prev, cancellationHours: parseInt(e.target.value) || 0 }))}
                min={0}
                max={24}
                className="field-input"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="bufferMinutes">
                Intervalo de folga entre atendimentos (min)
              </label>
              <input
                id="bufferMinutes"
                type="number"
                value={formData.bufferMinutes}
                onChange={e => setFormData(prev => ({ ...prev, bufferMinutes: parseInt(e.target.value) || 0 }))}
                min={0}
                max={60}
                className="field-input"
              />
              <p className="text-xs text-brand-grayMid mt-1.5">
                Tempo que o profissional fica bloqueado <strong>após</strong> o fim de cada serviço.
                Ex.: com 15 min, um corte das 15:00 às 15:30 trava o profissional até 15:45.
              </p>
            </div>
            <div>
              <label className="field-label" htmlFor="slotInterval">
                Intervalo entre horários oferecidos (min)
              </label>
              <input
                id="slotInterval"
                type="number"
                value={formData.slotInterval}
                onChange={e => setFormData(prev => ({ ...prev, slotInterval: parseInt(e.target.value) || 30 }))}
                min={15}
                max={60}
                step={15}
                className="field-input"
              />
              <p className="text-xs text-brand-grayMid mt-1.5">
                De quanto em quanto tempo os horários aparecem para o cliente escolher.
              </p>
            </div>
          </div>

          <button onClick={handleSave} disabled={saving} className="w-full py-3 bg-brand-black text-white  font-medium hover:bg-brand-grayDark disabled:opacity-50">
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      )}

      {/* Hours */}
      {activeTab === 'hours' && (
        <div className="bg-brand-white  border border-brand-gray p-6 space-y-6">
          <h2 className="text-lg font-semibold text-brand-black">Horário de Funcionamento</h2>
          <p className="text-brand-grayMid">Configure os horários de abertura e fechamento para cada dia da semana</p>
          
          <div className="space-y-3">
            {DAYS.map(day => {
              const hours = businessHours[day.key];
              const isClosed = !hours;
              return (
                <div key={day.key} className="flex items-center gap-4 p-4 bg-brand-grayLight ">
                  <div className="w-20 font-medium text-brand-black">{day.name}</div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!isClosed}
                      onChange={e => setBusinessHours(prev => ({
                        ...prev,
                        [day.key]: e.target.checked ? { open: '09:00', close: '18:00' } : null
                      }))}
                      className="rounded border-brand-gray text-brand-black focus:ring-brand-black"
                    />
                    <span className="text-sm text-brand-grayMid">Fechado</span>
                  </label>
                  {!isClosed && (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="time"
                        value={hours?.open || '09:00'}
                        onChange={e => setBusinessHours(prev => ({
                          ...prev,
                          [day.key]: prev[day.key] ? { ...prev[day.key]!, open: e.target.value } : null
                        }))}
                        className="px-3 py-2 border border-brand-gray "
                      />
                      <span className="text-brand-grayMid">até</span>
                      <input
                        type="time"
                        value={hours?.close || '18:00'}
                        onChange={e => setBusinessHours(prev => ({
                          ...prev,
                          [day.key]: prev[day.key] ? { ...prev[day.key]!, close: e.target.value } : null
                        }))}
                        className="px-3 py-2 border border-brand-gray "
                      />
                    </div>)}
                </div>
              );
            })}
          </div>

          <button onClick={handleSave} disabled={saving} className="w-full py-3 bg-brand-black text-white  font-medium hover:bg-brand-grayDark disabled:opacity-50">
            {saving ? 'Salvando...' : 'Salvar Horários'}
          </button>
        </div>
      )}

      {/* WhatsApp */}
      {activeTab === 'whatsapp' && (
        <div className="bg-brand-white  border border-brand-gray p-6 space-y-6">
          <h2 className="text-lg font-semibold text-brand-black">Configuração WhatsApp</h2>
          <p className="text-brand-grayMid">
            Configure a API do WhatsApp para envio automático de códigos, confirmações e lembretes.
            Suportamos <strong>Z-API</strong>, <strong>Evolution API</strong> e <strong>Meta Cloud API</strong>.
          </p>

          <div className="space-y-4">
            <div>
              <label className="field-label">Provedor</label>
              <select
                value={whatsappConfig.provider}
                onChange={e => setWhatsappConfig(prev => ({ ...prev, provider: e.target.value as any }))}
                className="field-input"
              >
                <option value="zapi">Z-API (Recomendado)</option>
                <option value="evolution">Evolution API</option>
                <option value="meta">Meta Cloud API</option>
              </select>
            </div>
            <div>
              <label className="field-label">Instance ID</label>
              <input
                type="text"
                value={whatsappConfig.instanceId}
                onChange={e => setWhatsappConfig(prev => ({ ...prev, instanceId: e.target.value }))}
                className="field-input"
                placeholder="Sua Instance ID"
              />
            </div>
            <div>
              <label className="field-label">Token / API Key</label>
              <input
                type="password"
                value={whatsappConfig.token}
                onChange={e => setWhatsappConfig(prev => ({ ...prev, token: e.target.value }))}
                className="field-input"
                placeholder="Seu token de acesso"
              />
            </div>
            <div>
              <label className="field-label">URL da API</label>
              <input
                type="url"
                value={whatsappConfig.apiUrl}
                onChange={e => setWhatsappConfig(prev => ({ ...prev, apiUrl: e.target.value }))}
                className="field-input"
                placeholder="https://api.z-api.io"
              />
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="text-md font-medium text-brand-black mb-4">Testar Configuração</h3>
            <div className="flex gap-4">
              <PhoneInput
                label="Telefone para teste"
                value={testPhone}
                onChange={setTestPhone}
                required
              />
              <button
                onClick={handleTestWhatsApp}
                disabled={testingWhatsApp || !testPhone}
                className="px-6 py-3 bg-brand-black text-white  font-medium hover:bg-brand-grayDark disabled:opacity-50 self-end"
              >
                {testingWhatsApp ? 'Enviando...' : 'Enviar Teste'}
              </button>
            </div>
          </div>

          <button onClick={handleWhatsAppSave} disabled={saving} className="w-full py-3 bg-brand-black text-white  font-medium hover:bg-brand-grayDark disabled:opacity-50">
            {saving ? 'Salvando...' : 'Salvar Configuração WhatsApp'}
          </button>
        </div>
      )}

      {/* Birthday */}
      {activeTab === 'birthday' && (
        <div className="bg-brand-white  border border-brand-gray p-6 space-y-6">
          <h2 className="text-lg font-semibold text-brand-black">Mensagem de Aniversário</h2>
          <p className="text-brand-grayMid">
            Configure a mensagem automática enviada no aniversário dos clientes via WhatsApp.
            Use <code className="bg-brand-gray px-1 rounded">{'{nome}'}</code> para o nome do cliente e{' '}
            <code className="bg-brand-gray px-1 rounded">{'{salao}'}</code> para o nome do salão.
          </p>

          <div>
            <label className="field-label">Template da Mensagem</label>
            <textarea
              value={formData.birthdayMessage}
              onChange={e => setFormData(prev => ({ ...prev, birthdayMessage: e.target.value }))}
              rows={4}
              className="field-input font-mono text-sm"
              placeholder="Olá {nome}! Feliz aniversário! Venha comemorar com a gente no {salao} e ganhe um presente especial!"
            />
          </div>

          <div className="bg-brand-grayLight  p-4">
            <h3 className="font-medium text-brand-black mb-2">Pré-visualização</h3>
            <p className="text-brand-black whitespace-pre-wrap">
              {formData.birthdayMessage.replace('{nome}', 'Maria Silva').replace('{salao}', settings?.name || 'Salão Beleza')}
            </p>
          </div>

          <div className="flex gap-4">
            <button onClick={handleRunBirthdayJob} className="px-6 py-3 bg-brand-black text-white  font-medium hover:bg-brand-grayDark">
              Executar Job de Aniversários (Teste)
            </button>
            <button onClick={handleSave} disabled={saving} className="flex-1 py-3 bg-brand-black text-white  font-medium hover:bg-brand-grayDark disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar Template'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}