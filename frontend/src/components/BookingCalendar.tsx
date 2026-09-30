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
          className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Semana anterior"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <h3 className="text-lg font-semibold text-gray-900">
          {format(currentWeek, 'dd/MM', { locale: ptBR })} -{' '}
          {format(endOfWeek(currentWeek, { weekStartsOn: 1 }), 'dd/MM/yyyy', { locale: ptBR })}
        </h3>

        <button
          onClick={() => goToWeek(1)}
          className="p-2 rounded-lg hover:bg-gray-100"
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
                relative p-3 rounded-xl text-center transition-all
                ${disabled 
                  ? 'bg-gray-50 text-gray-300 cursor-not-allowed' 
                  : isSelected
                    ? 'bg-blue-50 border-2 border-blue-500'
                    : blocked
                      ? 'bg-red-50 border border-red-200'
                      : 'bg-white hover:bg-gray-50 border border-gray-100'
                }
                ${isTodayDay && !disabled ? 'ring-2 ring-blue-200' : ''}
              `}
              aria-selected={isSelected}
              aria-disabled={disabled}
              aria-label={format(day, "EEEE, dd 'de' MMMM", { locale: ptBR })}
            >
              <span className={`
                block text-sm font-medium
                ${isTodayDay && !disabled ? 'text-blue-600' : 'text-gray-700'}
                ${disabled ? 'text-gray-300' : ''}
                ${blocked ? 'text-red-600' : ''}
              `}>
                {format(day, 'EEEEEE', { locale: ptBR })}
              </span>
              <span className={`
                block text-2xl font-bold mt-1
                ${isTodayDay && !disabled ? 'text-blue-600' : 'text-gray-900'}
                ${disabled ? 'text-gray-300' : ''}
                ${blocked ? 'text-red-600' : ''}
              `}>
                {format(day, 'dd')}
              </span>
              
              {dayLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-xl">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              
              {!dayLoading && !disabled && availableCount > 0 && !blocked && (
                <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                  {availableCount > 9 ? '9+' : availableCount}
                </span>
              )}

              {blocked && !dayLoading && (
                <div className="absolute inset-0 bg-red-500/10 rounded-xl" />
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
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 animate-fade-in">
            <h4 className="font-medium text-gray-900 mb-3">
              Horários disponíveis para {format(activeDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </h4>

            {isActiveLoading ? (
              <div className="flex items-center justify-center py-6">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : available.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Nenhum horário disponível neste dia.</p>
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
                        'py-2 px-3 rounded-lg text-sm font-medium transition-all',
                        active
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200',
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
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}