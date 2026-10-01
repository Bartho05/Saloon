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
import type { Service, Employee, Client } from '@types';
import { clienteSemNome } from '@utils/client';
import { formatBirthDate } from '@utils/date';
import { Button, Card, CardContent, Container, Section, Input, Badge } from '@components/ui';

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
    <div className="space-y-6">
      <Badge variant="outline" className="mb-2">SERVIÇO</Badge>
      <p className="text-body-lg text-brand-grayMid">Selecione o serviço desejado</p>
      <div className="grid-editorial-2 md:grid-editorial-3">
        {services.map(svc => (
          <Card
            key={svc.id}
            variant="hover"
            onClick={() => actions.setService(svc)}
            className={`cursor-pointer group ${state.service?.id === svc.id ? 'border-brand-black ring-2 ring-brand-black' : ''}`}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); actions.setService(svc); } }}
          >
            <CardContent>
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-display font-semibold text-body-lg">{svc.name}</h3>
                <span className="font-display font-bold text-body-lg text-brand-black">
                  R$ {svc.price.toFixed(2).replace('.', ',')}
                </span>
              </div>
              <p className="text-caption text-brand-grayMid mb-4">{svc.durationMinutes} min</p>
              <Button variant="minimal" className="w-full justify-center group-hover:text-brand-black">
                Selecionar
                <svg className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  // Passo 2: Seleção de Funcionário
  const renderStep2 = () => (
    <div className="space-y-6">
      <Badge variant="outline" className="mb-2">PROFISSIONAL</Badge>
      <p className="text-body-lg text-brand-grayMid">Escolha seu profissional</p>
      {filteredEmployees.length === 0 ? (
        <Card variant="padded" className="text-center py-12">
          <p className="text-body text-brand-grayMid">Nenhum profissional disponível para este serviço</p>
          <Button variant="ghost" onClick={() => actions.goBack()} className="mt-4">
            Voltar aos serviços
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredEmployees.map(emp => (
            <Card
              key={emp.id}
              variant="hover"
              onClick={() => actions.setEmployee(emp)}
              className={`cursor-pointer ${state.employee?.id === emp.id ? 'border-brand-black ring-2 ring-brand-black' : ''}`}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); actions.setEmployee(emp); } }}
            >
              <CardContent className="flex items-center gap-4">
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-brand-grayLight border border-brand-gray flex items-center justify-center overflow-hidden flex-shrink-0">
                  {emp.photoUrl ? (
                    <img
                      src={emp.photoUrl}
                      alt={`Foto de ${emp.name}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="font-display font-bold text-body-lg text-brand-grayMid">
                      {emp.name.charAt(0)}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-semibold text-body-lg">{emp.name}</h3>
                  <p className="text-caption text-brand-grayMid mt-1">{emp.specialties.join(', ')}</p>
                </div>
                {state.employee?.id === emp.id && (
                  <svg className="w-6 h-6 text-brand-black flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  // Passo 3: Calendário
  const renderStep3 = () => (
    <div className="space-y-6">
      <Badge variant="outline" className="mb-2">DATA E HORA</Badge>
      <p className="text-body-lg text-brand-grayMid">Selecione o melhor horário</p>
      <BookingCalendar
        employeeId={state.employee!.id}
        serviceId={state.service!.id}
        serviceDuration={state.service!.durationMinutes}
        selectedSlot={state.selectedSlot}
        onSelectSlot={(slot) => actions.setSlot(slot.start, slot)}
      />
    </div>
  );

  // Passo 4: Identificação
  const renderStep4 = () => {
    const handlePhoneSubmit = async (phone: string) => {
      setCheckingPhone(true);
      setStep4Error(null);
      try {
        const res = await bookingApi.checkClient(phone);

        /**
         * Registro sem nome (ou sem nascimento) é tratado como cadastro ainda
         * não feito, mesmo que o telefone já exista.
         *
         * Isso importa porque o registro incompleto existe justamente quando
         * o telefone foi verificado por WhatsApp antes do primeiro
         * agendamento. Cair no ramo "Seus dados já estão cadastrados" ali
         * impedia a pessoa de informar o nome — e era assim que a agenda
         * ficava com nome vazio para sempre. Pior: `new Date(null)` nesse
         * cartão quebrava a tela com data inválida.
         */
        if (res.exists && !clienteSemNome(res.client) && res.client?.birthDate) {
          setClientExists(res.client!);
        } else {
          setClientExists(null);
        }
        actions.setClientPhone(phone);
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
        <div className="space-y-6">
          <Badge variant="outline" className="mb-2">SEUS DADOS</Badge>
          <Card variant="padded" className="text-center py-8">
            <CardContent>
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-brand-grayLight border border-brand-gray flex items-center justify-center">
                <span className="font-display font-bold text-display-sm text-brand-grayMid">
                  {clientExists.fullName.charAt(0)}
                </span>
              </div>
              <h3 className="font-display font-bold text-display-sm">Olá, {clientExists.fullName}!</h3>
              <p className="text-body-sm text-brand-grayMid mt-2">Seus dados já estão cadastrados.</p>
              {/* `clientExists` só é setado quando nome e nascimento existem
                  (ver handlePhoneSubmit), mas `birthDate` é anulável no tipo
                  — sem esta guarda, um null viraria data inválida em tela. */}
              {clientExists.birthDate && (
                <p className="text-caption text-brand-grayMid mt-1">
                  Nasc: {formatBirthDate(clientExists.birthDate)}
                </p>
              )}
              <Button variant="solid" size="lg" className="mt-6 w-full sm:w-auto" onClick={() => actions.nextStep()}>
                Confirmar Agendamento
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Formulário de telefone / novo cadastro
    return (
      <div className="space-y-6">
        <Badge variant="outline" className="mb-2">SEUS DADOS</Badge>
        <div className="space-y-4">
          <PhoneInput
            label="Telefone (WhatsApp)"
            value={state.client?.phone || ''}
            onChange={(phone) => actions.setClientPhone(phone)}
            required
            error={step4Error ?? undefined}
            onEnterPress={() => handlePhoneSubmit(state.client?.phone || '')}
          />
          <Button variant="solid" size="lg" className="w-full" disabled={checkingPhone || !state.client?.phone} onClick={() => handlePhoneSubmit(state.client?.phone || '')}>
            {checkingPhone ? 'Verificando...' : 'Continuar'}
          </Button>
        </div>

        {/* Formulário novo cliente */}
        {!clientExists && state.client?.phone && (
          <form onSubmit={handleNewClientSubmit} className="space-y-4 pt-6 border-t border-brand-gray">
            {/* Sem "primeira vez": este formulário também aparece para quem já
                tem telefone verificado e só falta o cadastro. */}
            <h4 className="font-display font-medium text-body">
              Complete seu cadastro:
            </h4>
            <Input
              label="Nome completo"
              name="fullName"
              type="text"
              placeholder="Seu nome completo"
              required
            />
            <Input
              label="Data de nascimento"
              name="birthDate"
              type="date"
              required
              max={format(new Date(), 'yyyy-MM-dd')}
            />
            <Button variant="solid" size="lg" type="submit" className="w-full">
              Agendar e Criar Conta
            </Button>
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
          actions.goBack();
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
    <Section className="min-h-screen py-12 md:py-16 lg:py-20">
      <Container size="lg">
        {/* Header */}
        <div className="mb-8 md:mb-12">
          <Badge variant="outline" className="mb-3">AGENDAMENTO</Badge>
          <h1 className="text-display-md md:text-display-lg mb-2">Novo Agendamento</h1>
          <p className="text-body-lg text-brand-grayMid">5 passos rápidos — 2 minutos</p>
        </div>

        {/* Progress */}
        <div className="mb-8 md:mb-10">
          <BookingProgress currentStep={state.currentStep} completedSteps={completedSteps} />
        </div>

        {/* Content */}
        <div className="animate-fade-in">
          {stepsContent[state.currentStep]()}
        </div>
      </Container>
    </Section>
  );
}

export default AgendarPage;