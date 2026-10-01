import { useRef, useState } from 'react';
import { useToast } from '@contexts/ToastContext';
import { Button } from '@components/ui';
import { UploadIcon, TrashIcon } from './icons';

interface ImageUploadProps {
  /** URL pública atual (ex.: /uploads/employees/abc.png) ou null */
  value: string | null;
  onUpload: (file: File) => Promise<void>;
  onRemove?: () => Promise<void>;
  label: string;
  hint?: string;
  shape?: 'square' | 'circle' | 'wide';
  className?: string;
}

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 4 * 1024 * 1024;

const shapeClasses = {
  square: 'w-28 h-28',
  circle: 'w-28 h-28 rounded-full',
  wide: 'w-full max-w-xs aspect-[16/9]',
};

/**
 * Upload de imagem com preview, validação no cliente e drag-and-drop.
 *
 * A validação aqui é só para dar retorno rápido; o multer no backend
 * valida de novo — nunca confie só no front.
 */
export function ImageUpload({
  value,
  onUpload,
  onRemove,
  label,
  hint,
  shape = 'square',
  className = '',
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const { showToast } = useToast();

  const handleFile = async (file: File | undefined | null) => {
    if (!file) return;

    if (!ACCEPTED.includes(file.type)) {
      showToast({ type: 'error', title: 'Formato inválido', message: 'Use JPEG, PNG ou WEBP.' });
      return;
    }

    if (file.size > MAX_BYTES) {
      showToast({ type: 'error', title: 'Arquivo muito grande', message: 'O limite é 4MB.' });
      return;
    }

    setBusy(true);
    try {
      await onUpload(file);
    } catch (err: any) {
      showToast({ type: 'error', title: 'Falha no envio', message: err.message });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className={className}>
      <p className="field-label">{label}</p>

      <div className="flex items-start gap-5">
        {/* Preview */}
        <div
          onClick={() => !busy && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void handleFile(e.dataTransfer.files?.[0]);
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          aria-label={value ? `Trocar ${label}` : `Enviar ${label}`}
          className={[
            shapeClasses[shape],
            'flex items-center justify-center flex-shrink-0 cursor-pointer',
            'border-2 border-dashed transition-colors duration-fast overflow-hidden bg-brand-grayLight',
            dragging ? 'border-brand-black bg-brand-gray' : 'border-brand-gray hover:border-brand-black',
            busy ? 'opacity-50 pointer-events-none' : '',
          ].join(' ')}
        >
          {value ? (
            <img src={value} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-1 text-brand-grayMid p-2 text-center">
              <UploadIcon className="w-5 h-5" />
              <span className="text-caption leading-tight">
                {busy ? 'Enviando...' : 'Enviar'}
              </span>
            </div>
          )}
        </div>

        {/* Ações */}
        <div className="space-y-2 pt-1">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED.join(',')}
            className="sr-only"
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />

          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>
            <UploadIcon className="w-3.5 h-3.5" />
            {value ? 'Trocar' : 'Escolher imagem'}
          </Button>

          {value && onRemove && (
            <Button
              type="button"
              variant="minimal"
              size="sm"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onRemove();
                } catch (err: any) {
                  showToast({ type: 'error', title: 'Erro', message: err.message });
                } finally {
                  setBusy(false);
                }
              }}
            >
              <TrashIcon className="w-3.5 h-3.5" />
              Remover
            </Button>
          )}
        </div>
      </div>

      {hint && <p className="field-hint mt-3">{hint}</p>}
    </div>
  );
}

export default ImageUpload;
