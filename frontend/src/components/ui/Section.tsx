import { HTMLAttributes, forwardRef, ElementType } from 'react';

interface SectionProps extends HTMLAttributes<HTMLElement> {
  size?: 'sm' | 'md' | 'lg';
  background?: 'white' | 'gray' | 'black';
  as?: ElementType;
}

const sizeClasses = {
  sm: 'py-10 md:py-16',
  md: 'py-16 md:py-24 lg:py-32',
  lg: 'py-24 md:py-32 lg:py-40',
};

const backgroundClasses = {
  white: 'bg-brand-white',
  gray: 'bg-brand-grayLight',
  black: 'bg-brand-black text-brand-white',
};

export const Section = forwardRef<HTMLElement, SectionProps>(
  ({ size = 'md', background = 'white', as: Component = 'section', className = '', children, ...props }, ref) => {
    return (
      <Component
        ref={ref}
        className={`${sizeClasses[size]} ${backgroundClasses[background]} ${className}`}
        {...props}
      >
        {children}
      </Component>
    );
  }
);
Section.displayName = 'Section';

export default Section;