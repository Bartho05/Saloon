import { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
import { formatPhoneInput, validatePhoneInput } from '@utils/validation';

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  onEnterPress?: () => void;
}

export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value, onChange, error, label, required, disabled, onEnterPress }, ref) => {
    const [displayValue, setDisplayValue] = useState(value);
    const [validation, setValidation] = useState({ valid: false, error: '' });
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      setDisplayValue(value);
    }, [value]);

    useEffect(() => {
      if (displayValue) {
        const result = validatePhoneInput(displayValue);
        setValidation(result);
      } else {
        setValidation({ valid: false, error: '' });
      }
    }, [displayValue]);

    const applyMask = (raw: string): string => {
      return formatPhoneInput(raw);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = applyMask(e.target.value);
      setDisplayValue(formatted);
      
      const numbers = formatted.replace(/\D/g, '');
      onChange(numbers);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && onEnterPress && validation.valid) {
        e.preventDefault();
        onEnterPress();
      }
    };

    const handleBlur = () => {
      const numbers = displayValue.replace(/\D/g, '');
      if (numbers.length === 10 && numbers[2] !== '9') {
        const withNine = numbers.slice(0, 2) + '9' + numbers.slice(2);
        const formatted = applyMask(withNine);
        setDisplayValue(formatted);
        onChange(withNine);
      }
    };

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
      value: displayValue,
    }));

    const isComplete = displayValue.length >= 14; // (99) 99999-9999
    const hasError = error || (!validation.valid && displayValue.length > 0);

    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {label} {required && <span className="text-red-500">*</span>}
          </label>
        )}
        <input
          ref={inputRef}
          type="tel"
          value={displayValue}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="(11) 99999-9999"
          maxLength={15}
          className={`
            w-full px-4 py-3 rounded-lg border transition-colors
            placeholder:text-gray-400 font-mono tabular-nums
            ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}
            ${hasError
              ? 'border-red-300 text-red-900 focus:border-red-500 focus:ring-red-500'
              : isComplete && validation.valid
                ? 'border-green-300 focus:border-green-500 focus:ring-green-500'
                : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
            }
            focus:ring-2 focus:ring-opacity-20 focus:outline-none
          `}
          aria-invalid={hasError ? 'true' : 'false'}
          aria-describedby={error ? 'phone-error' : undefined}
        />
        {error && (
          <p id="phone-error" className="mt-1 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        {!error && !validation.valid && displayValue.length > 0 && !isComplete && (
          <p className="mt-1 text-sm text-amber-600">
            {validation.error || 'Complete o número'}
          </p>
        )}
        {isComplete && validation.valid && !error && (
          <p className="mt-1 text-sm text-green-600">
            ✓ Telefone válido
          </p>
        )}
      </div>
    );
  }
);

PhoneInput.displayName = 'PhoneInput';