import { useState, useCallback, useMemo } from 'react';
import type { TimeSlot, Service, Employee } from '@types';

export interface BookingState {
  service: Service | null;
  employee: Employee | null;
  selectedDate: Date | null;
  selectedSlot: TimeSlot | null;
  client: {
    phone: string;
    fullName?: string;
    birthDate?: string;
  } | null;
  confirmed: boolean;
}

export interface BookingActions {
  setService: (service: Service) => void;
  setEmployee: (employee: Employee) => void;
  setSlot: (date: Date, slot: TimeSlot) => void;
  setClientPhone: (phone: string) => void;
  setClientDetails: (details: { fullName: string; birthDate: string }) => void;
  confirm: () => void;
  reset: () => void;
  goBack: () => void;
  canProceed: (step: number) => boolean;
  nextStep: () => void;
}

const initialState: BookingState = {
  service: null,
  employee: null,
  selectedDate: null,
  selectedSlot: null,
  client: null,
  confirmed: false,
};

const STEPS = [
  { key: 'service', label: 'Serviço', icon: '' },
  { key: 'employee', label: 'Profissional', icon: '' },
  { key: 'slot', label: 'Data e Hora', icon: '' },
  { key: 'client', label: 'Seus Dados', icon: '' },
  { key: 'confirm', label: 'Confirmar', icon: '' },
] as const;

export { STEPS };

export function useBookingFlow(): [BookingState & { currentStep: number; nextStep: () => void }, BookingActions, typeof STEPS] {
  const [state, setState] = useState<BookingState>(initialState);
  const [currentStep, setCurrentStep] = useState(0);

  const canProceed = useCallback((step: number) => {
    switch (step) {
      case 0: return !!state.service;
      case 1: return !!state.employee;
      case 2: return !!state.selectedSlot;
      case 3: return !!state.client?.phone;
      case 4: return true;
      default: return false;
    }
  }, [state]);

  const nextStep = useCallback(() => {
    if (canProceed(currentStep)) {
      setCurrentStep(prev => Math.min(STEPS.length - 1, prev + 1));
    }
  }, [currentStep, canProceed]);

  const actions = useMemo<BookingActions>(() => ({
    setService: (service) => {
      setState(prev => ({
        ...prev, service, employee: null, selectedDate: null, selectedSlot: null
      }));
      // Avança automaticamente para a escolha do profissional
      setCurrentStep(1);
    },

    setEmployee: (employee) => {
      setState(prev => ({
        ...prev, employee, selectedDate: null, selectedSlot: null
      }));
      setCurrentStep(2);
    },

    setSlot: (date, slot) => {
      setState(prev => ({
        ...prev, selectedDate: date, selectedSlot: slot
      }));
      setCurrentStep(3);
    },

    // A etapa de identificação é manual: o cliente precisa confirmar
    // (e Possibly informedar nome/data de nascimento) antes de seguir.
    setClientPhone: (phone) => setState(prev => ({
      ...prev, client: { ...prev.client, phone } as BookingState['client']
    })),

    setClientDetails: (details) => setState(prev => ({
      ...prev, client: { ...prev.client, ...details } as BookingState['client']
    })),

    confirm: () => setState(prev => ({ ...prev, confirmed: true })),

    reset: () => {
      setState(initialState);
      setCurrentStep(0);
    },

    goBack: () => setCurrentStep(prev => Math.max(0, prev - 1)),

    canProceed,
    nextStep,
  }), [canProceed]);

  return [
    { ...state, currentStep, nextStep },
    actions,
    STEPS
  ];
}