import { HTMLAttributes, forwardRef } from 'react';

interface SeparatorProps extends HTMLAttributes<HTMLHRElement> {
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

export const Separator = forwardRef<HTMLHRElement, SeparatorProps>(
  ({ orientation = 'horizontal', className = '', ...props }, ref) => {
    return (
      <hr
        ref={ref}
        className={`divider ${orientation === 'vertical' ? 'divider-vertical' : ''} ${className}`}
        role="separator"
        {...props}
      />
    );
  }
);
Separator.displayName = 'Separator';

export default Separator;