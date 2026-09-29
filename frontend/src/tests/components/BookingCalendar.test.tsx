import { render, screen, waitFor } from '@testing-library/react';
import { BookingCalendar } from '@components/BookingCalendar';
import { bookingApi } from '@services/api';
import { vi } from 'vitest';

vi.mock('@services/api', () => ({
  bookingApi: {
    getSlots: vi.fn(),
  },
}));

describe('BookingCalendar', () => {
  const mockSlots = [
    { start: new Date('2025-01-15T10:00:00'), end: new Date('2025-01-15T10:30:00'), available: true },
    { start: new Date('2025-01-15T10:30:00'), end: new Date('2025-01-15T11:00:00'), available: false },
    { start: new Date('2025-01-15T14:00:00'), end: new Date('2025-01-15T14:30:00'), available: true },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders week navigation', () => {
    render(<BookingCalendar employeeId="emp1" serviceId="svc1" serviceDuration={30} onSelectSlot={vi.fn()} />);
    
    expect(screen.getByLabelText('Semana anterior')).toBeInTheDocument();
    expect(screen.getByLabelText('Próxima semana')).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    render(<BookingCalendar employeeId="emp1" serviceId="svc1" serviceDuration={30} onSelectSlot={vi.fn()} />);
    
    // Should show day buttons
    const days = screen.getAllByRole('gridcell');
    expect(days.length).toBe(7);
  });

  it('displays available slots when day selected', async () => {
    bookingApi.getSlots.mockResolvedValue({
      slots: mockSlots,
      grouped: { 10: ['2025-01-15T10:00:00'], 14: ['2025-01-15T14:00:00'] },
    });

    const onSelectSlot = vi.fn();
    render(<BookingCalendar employeeId="emp1" serviceId="svc1" serviceDuration={30} onSelectSlot={onSelectSlot} />);

    // Click on a day
    const todayButton = screen.getAllByRole('gridcell').find(btn => btn.textContent?.includes(new Date().getDate().toString()));
    if (todayButton) {
      fireEvent.click(todayButton);
    }

    await waitFor(() => {
      expect(screen.getByText('10:00')).toBeInTheDocument();
    });
  });

  it('shows blocked day indicator', async () => {
    bookingApi.getSlots.mockResolvedValue({
      slots: [],
      grouped: {},
      blocked: true,
      reason: 'Feriado nacional',
    });

    render(<BookingCalendar employeeId="emp1" serviceId="svc1" serviceDuration={30} onSelectSlot={vi.fn()} />);

    const todayButton = screen.getAllByRole('gridcell').find(btn => btn.textContent?.includes(new Date().getDate().toString()));
    if (todayButton) {
      fireEvent.click(todayButton);
    }

    await waitFor(() => {
      expect(screen.getByText('Nenhum horário disponível neste dia.')).toBeInTheDocument();
    });
  });
});