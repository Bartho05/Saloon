/**
 * Créditos do desenvolvedor.
 *
 * Aparece em todas as páginas — público e painéis. É um componente só de
 * propósito: escrever o crédito em cada layout é exatamente o que o
 * SalonBrand resolveu, e o resultado foi a mesma coisa.
 */

export const DEV_NAME = 'Bartholomeo Rocha';
export const DEV_EMAIL = 'workbartholomeo@gmail.com';

interface DevCreditsProps {
  /** 'footer' é o rodapé do site; 'aside' é a assinatura discreta dos painéis. */
  tone?: 'footer' | 'aside';
  className?: string;
}

export function DevCredits({ tone = 'footer', className = '' }: DevCreditsProps) {
  if (tone === 'aside') {
    return (
      <p className={`text-caption text-brand-grayMid ${className}`}>
        Desenvolvido por {DEV_NAME} &middot;{' '}
        <a
          href={`mailto:${DEV_EMAIL}`}
          className="underline underline-offset-2 hover:text-brand-black transition-colors duration-fast"
        >
          {DEV_EMAIL}
        </a>
      </p>
    );
  }

  return (
    <p className={`text-caption text-brand-grayMid text-center ${className}`}>
      Desenvolvido por {DEV_NAME} &middot;{' '}
      <a
        href={`mailto:${DEV_EMAIL}`}
        className="underline underline-offset-2 hover:text-brand-black transition-colors duration-fast"
      >
        {DEV_EMAIL}
      </a>
    </p>
  );
}

export default DevCredits;