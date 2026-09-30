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
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>

      {/* Tabs */}
      <div className="flex gap-2 bg-gray-100 rounded-xl p-1 mb-6">
        {[
          { key: 'general', label: 'Geral', icon: '' },
          { key: 'hours', label: 'Horários', icon: '' },
          { key: 'whatsapp', label: 'WhatsApp', icon: '' },
          { key: 'birthday', label: 'Aniversários', icon: '' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key ? 'bg-white text-blue-600 shadow' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* General */}
      {activeTab === 'general' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">Informações do Salão</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Salão *</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
              <PhoneInput
                value={formData.phone}
                onChange={v => setFormData(prev => ({ ...prev, phone: v }))}
                label=""
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
              <textarea
                value={formData.address}
                onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))}
                rows={2}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
              />
            </div>
          </div>

          <h2 className="text-lg font-semibold text-gray-900 border-t pt-6">Parâmetros de Agendamento</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Horas para cancelamento</label>
              <input
                type="number"
                value={formData.cancellationHours}
                onChange={e => setFormData(prev => ({ ...prev, cancellationHours: parseInt(e.target.value) || 0 }))}
                min={0}
                max={24}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Buffer entre agendamentos (min)</label>
              <input
                type="number"
                value={formData.bufferMinutes}
                onChange={e => setFormData(prev => ({ ...prev, bufferMinutes: parseInt(e.target.value) || 0 }))}
                min={0}
                max={60}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Intervalo de slots (min)</label>
              <input
                type="number"
                value={formData.slotInterval}
                onChange={e => setFormData(prev => ({ ...prev, slotInterval: parseInt(e.target.value) || 30 }))}
                min={15}
                max={60}
                step={15}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
              />
            </div>
          </div>

          <button onClick={handleSave} disabled={saving} className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      )}

      {/* Hours */}
      {activeTab === 'hours' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">Horário de Funcionamento</h2>
          <p className="text-gray-600">Configure os horários de abertura e fechamento para cada dia da semana</p>
          
          <div className="space-y-3">
            {DAYS.map(day => {
              const hours = businessHours[day.key];
              const isClosed = !hours;
              return (
                <div key={day.key} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                  <div className="w-20 font-medium text-gray-700">{day.name}</div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!isClosed}
                      onChange={e => setBusinessHours(prev => ({
                        ...prev,
                        [day.key]: e.target.checked ? { open: '09:00', close: '18:00' } : null
                      }))}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-600">Fechado</span>
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
                        className="px-3 py-2 border border-gray-300 rounded-lg"
                      />
                      <span className="text-gray-400">até</span>
                      <input
                        type="time"
                        value={hours?.close || '18:00'}
                        onChange={e => setBusinessHours(prev => ({
                          ...prev,
                          [day.key]: prev[day.key] ? { ...prev[day.key]!, close: e.target.value } : null
                        }))}
                        className="px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>)}
                </div>
              );
            })}
          </div>

          <button onClick={handleSave} disabled={saving} className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Salvando...' : 'Salvar Horários'}
          </button>
        </div>
      )}

      {/* WhatsApp */}
      {activeTab === 'whatsapp' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">Configuração WhatsApp</h2>
          <p className="text-gray-600">
            Configure a API do WhatsApp para envio automático de códigos, confirmações e lembretes.
            Suportamos <strong>Z-API</strong>, <strong>Evolution API</strong> e <strong>Meta Cloud API</strong>.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Provedor</label>
              <select
                value={whatsappConfig.provider}
                onChange={e => setWhatsappConfig(prev => ({ ...prev, provider: e.target.value as any }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
              >
                <option value="zapi">Z-API (Recomendado)</option>
                <option value="evolution">Evolution API</option>
                <option value="meta">Meta Cloud API</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Instance ID</label>
              <input
                type="text"
                value={whatsappConfig.instanceId}
                onChange={e => setWhatsappConfig(prev => ({ ...prev, instanceId: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                placeholder="Sua Instance ID"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Token / API Key</label>
              <input
                type="password"
                value={whatsappConfig.token}
                onChange={e => setWhatsappConfig(prev => ({ ...prev, token: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                placeholder="Seu token de acesso"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">URL da API</label>
              <input
                type="url"
                value={whatsappConfig.apiUrl}
                onChange={e => setWhatsappConfig(prev => ({ ...prev, apiUrl: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                placeholder="https://api.z-api.io"
              />
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="text-md font-medium text-gray-900 mb-4">Testar Configuração</h3>
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
                className="px-6 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 disabled:opacity-50 self-end"
              >
                {testingWhatsApp ? 'Enviando...' : 'Enviar Teste'}
              </button>
            </div>
          </div>

          <button onClick={handleWhatsAppSave} disabled={saving} className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Salvando...' : 'Salvar Configuração WhatsApp'}
          </button>
        </div>
      )}

      {/* Birthday */}
      {activeTab === 'birthday' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">Mensagem de Aniversário</h2>
          <p className="text-gray-600">
            Configure a mensagem automática enviada no aniversário dos clientes via WhatsApp.
            Use <code className="bg-gray-100 px-1 rounded">{'{nome}'}</code> para o nome do cliente e{' '}
            <code className="bg-gray-100 px-1 rounded">{'{salao}'}</code> para o nome do salão.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Template da Mensagem</label>
            <textarea
              value={formData.birthdayMessage}
              onChange={e => setFormData(prev => ({ ...prev, birthdayMessage: e.target.value }))}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none font-mono text-sm"
              placeholder="Olá {nome}! Feliz aniversário! Venha comemorar com a gente no {salao} e ganhe um presente especial!"
            />
          </div>

          <div className="bg-gray-50 rounded-xl p-4">
            <h3 className="font-medium text-gray-900 mb-2">Pré-visualização</h3>
            <p className="text-gray-700 whitespace-pre-wrap">
              {formData.birthdayMessage.replace('{nome}', 'Maria Silva').replace('{salao}', settings?.name || 'Salão Beleza')}
            </p>
          </div>

          <div className="flex gap-4">
            <button onClick={handleRunBirthdayJob} className="px-6 py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700">
              Executar Job de Aniversários (Teste)
            </button>
            <button onClick={handleSave} disabled={saving} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar Template'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}