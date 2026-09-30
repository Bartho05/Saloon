import { useState, useEffect } from 'react';
import { ownerApi } from '@services/api';
import { useToast } from '@contexts/ToastContext';
import { formatCurrency } from '@utils/date';
import type { Service } from '@types';
import { Button, Input, Textarea, Modal, Container, Card } from '@components/ui';
import { PageHeader, EmptyState, PageSpinner } from '@components/Dashboard';
import { PlusIcon, PencilIcon, TrashIcon, RefreshIcon } from '@components/icons';

export function OwnerServicesPage() {
  const { showToast } = useToast();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    durationMinutes: 30,
    price: 0,
    isActive: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Service | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    setLoading(true);
    try {
      // Rota autenticada: a pública /services não devolve `isActive`, e sem
      // esse campo todo serviço aparecia como "Inativo" e não dava para
      // reativar um serviço desativado.
      const res = await ownerApi.getServices();
      setServices(res.services);
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
      if (editingService) {
        await ownerApi.updateService(editingService.id, formData);
        showToast({ type: 'success', title: 'Serviço atualizado' });
      } else {
        await ownerApi.createService(formData);
        showToast({ type: 'success', title: 'Serviço criado' });
      }
      closeModal();
      loadServices();
    } catch (err: any) {
      showToast({ type: 'error', title: 'Erro', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (service: Service) => {
    setTogglingId(service.id);
    try {
      await ownerApi.updateService(service.id, { isActive: !service.isActive });
      showToast({
        type: 'success',
        title: service.isActive ? 'Serviço desativado' : 'Serviço reativado',
      });
      loadServices();
    } catch (err: any) {
      showToast({ type: 'error', title: 'Erro', message: err.message });
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await ownerApi.deleteService(confirmDelete.id);
      showToast({ type: 'success', title: 'Serviço desativado' });
      setConfirmDelete(null);
      loadServices();
    } catch (err: any) {
      showToast({ type: 'error', title: 'Erro', message: err.message });
    } finally {
      setDeleting(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingService(null);
    setFormData({ name: '', description: '', durationMinutes: 30, price: 0, isActive: true });
  };

  const openCreateModal = () => {
    setEditingService(null);
    setFormData({ name: '', description: '', durationMinutes: 30, price: 0, isActive: true });
    setShowModal(true);
  };

  const openEditModal = (service: Service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      description: service.description || '',
      durationMinutes: service.durationMinutes,
      price: service.price,
      isActive: service.isActive,
    });
    setShowModal(true);
  };

  if (loading) return <PageSpinner />;

  const activeCount = services.filter((s) => s.isActive).length;

  return (
    <Container size="full" className="!px-0">
      <PageHeader
        title="Serviços"
        description={`${activeCount} ativo${activeCount !== 1 ? 's' : ''} de ${services.length} cadastrado${services.length !== 1 ? 's' : ''}`}
        action={
          <Button onClick={openCreateModal}>
            <PlusIcon className="w-4 h-4" />
            Novo Serviço
          </Button>
        }
      />

      {services.length === 0 ? (
        <Card>
          <EmptyState
            title="Nenhum serviço cadastrado"
            description="Crie seu primeiro serviço para começar a receber agendamentos."
            action={<Button onClick={openCreateModal}>Criar Serviço</Button>}
          />
        </Card>
      ) : (
        <Card>
          <ul>
            {services.map((service) => (
              <li
                key={service.id}
                className="group px-5 md:px-6 py-5 flex items-center gap-4 border-b border-brand-gray last:border-b-0 hover:bg-brand-grayLight transition-colors duration-fast"
              >
                {/* Índice */}
                <span className="font-display font-bold text-body-lg text-brand-grayMid w-6 flex-shrink-0">
                  {String(services.indexOf(service) + 1).padStart(2, '0')}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="font-display font-medium text-body-lg">{service.name}</h3>
                    <span className="inline-flex items-center gap-1.5 text-caption text-brand-grayMid">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          service.isActive ? 'bg-brand-black' : 'bg-brand-gray border border-brand-grayMid'
                        }`}
                        aria-hidden="true"
                      />
                      {service.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>

                  <div className="flex items-center gap-x-4 gap-y-1 mt-1.5 flex-wrap text-body-sm text-brand-grayMid">
                    <span className="badge badge-muted">{service.durationMinutes} min</span>
                    {service.description && (
                      <span className="truncate max-w-md">{service.description}</span>
                    )}
                  </div>
                </div>

                <span className="font-display font-medium text-body-lg tabular-nums flex-shrink-0 w-28 text-right">
                  {formatCurrency(service.price)}
                </span>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <IconAction
                    label={service.isActive ? `Desativar ${service.name}` : `Reativar ${service.name}`}
                    onClick={() => handleToggle(service)}
                    disabled={togglingId === service.id}
                    spinning={togglingId === service.id}
                  >
                    <RefreshIcon className="w-4 h-4" />
                  </IconAction>
                  <IconAction label={`Editar ${service.name}`} onClick={() => openEditModal(service)}>
                    <PencilIcon className="w-4 h-4" />
                  </IconAction>
                  <IconAction
                    label={`Excluir ${service.name}`}
                    onClick={() => setConfirmDelete(service)}
                    disabled={!service.isActive}
                  >
                    <TrashIcon className="w-4 h-4" />
                  </IconAction>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Modal
        open={showModal}
        onClose={closeModal}
        title={editingService ? 'Editar Serviço' : 'Novo Serviço'}
        description={editingService ? 'Altere os dados do serviço.' : 'Defina duração e preço.'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            label="Nome"
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            required
            placeholder="Ex: Corte Masculino"
          />

          <Textarea
            label="Descrição"
            value={formData.description}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            rows={3}
            placeholder="Detalhes do serviço..."
          />

          <div className="grid grid-cols-2 gap-5">
            <Input
              label="Duração (min)"
              type="number"
              value={formData.durationMinutes}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, durationMinutes: parseInt(e.target.value) || 0 }))
              }
              min={15}
              max={480}
              step={15}
              required
            />
            <Input
              label="Preço (R$)"
              type="number"
              value={formData.price}
              onChange={(e) => setFormData((prev) => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
              min={0}
              step={0.01}
              required
            />
          </div>

          {editingService && (
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData((prev) => ({ ...prev, isActive: e.target.checked }))}
                className="w-4 h-4 border-brand-gray accent-brand-black"
              />
              <span className="text-body-sm">Serviço ativo (aparece no agendamento público)</span>
            </label>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={closeModal} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={submitting} loading={submitting}>
              {editingService ? 'Salvar alterações' : 'Criar serviço'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title="Desativar serviço"
        description={
          confirmDelete
            ? `${confirmDelete.name} deixará de aparecer no agendamento público. Você pode reativar depois.`
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
      {spinning ? (
        <span className="block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        children
      )}
    </button>
  );
}

export default OwnerServicesPage;
