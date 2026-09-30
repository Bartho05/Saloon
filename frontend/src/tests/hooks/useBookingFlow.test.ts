import { renderHook, act } from '@testing-library/react';
import { useBookingFlow } from '@hooks/useBookingFlow';
import type { Service, Employee, TimeSlot } from '@types';

const mockService: Service = {
  id: 'svc1',
  name: 'Corte',
  durationMinutes: 30,
  price: 50,
  isActive: true,
};

const mockEmployee: Employee = {
  id: 'emp1',
  name: 'João',
  phone: '11999999999',
  specialties: ['Corte'],
  accessCode: '123456',
  isActive: true,
};

const mockSlot: TimeSlot = {
  start: new Date('2025-01-15T10:00:00'),
  end: new Date('2025-01-15T10:30:00'),
  available: true,
};

describe('useBookingFlow', () => {
  it('initializes with empty state', () => {
    const { result } = renderHook(() => useBookingFlow());
    
    expect(result.current[0].service).toBeNull();
    expect(result.current[0].employee).toBeNull();
    expect(result.current[0].selectedSlot).toBeNull();
    expect(result.current[0].client).toBeNull();
    expect(result.current[0].currentStep).toBe(0);
  });

  it('advances step when service selected', () => {
    const { result } = renderHook(() => useBookingFlow());
    
    act(() => {
      result.current[1].setService(mockService);
    });
    
    expect(result.current[0].service).toBe(mockService);
    expect(result.current[0].currentStep).toBe(1); // auto-advances
  });

  it('advances step when employee selected', () => {
    const { result } = renderHook(() => useBookingFlow());
    
    act(() => {
      result.current[1].setService(mockService);
      result.current[1].setEmployee(mockEmployee);
    });
    
    expect(result.current[0].employee).toBe(mockEmployee);
    expect(result.current[0].currentStep).toBe(2);
  });

  it('advances step when slot selected', () => {
    const { result } = renderHook(() => useBookingFlow());
    
    act(() => {
      result.current[1].setService(mockService);
      result.current[1].setEmployee(mockEmployee);
      result.current[1].setSlot(mockSlot.start, mockSlot);
    });
    
    expect(result.current[0].selectedSlot).toBe(mockSlot);
    expect(result.current[0].currentStep).toBe(3);
  });

  it('requires confirmation before advancing from the client step', () => {
    const { result } = renderHook(() => useBookingFlow());
    
    act(() => {
      result.current[1].setService(mockService);
      result.current[1].setEmployee(mockEmployee);
      result.current[1].setSlot(mockSlot.start, mockSlot);
      result.current[1].setClientPhone('11999999999');
    });
    
    // A etapa de identificação não avança sozinha: o cliente precisa confirmar
    expect(result.current[0].client?.phone).toBe('11999999999');
    expect(result.current[0].currentStep).toBe(3);
    
    act(() => {
      result.current[1].nextStep();
    });
    
    expect(result.current[0].currentStep).toBe(4);
  });

  it('canProceed returns correct values', () => {
    const { result } = renderHook(() => useBookingFlow());
    
    expect(result.current[1].canProceed(0)).toBe(false);
    
    act(() => {
      result.current[1].setService(mockService);
    });
    
    expect(result.current[1].canProceed(0)).toBe(true);
    expect(result.current[1].canProceed(1)).toBe(false);
    
    act(() => {
      result.current[1].setEmployee(mockEmployee);
    });
    
    expect(result.current[1].canProceed(1)).toBe(true);
    expect(result.current[1].canProceed(2)).toBe(false);
  });

  it('goBack decrements step', () => {
    const { result } = renderHook(() => useBookingFlow());
    
    act(() => {
      result.current[1].setService(mockService);
      result.current[1].goBack();
    });
    
    expect(result.current[0].currentStep).toBe(0);
  });

  it('reset clears all state', () => {
    const { result } = renderHook(() => useBookingFlow());
    
    act(() => {
      result.current[1].setService(mockService);
      result.current[1].setEmployee(mockEmployee);
      result.current[1].reset();
    });
    
    expect(result.current[0].service).toBeNull();
    expect(result.current[0].employee).toBeNull();
    expect(result.current[0].currentStep).toBe(0);
  });

  it('clears dependent state when going back', () => {
    const { result } = renderHook(() => useBookingFlow());
    
    act(() => {
      result.current[1].setService(mockService);
      result.current[1].setEmployee(mockEmployee);
      result.current[1].setService(mockService); // change service
    });
    
    // Employee should be cleared when service changes
    expect(result.current[0].employee).toBeNull();
  });
});