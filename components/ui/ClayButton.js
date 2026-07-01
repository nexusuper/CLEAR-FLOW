import Link from 'next/link';

const VARIANTS = {
  primary: 'clay-btn-primary',
  white: 'clay-btn-white',
  ghost: 'bg-white/20 text-white border-2 border-white/60',
  outline: 'bg-clay-surface text-clay-skydeep ring-1 ring-clay-sky/40 clay-raised-sm',
};

const SIZES = {
  md: 'px-6 py-3 text-base',
  lg: 'px-8 py-4 text-lg',
  sm: 'px-4 py-2 text-sm',
};

export default function ClayButton({
  href,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  children,
  ...rest
}) {
  const classes = `inline-flex items-center justify-center gap-2 rounded-full font-display font-semibold clay-pressable ${SIZES[size]} ${VARIANTS[variant]} ${disabled || loading ? 'opacity-60 pointer-events-none' : ''} ${className}`;

  if (href && !disabled && !loading) {
    return (
      <Link href={href} className={classes} {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <button className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? (
        <>
          <span className="clay-spinner" aria-hidden="true" />
          Please wait…
        </>
      ) : (
        children
      )}
    </button>
  );
}
