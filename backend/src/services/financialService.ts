import prisma from '@config/database';
import { startOfDayInTimezone, endOfDayInTimezone, toSalonTimezone } from '@utils/date';
import { formatInTimeZone, zonedTimeToUtc } from 'date-fns-tz';
import { ptBR } from 'date-fns/locale';

export type Period = 'day' | 'month' | 'year';

const TIMEZONE = 'America/Sao_Paulo';

export interface PeriodRange {
  start: Date;
  end: Date;
  label: string;
}

export interface FinancialSummary {
  period: Period;
  /** Rótulo do período já no fuso do salão: "quinta-feira, 1 de outubro de 2026". */
  label: string;
  range: { start: string; end: string };
  totals: {
    appointments: number;
    completed: number;
    cancelled: number;
    noShow: number;
    revenue: number;
    averageTicket: number;
    /** Valor já agendado e ainda não concluído — o que pode virar receita. */
    scheduled: number;
  };
  byService: Array<{
    serviceId: string;
    name: string;
    count: number;
    revenue: number;
  }>;
  /**
   * Série para o gráfico, com a granularidade CORTA para o período:
   * hora no dia, dia no mês, mês no ano.
   *
   * Densa de propósito — os periods sem atendimento vêm com revenue 0 em vez
   * de sumirem. Sem isso o mês aparecia só com os dias que tiveram serviço e o
   * gráfico mentia sobre o ritmo do mês; e no dia, sem os buckets por hora,
   * sobrava uma barra solitária e o dono concluía que não houve atendimento.
   *
   * O `label` vem pronto do servidor, formatado no fuso do salão. O front não
   * deve remontar a data: `new Date('2026-10-01')` é meia-noite UTC e em São
   * Paulo (UTC-3) virava 30/09 — o dia ao lado do dia errado.
   */
  series: FinancialSeriesPoint[];
  /**
   * Os agendamentos do período, um a um.
   *
   * Sem isto a tela só mostra agregados: no mês e no ano o gráfico de
   * barras com muitos dias dá a impressão de que há dados, mas na visão de
   * "dia" sobra uma barra solitária e o usuário conclui que não houve
   * atendimento nenhum.
   */
  appointments: FinancialAppointment[];
}

export interface FinancialSeriesPoint {
  /** Chave estável da faixa, em ISO curto: "2026-10-01", "2026-10" ou "2026-10-01T14". */
  key: string;
  /** Rótulo curto pronto para exibir: "14h", "01/10" ou "Jan". */
  label: string;
  /** Rótulo completo, para o tooltip. */
  fullLabel: string;
  /**
   * O salão não atende neste dia (domingo, feriado, ou dia sem horário
   * configurado). A barra fica vazia e sem rótulo, porque um espaço em branco
   * no eixo é informação — o dono enxerga o salão fechado. Rótulo em dia
   * fechado só polui o eixo do mês com 31 números.
   */
  isOpen: boolean;
  count: number;
  revenue: number;
}

export interface FinancialAppointment {
  id: string;
  startsAt: string;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  /**
   * Mesmo formato do `client` das listas de agendamento, para o front
   * aplicar a mesma regra de exibição nos dois lugares. Traz o telefone
   * porque `fullName` pode vir vazio em cadastro incompleto.
   */
  client: { fullName: string; phone: string };
  employeeName: string;
  serviceName: string;
  price: number;
}

/**
 * Resolve o intervalo [start, end] do período no fuso do salão.
 * `reference` permite consultar dias/meses/anos anteriores.
 *
 * Aceita 'YYYY-MM-DD' (como o front envia) ou Date. Ver `resolveReference`
 * para por que a string não pode virar Date direto.
 */
