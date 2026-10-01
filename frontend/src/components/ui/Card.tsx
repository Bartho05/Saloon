import { HTMLAttributes, forwardRef } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'padded' | 'hover';
}

/**
 * Variantes do invólucro.
 *
 * - `default`: só a moldura. O padding vem do `CardContent`.
 * - `hover`: idem, mais o efeito de levantar. Para usar com `CardContent`.
 * - `padded`: a moldura JÁ com padding, para conteúdo cru (estado vazio).
 *   Não usar junto com `CardContent` — o padding sai em dobro.
 */
const variantClasses = {
  default: 'card',
  padded: 'card-padded',
  hover: 'card-padded-hover',
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`${variantClasses[variant]} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className = '', ...props }, ref) => (
    <div ref={ref} className={`mb-4 ${className}`} {...props} />
  )
);
CardHeader.displayName = 'CardHeader';

export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className = '', ...props }, ref) => (
    <h3 ref={ref} className={`font-display font-semibold text-body-lg ${className}`} {...props} />
  )
);
CardTitle.displayName = 'CardTitle';

export const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className = '', ...props }, ref) => (
    <p ref={ref} className={`text-body-sm text-brand-grayMid mt-1 ${className}`} {...props} />
  )
);
CardDescription.displayName = 'CardDescription';

/**
 * Corpo do card, COM respiro.
 *
 * Antes não tinha padding nenhum e o conteúdo encostava na borda — notável
 * no Perfil, onde o divisor e a lista de informações ficavam colados no
 * outline do card. O padding é padrão aqui e não em `Card`: quem escreve
 * o corpo não deveria ter que lembrar de afastar o texto da borda.
 *
 * Usado dentro de `<Card variant="padded">` daria padding em dobro; por
 * isso o `Card` normal não tem padding e estas chamadas combinam as duas
 * peças.
 */
export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className = '', ...props }, ref) => (
    <div ref={ref} className={`p-5 md:p-6 ${className}`} {...props} />
  )
);
CardContent.displayName = 'CardContent';

export const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className = '', ...props }, ref) => (
    <div ref={ref} className={`mt-6 flex items-center gap-3 ${className}`} {...props} />
  )
);
CardFooter.displayName = 'CardFooter';

export default Card;