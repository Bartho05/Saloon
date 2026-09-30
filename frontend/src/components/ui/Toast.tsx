import { Fragment, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  onClose: (id: string) => void;
  duration?: number;
}

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
};

const typeClasses = {
  success: 'toast-success',
  error: 'toast-error',
  info: 'toast-info',
};

export function Toast({ id, type, title, message, onClose, duration = 5000 }: ToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onClose(id), 250);
    }, duration);
    return () => clearTimeout(timer);
  }, [id, onClose, duration]);

  if (!visible) return null;

  const Icon = icons[type];

  return createPortal(
    <Fragment>
      <div className={`toast ${typeClasses[type]} animate-slide-up`} role="alert">
        <div className="flex items-start gap-3">
          <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <p className="font-display font-medium text-body-sm">{title}</p>
            {message && (
              <p className="text-body-sm text-brand-grayMid mt-0.5">{message}</p>
            )}
          </div>
          <button
            onClick={() => onClose(id)}
            className="flex-shrink-0 p-1 text-brand-grayMid hover:text-brand-black transition-colors duration-fast"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </Fragment>,
    document.body
  );
}

interface ToasterProps {
  toasts: Array<{ id: string; type: ToastType; title: string; message?: string; duration?: number }>;
  onClose: (id: string) => void;
}

export function Toaster({ toasts, onClose }: ToasterProps) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none" aria-live="polite">
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} onClose={onClose} />
      ))}
    </div>
  );
}

export default Toast;