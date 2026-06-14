// Named SVG icons replacing all emoji. Decorative by default (aria-hidden).
// Pass `title` to make an icon meaningful to screen readers.
const PATHS = {
  drop: <path d="M12 2.5C12 2.5 5 11 5 15.5a7 7 0 0 0 14 0C19 11 12 2.5 12 2.5z" />,
  lock: <><rect x="4" y="11" width="16" height="10" rx="2.5" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  bolt: <path d="M13 2 4.5 13.5H11l-1 8.5L19.5 10H13z" />,
  filter: <><path d="M12 3C12 3 6 9 6 13.5a6 6 0 0 0 12 0C18 9 12 3 12 3z" /><path d="M10 13.5a2 2 0 0 0 2 2" /></>,
  jug: <><rect x="8" y="2" width="8" height="3.5" rx="1" /><path d="M6 7q0-1.5 2-1.5h8q2 0 2 1.5v13q0 2-2 2H8q-2 0-2-2z" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  phone: <path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 5 5L16 13l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />,
  cash: <><rect x="2.5" y="6" width="19" height="12" rx="2.5" /><circle cx="12" cy="12" r="2.5" /></>,
  mobile: <><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M11 18h2" /></>,
  card: <><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 10h19" /></>,
  truck: <><path d="M2 6h11v9H2z" /><path d="M13 9h4l3 3v3h-7z" /><circle cx="6" cy="18" r="1.8" /><circle cx="17" cy="18" r="1.8" /></>,
  clipboard: <><rect x="5" y="4" width="14" height="17" rx="2.5" /><path d="M9 4V3h6v1" /><path d="M9 10h6M9 14h4" /></>,
  check: <path d="m5 13 4 4 10-11" />,
  party: <><path d="M4 20 9 8l7 7z" /><path d="M14 4l1 2M18 6l2-1M17 10l2 1" /></>,
  trash: <><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6 7l1 13h10l1-13" /></>,
  refresh: <><path d="M4 12a8 8 0 0 1 14-5l2 2" /><path d="M20 4v5h-5" /><path d="M20 12a8 8 0 0 1-14 5l-2-2" /><path d="M4 20v-5h5" /></>,
  chat: <path d="M4 5h16v11H9l-5 4z" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  cancel: <><circle cx="12" cy="12" r="9" /><path d="M9 9l6 6M15 9l-6 6" /></>,
};

export default function ClayIcon({ name, title, className = 'w-6 h-6', fill = 'none', stroke = 'currentColor', strokeWidth = 2 }) {
  const node = PATHS[name];
  if (!node) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title || undefined}
    >
      {title ? <title>{title}</title> : null}
      {node}
    </svg>
  );
}
