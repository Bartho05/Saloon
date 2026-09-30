import prisma from '@config/database';
import { startOfDayInTimezone, endOfDayInTimezone } from '@utils/date';

export type Period = 'day' | 'month' | 'year';

export interface PeriodRange {
  start: Date;
  end: Date;
  label: string;
}

export interface FinancialSummary {
  period: Period;
  range: { start: string; end: string };
  totals: {
    appointments: number;
    completed: number;
    cancelled: number;
    noShow: number;
    revenue: number;
    averageTicket: number;
  };
  byService: Array<{
    serviceId: string;
    name: string;
    count: number;
    revenue: number;
  }>;
  daily: Array<{ date: string; count: number; revenue: number }>;
}

/**
 * Resolve o intervalo [start, end] do período no fuso do salão.
 * `reference` permite consultar dias/meses/anos anteriores.
 */
export function resolvePeriod(period: Period, reference = new Date()): PeriodRange {
  const ref = new Date(reference);

  if (period === 'day') {
    return {
      start: startOfDayInTimezone(ref),
      end: endOfDayInTimezone(ref),
      label: ref.toLocaleDateString('pt-BR'),
    };
  }

  if (period === 'month') {
    const first = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const last = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
    return {
      start: startOfDayInTimezone(first),
      end: endOfDayInTimezone(last),
      label: first.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
    };
  }

  const first = new Date(ref.getFullYear(), 0, 1);
  const last = new Date(ref.getFullYear(), 11, 31);
  return {
    start: startOfDayInTimezone(first),
    end: endOfDayInTimezone(last),
    label: String(ref.getFullYear()),
  };
}

/**
 * Faturamento considera apenas agendamentos concluídos — é o que de fato
 * entrou no caixa. Agendados entram como "previsto" separado, para o
 * profissional ver o que ainda pode virar receita.
 */
export async function getFinancialSummary(
  employeeId: string,
  period: Period,
  reference = new Date()
): Promise<FinancialSummary> {
  const { start, end, label } = resolvePeriod(period, reference);

  const appointments = await prisma.appointment.findMany({
    where: {
      employeeId,
      startsAt: { gte: start, lte: end },
      status: { not: 'CANCELLED' },
    },
    select: {
      id: true,
      startsAt: true,
      status: true,
      service: { select: { id: true, name: true, price: true } },
    },
    orderBy: { startsAt: 'asc' },
  });

  const completed = appointments.filter((a) => a.status === 'COMPLETED');
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

  // Série diária (usada nos gráficos de mês/ano)
  const dailyMap = new Map<string, { count: number; revenue: number }>();
  for (const apt of completed) {
    const key = apt.startsAt.toISOString().slice(0, 10);
    const entry = dailyMap.get(key) ?? { count: 0, revenue: 0 };
    entry.count += 1;
    entry.revenue += apt.service.price ?? 0;
    dailyMap.set(key, entry);
  }

  return {
    period,
    range: { start: start.toISOString(), end: end.toISOString() },
    totals: {
      appointments: appointments.length,
      completed: completed.length,
      cancelled: appointments.filter((a) => a.status === 'CANCELLED').length,
      noShow: appointments.filter((a) => a.status === 'NO_SHOW').length,
      revenue,
      averageTicket: completed.length > 0 ? revenue / completed.length : 0,
    },
    byService: [...serviceMap.entries()]
      .map(([serviceId, v]) => ({ serviceId, ...v }))
      .sort((a, b) => b.revenue - a.revenue),
    daily: [...dailyMap.entries()]
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}

/** Resumo por funcionário para o proprietário (para o mês corrente). */
export async function getOwnerFinancialOverview(
  period: Period,
  reference = new Date()
): Promise<{
  period: Period;
  label: string;
  totals: { revenue: number; appointments: number; averageTicket: number };
  employees: Array<{
    id: string;
    name: string;
    appointments: number;
    completed: number;
    revenue: number;
    averageTicket: number;
  }>;
  byService: Array<{ name: string; count: number; revenue: number }>;
  daily: Array<{ date: string; count: number; revenue: number }>;
}> {
  const { start, end, label } = resolvePeriod(period, reference);

  const appointments = await prisma.appointment.findMany({
    where: { startsAt: { gte: start, lte: end }, status: 'COMPLETED' },
    select: {
      startsAt: true,
      employee: { select: { id: true, name: true } },
      service: { select: { name: true, price: true } },
    },
  });

  const employeeMap = new Map<string, { name: string; appointments: number; revenue: number }>();
  const serviceMap = new Map<string, { count: number; revenue: number }>();
  const dailyMap = new Map<string, { count: number; revenue: number }>();

  for (const apt of appointments) {
    const price = apt.service.price ?? 0;

    const emp = employeeMap.get(apt.employee.id) ?? {
      name: apt.employee.name,
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

    const key = apt.startsAt.toISOString().slice(0, 10);
    const day = dailyMap.get(key) ?? { count: 0, revenue: 0 };
    day.count += 1;
    day.revenue += price;
    dailyMap.set(key, day);
  }

  const employees = [...employeeMap.entries()]
    .map(([id, v]) => ({
      id,
      name: v.name,
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
    totals: {
      revenue: totalRevenue,
      appointments: totalAppointments,
      averageTicket: totalAppointments > 0 ? totalRevenue / totalAppointments : 0,
    },
    employees,
    byService: [...serviceMap.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue),
    daily: [...dailyMap.entries()]
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}
