import { HTMLAttributes, forwardRef } from 'react';

interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

const sizeClasses = {
  sm: 'max-w-3xl',
  md: 'max-w-5xl',
  lg: 'max-w-7xl',
  xl: 'max-w-[80rem]',
  full: 'max-full',
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