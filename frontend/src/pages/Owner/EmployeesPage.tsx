import { useState, useEffect } from 'react';
import { ownerApi, servicesApi } from '@services/api';
import { useToast } from '@contexts/ToastContext';
import { formatPhone } from '@utils/validation';
import type { Employee, Service } from '@types';
import { Button, Input, Modal, Container, Card } from '@components/ui';
import { PageHeader, EmptyState, PageSpinner } from '@components/Dashboard';
import {
  PhoneIcon,
  ShieldIcon,
  PencilIcon,
  RefreshIcon,
  TrashIcon,
  PlusIcon,
} from '@components/icons';

export function OwnerEmployeesPage() {
  const { showToast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    specialties: [] as string[],
  });
  const [submitting, setSubmitting] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Employee | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [empRes, svcRes] = await Promise.all([
        ownerApi.getEmployees(),
        servicesApi.getAll(),
      ]);
      setEmployees(empRes.employees);
      setServices(svcRes.services);
    } catch (err: any) {
      showToast({ type: 'error', title: 'Erro', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingEmployee) {
        await ownerApi.updateEmployee(editingEmployee.id, formData);
        showToast({ type: 'success', title: 'Funcionário atualizado' });
      } else {
        await ownerApi.createEmployee(formData);
        showToast({ type: 'success', title: 'Funcionário criado' });
      }
      closeModal();
      loadData();
    } catch (err: any) {
      showToast({ type: 'error', title: 'Erro', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setFormData({
      name: employee.name,
      phone: employee.phone,
      specialties: employee.specialties,
    });
    setShowModal(true);
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await ownerApi.deleteEmployee(confirmDelete.id);
      showToast({ type: 'success', title: 'Funcionário desativado' });
      setConfirmDelete(null);
      loadData();
    } catch (err: any) {
      showToast({ type: 'error', title: 'Erro', message: err.message });
    } finally {
      setDeleting(false);
    }
  };

  const handleRegenerateCode = async (id: string) => {
    setRegeneratingId(id);
    try {
      await ownerApi.regenerateAccessCode(id);
      showToast({ type: 'success', title: 'Código regenerado e enviado via WhatsApp' });
      loadData();
    } catch (err: any) {
      showToast({ type: 'error', title: 'Erro', message: err.message });
    } finally {
      setRegeneratingId(null);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingEmployee(null);
    setFormData({ name: '', phone: '', specialties: [] });
  };

  const openCreateModal = () => {
    setEditingEmployee(null);
    setFormData({ name: '', phone: '', specialties: [] });
    setShowModal(true);
  };

  const toggleSpecialty = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      specialties: prev.specialties.includes(name)
        ? prev.specialties.filter((s) => s !== name)
        : [...prev.specialties, name],
    }));
  };

  if (loading) return <PageSpinner />;

  const activeCount = employees.filter((e) => e.isActive).length;

  return (
    <Container size="full" className="!px-0">
      <PageHeader
        title="Funcionários"
        description={`${activeCount} ativo${activeCount !== 1 ? 's' : ''} de ${employees.length} cadastrado${employees.length !== 1 ? 's' : ''}`}
        action={
          <Button onClick={openCreateModal}>
            <PlusIcon className="w-4 h-4" />
            Novo Funcionário
          </Button>
        }
      />

      {employees.length === 0 ? (
        <Card>
          <EmptyState
            title="Nenhum funcionário cadastrado"
            description="Adicione profissionais para que eles possam acessar suas agendas."
            action={<Button onClick={openCreateModal}>Adicionar Funcionário</Button>}
          />
        </Card>
      ) : (
        <Card>
          <ul>
            {employees.map((employee) => (
              <li
                key={employee.id}
                className="group px-5 md:px-6 py-5 flex items-center gap-4 border-b border-brand-gray last:border-b-0 hover:bg-brand-grayLight transition-colors duration-fast"
              >
                {/* Avatar */}
                <div
                  className={`w-11 h-11 flex-shrink-0 flex items-center justify-center font-display font-bold text-body-lg border ${
                    employee.isActive
                      ? 'bg-brand-black text-brand-white border-brand-black'
                      : 'bg-transparent text-brand-grayMid border-brand-gray'
                  }`}
                  aria-hidden="true"
                >
                  {employee.name.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="font-display font-medium text-body-lg">{employee.name}</h3>
                    <span className="inline-flex items-center gap-1.5 text-caption text-brand-grayMid">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          employee.isActive ? 'bg-brand-black' : 'bg-brand-gray border border-brand-grayMid'
                        }`}
                        aria-hidden="true"
                      />
                      {employee.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>

                  <div className="flex items-center gap-x-5 gap-y-1 mt-1.5 flex-wrap text-body-sm text-brand-grayMid">
                    <span className="inline-flex items-center gap-1.5">
                      <PhoneIcon className="w-3.5 h-3.5" />
                      {formatPhone(employee.phone)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <ShieldIcon className="w-3.5 h-3.5" />
                      <span className="font-mono tracking-wider">{employee.accessCode}</span>
                    </span>
                  </div>

                  {employee.specialties.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {employee.specialties.map((spec) => (
                        <span key={spec} className="badge badge-muted">{spec}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Ações */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <IconAction
                    label={`Editar ${employee.name}`}
                    onClick={() => handleEdit(employee)}
                  >
                    <PencilIcon className="w-4 h-4" />
                  </IconAction>
                  <IconAction
                    label="Gerar novo código de acesso"
                    onClick={() => handleRegenerateCode(employee.id)}
                    disabled={regeneratingId === employee.id}
                    spinning={regeneratingId === employee.id}
                  >
                    <RefreshIcon className="w-4 h-4" />
                  </IconAction>
                  <IconAction
                    label={`Desativar ${employee.name}`}
                    onClick={() => setConfirmDelete(employee)}
                    disabled={!employee.isActive}
                  >
                    <TrashIcon className="w-4 h-4" />
                  </IconAction>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Formulário */}
      <Modal
        open={showModal}
        onClose={closeModal}
        title={editingEmployee ? 'Editar Funcionário' : 'Novo Funcionário'}
        description={
          editingEmployee
            ? 'Altere os dados e as especialidades.'
            : 'O código de acesso é gerado automaticamente.'
        }
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            label="Nome"
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            required
            placeholder="Nome completo"
          />

          <Input
            label="Telefone (WhatsApp)"
            type="tel"
            inputMode="numeric"
            value={formData.phone}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, phone: e.target.value.replace(/\D/g, '').slice(0, 11) }))
            }
            required
            placeholder="31999999999"
          />

          <fieldset>
            <legend className="field-label">Especialidades</legend>
            {services.length === 0 ? (
              <p className="text-body-sm text-brand-grayMid">
                Cadastre serviços antes de definir as especialidades.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2 mt-2">
                {services.map((svc) => {
                  const selected = formData.specialties.includes(svc.name);
                  return (
                    <button
                      key={svc.id}
                      type="button"
                      onClick={() => toggleSpecialty(svc.name)}
                      aria-pressed={selected}
                      className={`px-3 py-2 text-body-sm border transition-colors duration-fast ${
                        selected
                          ? 'bg-brand-black text-brand-white border-brand-black'
                          : 'bg-brand-white text-brand-black border-brand-gray hover:border-brand-black'
                      }`}
                    >
                      {svc.name}
                    </button>
                  );
                })}
              </div>
            )}
            {formData.specialties.length === 0 && services.length > 0 && (
              <p className="field-hint mt-2">Selecione ao menos uma especialidade</p>
            )}
          </fieldset>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={closeModal} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={submitting} loading={submitting}>
              {editingEmployee ? 'Salvar alterações' : 'Criar funcionário'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirmação de desativação */}
      <Modal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title="Desativar funcionário"
        description={
          confirmDelete
            ? `${confirmDelete.name} deixará de aparecer no agendamento público. O histórico de agendamentos é preservado.`
            : undefined
        }
        size="sm"
      >
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={() => setConfirmDelete(null)} disabled={deleting}>
            Cancelar
          </Button>
          <Button onClick={handleDelete} disabled={deleting} loading={deleting}>
            Desativar
          </Button>
        </div>
      </Modal>
    </Container>
  );
}

function IconAction({
  label,
  onClick,
  disabled,
  spinning,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  spinning?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="p-2.5 text-brand-grayMid hover:text-brand-black hover:bg-brand-white border border-transparent hover:border-brand-gray transition-colors duration-fast disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-transparent"
    >
      {spinning ? <span className="block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : children}
    </button>
  );
}

export default OwnerEmployeesPage;
