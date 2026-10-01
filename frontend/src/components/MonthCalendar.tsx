import { useMemo } from 'react';
import type { Appointment } from '@types';
import { ChevronLeftIcon, ChevronRightIcon } from '@components/icons';

/**
 * Grade mensal da agenda.
 *
 * Por que uma grade e não uma lista: o dono precisa responder "como está o
 * mês?" num relance — quais dias estão cheated, onde há buraco. A lista
 * obriga a ler 30 dias para achar isso.
 *
 * O mês vem pronto do pai (que só busca o intervalo visível). Aqui não há
 * fetch nem estado de servidor: a grade é uma projeção dos agendamentos já
 * carregados.
 */

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/** Máximo de agendamentos listados dentro de uma célula. */
const MAX_CHIPS = 3;

export interface MonthCalendarProps {
  /** Primeiro dia do mês visível. */
  month: Date;
  onMonthChange: (month: Date) => void;
  appointments: Appointment[];
  /** Dia selecionado, em 'YYYY-MM-DD' local. */
  selectedDate: string | null;
  onSelectDate: (dateKey: string | null) => void;
}

/** 'YYYY-MM-DD' no fuso LOCAL. Usar toISOString() aqui erraria o dia. */
export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export function MonthCalendar({
  month,
  onMonthChange,
  appointments,
  selectedDate,
  onSelectDate,
}: MonthCalendarProps) {
  const todayKey = localDateKey(new Date());

  /** Agrupa por dia local. Chave local de novo: o appointment chega em UTC. */
  const byDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const apt of appointments) {
      const key = localDateKey(new Date(apt.startsAt));
      const list = map.get(key);
      if (list) list.push(apt);
      else map.set(key, [apt]);
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    }
    return map;
  }, [appointments]);

  /**
   * Grade de 6 semanas sempre, para a altura não pular entre meses.
   * Começa no domingo anterior ao dia 1.
   */
  const weeks = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - first.getDay());

    const cells: { key: string; day: number; inMonth: boolean }[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      cells.push({
        key: localDateKey(d),
        day: d.getDate(),
        inMonth: d.getMonth() === month.getMonth(),
      });
    }

    const rows: typeof cells[] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [month]);

  const shiftMonth = (delta: number) => {
    onMonthChange(new Date(month.getFullYear(), month.getMonth() + delta, 1));
  };

  const monthLabel = `${MONTH_NAMES[month.getMonth()]} ${month.getFullYear()}`;
  const totalInMonth = appointments.filter(
    (a) => new Date(a.startsAt).getMonth() === month.getMonth() &&
           new Date(a.startsAt).getFullYear() === month.getFullYear()
  ).length;

  return (
    <div>
      {/* Cabeçalho do mês */}
      <div className="flex items-center justify-between gap-4 px-5 md:px-6 py-4 border-b border-brand-gray">
        <div className="min-w-0">
          <h3 className="font-display font-bold text-display-sm leading-none">
            {monthLabel}
          </h3>
          <p className="text-caption text-brand-grayMid mt-1.5">
            {totalInMonth === 0
              ? 'Nenhum agendamento no mês'
              : `${totalInMonth} agendamento${totalInMonth !== 1 ? 's' : ''} no mês`}
          </p>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            aria-label="Mês anterior"
            className="p-2.5 text-brand-grayMid hover:text-brand-black hover:bg-brand-grayLight border border-transparent hover:border-brand-gray transition-colors duration-fast"
          >
            <ChevronLeftIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onMonthChange(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}
            className="btn-minimal px-4 py-2 text-caption"
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            aria-label="Próximo mês"
            className="p-2.5 text-brand-grayMid hover:text-brand-black hover:bg-brand-grayLight border border-transparent hover:border-brand-gray transition-colors duration-fast"
          >
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Dias da semana — faixa preta, como o cabeçalho das tabelas */}
      <div className="grid grid-cols-7 bg-brand-black">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="px-2 py-2.5 text-center font-display text-caption uppercase tracking-wider text-brand-white"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Grade */}
      <div className="grid grid-cols-7 border-l border-brand-gray">
        {weeks.map((week, wi) => (
          <div key={wi} className="contents">
            {week.map((cell) => {
              const dayAppointments = byDay.get(cell.key) ?? [];
              const isToday = cell.key === todayKey;
              const isSelected = cell.key === selectedDate;

              return (
                <button
                  key={cell.key}
                  type="button"
                  onClick={() => onSelectDate(isSelected ? null : cell.key)}
                  aria-pressed={isSelected}
                  aria-label={`${cell.day} — ${dayAppointments.length} agendamento${dayAppointments.length !== 1 ? 's' : ''}`}
                  className={[
                    'text-left align-top p-2 min-h-[92px] sm:min-h-[112px] border-b border-r border-brand-gray',
                    'transition-colors duration-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-black',
                    cell.inMonth ? 'bg-brand-white' : 'bg-brand-grayLight',
                    !isSelected && 'hover:bg-brand-grayLight',
                    isSelected ? 'bg-brand-black text-brand-white' : '',
                  ].join(' ')}
                >
                  {/* Número do dia */}
                  <span
                    className={[
                      'inline-flex items-center justify-center w-6 h-6 font-display font-bold text-caption tabular-nums',
                      isToday && !isSelected ? 'bg-brand-black text-brand-white' : '',
                      isToday && isSelected ? 'bg-brand-white text-brand-black' : '',
                      !cell.inMonth ? 'opacity-40' : '',
                    ].join(' ')}
                  >
                    {cell.day}
                  </span>

                  {/* Agendamentos do dia.
                      Abaixo de `sm` a célula tem ~49px: um chip com horário e
                      nome vira "09:…" ilegível. Nesse tamanho vale mais a
                      contagem — o detalhe fica na lista, e clicar no dia já
                      abre o painel ao lado. */}
                  {dayAppointments.length > 0 && (
                    <>
                      <span
                        className="sm:hidden mt-1 inline-block px-1.5 py-0.5 text-caption font-display tabular-nums bg-brand-black text-brand-white"
                        aria-hidden="true"
                      >
                        {dayAppointments.length}
                      </span>

                      <ul className="hidden sm:block mt-1.5 space-y-1">
                        {dayAppointments.slice(0, MAX_CHIPS).map((apt) => (
                          <li
                            key={apt.id}
                            className={[
                              'text-caption leading-tight truncate px-1.5 py-1 border-l-2',
                              isSelected ? 'border-brand-white bg-brand-gray' : '',
                              !isSelected && CHIP_CLASS[apt.status],
                            ].join(' ')}
                          >
                            <span className="tabular-nums font-display">
                              {new Date(apt.startsAt).toLocaleTimeString('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>{' '}
                            {apt.client?.fullName?.split(' ')[0] || 'Cliente'}
                          </li>
                        ))}

                        {dayAppointments.length > MAX_CHIPS && (
                          <li
                            className={[
                              'text-caption leading-tight px-1.5 py-0.5 tabular-nums',
                              isSelected ? 'text-brand-gray' : 'text-brand-grayMid',
                            ].join(' ')}
                          >
                            +{dayAppointments.length - MAX_CHIPS}
                          </li>
                        )}
                      </ul>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Aparência do marcador por status — toda monocromática.
 * A distinção é feita por preenchimento e peso, não por cor.
 */
const CHIP_CLASS: Record<Appointment['status'], string> = {
  SCHEDULED: 'border-brand-black text-brand-black bg-brand-grayLight',
  COMPLETED: 'border-brand-black bg-brand-black text-brand-white',
  CANCELLED: 'border-brand-grayMid text-brand-grayMid line-through',
  NO_SHOW: 'border-brand-gray bg-brand-white text-brand-grayMid',
};

export default MonthCalendar;