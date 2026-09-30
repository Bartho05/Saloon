import { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, forwardRef } from 'react';

interface FieldProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement>, FieldProps {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, required, className = '', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    const hintId = `${inputId}-hint`;
    const errorId = `${inputId}-error`;

    return (
      <div className={`field ${className}`}>
        {label && (
          <label htmlFor={inputId} className="field-label">
            {label}
            {required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={error ? 'field-input-error' : 'field-input'}
          aria-describedby={`${hint ? hintId : ''} ${error ? errorId : ''}`.trim() || undefined}
          aria-invalid={error ? 'true' : 'false'}
          {...props}
        />
        {hint && !error && <p id={hintId} className="field-hint">{hint}</p>}
        {error && <p id={errorId} className="field-error" role="alert">{error}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, FieldProps {}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, hint, error, required, className = '', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    const hintId = `${inputId}-hint`;
    const errorId = `${inputId}-error`;

    return (
      <div className={`field ${className}`}>
        {label && (
          <label htmlFor={inputId} className="field-label">
            {label}
            {required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={error ? 'field-input-error min-h-[100px] resize-y' : 'field-input min-h-[100px] resize-y'}
          aria-describedby={`${hint ? hintId : ''} ${error ? errorId : ''}`.trim() || undefined}
          aria-invalid={error ? 'true' : 'false'}
          {...props}
        />
        {hint && !error && <p id={hintId} className="field-hint">{hint}</p>}
        {error && <p id={errorId} className="field-error" role="alert">{error}</p>}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement>, FieldProps {
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, hint, error, required, options, placeholder, className = '', id, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');
    const hintId = `${selectId}-hint`;
    const errorId = `${selectId}-error`;

    return (
      <div className={`field ${className}`}>
        {label && (
          <label htmlFor={selectId} className="field-label">
            {label}
            {required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={error ? 'field-input-error' : 'field-input'}
          aria-describedby={`${hint ? hintId : ''} ${error ? errorId : ''}`.trim() || undefined}
          aria-invalid={error ? 'true' : 'false'}
          {...props}
        >
          {placeholder && <option value="" disabled>{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {hint && !error && <p id={hintId} className="field-hint">{hint}</p>}
        {error && <p id={errorId} className="field-error" role="alert">{error}</p>}
      </div>
    );
  }
);
Select.displayName = 'Select';

export { Input as Field };