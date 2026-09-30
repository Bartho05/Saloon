import { useState, useEffect } from 'react';
import { ownerApi, servicesApi } from '@services/api';
import { useToast } from '@contexts/ToastContext';
import { formatCurrency } from '@utils/date';
import type { Service } from '@types';

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
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    setLoading(true);
    try {
      const res = await servicesApi.getAll();
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
      setShowModal(false);
      setEditingService(null);
      resetForm();
      loadServices();
    } catch (err: any) {
      showToast({ type: 'error', title: 'Erro', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (service: Service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      description: service.description || '',
      durationMinutes: service.durationMinutes,
      price: service.price,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza? Serviços com agendamentos futuros não podem ser desativados.')) return;
    try {
      await ownerApi.deleteService(id);
      showToast({ type: 'success', title: 'Serviço desativado' });
      loadServices();
    } catch (err: any) {
      showToast({ type: 'error', title: 'Erro', message: err.message });
    }
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', durationMinutes: 30, price: 0 });
  };

  const openCreateModal = () => {
    setEditingService(null);
    resetForm();
    setShowModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-brand-black border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand-black">Serviços</h1>
        <button onClick={openCreateModal} className="px-4 py-2 bg-brand-black text-white  font-medium hover:bg-brand-grayDark">
          <svg className="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo Serviço
        </button>
      </div>

      {services.length === 0 ? (
        <div className="text-center py-12 bg-brand-grayLight ">
          <svg className="w-16 h-16 text-brand-grayMid mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 3.101v3.867M9 14.25v2.25m-2.247-3.375l1.515 1.515m0 0l1.515 1.516m-1.515-1.515l-1.515 1.515M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <h3 className="text-lg font-medium text-brand-black mb-1">Nenhum serviço cadastrado</h3>
          <p className="text-brand-grayMid mb-4">Crie seu primeiro serviço para começar a receber agendamentos</p>
          <button onClick={openCreateModal} className="px-6 py-3 bg-brand-black text-white  font-medium hover:bg-brand-grayDark">
            Criar Serviço
          </button>
        </div>
      ) : (
        <div className="bg-brand-white  border border-brand-gray divide-y divide-brand-gray">
          {services.map(service => (
            <div key={service.id} className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-brand-grayLight">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <h3 className="font-medium text-brand-black">{service.name}</h3>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${service.isActive ? 'bg-green-50 text-green-800' : 'bg-brand-gray text-brand-black'}`}>
                    {service.isActive ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                <p className="text-sm text-brand-grayMid mt-1 flex items-center gap-4">
                  <span>{service.durationMinutes} min</span>
                  <span className="font-medium text-brand-black">{formatCurrency(service.price)}</span>
                  {service.description && <span className="truncate max-w-xs">{service.description}</span>}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleEdit(service)} className="p-2 text-brand-grayMid hover:text-brand-black hover:bg-brand-gray ">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button onClick={() => handleDelete(service.id)} className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 ">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-brand-white  max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-brand-gray flex items-center justify-between">
              <h2 className="text-xl font-semibold text-brand-black">{editingService ? 'Editar Serviço' : 'Novo Serviço'}</h2>
              <button onClick={() => { setShowModal(false); setEditingService(null); }} className="p-2 text-brand-grayMid hover:text-brand-black">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-brand-black mb-1">Nome *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                  className="w-full px-4 py-3 border border-brand-gray  focus:border-brand-black focus:ring-2 focus:ring-brand-black/20 outline-none"
                  placeholder="Ex: Corte Feminino"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-black mb-1">Descrição</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-3 border border-brand-gray  focus:border-brand-black focus:ring-2 focus:ring-brand-black/20 outline-none"
                  placeholder="Detalhes do serviço..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-brand-black mb-1">Duração (min) *</label>
                  <input
                    type="number"
                    value={formData.durationMinutes}
                    onChange={e => setFormData(prev => ({ ...prev, durationMinutes: parseInt(e.target.value) || 0 }))}
                    min={15}
                    max={480}
                    step={15}
                    required
                    className="w-full px-4 py-3 border border-brand-gray  focus:border-brand-black focus:ring-2 focus:ring-brand-black/20 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-brand-black mb-1">Preço (R$) *</label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={e => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                    min={0}
                    step={0.01}
                    required
                    className="w-full px-4 py-3 border border-brand-gray  focus:border-brand-black focus:ring-2 focus:ring-brand-black/20 outline-none"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowModal(false); setEditingService(null); }} className="flex-1 py-3 px-4 border border-brand-gray text-brand-black  font-medium hover:bg-brand-grayLight">
                  Cancelar
                </button>
                <button type="submit" disabled={submitting} className="flex-1 py-3 px-4 bg-brand-black text-white  font-medium hover:bg-brand-grayDark disabled:opacity-50">
                  {submitting ? 'Salvando...' : (editingService ? 'Atualizar' : 'Criar')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}