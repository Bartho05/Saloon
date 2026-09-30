import { useState, useEffect, useMemo, useCallback } from 'react';
import { format, startOfWeek, endOfWeek, addDays, isSameDay, isBefore, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { bookingApi } from '@services/api';
import type { TimeSlot } from '@utils/schedule';
import { parseSlots } from '@utils/schedule';

interface BookingCalendarProps {
  employeeId: string;
  serviceId: string;
  serviceDuration: number;
  onSelectSlot: (slot: TimeSlot) => void;
  selectedSlot?: TimeSlot | null;
  disabledDates?: Date[];
}

export function BookingCalendar({ 
  employeeId, 
  serviceId, 
  onSelectSlot, 
  selectedSlot,
  disabledDates = []
}: BookingCalendarProps) {
  const [currentWeek, setCurrentWeek] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [slots, setSlots] = useState<Record<string, TimeSlot[]>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [activeDate, setActiveDate] = useState<Date | null>(null);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(currentWeek, i)),
    [currentWeek]
  );

  const fetchDaySlots = useCallback(async (date: Date) => {
    const key = format(date, 'yyyy-MM-dd');
    if (slots[key] || loading[key]) return;

    setLoading(prev => ({ ...prev, [key]: true }));
    setError(null);
    
    try {
      const res = await bookingApi.getSlots(employeeId, serviceId, key);
      // A API devolve ISO strings — converte para Date
      setSlots(prev => ({ ...prev, [key]: parseSlots(res.slots) }));
    } catch {
      setError('Não foi possível carregar horários. Tente novamente.');
    } finally {
      setLoading(prev => ({ ...prev, [key]: false }));
    }
  }, [employeeId, serviceId, slots, loading]);

  // Pré-carrega a semana atual
  useEffect(() => {
    weekDays.forEach((day) => {
      void fetchDaySlots(day);
    });
  }, [currentWeek, fetchDaySlots]);

  const goToWeek = (delta: number) => {
    setCurrentWeek(prev => addDays(prev, delta * 7));
  };

  const isPast = (date: Date) => isBefore(startOfDay(date), startOfDay(new Date()));
  const isDisabled = (date: Date) => 
    isPast(date) || 
    disabledDates.some(d => isSameDay(d, date));

  const startOfDay = (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const getDayStatus = (date: Date) => {
    const key = format(date, 'yyyy-MM-dd');
    const daySlots = slots[key] || [];
    const availableCount = daySlots.filter(s => s.available).length;
    const dayLoading = loading[key];
    const disabled = isDisabled(date);
    const blocked = daySlots.length > 0 && availableCount === 0 && !dayLoading && !disabled;

    return { availableCount, dayLoading, disabled, blocked };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => goToWeek(-1)}
          disabled={isBefore(currentWeek, startOfWeek(new Date(), { weekStartsOn: 1 }))}
          className="p-2 text-brand-black hover:bg-brand-grayLight disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-fast"
          aria-label="Semana anterior"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <h3 className="font-display font-semibold text-body tracking-tight">
          {format(currentWeek, "dd 'de' MMMM", { locale: ptBR })} —{' '}
          {format(endOfWeek(currentWeek, { weekStartsOn: 1 }), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </h3>

        <button
          onClick={() => goToWeek(1)}
          className="p-2 text-brand-black hover:bg-brand-grayLight transition-colors duration-fast"
          aria-label="Próxima semana"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1" role="grid" aria-label="Dias da semana">
        {weekDays.map(day => {
          const key = format(day, 'yyyy-MM-dd');
          const { availableCount, dayLoading, disabled, blocked } = getDayStatus(day);
          const isSelected = Boolean(selectedSlot && isSameDay(selectedSlot.start, day));
          const isTodayDay = isToday(day);

          return (
            <button
              key={key}
              role="gridcell"
              onClick={() => {
                if (disabled) return;
                setActiveDate(day);
                void fetchDaySlots(day);
              }}
              disabled={disabled}
              className={`
                relative py-3 text-center border transition-colors duration-fast
                ${disabled
                  ? 'bg-brand-grayLight text-brand-grayMid cursor-not-allowed border-brand-gray'
                  : isSelected
                    ? 'bg-brand-black text-brand-white border-brand-black'
                    : blocked
                      ? 'bg-brand-grayLight text-brand-grayMid border-brand-gray'
                      : 'bg-brand-white text-brand-black border-brand-gray hover:border-brand-black'
                }
              `}
              aria-selected={isSelected}
              aria-disabled={disabled}
              aria-label={format(day, "EEEE, dd 'de' MMMM", { locale: ptBR })}
            >
              <span className={`
                block text-caption
                ${isTodayDay && !disabled ? 'opacity-60' : 'opacity-60'}
                ${isSelected && !disabled ? 'opacity-80' : ''}
              `}>
                {format(day, 'EEEEEE', { locale: ptBR })}
              </span>
              <span className={`
                block font-display font-bold text-body-lg mt-1
                ${disabled ? 'opacity-40' : ''}
                ${isSelected && !disabled ? 'text-brand-white' : ''}
              `}>
                {format(day, 'dd')}
              </span>

              {dayLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-brand-white/80">
                  <div className="w-4 h-4 border-2 border-brand-black border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {!dayLoading && !disabled && availableCount > 0 && !blocked && (
                <span className="absolute -top-1 -right-1 bg-brand-black text-brand-white text-caption w-5 h-5 flex items-center justify-center">
                  {availableCount > 9 ? '9+' : availableCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {activeDate && (() => {
        const activeKey = format(activeDate, 'yyyy-MM-dd');
        const daySlots = slots[activeKey];
        const isActiveLoading = Boolean(loading[activeKey]) && !daySlots;
        const available = (daySlots ?? []).filter(s => s.available);
        const isActiveSelected = Boolean(selectedSlot && isSameDay(selectedSlot.start, activeDate));

        return (
          <div className="border border-brand-gray bg-brand-grayLight p-4 animate-fade-in">
            <h4 className="font-display font-medium text-body-sm mb-3">
              Horários para {format(activeDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </h4>

            {isActiveLoading ? (
              <div className="flex items-center justify-center py-6">
                <div className="w-5 h-5 border-2 border-brand-black border-t-transparent rounded-full animate-spin" />
              </div>
            ) : available.length === 0 ? (
              <p className="text-body-sm text-brand-grayMid text-center py-4">Nenhum horário disponível neste dia.</p>
            ) : (
              <div
                className="grid grid-cols-3 sm:grid-cols-4 gap-2"
                role="listbox"
                aria-label="Horários disponíveis"
              >
                {available.map((slot) => {
                  const active = isActiveSelected && slot.start.getTime() === selectedSlot!.start.getTime();
                  return (
                    <button
                      key={slot.start.toISOString()}
                      type="button"
                      onClick={() => onSelectSlot(slot)}
                      className={[
                        'py-2.5 px-3 font-display text-body-sm font-medium transition-colors duration-fast border',
                        active
                          ? 'bg-brand-black text-brand-white border-brand-black'
                          : 'bg-brand-white text-brand-black border-brand-gray hover:border-brand-black',
                      ].join(' ')}
                      role="option"
                      aria-selected={active}
                    >
                      {format(slot.start, 'HH:mm')}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {error && (
        <div className="border border-red-300 bg-red-50 text-red-700 px-4 py-3 text-body-sm" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}