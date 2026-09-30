import { STEPS } from '@hooks/useBookingFlow';

interface BookingProgressProps {
  currentStep: number;
  completedSteps: number[];
}

export function BookingProgress({ currentStep, completedSteps }: BookingProgressProps) {
  return (
    <nav className="w-full mb-8" aria-label="Progresso do agendamento">
      <ol className="flex items-center" role="list">
        {STEPS.map((step, index) => {
          const isCompleted = completedSteps.includes(index);
          const isCurrent = index === currentStep;

          return (
            <li key={step.key} className="flex items-center flex-1">
              <div className="flex items-center">
                <div className={`
                  relative flex items-center justify-center w-10 h-10 rounded-full
                  text-sm font-bold transition-all
                  ${isCompleted 
                    ? 'bg-green-500 text-white' 
                    : isCurrent 
                      ? 'bg-blue-500 text-white ring-4 ring-blue-500/20' 
                      : 'bg-gray-200 text-gray-500'
                  }
                `}>
                  {isCompleted ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>

                <span className={`
                  ml-2 text-sm font-medium hidden sm:block
                  ${isCurrent ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-400'}
                `}>
                  {step.label}
                </span>
              </div>

              {index < STEPS.length - 1 && (
                <div className={`
                  flex-1 h-1 mx-2 rounded
                  ${isCompleted ? 'bg-green-500' : 'bg-gray-200'}
                `} />
              )}
            </li>
          );
        })}
      </ol>
      
      <div className="flex justify-center space-x-4 mt-4 sm:hidden" role="list" aria-label="Passos mobile">
        {STEPS.map((step, index) => (
          <div key={step.key} className="flex flex-col items-center">
            <div className={`
              w-10 h-10 rounded-full flex items-center justify-center
              text-sm font-bold
              ${index < currentStep ? 'bg-green-500 text-white' : index === currentStep ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'}
            `}>
              {index < currentStep ? '✓' : step.icon}
            </div>
            <span className="text-xs mt-1 text-center text-gray-500">{step.label}</span>
          </div>
        ))}
      </div>
    </nav>
  );
}