export function resolvePeriod(period: Period, reference?: unknown): PeriodRange {
  const ref = resolveReference(reference);

  /**
   * Ano, mês e dia civil no fuso do SALÃO.
   *
   * Usar `toSalonTimezone(ref).getFullYear()` seria tempting e errado: o
   * `getFullYear()` lê o fuso da MÁQUINA, não o do salão. Numa máquina em UTC,
   * o dia 1º do mês às 00:00 no salão é 30/09 no servidor — e o período saía
   * com o dia 30 em vez de 1. Extrair o dia civil com `formatInTimeZone` e
   * remontar o intervalo com `zonedTimeToUtc` não depende do fuso do servidor.
   */
  const ano = Number(formatInTimeZone(ref, TIMEZONE, 'yyyy'));
  const mes = Number(formatInTimeZone(ref, TIMEZONE, 'M')); // 1..12
  const dia = Number(formatInTimeZone(ref, TIMEZONE, 'd'));

  const inicio = (a: number, m: number, d: number) => zonedTimeToUtc(`${pad(a, 4)}-${pad(m)}-${pad(d)}T00:00:00`, TIMEZONE);
  const fim = (a: number, m: number, d: number) =>
    // 23:59:59.999 do dia: o `lte` do filtro precisa alcançar o último
    // milissegundo, senão um agendamento às 23:59:59.500 ficaria de fora.
    new Date(zonedTimeToUtc(`${pad(a, 4)}-${pad(m)}-${pad(d)}T00:00:00`, TIMEZONE).getTime() + 86400000 - 1);

  if (period === 'day') {
    return {
      start: inicio(ano, mes, dia),
      end: fim(ano, mes, dia),
      // O locale vai junto: sem ele o rótulo saía "Thursday, 1 de October",
      // com o dia da semana e o mês em inglês no meio de uma tela em português.
      label: formatInTimeZone(ref, TIMEZONE, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR }),
    };
  }

  if (period === 'month') {
    const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
    return {
      start: inicio(ano, mes, 1),
      end: fim(ano, mes, ultimoDia),
      label: capitalize(
        formatInTimeZone(new Date(Date.UTC(ano, mes - 1, 1)), 'UTC', 'MMMM', { locale: ptBR }) + ' de ' + ano
      ),
    };
  }

  return {
    start: inicio(ano, 1, 1),
    end: fim(ano, 12, 31),
    label: String(ano),
  };
}

function pad(n: number, len = 2): string {
  return String(n).padStart(len, '0');
}

/**
 * Monta a série do gráfico.
 *
 * A granularidade acompanha o período — é a diferença entre um gráfico
 * legível e um borrão:
 *
 * - `day`   -> uma barra por hora, da abertura ao fechamento do salão.
 *              Responde "que hora o salão fatura mais?", que é a pergunta da
 *              visão de dia.
 * - `month` -> uma barra por dia do mês, incluindo os dias fechados.
 * - `year`  -> uma barra por mês do ano. Barra diária daria 365 barras
 *              ilegíveis; mensal mostra a estação do ano.
 *
 * Densidade importa: um bucket sem atendimento precisa existir com zero, senão
 * o gráfico mente sobre o ritmo (no mês, os dias sem serviço sumiriam e as
 * barras se espalhariam por cima umas das outras).
 */
export function buildSeries(
  period: Period,
  start: Date,
  end: Date,
  appointments: Array<{ startsAt: Date; price: number | null }>,
  /** Horário de funcionamento: { "1": { open: "09:00", close: "19:00" }, ... } */
  businessHours?: unknown
): FinancialSeriesPoint[] {
  if (period === 'day') return buildHourlySeries(start, end, appointments, businessHours);
  if (period === 'month') return buildDailySeries(start, end, appointments, businessHours);
  return buildMonthlySeries(start, end, appointments);
}

/**
 * O salão abre neste dia da semana?
 *
 * `businessHours` é `{ "0": null, "1": { open, close }, ... }`, com a chave
 * sendo o dia da semana (0 = domingo). Dia sem entrada ou com `null` é
 * fechado.
 */
function isOpenOn(weekday: number, businessHours: unknown): boolean {
  if (!businessHours || typeof businessHours !== 'object') return true;
  const hours = businessHours as Record<string, unknown>;
  if (!(weekday in hours)) return true;
  const value = hours[weekday];
  if (!value || typeof value !== 'object') return false;
  const { open, close } = value as { open?: string; close?: string };
  return typeof open === 'string' && typeof close === 'string' && open !== '' && close !== '';
}

/** "outubro de 2026" -> "Outubro de 2026". */
function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Interpreta a data de referência vinda da query.
 *
 * O front manda o dia civil em 'YYYY-MM-DD' ("2026-10-01"). Passar isso
 * direto para `new Date()` interpretaria como meia-noite UTC, que em São
 * Paulo é 30/09 às 21:00 — e o financeiro do dia 1º do mês abriria o mês
 * ANTERIOR, sem nenhum erro aparente, só um número que não bate com a
 * agenda. A conversão tem de respeitar o fuso do salão.
 */
