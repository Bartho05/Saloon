import { STEPS } from '@hooks/useBookingFlow';

interface BookingProgressProps {
  currentStep: number;
  completedSteps: number[];
}

export function BookingProgress({ currentStep, completedSteps }: BookingProgressProps) {
  return (
    <nav className="w-full" aria-label="Progresso do agendamento">
      {/* Desktop version */}
      <div className="hidden lg:flex items-center gap-4 mb-6">
        {STEPS.map((step, index) => {
          const isCompleted = completedSteps.includes(index);
          const isCurrent = index === currentStep;

          return (
            <div key={step.key} className="flex items-center flex-1">
              <div className="flex items-center gap-3">
                <div className={`
                  relative flex items-center justify-center w-8 h-8 rounded-none
                  font-display font-bold text-caption transition-all duration-fast
                  ${isCompleted
                    ? 'bg-brand-black text-brand-white'
                    : isCurrent
                      ? 'bg-brand-black text-brand-white ring-2 ring-brand-black ring-offset-2 ring-offset-brand-white'
                      : 'bg-brand-gray text-brand-grayMid'}
                `}>
                  {isCompleted ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>

                <span className={`
                  font-display font-medium text-body-sm tracking-tight
                  ${isCurrent ? 'text-brand-black' : isCompleted ? 'text-brand-black' : 'text-brand-grayMid'}
                `}>
                  {step.label}
                </span>
              </div>

              {index < STEPS.length - 1 && (
                <div className={`
                  flex-1 h-px rounded-none
                  ${isCompleted ? 'bg-brand-black' : 'bg-brand-gray'}
                `} />
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile version */}
      <div className="lg:hidden">
        <div className="flex items-center justify-between mb-4" role="list" aria-label="Passos">
          {STEPS.map((step, index) => {
            const isCompleted = completedSteps.includes(index);
            const isCurrent = index === currentStep;

            return (
              <div key={step.key} className="flex flex-col items-center flex-1 relative">
                <div className={`
                  w-8 h-8 rounded-none flex items-center justify-center
                  font-display font-bold text-caption transition-all duration-fast
                  ${isCompleted ? 'bg-brand-black text-brand-white' : isCurrent ? 'bg-brand-black text-brand-white ring-2 ring-brand-black ring-offset-2 ring-offset-brand-white' : 'bg-brand-gray text-brand-grayMid'}
                `}>
                  {isCompleted ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>
                <span className={`text-caption mt-1 text-center ${isCurrent ? 'text-brand-black font-medium' : 'text-brand-grayMid'}`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
        {/* Progress bar mobile */}
        <div className="h-px bg-brand-gray rounded-none overflow-hidden">
          <div
            className="h-full bg-brand-black transition-all duration-fast ease-sharp"
            style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>
    </nav>
  );
}

export default BookingProgress;