const VARIANTS = {
  raised: 'clay-raised',
  raisedSm: 'clay-raised-sm',
  inset: 'clay-inset',
  flat: 'bg-clay-surface',
};

export default function ClayCard({ as: Tag = 'div', variant = 'raised', className = '', children, ...rest }) {
  return (
    <Tag className={`rounded-3xl ${VARIANTS[variant] || VARIANTS.raised} ${className}`} {...rest}>
      {children}
    </Tag>
  );
}