export function resolveReference(reference: unknown, fallback = new Date()): Date {
  if (reference === undefined || reference === null || reference === '') return fallback;

  if (reference instanceof Date) {
    // Já veio Date (chamada interna). Continua correta: o controller passa a
    // string, mas a assinatura aceita os dois.
    return reference;
  }

  const text = String(reference);

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    // Meio-dia local: o dia continua o mesmo mesmo que o navegador ou o
    // servidor estejam em outro fuso, e evita qualquer borda de meia-noite.
    return zonedTimeToUtc(`${text}T12:00:00`, TIMEZONE);
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

/** Onde o dia começa e termina, como hora local do salão. */
function businessHourBounds(businessHours: unknown): { from: number; to: number } {
  const fallback = { from: 8, to: 20 };

  if (!businessHours || typeof businessHours !== 'object') return fallback;

  let from = 24;
  let to = 0;

  for (const value of Object.values(businessHours as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue;
    const { open, close } = value as { open?: string; close?: string };
    if (typeof open !== 'string' || typeof close !== 'string') continue;

    const hOpen = Number(open.slice(0, 2));
    const hClose = Number(close.slice(0, 2));
    if (!Number.isFinite(hOpen) || !Number.isFinite(hClose)) continue;

    if (hOpen < from) from = hOpen;
    if (hClose > to) to = hClose;
  }

  if (from >= to) return fallback;
  // Consome até a última hora útil: um serviço das 18:30 às 19:00 cai na
  // faixa "19h" e não ficaria fora do gráfico.
  return { from, to: to + 1 };
}

function buildHourlySeries(
  start: Date,
  end: Date,
  appointments: Array<{ startsAt: Date; price: number | null }>,
  businessHours?: unknown
): FinancialSeriesPoint[] {
  const { from, to } = businessHourBounds(businessHours);

  const buckets = new Map<string, FinancialSeriesPoint>();
  for (let h = from; h < to; h++) {
    const key = formatInTimeZone(start, TIMEZONE, 'yyyy-MM-dd') + 'T' + String(h).padStart(2, '0');
    buckets.set(key, {
      key,
      label: `${String(h).padStart(2, '0')}h`,
      fullLabel: `${String(h).padStart(2, '0')}h`,
      isOpen: true,
      count: 0,
      revenue: 0,
    });
  }

  for (const apt of appointments) {
    const hour = formatInTimeZone(apt.startsAt, TIMEZONE, 'H');
    const key = formatInTimeZone(apt.startsAt, TIMEZONE, 'yyyy-MM-dd') + 'T' + String(hour).padStart(2, '0');
    const entry = buckets.get(key);
    // Fora da faixa de funcionamento (agendamento legado, ou horário
    // configurado diferente do gráfico): cria a faixa em vez de perder o dado.
    if (!entry) {
      buckets.set(key, {
        key,
        label: `${String(hour).padStart(2, '0')}h`,
        fullLabel: `${String(hour).padStart(2, '0')}h`,
        isOpen: true,
        count: 0,
        revenue: 0,
      });
    }
    const target = buckets.get(key)!;
    target.count += 1;
    target.revenue += apt.price ?? 0;
  }

  return [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function buildDailySeries(
  start: Date,
  end: Date,
  appointments: Array<{ startsAt: Date; price: number | null }>,
  businessHours?: unknown
): FinancialSeriesPoint[] {
  const buckets = new Map<string, FinancialSeriesPoint>();

  const totalDays = Math.round(
    (startOfDayInTimezone(end).getTime() - startOfDayInTimezone(start).getTime()) / 86400000
  ) + 1;

  for (let i = 0; i < totalDays; i++) {
    const d = new Date(startOfDayInTimezone(start).getTime() + i * 86400000);
    const key = formatInTimeZone(d, TIMEZONE, 'yyyy-MM-dd');
    const weekday = Number(formatInTimeZone(d, TIMEZONE, 'i')) % 7; // 'i' é 1..7 (seg..dom)
    const aberto = isOpenOn(weekday, businessHours);
    buckets.set(key, {
      key,
      // Rótulo vazio em dia fechado: o gráfico decide se mostra, e assim o eixo
      // do mês não vira uma parede de números.
      label: aberto ? formatInTimeZone(d, TIMEZONE, 'dd/MM') : '',
      fullLabel: formatInTimeZone(d, TIMEZONE, "EEEE, d 'de' MMMM", { locale: ptBR }),
      isOpen: aberto,
      count: 0,
      revenue: 0,
    });
  }

  for (const apt of appointments) {
    const key = formatInTimeZone(apt.startsAt, TIMEZONE, 'yyyy-MM-dd');
    const entry = buckets.get(key);
    if (!entry) continue;
    entry.count += 1;
    entry.revenue += apt.price ?? 0;
  }

  return [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function buildMonthlySeries(
  start: Date,
  end: Date,
  appointments: Array<{ startsAt: Date; price: number | null }>
): FinancialSeriesPoint[] {
  const buckets = new Map<string, FinancialSeriesPoint>();

  const year = formatInTimeZone(start, TIMEZONE, 'yyyy');
  for (let m = 0; m < 12; m++) {
    const d = new Date(Number(year), m, 1);
    const key = formatInTimeZone(d, TIMEZONE, 'yyyy-MM');
    buckets.set(key, {
      key,
      // "jan", "fev"… em português e com inicial maiúscula. `MMM` sem locale
      // devolvia "Jan"/"Feb" em inglês.
      label: capitalize(formatInTimeZone(d, TIMEZONE, 'MMM', { locale: ptBR }).replace('.', '')),
      fullLabel: capitalize(formatInTimeZone(d, TIMEZONE, "MMMM 'de' yyyy", { locale: ptBR })),
      isOpen: true,
      count: 0,
      revenue: 0,
    });
  }

  for (const apt of appointments) {
    const key = formatInTimeZone(apt.startsAt, TIMEZONE, 'yyyy-MM');
    const entry = buckets.get(key);
    if (!entry) continue;
    entry.count += 1;
    entry.revenue += apt.price ?? 0;
  }

  return [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Faturamento considera apenas agendamentos concluídos — é o que de fato
 * entrou no caixa. Agendados entram como "previsto" separado, para o
 * profissional ver o que ainda pode virar receita.
 */
export async function getFinancialSummary(
  employeeId: string,
  period: Period,
  /** 'YYYY-MM-DD', ISO completo ou Date. Ver `resolveReference`. */
  reference?: unknown
): Promise<FinancialSummary> {
  const { start, end, label } = resolvePeriod(period, reference);

  const [appointments, settings, employee] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        employeeId,
        startsAt: { gte: start, lte: end },
      },
      select: {
        id: true,
        startsAt: true,
        status: true,
        client: { select: { fullName: true, phone: true } },
        service: { select: { id: true, name: true, price: true } },
      },
      orderBy: { startsAt: 'asc' },
    }),
    // Só para os rótulos por hora do gráfico. Falhar aqui não pode derrubar o
    // financeiro inteiro.
    prisma.salonSettings.findUnique({ where: { id: 1 }, select: { businessHours: true } }).catch(() => null),
    prisma.user.findUnique({ where: { id: employeeId }, select: { name: true } }),
  ]);

  // Cancelado não é agendamento: some do total e das listas, mas continua
  // no relatório de appointments para dar para auditar.
  const ativos = appointments.filter((a) => a.status !== 'CANCELLED');
  const completed = ativos.filter((a) => a.status === 'COMPLETED');
  const scheduled = ativos.filter((a) => a.status === 'SCHEDULED');
  const revenue = completed.reduce((sum, a) => sum + (a.service.price ?? 0), 0);

  // Agregação por serviço
  const serviceMap = new Map<string, { name: string; count: number; revenue: number }>();
  for (const apt of completed) {
    const entry = serviceMap.get(apt.service.id) ?? {
      name: apt.service.name,
      count: 0,
      revenue: 0,
    };
    entry.count += 1;
    entry.revenue += apt.service.price ?? 0;
    serviceMap.set(apt.service.id, entry);
  }

  return {
    period,
    label,
    range: { start: start.toISOString(), end: end.toISOString() },
    totals: {
      appointments: ativos.length,
      completed: completed.length,
      cancelled: appointments.filter((a) => a.status === 'CANCELLED').length,
      noShow: ativos.filter((a) => a.status === 'NO_SHOW').length,
      revenue,
      averageTicket: completed.length > 0 ? revenue / completed.length : 0,
      scheduled: scheduled.reduce((sum, a) => sum + (a.service.price ?? 0), 0),
    },
    byService: [...serviceMap.entries()]
      .map(([serviceId, v]) => ({ serviceId, ...v }))
      .sort((a, b) => b.revenue - a.revenue),
    series: buildSeries(
      period,
      start,
      end,
      completed.map((a) => ({ startsAt: a.startsAt, price: a.service.price })),
      settings?.businessHours
    ),
    appointments: ativos.map((a) => ({
      id: a.id,
      startsAt: a.startsAt.toISOString(),
      status: a.status,
      // Mesmo formato do `client` das listas de agendamento. Traz telefone
      // porque cadastro incompleto tem `fullName` vazio, e sem ele a linha
      // do relatório ficava sem nenhuma identificação.
      client: { fullName: a.client.fullName, phone: a.client.phone },
      // Vinha string vazia: o profissional lia o próprio nome em branco na
      // lista do próprio faturamento.
      employeeName: employee?.name ?? '',
      serviceName: a.service.name,
      price: a.service.price ?? 0,
    })),
  };
}

/** Resumo por funcionário para o proprietário (para o mês corrente). */
export async function getOwnerFinancialOverview(
  period: Period,
  /** 'YYYY-MM-DD', ISO completo ou Date. Ver `resolveReference`. */
  reference?: unknown
): Promise<{
  period: Period;
  label: string;
  range: { start: string; end: string };
  totals: { revenue: number; appointments: number; completed: number; averageTicket: number; scheduled: number };
  employees: Array<{
    id: string;
    name: string;
    photoUrl: string | null;
    appointments: number;
    completed: number;
    revenue: number;
    averageTicket: number;
  }>;
  byService: Array<{ name: string; count: number; revenue: number }>;
  series: FinancialSeriesPoint[];
  /** Agendamentos um a um — sem isto a visão "dia" fica sem conteúdo. */
  appointments: FinancialAppointment[];
}> {
  const { start, end, label } = resolvePeriod(period, reference);

  const [all, settings] = await Promise.all([
    prisma.appointment.findMany({
      where: { startsAt: { gte: start, lte: end } },
      select: {
        id: true,
        startsAt: true,
        status: true,
        employee: { select: { id: true, name: true, photoUrl: true } },
        service: { select: { name: true, price: true } },
        client: { select: { fullName: true, phone: true } },
      },
      orderBy: { startsAt: 'asc' },
    }),
    prisma.salonSettings.findUnique({ where: { id: 1 }, select: { businessHours: true } }).catch(() => null),
  ]);

  // Faturamento é só o que foi concluído; a lista mostra tudo para dar para
  // conferir o dia e ver o que ficou pendente.
  const appointments = all.filter((a) => a.status !== 'CANCELLED');
  const concluidos = appointments.filter((a) => a.status === 'COMPLETED');
  const agendados = appointments.filter((a) => a.status === 'SCHEDULED');

  const employeeMap = new Map<
    string,
    { name: string; photoUrl: string | null; appointments: number; revenue: number }
  >();
  const serviceMap = new Map<string, { count: number; revenue: number }>();

  for (const apt of concluidos) {
    const price = apt.service.price ?? 0;

    const emp = employeeMap.get(apt.employee.id) ?? {
      name: apt.employee.name,
      photoUrl: apt.employee.photoUrl,
      appointments: 0,
      revenue: 0,
    };
    emp.appointments += 1;
    emp.revenue += price;
    employeeMap.set(apt.employee.id, emp);

    const svc = serviceMap.get(apt.service.name) ?? { count: 0, revenue: 0 };
    svc.count += 1;
    svc.revenue += price;
    serviceMap.set(apt.service.name, svc);
  }

  const employees = [...employeeMap.entries()]
    .map(([id, v]) => ({
      id,
      name: v.name,
      photoUrl: v.photoUrl,
      appointments: v.appointments,
      completed: v.appointments,
      revenue: v.revenue,
      averageTicket: v.appointments > 0 ? v.revenue / v.appointments : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const totalRevenue = employees.reduce((s, e) => s + e.revenue, 0);
  const totalAppointments = employees.reduce((s, e) => s + e.appointments, 0);

  return {
    period,
    label,
    range: { start: start.toISOString(), end: end.toISOString() },
    totals: {
      revenue: totalRevenue,
      appointments: totalAppointments,
      completed: totalAppointments,
      averageTicket: totalAppointments > 0 ? totalRevenue / totalAppointments : 0,
      scheduled: agendados.reduce((sum, a) => sum + (a.service.price ?? 0), 0),
    },
    employees,
    byService: [...serviceMap.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue),
    series: buildSeries(
      period,
      start,
      end,
      concluidos.map((a) => ({ startsAt: a.startsAt, price: a.service.price })),
      settings?.businessHours
    ),
    appointments: appointments.map((a) => ({
      id: a.id,
      startsAt: a.startsAt.toISOString(),
      status: a.status,
      client: { fullName: a.client.fullName, phone: a.client.phone },
      employeeName: a.employee.name,
      serviceName: a.service.name,
      price: a.service.price ?? 0,
    })),
  };
}
