import { HTMLAttributes, forwardRef } from 'react';

interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

const sizeClasses = {
  sm: 'max-w-3xl',
  md: 'max-w-5xl',
  lg: 'max-w-7xl',
  xl: 'max-w-[80rem]',
  // NÃO é "sem limite". Em 2K e 4K o conteúdo esticado por 2560/3840px
  // deixa os cards com uma linha de texto à esquerda e o resto vazio — o
  // painel fica com aparência de template quebrado. O teto de 110rem
  // (1760px) faz 2K e 4K mostrarem exatamente o mesmo layout do FullHD,
  // centralizado, que é o que "consistente entre desktops" pede.
  full: 'max-w-[110rem]',
};

export const Container = forwardRef<HTMLDivElement, ContainerProps>(
  ({ size = 'lg', className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`mx-auto px-4 md:px-6 lg:px-8 ${sizeClasses[size]} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Container.displayName = 'Container';

export default Container;