import { useState, useEffect } from 'react';
import { ownerApi, employeesApi } from '@services/api';
import { useToast } from '@contexts/ToastContext';
import { formatCurrency as fmtCurrency } from '@utils/date';
import type { Appointment, Employee } from '@types';
import { Button, Input, Select, Container, Card } from '@components/ui';
import { PageHeader, StatusBadge, EmptyState, PageSpinner } from '@components/Dashboard';
import { ListIcon, GridIcon } from '@components/icons';

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'SCHEDULED', label: 'Agendados' },
  { value: 'COMPLETED', label: 'Concluídos' },
  { value: 'CANCELLED', label: 'Cancelados' },
  { value: 'NO_SHOW', label: 'Não compareceu' },
];

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

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadAppointments();
  }, [filters]);

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

  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({ status: '', startDate: '', endDate: '', employeeId: '' });
  };

  const hasFilters = Object.values(filters).some(Boolean);

  if (loading) return <PageSpinner />;

  return (
    <Container size="full" className="!px-0">
      <PageHeader
        title="Agenda Geral"
        description={`${appointments.length} agendamento${appointments.length !== 1 ? 's' : ''} no filtro atual`}
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
                      {apt.client?.fullName || 'Cliente'}
                    </p>
                    <p className="text-body-sm text-brand-grayMid truncate">
                      {apt.service?.name} &middot; {apt.employee?.name}
                    </p>
                  </div>

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
      ) : (
        <Card>
          <EmptyState
            title="Visão de calendário em construção"
            description="A lista é a visão mais útil para operação diária. A grade por mês chega na próxima etapa."
          />
        </Card>
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
