import { HTMLAttributes, forwardRef } from 'react';

type Variant = 'outline' | 'solid' | 'muted';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

const variantClasses: Record<Variant, string> = {
  outline: 'badge-outline',
  solid: 'badge-solid',
  muted: 'badge-muted',
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = 'outline', className = '', children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={`${variantClasses[variant]} ${className}`}
        {...props}
      >
        {children}
      </span>
    );
  }
);
Badge.displayName = 'Badge';

export default Badge;