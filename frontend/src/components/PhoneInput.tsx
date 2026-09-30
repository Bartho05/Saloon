import { useState, useEffect, useRef, useCallback } from 'react';
import { formatPhoneInput, validatePhoneInput, onlyDigits } from '@utils/validation';

interface PhoneInputProps {
  /** Valor controlado: apenas dígitos (ex.: "31988976543") */
  value: string;
  onChange: (value: string) => void;
  error?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  onEnterPress?: () => void;
}

export function PhoneInput({
  value,
  onChange,
  error,
  label,
  required,
  disabled,
  onEnterPress,
}: PhoneInputProps) {
  const [displayValue, setDisplayValue] = useState(() => formatPhoneInput(value));
  const inputRef = useRef<HTMLInputElement>(null);
  // Últimos dígitos enviados ao pai — evita que o effect apague a máscara
  const lastEmitted = useRef<string>(onlyDigits(value));

  // Sincroniza apenas quando o pai envia um valor diferente do que emitimos
  useEffect(() => {
    const incoming = onlyDigits(value);
    if (incoming !== lastEmitted.current) {
      lastEmitted.current = incoming;
      setDisplayValue(formatPhoneInput(incoming));
    }
  }, [value]);

  const validation = displayValue ? validatePhoneInput(displayValue) : { valid: false, error: '' };

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const digits = onlyDigits(e.target.value).slice(0, 11);
      const formatted = formatPhoneInput(digits);
      lastEmitted.current = digits;
      setDisplayValue(formatted);
      onChange(digits);
    },
    [onChange]
  );

  const handleBlur = useCallback(() => {
    const digits = onlyDigits(displayValue);

    // Telefone fixo de 10 dígitos (DDD + 8) → completa com o 9 para celular
    if (digits.length === 10 && digits[2] !== '9') {
      const withNine = digits.slice(0, 2) + '9' + digits.slice(2);
      lastEmitted.current = withNine;
      setDisplayValue(formatPhoneInput(withNine));
      onChange(withNine);
    }
  }, [displayValue, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (validation.valid && onEnterPress) onEnterPress();
      }
    },
    [validation.valid, onEnterPress]
  );

  const hasError = Boolean(error) || (displayValue.length > 0 && !validation.valid);
  const showHint = !error && displayValue.length > 0 && !validation.valid && validation.error;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor="phone-input" className="block text-sm font-medium text-gray-700 mb-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <input
        id="phone-input"
        ref={inputRef}
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="(31) 98888-7777"
        maxLength={16}
        className={[
          'w-full px-4 py-3 rounded-lg border transition-colors tabular-nums',
          'placeholder:text-gray-400',
          disabled ? 'bg-gray-100 cursor-not-allowed' : '',
          hasError
            ? 'border-red-300 text-red-900 focus:border-red-500 focus:ring-red-500'
            : validation.valid
              ? 'border-green-300 focus:border-green-500 focus:ring-green-500'
              : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500',
          'focus:ring-2 focus:ring-opacity-20 focus:outline-none',
        ].join(' ')}
        aria-invalid={hasError ? 'true' : 'false'}
        aria-describedby={error ? 'phone-error' : undefined}
      />
      {error && (
        <p id="phone-error" className="mt-1 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {!error && showHint && <p className="mt-1 text-sm text-amber-600">{validation.error}</p>}
      {!error && validation.valid && (
        <p className="mt-1 text-sm text-green-600">✓ Telefone válido</p>
      )}
    </div>
  );
}

export default PhoneInput;
