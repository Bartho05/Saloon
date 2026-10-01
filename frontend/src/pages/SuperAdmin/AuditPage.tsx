import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  superadminApi,
  type AuditEntry,
  type AuditEntity,
  type ActorKind,
} from '@services/api';
import { useToast } from '@contexts/ToastContext';
import { formatDateTime } from '@utils/date';
import { Card, CardContent, Container } from '@components/ui';
import { PageSpinner, EmptyState, StatusBadge } from '@components/Dashboard';
import { SuperAdminHeader } from '@layouts/SuperAdminLayout';
import {
  RefreshIcon,
  AlertIcon,
  CheckCircleIcon,
  UserPlusIcon,
  KeyIcon,
  ClockIcon,
  SearchIcon,
  CalendarIcon,
  SettingsIcon,
  ScissorsIcon,
  PhoneIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@components/icons';

/**
 * ── Como a tela se organiza ─────────────────────────────────────────────────
 *
 * A trilha é uma lista, e listas longas têm um problema: a pessoa quer uma
 * coisa específica ("quem entrou hoje?", "quantas mensagens falharam?") e a
 * lista tem mil linhas. Os filtros existem para essa pergunta, não para
 * organizar a estética.
 *
 * A ordem de importance é deliberada:
 * 1. O que aconteceu (o `summary`, já em português)
 * 2. Quem fez (o `actorLabel`, abaixo)
 * 3. Quando e de onde (o rodapé, o menor possível)
 *
 * Se o "quando" fosse para o topo, a lista viraria uma parede de datas e o que
 * aconteceu — a informação difícil — ficaria buried embaixo.
 */

const POR_PAGINA = 40;

type Tone = 'info' | 'success' | 'danger' | 'warning' | 'neutral';

/**
 * Rótulo e ícone por ação.
 *
 * O rótulo é humano porque "APPOINTMENT_REJECTED" numa coluna estreita obriga a
 * traduzir mentalmente enquanto se procura um problema — e a utilidade de um
 * log é essa leitura rápida.
 */
const ACAO: Record<string, { rotulo: string; tone: Tone; Icon: any }> = {
  // acesso
  LOGIN: { rotulo: 'Entrou', tone: 'success', Icon: CheckCircleIcon },
  LOGIN_FAILED: { rotulo: 'Não conseguiu entrar', tone: 'danger', Icon: AlertIcon },
  LOGOUT: { rotulo: 'Saiu', tone: 'neutral', Icon: ChevronLeftIcon },
  ACCESS_CODE_REQUESTED: { rotulo: 'Pediu código', tone: 'info', Icon: PhoneIcon },
  ACCESS_CODE_VERIFIED: { rotulo: 'Verificou o número', tone: 'success', Icon: CheckCircleIcon },
  ACCOUNT_LOCKED: { rotulo: 'Conta travada', tone: 'warning', Icon: AlertIcon },

  // agenda
  APPOINTMENT_CREATED: { rotulo: 'Agendamento criado', tone: 'success', Icon: CalendarIcon },
  APPOINTMENT_UPDATED: { rotulo: 'Agendamento alterado', tone: 'info', Icon: CalendarIcon },
  APPOINTMENT_STATUS_CHANGED: { rotulo: 'Status mudou', tone: 'info', Icon: CalendarIcon },
  APPOINTMENT_DELETED: { rotulo: 'Agendamento removido', tone: 'warning', Icon: CalendarIcon },
  APPOINTMENT_REJECTED: { rotulo: 'Agendamento recusado', tone: 'danger', Icon: AlertIcon },

  // clientes
  CLIENT_CREATED: { rotulo: 'Cliente cadastrado', tone: 'success', Icon: UserPlusIcon },
  CLIENT_UPDATED: { rotulo: 'Cliente alterado', tone: 'info', Icon: UserPlusIcon },

  // serviços e profissionais
  SERVICE_CREATED: { rotulo: 'Serviço criado', tone: 'success', Icon: ScissorsIcon },
  SERVICE_UPDATED: { rotulo: 'Serviço alterado', tone: 'info', Icon: ScissorsIcon },
  SERVICE_DELETED: { rotulo: 'Serviço desativado', tone: 'warning', Icon: ScissorsIcon },
  EMPLOYEE_CREATED: { rotulo: 'Profissional criado', tone: 'success', Icon: UserPlusIcon },
  EMPLOYEE_UPDATED: { rotulo: 'Profissional alterado', tone: 'info', Icon: UserPlusIcon },
  EMPLOYEE_DELETED: { rotulo: 'Profissional desativado', tone: 'warning', Icon: UserPlusIcon },
  EMPLOYEE_ACCESS_CODE_REGENERATED: {
    rotulo: 'Código de acesso trocado',
    tone: 'warning',
    Icon: KeyIcon,
  },
  EMPLOYEE_PHOTO_CHANGED: { rotulo: 'Foto trocada', tone: 'info', Icon: UserPlusIcon },

  // configuração
  SETTINGS_UPDATED: { rotulo: 'Configuração alterada', tone: 'info', Icon: SettingsIcon },
  WHATSAPP_CONFIG_CHANGED: { rotulo: 'WhatsApp reconfigurado', tone: 'info', Icon: SettingsIcon },

  // WhatsApp
  WHATSAPP_SENT: { rotulo: 'Mensagem enviada', tone: 'success', Icon: CheckCircleIcon },
  WHATSAPP_FAILED: { rotulo: 'Mensagem falhou', tone: 'danger', Icon: AlertIcon },
  WHATSAPP_DISCONNECTED: { rotulo: 'WhatsApp desconectado', tone: 'danger', Icon: AlertIcon },
  WHATSAPP_MESSAGE_STATUS: { rotulo: 'Status da mensagem', tone: 'info', Icon: PhoneIcon },
  WHATSAPP_INCOMING: { rotulo: 'Mensagem recebida', tone: 'info', Icon: PhoneIcon },

  // superadmin
  SUPERADMIN_BOOTSTRAP: { rotulo: 'Primeiro acesso criado', tone: 'success', Icon: KeyIcon },
  SUPERADMIN_BOOTSTRAP_DENIED: { rotulo: 'Instalação recusada', tone: 'danger', Icon: AlertIcon },
  SUPERADMIN_CODE_ROTATED: { rotulo: 'Código trocado', tone: 'warning', Icon: KeyIcon },
  SUPERADMIN_UNLOCKED: { rotulo: 'Conta destravada', tone: 'info', Icon: CheckCircleIcon },
  SUPERADMIN_ACTIVATED: { rotulo: 'Conta reativada', tone: 'info', Icon: CheckCircleIcon },
  SUPERADMIN_DEACTIVATED: { rotulo: 'Conta desativada', tone: 'warning', Icon: AlertIcon },

  // instalação e rotina
  OWNER_CREATED: { rotulo: 'Proprietário criado', tone: 'success', Icon: UserPlusIcon },
  OWNER_CREATION_DENIED: { rotulo: 'Criação recusada', tone: 'danger', Icon: AlertIcon },
  CRON_JOB_RUN: { rotulo: 'Rotina executada', tone: 'neutral', Icon: ClockIcon },
  CRON_JOB_FAILED: { rotulo: 'Rotina falhou', tone: 'danger', Icon: AlertIcon },
};

/** Quem agiu, em português. */
const AUTOR: Record<string, string> = {
  OWNER: 'Dono',
  EMPLOYEE: 'Profissional',
  CLIENT: 'Cliente',
  SUPERADMIN: 'Administração',
  SYSTEM: 'Sistema',
  ANONYMOUS: 'Sem identificação',
};

/** Área do sistema, para o filtro e para a leitura rápida da linha. */
const ENTIDADE: Record<AuditEntity, string> = {
  appointment: 'Agendamentos',
  client: 'Clientes',
  service: 'Serviços',
  employee: 'Profissionais',
  settings: 'Configurações',
  whatsapp: 'WhatsApp',
  auth: 'Acessos',
  superadmin: 'Administração',
  cron: 'Rotinas',
};

interface Filtros {
  entity?: AuditEntity;
  actorKind?: ActorKind;
  outcome?: 'SUCCESS' | 'FAILURE';
  busca: string;
}

const SEM_FILTRO: Filtros = { busca: '' };

export function SuperAdminAuditPage() {
  const { showToast } = useToast();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [recarregando, setRecarregando] = useState(false);
  const [pagina, setPagina] = useState(0);
  const [filtros, setFiltros] = useState<Filtros>(SEM_FILTRO);

  /**
   * O texto digitado não vai direto para a requisição.
   *
   * Sem esta espera, cada tecla vira uma chamada: em "Carlos" são seis
   * requisições, e o dono perde a sensação de que a tela responde. 300ms é o
   * suficiente para agrupar uma digitação normal e imperceptível para quem
   * escreve.
   */
  const [buscaAplicada, setBuscaAplicada] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setBuscaAplicada(filtros.busca.trim()), 300);
    return () => clearTimeout(t);
  }, [filtros.busca]);

  const carregar = useCallback(async () => {
    try {
      const res = await superadminApi.getAudit({
        limit: POR_PAGINA,
        offset: pagina * POR_PAGINA,
        entity: filtros.entity,
        actorKind: filtros.actorKind,
        outcome: filtros.outcome,
        busca: buscaAplicada || undefined,
      });

      setEntries(res.entries);
      setTotal(res.total);
    } catch (err: any) {
      showToast({ type: 'error', title: 'Erro', message: err.message });
    } finally {
      setLoading(false);
      setRecarregando(false);
    }
  }, [pagina, filtros.entity, filtros.actorKind, filtros.outcome, buscaAplicada, showToast]);

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagina, filtros.entity, filtros.actorKind, filtros.outcome, buscaAplicada]);

  const recarregar = () => {
    setRecarregando(true);
    void carregar();
  };

  const temFiltro = Boolean(filtros.entity || filtros.actorKind || filtros.outcome || buscaAplicada);

  const falhas = useMemo(() => entries.filter((e) => e.outcome === 'FAILURE').length, [entries]);

  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  const marcar = (patch: Partial<Filtros>) => {
    setFiltros((f) => ({ ...f, ...patch }));
    // Volta para a primeira página: filtrar enquanto se está na terceira
    // mostraria "nenhum registro" numa lista que tem miles.
    setPagina(0);
  };

  if (loading) return <PageSpinner />;

  return (
    <Container size="full" className="!px-0">
      <SuperAdminHeader
        title="Auditoria"
        description="Tudo que acontece no sistema, com quem, quando e de onde"
        action={
          <button
            onClick={recarregar}
            disabled={recarregando}
            className="flex items-center gap-2 text-caption text-brand-grayMid hover:text-brand-black transition-colors duration-fast disabled:opacity-40"
          >
            <RefreshIcon className={`w-4 h-4 ${recarregando ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        }
      />

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <FilterChip
          ativo={!filtros.entity}
          onClick={() => marcar({ entity: undefined })}
        >
          Tudo
        </FilterChip>

        {(Object.keys(ENTIDADE) as AuditEntity[]).map((e) => (
          <FilterChip
            key={e}
            ativo={filtros.entity === e}
            onClick={() => marcar({ entity: filtros.entity === e ? undefined : e })}
          >
            {ENTIDADE[e]}
          </FilterChip>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Busca */}
        <div className="relative flex-1 min-w-[220px]">
          <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-brand-grayMid pointer-events-none" />
          <input
            type="text"
            value={filtros.busca}
            onChange={(e) => marcar({ busca: e.target.value })}
            placeholder="Buscar por nome, telefone ou ação"
            className="w-full h-10 pl-9 pr-3 border border-brand-gray bg-white text-body-sm focus:outline-none focus:border-brand-black transition-colors duration-fast"
          />
        </div>

        {/* Autor */}
        <select
          value={filtros.actorKind ?? ''}
          onChange={(e) =>
            marcar({ actorKind: (e.target.value || undefined) as ActorKind | undefined })
          }
          className="h-10 px-3 border border-brand-gray bg-white text-body-sm focus:outline-none focus:border-brand-black transition-colors duration-fast"
        >
          <option value="">Qualquer autor</option>
          {Object.entries(AUTOR).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>

        {/* Resultado */}
        <select
          value={filtros.outcome ?? ''}
          onChange={(e) =>
            marcar({ outcome: (e.target.value || undefined) as 'SUCCESS' | 'FAILURE' | undefined })
          }
          className="h-10 px-3 border border-brand-gray bg-white text-body-sm focus:outline-none focus:border-brand-black transition-colors duration-fast"
        >
          <option value="">Tudo que aconteceu</option>
          <option value="FAILURE">Só o que falhou</option>
          <option value="SUCCESS">Só o que deu certo</option>
        </select>
      </div>

      {/* Resumo do que está na tela */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mb-4 text-body-sm">
        <span className="text-brand-grayMid">
          <strong className="font-display text-brand-black">{total.toLocaleString('pt-BR')}</strong>{' '}
          registro(s){temFiltro ? ' com este filtro' : ' no total'}
        </span>
        {falhas > 0 && (
          <span className="text-brand-grayMid">
            <strong className="font-display text-brand-black">{falhas}</strong> falha(s) nesta
            página
          </span>
        )}
        {temFiltro && (
          <button
            onClick={() => {
              setFiltros(SEM_FILTRO);
              setPagina(0);
            }}
            className="text-caption text-brand-grayMid hover:text-brand-black underline underline-offset-2 transition-colors duration-fast"
          >
            Limpar filtros
          </button>
        )}
      </div>

      <Card>
        {!entries.length ? (
          <EmptyState
            title={temFiltro ? 'Nada com este filtro' : 'Nada registrado ainda'}
            description={
              temFiltro
                ? 'Tente outro filtro ou limpe a busca.'
                : 'Toda entrada, agendamento, alteração e mensagem fica registrada aqui.'
            }
          />
        ) : (
          <ul>
            {entries.map((entry) => {
              const meta = ACAO[entry.action] ?? {
                rotulo: entry.action,
                tone: 'neutral' as Tone,
                Icon: ClockIcon,
              };
              const Icon = meta.Icon;
              const falhou = entry.outcome === 'FAILURE';

              return (
                <li
                  key={entry.id}
                  className="px-5 md:px-6 py-4 flex items-start gap-3 md:gap-4 border-b border-brand-gray last:border-b-0"
                >
                  <span
                    className={`w-8 h-8 flex-shrink-0 border flex items-center justify-center ${
                      falhou ? 'border-brand-black text-brand-black' : 'border-brand-gray text-brand-grayMid'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge tone={falhou ? 'danger' : meta.tone}>{meta.rotulo}</StatusBadge>
                      {entry.entity && entry.entity in ENTIDADE && (
                        <span className="text-caption text-brand-grayMid">
                          {ENTIDADE[entry.entity as AuditEntity]}
                        </span>
                      )}
                    </div>

                    {/* A frase é o que a pessoa veio ler. Por isso é a maior. */}
                    <p className="font-display text-body-sm text-brand-black mt-1.5 break-words">
                      {entry.summary}
                    </p>

                    <p className="text-caption text-brand-grayMid mt-1">
                      {AUTOR[entry.actorKind] ?? entry.actorKind}
                      {entry.actorLabel ? ` · ${entry.actorLabel}` : ''}
                      {' · '}
                      {formatDateTime(entry.createdAt)}
                      {entry.ip ? ` · ${entry.ip}` : ''}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Paginação */}
      {totalPaginas > 1 && (
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={() => setPagina((p) => Math.max(0, p - 1))}
            disabled={pagina === 0}
            className="flex items-center gap-1.5 text-body-sm text-brand-black disabled:opacity-30 disabled:text-brand-grayMid transition-opacity duration-fast"
          >
            <ChevronLeftIcon className="w-4 h-4" />
            Anteriores
          </button>

          <span className="text-caption text-brand-grayMid">
            Página {pagina + 1} de {totalPaginas}
          </span>

          <button
            onClick={() => setPagina((p) => p + 1)}
            disabled={pagina >= totalPaginas - 1}
            className="flex items-center gap-1.5 text-body-sm text-brand-black disabled:opacity-30 disabled:text-brand-grayMid transition-opacity duration-fast"
          >
            Próximas
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/*
        Aviso sobre o que NÃO aparece aqui.

        Uma trilha de auditoria que deixa a pessoa supor que guarda tudo é pior
        do que não existir: ela para de procurar algo que nunca foi gravado. O
        código de acesso, por definição, não entra — nem a senha, nem o token
        do WhatsApp.
      */}
      <Card className="mt-6">
        <CardContent>
          <div className="flex items-start gap-3">
            <AlertIcon className="w-5 h-5 text-brand-grayMid flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-display font-medium text-body-sm mb-1">
                O que não é registrado
              </p>
              <p className="text-body-sm text-brand-grayMid">
                A auditoria registra <em>que</em> a ação aconteceu, com data, autor e origem — mas
                nunca guarda segredos. O código de acesso do profissional, a senha do dono e o token
                do WhatsApp não entram nem aqui nem no banco: só o hash ou os oito primeiros
                caracteres, quando ajuda a distinguir uma credencial da outra.
              </p>
              <p className="text-body-sm text-brand-grayMid mt-2">
                Registros com mais de 90 dias são apagados automaticamente, todo dia às 3h da
                manhã. A limpeza fica registrada aqui como uma rotina comum.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Container>
  );
}

/**
 * Chip de filtro.
 *
 * Um botão, não um `<select>`: com nove áreas numa lista suspensa seria preciso
 * abrir, rolar e escolher para trocar de área, e o filtro é a função mais
 * usada da tela. Todos à vista e um clique.
 */
function FilterChip({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`h-9 px-3 text-caption border transition-colors duration-fast ${
        ativo
          ? 'bg-brand-black text-white border-brand-black'
          : 'bg-white text-brand-grayMid border-brand-gray hover:border-brand-black hover:text-brand-black'
      }`}
    >
      {children}
    </button>
  );
}

export default SuperAdminAuditPage;
