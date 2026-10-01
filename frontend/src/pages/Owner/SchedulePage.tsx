import { useState, useEffect, useCallback } from 'react';
import { ownerApi, employeesApi } from '@services/api';
import { useToast } from '@contexts/ToastContext';
import { formatCurrency as fmtCurrency } from '@utils/date';
import { clientLabel } from '@utils/client';
import type { Appointment, Employee } from '@types';
import { Button, Input, Select, Container, Card, CardContent } from '@components/ui';
import { PageHeader, StatusBadge, EmptyState, PageSpinner } from '@components/Dashboard';
import { ListIcon, GridIcon, CloseIcon } from '@components/icons';
import { MonthCalendar, localDateKey } from '@components/MonthCalendar';

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'SCHEDULED', label: 'Agendados' },
  { value: 'COMPLETED', label: 'Concluídos' },
  { value: 'CANCELLED', label: 'Cancelados' },
  { value: 'NO_SHOW', label: 'Não compareceu' },
];

const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);

/** Teto de itens por requisição. Acima disso o backend devolve 400. */
const MAX_LIMIT = 100;

export function OwnerSchedulePage() {
  const { showToast } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    startDate: '',
    endDate: '',
    employeeId: '',
  });
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  // Estado do calendário — só importa na visão de calendário
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [calendarData, setCalendarData] = useState<Appointment[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (viewMode === 'list') {
      loadAppointments();
    } else {
      loadCalendar();
    }
  }, [filters, viewMode, month]);

  const loadData = async () => {
    try {
      const empRes = await employeesApi.getActive();
      setEmployees(empRes.employees);
    } catch (err: any) {
      showToast({ type: 'error', title: 'Erro', message: err.message });
    }
  };

  const loadAppointments = async () => {
    setLoading(true);
    try {
      const res = await ownerApi.getAppointments(filters);
      setAppointments(res.appointments);
    } catch (err: any) {
      showToast({ type: 'error', title: 'Erro', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  /**
   * A grade busca o mês inteiro de uma vez. Os filtros de data da barra
   * acima não se aplicam aqui — quem mexe no mês escolhe o período pelo
   * próprio calendário, e misturar os doisoria dava resultados que ninguém
   * consegue explicar.
   */
  const loadCalendar = useCallback(async () => {
    setCalendarLoading(true);
    try {
      const res = await ownerApi.getAppointments({
        status: filters.status,
        employeeId: filters.employeeId,
        startDate: localDateKey(startOfMonth(month)),
        endDate: localDateKey(endOfMonth(month)),
        limit: MAX_LIMIT,
      });
      setCalendarData(res.appointments);
      setTruncated((res.pagination?.total ?? 0) > res.appointments.length);
    } catch (err: any) {
      showToast({ type: 'error', title: 'Erro', message: err.message });
    } finally {
      setCalendarLoading(false);
    }
  }, [filters.status, filters.employeeId, month, showToast]);

  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({ status: '', startDate: '', endDate: '', employeeId: '' });
  };

  const hasFilters = Object.values(filters).some(Boolean);

  const selectedDayAppointments = selectedDate
    ? calendarData
        .filter((a) => localDateKey(new Date(a.startsAt)) === selectedDate)
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    : [];

  const selectedDayTotal = selectedDayAppointments
    .filter((a) => a.status === 'COMPLETED')
    .reduce((sum, a) => sum + (a.service?.price || 0), 0);

  return (
    <Container size="full" className="!px-0">
      <PageHeader
        title="Agenda Geral"
        description={
          viewMode === 'list'
            ? `${appointments.length} agendamento${appointments.length !== 1 ? 's' : ''} no filtro atual`
            : 'Visão do mês por dia'
        }
        action={
          <div className="tabs" role="tablist" aria-label="Modo de visualização">
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'list'}
              onClick={() => setViewMode('list')}
              className={`tab ${viewMode === 'list' ? 'tab-active' : 'tab-inactive'}`}
            >
              <ListIcon className="w-3.5 h-3.5" />
              Lista
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'calendar'}
              onClick={() => setViewMode('calendar')}
              className={`tab ${viewMode === 'calendar' ? 'tab-active' : 'tab-inactive'}`}
            >
              <GridIcon className="w-3.5 h-3.5" />
              Calendário
            </button>
          </div>
        }
      />

      {/* Filtros */}
      <Card className="p-5 md:p-6 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          <Select
            label="Status"
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            options={STATUS_OPTIONS}
          />
          <Select
            label="Profissional"
            value={filters.employeeId}
            onChange={(e) => handleFilterChange('employeeId', e.target.value)}
            options={[
              { value: '', label: 'Todos' },
              ...employees.map((e) => ({ value: e.id, label: e.name })),
            ]}
          />
          {viewMode === 'list' ? (
            <>
              <Input
                label="Data início"
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
              />
              <Input
                label="Data fim"
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
              />
            </>
          ) : (
            <>
              <div className="sm:col-span-2 xl:col-span-2 flex items-end">
                <p className="text-caption text-brand-grayMid">
                  No calendário o período é o próprio mês visível — os campos de
                  data não se aplicam aqui.
                </p>
              </div>
            </>
          )}
        </div>
        {hasFilters && (
          <div className="mt-5 pt-5 border-t border-brand-gray">
            <Button variant="minimal" onClick={clearFilters}>
              Limpar filtros
            </Button>
          </div>
        )}
      </Card>

      {viewMode === 'list' ? (
        loading ? (
          <PageSpinner />
        ) : (
          <Card>
            {appointments.length === 0 ? (
              <EmptyState
                title="Nenhum agendamento encontrado"
                description={
                  hasFilters
                    ? 'Ajuste ou limpe os filtros para ver outros agendamentos.'
                    : 'Quando houver agendamentos, eles aparecem aqui.'
                }
              />
            ) : (
              <ul>
                {appointments.map((apt) => (
                  <li
                    key={apt.id}
                    className="px-5 md:px-6 py-4 flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-5 border-b border-brand-gray last:border-b-0 hover:bg-brand-grayLight transition-colors duration-fast"
                  >
                    {/* Data/hora em bloco fixo */}
                    <div className="flex-shrink-0 w-16 lg:w-20">
                      <p className="font-display font-bold text-body-lg tabular-nums leading-none">
                        {new Date(apt.startsAt).toLocaleDateString('pt-BR', { day: '2-digit' })}
                      </p>
                      <p className="text-caption text-brand-grayMid mt-1">
                        {new Date(apt.startsAt).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}
                      </p>
                      <p className="text-caption text-brand-grayMid tabular-nums">
                        {new Date(apt.startsAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-display font-medium text-body truncate">
                        {clientLabel(apt.client)}
                      </p>
                      <p className="text-body-sm text-brand-grayMid truncate">
                        {apt.service?.name}
                      </p>
                    </div>

                    {/* Profissional com foto — o dono vê de cara quem atendeu */}
                    {apt.employee && (
                      <div className="flex items-center gap-2.5 flex-shrink-0">
                        <span className="w-8 h-8 flex-shrink-0 bg-brand-grayLight border border-brand-gray overflow-hidden flex items-center justify-center">
                          {apt.employee.photoUrl ? (
                            <img
                              src={apt.employee.photoUrl}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="font-display font-bold text-caption text-brand-grayMid">
                              {apt.employee.name.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </span>
                        <span className="text-body-sm truncate max-w-[9rem]">
                          {apt.employee.name}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-5 flex-shrink-0">
                      <span className="font-display font-medium text-body tabular-nums">
                        {fmtCurrency(apt.service?.price || 0)}
                      </span>
                      <StatusBadge tone={STATUS_TONE[apt.status]}>{STATUS_LABEL[apt.status]}</StatusBadge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )
      ) : (
        <div className="grid xl:grid-cols-3 gap-6 items-start">
          <Card className="xl:col-span-2 overflow-hidden">
            <MonthCalendar
              month={month}
              onMonthChange={setMonth}
              appointments={calendarData}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />

            {calendarLoading && (
              <p className="px-5 md:px-6 py-3 border-t border-brand-gray text-caption text-brand-grayMid">
                Carregando...
              </p>
            )}

            {truncated && !calendarLoading && (
              <p className="px-5 md:px-6 py-3 border-t border-brand-gray text-caption text-brand-grayMid">
                Mostrando os {MAX_LIMIT} agendamentos mais recentes do mês. Use os
                filtros de status ou profissional para afinar.
              </p>
            )}
          </Card>

          {/* Detalhe do dia selecionado */}
          <Card className="xl:sticky xl:top-6">
            <div className="px-5 md:px-6 py-4 border-b border-brand-gray flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-display font-semibold text-body truncate">
                  {selectedDate
                    ? new Date(`${selectedDate}T12:00:00`).toLocaleDateString('pt-BR', {
                        weekday: 'long',
                        day: '2-digit',
                        month: 'long',
                      })
                    : 'Selecione um dia'}
                </h3>
                {selectedDate && selectedDayAppointments.length > 0 && (
                  <p className="text-caption text-brand-grayMid mt-1 tabular-nums">
                    {fmtCurrency(selectedDayTotal)} concluídos
                  </p>
                )}
              </div>
              {selectedDate && (
                <button
                  type="button"
                  onClick={() => setSelectedDate(null)}
                  aria-label="Fechar detalhe do dia"
                  title="Fechar"
                  className="p-2 text-brand-grayMid hover:text-brand-black hover:bg-brand-grayLight border border-transparent hover:border-brand-gray transition-colors duration-fast flex-shrink-0"
                >
                  <CloseIcon className="w-4 h-4" />
                </button>
              )}
            </div>

            <CardContent>
              {!selectedDate ? (
                <p className="text-body-sm text-brand-grayMid py-4">
                  Clique em um dia no calendário para ver os agendamentos dele.
                </p>
              ) : selectedDayAppointments.length === 0 ? (
                <p className="text-body-sm text-brand-grayMid py-4">
                  Nenhum agendamento neste dia.
                </p>
              ) : (
                <ul className="divide-y divide-brand-gray">
                  {selectedDayAppointments.map((apt) => (
                    <li key={apt.id} className="py-3.5 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-display font-bold text-body tabular-nums leading-none pt-0.5">
                          {new Date(apt.startsAt).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                        <StatusBadge tone={STATUS_TONE[apt.status]}>
                          {STATUS_LABEL[apt.status]}
                        </StatusBadge>
                      </div>
                      <p className="text-body-sm mt-2">{clientLabel(apt.client)}</p>
                      <p className="text-caption text-brand-grayMid mt-0.5">
                        {apt.service?.name} &middot; {apt.employee?.name}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </Container>
  );
}

const STATUS_LABEL: Record<Appointment['status'], string> = {
  SCHEDULED: 'Agendado',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
  NO_SHOW: 'Não compareceu',
};

const STATUS_TONE: Record<Appointment['status'], 'info' | 'success' | 'danger' | 'warning'> = {
  SCHEDULED: 'info',
  COMPLETED: 'success',
  CANCELLED: 'danger',
  NO_SHOW: 'warning',
};

export default OwnerSchedulePage;
