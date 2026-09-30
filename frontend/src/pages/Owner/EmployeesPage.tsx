import { useState, useEffect } from 'react';
import { ownerApi, servicesApi } from '@services/api';
import { useToast } from '@contexts/ToastContext';
import type { Employee, Service } from '@types';

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
    serviceIds: [] as string[],
  });
  const [submitting, setSubmitting] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

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
      setShowModal(false);
      setEditingEmployee(null);
      resetForm();
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
      serviceIds: employee.services?.map(s => s.id) || [],
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza? Funcionários com agendamentos futuros não podem ser desativados.')) return;
    try {
      await ownerApi.deleteEmployee(id);
      showToast({ type: 'success', title: 'Funcionário desativado' });
      loadData();
    } catch (err: any) {
      showToast({ type: 'error', title: 'Erro', message: err.message });
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

  const resetForm = () => {
    setFormData({ name: '', phone: '', specialties: [], serviceIds: [] });
  };

  const openCreateModal = () => {
    setEditingEmployee(null);
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
        <h1 className="text-2xl font-bold text-brand-black">Funcionários</h1>
        <button onClick={openCreateModal} className="px-4 py-2 bg-brand-black text-white  font-medium hover:bg-brand-grayDark">
          <svg className="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
          Novo Funcionário
        </button>
      </div>

      {employees.length === 0 ? (
        <div className="text-center py-12 bg-brand-grayLight ">
          <svg className="w-16 h-16 text-brand-grayMid mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <h3 className="text-lg font-medium text-brand-black mb-1">Nenhum funcionário cadastrado</h3>
          <p className="text-brand-grayMid mb-4">Adicione profissionais para que eles possam acessar suas agendas</p>
          <button onClick={openCreateModal} className="px-6 py-3 bg-brand-black text-white  font-medium hover:bg-brand-grayDark">
            Adicionar Funcionário
          </button>
        </div>
      ) : (
        <div className="bg-brand-white  border border-brand-gray divide-y divide-brand-gray">
          {employees.map(employee => (
            <div key={employee.id} className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-brand-grayLight">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="font-medium text-brand-black">{employee.name}</h3>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${employee.isActive ? 'bg-green-50 text-green-800' : 'bg-brand-gray text-brand-black'}`}>
                    {employee.isActive ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                <p className="text-sm text-brand-grayMid mt-1 flex items-center gap-4 flex-wrap">
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    {employee.phone}
                  </span>
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <span className="font-mono bg-brand-gray px-2 py-1 rounded">{employee.accessCode}</span>
                  </span>
                </p>
                {employee.specialties.length > 0 && (
                  <p className="text-sm text-brand-grayMid mt-1">
                    Especialidades: {employee.specialties.join(', ')}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleEdit(employee)} className="p-2 text-brand-grayMid hover:text-brand-black hover:bg-brand-gray ">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button 
                  onClick={() => handleRegenerateCode(employee.id)} 
                  disabled={regeneratingId === employee.id}
                  className="p-2 text-brand-black hover:text-brand-black hover:bg-brand-grayLight  disabled:opacity-50"
                  title="Regenerar código de acesso"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                <button onClick={() => handleDelete(employee.id)} className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 ">
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
              <h2 className="text-xl font-semibold text-brand-black">{editingEmployee ? 'Editar Funcionário' : 'Novo Funcionário'}</h2>
              <button onClick={() => { setShowModal(false); setEditingEmployee(null); }} className="p-2 text-brand-grayMid hover:text-brand-black">
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
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-black mb-1">Telefone (WhatsApp) *</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value.replace(/\D/g, '') }))}
                  required
                  maxLength={11}
                  className="w-full px-4 py-3 border border-brand-gray  focus:border-brand-black focus:ring-2 focus:ring-brand-black/20 outline-none font-mono"
                  placeholder="11999999999"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-black mb-1">Especialidades *</label>
                <div className="flex flex-wrap gap-2">
                  {services.map(svc => (
                    <label key={svc.id} className="flex items-center gap-2 px-3 py-2 border  cursor-pointer hover:bg-brand-grayLight">
                      <input
                        type="checkbox"
                        checked={formData.specialties.includes(svc.name)}
                        onChange={e => setFormData(prev => ({
                          ...prev,
                          specialties: e.target.checked 
                            ? [...prev.specialties, svc.name]
                            : prev.specialties.filter(s => s !== svc.name)
                        }))}
                        className="rounded border-brand-gray text-brand-black focus:ring-brand-black"
                      />
                      <span className="text-sm">{svc.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowModal(false); setEditingEmployee(null); }} className="flex-1 py-3 px-4 border border-brand-gray text-brand-black  font-medium hover:bg-brand-grayLight">
                  Cancelar
                </button>
                <button type="submit" disabled={submitting} className="flex-1 py-3 px-4 bg-brand-black text-white  font-medium hover:bg-brand-grayDark disabled:opacity-50">
                  {submitting ? 'Salvando...' : (editingEmployee ? 'Atualizar' : 'Criar')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}