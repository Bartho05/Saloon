import { useSalonName } from '@contexts/SalonContext';

interface SalonBrandProps {
  /** 'sm' | 'md' | 'lg' escala tipográfica. */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES = {
  sm: 'text-body',
  md: 'text-body-lg',
  lg: 'text-display-sm',
};

/**
 * Nome da marca, vindo do banco.
 *
 * Existe como componente único porque a marca aparecia escrita em cinco
 * arquivos diferentes. Componente compartilhado, trocar o nome nas
 * Configurações muda todas as telas de uma vez — e nenhuma delas volta a
 * ficar com o literal antigo.
 *
 * Enquanto o GET /salon não volta, renderiza um espaço com a mesma altura
 * da linha em vez do literal: nada de "MR. CUT" aparecendo e sumindo, e
 * sem salto de layout.
 */
export function SalonBrand({ size = 'md', className = '' }: SalonBrandProps) {
  const { name, loading } = useSalonName();

  if (!name) {
    return (
      <span
        className={`inline-block font-display font-bold tracking-tight ${SIZE_CLASSES[size]} ${className}`}
        style={{ minWidth: '4ch' }}
        aria-hidden="true"
      >
        {loading ? ' ' : ''}
      </span>
    );
  }

  return (
    <span className={`font-display font-bold tracking-tight ${SIZE_CLASSES[size]} ${className}`}>
      {name}
    </span>
  );
}

export default SalonBrand;