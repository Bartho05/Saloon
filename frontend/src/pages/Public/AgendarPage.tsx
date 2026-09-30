import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookingApi, servicesApi, employeesApi } from '@services/api';
import { useBookingFlow } from '@hooks/useBookingFlow';
import { BookingProgress } from '@components/BookingProgress';
import { BookingCalendar } from '@components/BookingCalendar';
import { PhoneInput } from '@components/PhoneInput';
import { BookingConfirmation } from '@components/BookingConfirmation';
import { useToast } from '@contexts/ToastContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Service, Employee, Client } from '@types';

export function AgendarPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [state, actions] = useBookingFlow();
  
  const [services, setServices] = useState<Service[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [checkingPhone, setCheckingPhone] = useState(false);
  const [clientExists, setClientExists] = useState<Client | null>(null);
  const [step4Error, setStep4Error] = useState<string | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // Carrega serviços
  useEffect(() => {
    servicesApi.getAll().then(res => setServices(res.services));
  }, []);

  // Atualiza funcionários filtrados quando serviço muda
  useEffect(() => {
    if (state.service) {
      employeesApi.getByService(state.service.id).then(res => {
        setFilteredEmployees(res.employees);
      });
    } else {
      setFilteredEmployees(employees);
    }
  }, [state.service]);

  // Carrega todos os funcionários para fallback
  useEffect(() => {
    employeesApi.getActive().then(res => setEmployees(res.employees));
  }, []);

  const completedSteps = useMemo(() => {
    const steps: number[] = [];
    if (state.service) steps.push(0);
    if (state.employee) steps.push(1);
    if (state.selectedSlot) steps.push(2);
    if (state.client?.phone) steps.push(3);
    return steps;
  }, [state]);

  // Passo 1: Seleção de Serviço
  const renderStep1 = () => (
    <div className="space-y-4">
      <p className="text-gray-600">Selecione o serviço desejado</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {services.map(svc => (
          <button
            key={svc.id}
            onClick={() => actions.setService(svc)}
            className={`
              p-4 rounded-xl border-2 text-center transition-all
              ${state.service?.id === svc.id 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-200 hover:border-gray-300'
              }
            `}
          >
            <h4 className="font-medium text-gray-900">{svc.name}</h4>
            <p className="text-sm text-gray-500">{svc.durationMinutes}min</p>
            <p className="text-lg font-bold text-blue-600 mt-1">R$ {svc.price.toFixed(2)}</p>
          </button>
        ))}
      </div>
    </div>
  );

  // Passo 2: Seleção de Funcionário
  const renderStep2 = () => (
    <div className="space-y-4">
      <p className="text-gray-600">Escolha seu profissional</p>
      {filteredEmployees.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          Nenhum profissional disponível para este serviço
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEmployees.map(emp => (
            <button
              key={emp.id}
              onClick={() => actions.setEmployee(emp)}
              className={`
                w-full p-4 rounded-xl border-2 text-left transition-all
                ${state.employee?.id === emp.id 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-200 hover:border-gray-300'
                }
              `}
            >
              <div className="font-medium text-gray-900">{emp.name}</div>
              <div className="text-sm text-gray-500 mt-1">
                {emp.specialties.join(', ')}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  // Passo 3: Calendário
  const renderStep3 = () => (
    <BookingCalendar
      employeeId={state.employee!.id}
      serviceId={state.service!.id}
      serviceDuration={state.service!.durationMinutes}
      selectedSlot={state.selectedSlot}
      onSelectSlot={(slot) => actions.setSlot(slot.start, slot)}
    />
  );

  // Passo 4: Identificação
  const renderStep4 = () => {
    const handlePhoneSubmit = async (phone: string) => {
      setCheckingPhone(true);
      setStep4Error(null);
      try {
        const res = await bookingApi.checkClient(phone);
        if (res.exists) {
          setClientExists(res.client!);
          actions.setClientPhone(phone);
        } else {
          setClientExists(null);
          actions.setClientPhone(phone);
        }
      } catch {
        setStep4Error('Erro ao verificar telefone. Tente novamente.');
      } finally {
        setCheckingPhone(false);
      }
    };

    const handleNewClientSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const form = e.target as HTMLFormElement;
      const formData = new FormData(form);
      actions.setClientDetails({
        fullName: formData.get('fullName') as string,
        birthDate: formData.get('birthDate') as string,
      });
      actions.nextStep();
    };

    // Cliente já existe
    if (clientExists) {
      return (
        <div className="text-center py-8">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-900">Olá, {clientExists.fullName}!</h3>
          <p className="text-gray-500 mt-1">Seus dados já estão cadastrados.</p>
          <p className="text-sm text-gray-400 mt-2">
            Nasc: {format(new Date(clientExists.birthDate), 'dd/MM/yyyy', { locale: ptBR })}
          </p>
          <button
            onClick={() => actions.nextStep()}
            className="mt-6 px-8 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700"
          >
            Confirmar Agendamento
          </button>
        </div>
      );
    }

    // Formulário de telefone / novo cadastro
    return (
      <div className="space-y-6">
        <PhoneInput
          label="Telefone (WhatsApp)"
          value={state.client?.phone || ''}
          onChange={(phone) => actions.setClientPhone(phone)}
          required
          error={step4Error ?? undefined}
          onEnterPress={() => handlePhoneSubmit(state.client?.phone || '')}
        />
        <button
          onClick={() => handlePhoneSubmit(state.client?.phone || '')}
          disabled={checkingPhone || !state.client?.phone}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium disabled:opacity-50"
        >
          {checkingPhone ? 'Verificando...' : 'Continuar'}
        </button>

        {/* Formulário novo cliente */}
        {!clientExists && state.client?.phone && (
          <form onSubmit={handleNewClientSubmit} className="space-y-4 pt-6 border-t">
            <h4 className="font-medium text-gray-900">Primeira vez por aqui? Complete seu cadastro:</h4>
            <input
              name="fullName"
              type="text"
              placeholder="Nome completo"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
            />
            <input
              name="birthDate"
              type="date"
              required
              max={format(new Date(), 'yyyy-MM-dd')}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
            />
            <button type="submit" className="w-full py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700">
              Agendar e Criar Conta
            </button>
          </form>
        )}
      </div>
    );
  };

  // Passo 5: Confirmação
  const renderStep5 = () => {
    const isNewClient = !clientExists;
    
    const handleConfirm = async () => {
      setConfirmLoading(true);
      try {
        await bookingApi.create({
          serviceId: state.service!.id,
          employeeId: state.employee!.id,
          startsAt: state.selectedSlot!.start.toISOString(),
          client: {
            phone: state.client!.phone,
            fullName: state.client!.fullName,
            birthDate: state.client!.birthDate,
          },
        });
        
        showToast({ type: 'success', title: 'Agendamento confirmado!', message: 'Você receberá confirmação no WhatsApp.' });
        navigate('/agendamento-confirmado');
      } catch (err: any) {
        if (err.status === 409) {
          showToast({ type: 'error', title: 'Horário indisponível', message: 'Este horário foi preenchido. Escolha outro.' });
          actions.goBack(); // volta pro calendário
        } else {
          showToast({ type: 'error', title: 'Erro ao agendar', message: err.message || 'Tente novamente.' });
        }
      } finally {
        setConfirmLoading(false);
      }
    };

    return (
      <BookingConfirmation
        service={state.service!}
        employee={state.employee!}
        slot={state.selectedSlot!}
        client={state.client!}
        isNewClient={isNewClient}
        onConfirm={handleConfirm}
        onBack={() => actions.goBack()}
        loading={confirmLoading}
      />
    );
  };

  const stepsContent = [renderStep1, renderStep2, renderStep3, renderStep4, renderStep5];

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm p-6 md:p-8">
        <BookingProgress currentStep={state.currentStep} completedSteps={completedSteps} />
        
        <div className="animate-fade-in">
          {stepsContent[state.currentStep]()}
        </div>
      </div>
    </div>
  );
}