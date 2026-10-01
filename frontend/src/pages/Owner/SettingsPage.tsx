import { useState, useEffect } from 'react';
import { ownerApi } from '@services/api';
import { useToast } from '@contexts/ToastContext';
import { useSalon } from '@contexts/SalonContext';
import { PhoneInput } from '@components/PhoneInput';
import { EstadoWhatsApp, ParearCelular, Webhooks } from '@components/WhatsApp/WhatsAppSections';

export function OwnerSettingsPage() {
  const { showToast } = useToast();
  const { refreshSalon } = useSalon();
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
    clientToken?: string;
  }>({
    provider: 'zapi',
    instanceId: '',
    token: '',
    apiUrl: 'https://api.z-api.io',
  });
  const [testPhone, setTestPhone] = useState('');
  const [testingWhatsApp, setTestingWhatsApp] = useState(false);

  /**
   * Estado da instância.
   *
   * Três estados, e não dois, porque a diferença importa:
   *
   * - `null` ainda não consultado. Não se desenha nada: inventar um
   *   "desconectado" aqui seria mentir na direção oposta.
   * - com `erro` preenchido, a consulta falhou. Mostra-se o erro, porque é
   *   ele que diz o conserto — "Instance not found" e "token inválido" são
   *   problems diferentes, e esconder isso deixa o dono sem pista nenhuma.
   * - preenchido sem erro, resposta normal.
   */
  const [estadoWhatsApp, setEstadoWhatsApp] = useState<{
    configurado: boolean;
    conectado: boolean;
    numero: string | null;
    pushName: string | null;
    smartphoneConectado: boolean | null;
    mensagem: string;
  } | null>(null);
  const [erroEstado, setErroEstado] = useState<string | null>(null);
  const [carregandoEstado, setCarregandoEstado] = useState(false);

  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrLink, setQrLink] = useState<string | null>(null);
  /**
   * A Z-API devolve `{connected: true}` e nenhum QR quando o número já está
   * pareado. Tratar a ausência de QR como falha mostraria um cartão de erro
   * num sistema funcionando — com o dono procurando defeito onde não há.
   */
  const [qrJaConectado, setQrJaConectado] = useState(false);
  const [carregandoQr, setCarregandoQr] = useState(false);
  const [registrandoWebhooks, setRegistrandoWebhooks] = useState(false);
  const [webhooksOk, setWebhooksOk] = useState<boolean | null>(null);

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

  /**
   * Consulta o estado assim que a tela abre.
   *
   * O motivo da falha é guardado e mostrado, não engolido. A Z-API tem várias
   * formas de recusar (instância inexistente, token inválido, URL errada) e
   * cada uma tem um conserto diferente — a mensagem que vem no corpo do erro
   * é literalmente a instrução de como resolver.
   */
  useEffect(() => {
    void consultarEstado();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const consultarEstado = async () => {
    setCarregandoEstado(true);
    try {
      setEstadoWhatsApp(await ownerApi.getWhatsAppStatus());
      setErroEstado(null);
    } catch (err: any) {
      setEstadoWhatsApp(null);
      setErroEstado(err.message || 'Não foi possível consultar a Z-API');
    } finally {
      setCarregandoEstado(false);
    }
  };

  const buscarQrCode = async () => {
    setCarregandoQr(true);
    try {
      const qr = await ownerApi.getWhatsAppQrCode();
      setQrCode(qr.base64);
      setQrLink(qr.link);
      setQrJaConectado(qr.jaConectado);
    } catch (err: any) {
      setQrCode(null);
      setQrLink(null);
      setQrJaConectado(false);
      showToast({ type: 'error', title: 'Não foi possível gerar o QR Code', message: err.message });
    } finally {
      setCarregandoQr(false);
    }
  };

  const handleRegistrarWebhooks = async () => {
    setRegistrandoWebhooks(true);
    try {
      const res = await ownerApi.registerWhatsAppWebhooks();
      setWebhooksOk(true);
      showToast({
        type: 'success',
        title: 'Avisos registrados',
        message: res.detalhe,
      });
    } catch (err: any) {
      setWebhooksOk(false);
      showToast({ type: 'error', title: 'Não foi possível registrar', message: err.message });
    } finally {
      setRegistrandoWebhooks(false);
    }
  };

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

      /**
       * Só os campos que NÃO são segredo vêm do servidor.
       *
       * Os de credencial (token e token de segurança) ficam vazios de propósito:
       * não há como mostrar um segredo preenchido. O backend trata o campo
       * vazio como "mantenha o que já está", então salvar assim não apaga a
       * configuração — que era o bug mais caro desta tela.
       */
      if (s.whatsapp) {
        const config = s.whatsapp;
        setWhatsappConfig(prev => ({
          ...prev,
          // O banco guarda texto livre; um valor desconhecido aqui viraria
          // opção inválida no select. `zapi` é o padrão do sistema.
          provider: (config.provider as typeof prev.provider) ?? 'zapi',
          instanceId: config.instanceId ?? '',
          apiUrl: config.apiUrl ?? 'https://api.z-api.io',
          token: '',
          clientToken: '',
        }));
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
      // O nome da marca vive num contexto com cache próprio. Sem esta
      // chamada, trocar o nome aqui só mudaria a tela atual — header,
      // sidebar e rodapé continuariam com o nome antigo até recarregar.
      await refreshSalon();
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
      showToast({ type: 'success', title: 'Credenciais salvas' });
      await loadSettings();
      // O estado é reconsultado porque salvar credencial nova muda a resposta
      // da Z-API — e o dono precisa ver na hora se passou a funcionar.
      await consultarEstado();
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
        <div className="card p-6 md:p-8 space-y-6">
          <div>
            <h2 className="text-body-lg font-semibold mb-5">Informações do salão</h2>
            <p className="text-caption text-brand-grayMid -mt-3 mb-5">
              Estes mesmos dados aparecem na página inicial e no rodapé do site.
            </p>
          </div>
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
        <div className="space-y-6">
          {/*
            O estado vem ANTES dos campos, e não depois.

            A ordem importa: a primeira pergunta do dono é "está funcionando?",
            e a resposta é sim/não com um motivo. Se a tela abrisse com quatro
            campos de texto vazios, a primeira impressão seria "está quebrado"
            mesmo com tudo funcionando — e foi exatamente isso que acontecia
            antes: o token nunca voltava do servidor, então a tela mostrava
            campos vazios sobre uma configuração que estava de pé.
          */}
          <EstadoWhatsApp
            carregando={carregandoEstado}
            estado={estadoWhatsApp}
            erro={erroEstado}
            onAtualizar={() => void consultarEstado()}
          />

          <div className="bg-brand-white border border-brand-gray p-6 space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-brand-black">Credenciais</h2>
              <p className="text-brand-grayMid mt-1">
                O sistema envia códigos de acesso, confirmações, lembretes e parabéns de
                aniversário por este número. O <strong>Z-API</strong> é o mais simples de configurar
                e o único que permite parear o celular e receber alertas de queda sem sair daqui.
              </p>
            </div>

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

              {/*
                Campos que a Z-API não exige, mas que o painel entrega prontos.

                A tela de integração da Z-API mostra a URL inteira, com
                instância e token já dentro. É o que a pessoa copia, e é a
                primeira tentativa de todo mundo. O backend aceita os dois
                formatos (ver `resolveZapiEndpoint` em `whatsapp.ts`), então
                colar a URL completa aqui funciona — desde que os campos
                Instance ID e Token também estejam preenchidos, porque a URL
                sozinha não substitui o que é salvo.
              */}
              <div>
                <label className="field-label">Instance ID</label>
                <input
                  type="text"
                  value={whatsappConfig.instanceId}
                  onChange={e => setWhatsappConfig(prev => ({ ...prev, instanceId: e.target.value }))}
                  className="field-input"
                  placeholder={settings?.whatsapp?.instanceId || 'Ex.: 3F9FFA3A072B01BA57C3F291022C939C'}
                />
                {settings?.whatsapp?.instanceId && whatsappConfig.instanceId === '' && (
                  <p className="text-caption text-brand-grayMid mt-1">
                    Já configurado: {settings.whatsapp.instanceId}
                  </p>
                )}
                <p className="text-caption text-brand-grayMid mt-1">
                  No painel da Z-API, clique em editar na sua instância.
                </p>
              </div>

              <div>
                <label className="field-label">Token da instância</label>
                <input
                  type="password"
                  value={whatsappConfig.token}
                  onChange={e => setWhatsappConfig(prev => ({ ...prev, token: e.target.value }))}
                  className="field-input"
                  placeholder={
                    settings?.whatsapp?.temToken
                      ? 'Já preenchido. Deixe em branco para manter.'
                      : 'Ex.: 60C60AD07EF2F45C1E56F91E'
                  }
                />
                {settings?.whatsapp?.temToken && whatsappConfig.token === '' && (
                  <p className="text-caption text-brand-grayMid mt-1">
                    Já há um token salvo. Deixe este campo em branco e ele será mantido.
                  </p>
                )}
              </div>

              {/*
                O Token de Segurança da Conta NÃO é opcional na prática.

                A documentação da Z-API trata como opcional porque o recurso
                começa desativado: enquanto ninguém clica em "Ativar Token", a
                API aceita chamada sem ele. Mas assim que alguém ativa — ou
                em contas onde já vem ativo — TODA requisição sem o header
                `Client-Token` é recusada com "your client-token is not
                configured", inclusive o QR Code e a consulta de status.

                Ele estava marcado como "opcional" aqui e gerou exatamente o
                problema que se viu: tela configurada, nada funcionando, e
                nenhuma pista do motivo. A dica agora aparece sempre, porque
                descobrir isso no meio do caminho custa mais que preencher um
                campo a mais.
              */}
              {whatsappConfig.provider === 'zapi' && (
                <div className="border-l-2 border-brand-black pl-4">
                  <label className="field-label">Token de segurança da conta</label>
                  <input
                    type="password"
                    value={whatsappConfig.clientToken || ''}
                    onChange={e => setWhatsappConfig(prev => ({ ...prev, clientToken: e.target.value }))}
                    className="field-input"
                    placeholder={
                      settings?.whatsapp?.temTokenDeSeguranca
                        ? 'Já preenchido. Deixe em branco para manter.'
                        : 'Em Z-API: Segurança → Token de Segurança da Conta'
                    }
                  />
                  <p className="text-caption text-brand-grayMid mt-1">
                    É uma credencial diferente do token da instância. Se a sua conta Z-API tem este
                    recurso ativo, a API recusa <strong>toda</strong> chamada sem ele — inclusive o
                    QR Code e a consulta de status. Se nunca foi ativado na sua conta, deixe em branco.
                  </p>
                </div>
              )}

              <div>
                <label className="field-label">URL da API</label>
                <input
                  type="url"
                  value={whatsappConfig.apiUrl}
                  onChange={e => setWhatsappConfig(prev => ({ ...prev, apiUrl: e.target.value }))}
                  className="field-input"
                  placeholder="https://api.z-api.io"
                />
                {/*
                  Explicita o que a tela da Z-API mostra, porque colar a URL
                  completa foi o que aconteceu e produziu uma mensagem de erro
                  que apontava para a causa errada.
                */}
                <p className="text-caption text-brand-grayMid mt-1">
                  Pode ser só <code className="bg-brand-gray px-1">https://api.z-api.io</code> ou a
                  URL completa da tela de integração. As duas formas funcionam.
                </p>
              </div>
            </div>

            <button
              onClick={handleWhatsAppSave}
              disabled={saving}
              className="w-full py-3 bg-brand-black text-white font-medium hover:bg-brand-grayDark disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar Credenciais'}
            </button>
          </div>

          {whatsappConfig.provider === 'zapi' && (
            <ParearCelular
              qr={qrCode}
              jaConectado={qrJaConectado}
              carregando={carregandoQr}
              onGerar={() => void buscarQrCode()}
              onAbrirLink={qrLink}
            />
          )}

          {whatsappConfig.provider === 'zapi' && (
            <Webhooks
              registrando={registrandoWebhooks}
              registrado={webhooksOk}
              onRegistrar={handleRegistrarWebhooks}
            />
          )}

          <div className="bg-brand-white border border-brand-gray p-6">
            <h3 className="text-md font-medium text-brand-black mb-1">Testar envio</h3>
            <p className="text-body-sm text-brand-grayMid mb-4">
              Envia uma mensagem real para o número que você indicar. Serve para confirmar que o
              texto chega — não substitui o estado acima, que diz se o número está pareado.
            </p>
            <div className="flex gap-4 flex-wrap">
              <div className="flex-1 min-w-[220px]">
                <PhoneInput
                  label="Telefone para teste"
                  value={testPhone}
                  onChange={setTestPhone}
                  required
                />
              </div>
              <button
                onClick={handleTestWhatsApp}
                disabled={testingWhatsApp || !testPhone}
                className="px-6 py-3 bg-brand-black text-white font-medium hover:bg-brand-grayDark disabled:opacity-50 self-end"
              >
                {testingWhatsApp ? 'Enviando...' : 'Enviar Teste'}
              </button>
            </div>
          </div>
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