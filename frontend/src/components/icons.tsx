/**
 * Ícones em SVG inline.
 *
 * Mantidos locais de propósito: uma lib de ícones adicionaria ~40kB no bundle
 * e o projeto usa apenas ~20 ícones. Todos usam `currentColor` para herdar a
 * cor do texto e DPI vetorial.
 */

type IconProps = { className?: string };

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  viewBox: '0 0 24 24',
  'aria-hidden': true,
};

/* ---------- Navegação / menu ---------- */

export const MenuIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}><path d="M4 7h16M4 12h16M4 17h16" /></svg>
);

export const CloseIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}><path d="M6 18 18 6M6 6l12 12" /></svg>
);

export const ArrowRightIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);

export const ArrowLeftIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
);

export const ChevronDownIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}><path d="m6 9 6 6 6-6" /></svg>
);

export const ChevronRightIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}><path d="m9 6 6 6-6 6" /></svg>
);

export const ChevronLeftIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}><path d="m15 6-6 6 6 6" /></svg>
);

export const ExternalLinkIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}><path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>
);

/* ---------- Dashboard ---------- */

export const HomeIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}><path d="M3 10.5 12 3l9 7.5M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" /></svg>
);

export const CalendarIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}><path d="M8 3v4M16 3v4M3.5 9.5h17M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v12A1.5 1.5 0 0 1 19 20.5H5A1.5 1.5 0 0 1 3.5 19V7A1.5 1.5 0 0 1 5 5.5Z" /></svg>
);

export const CalendarCheckIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}><path d="M8 3v4M16 3v4M3.5 9.5h17M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v12A1.5 1.5 0 0 1 19 20.5H5A1.5 1.5 0 0 1 3.5 19V7A1.5 1.5 0 0 1 5 5.5Z" /><path d="m9 14.5 2 2 4-4" /></svg>
);

export const UsersIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}><path d="M15.5 20v-1.5a4 4 0 0 0-4-4h-4a4 4 0 0 0-4 4V20" /><circle cx="9.5" cy="7.5" r="3.5" /><path d="M21.5 20v-1.5a4 4 0 0 0-3-3.87M16.5 4.13a4 4 0 0 1 0 6.74" /></svg>
);

export const ScissorsIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}><circle cx="6" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" /><path d="M20 4 8.6 15.4M14.5 14.5 20 20M8.6 8.6 12 12" /></svg>
);

export const SettingsIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .32 1.77l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.6 1.6 0 0 0-1.77-.32 1.6 1.6 0 0 0-1 1.47V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1.05-1.47 1.6 1.6 0 0 0-1.77.32l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.6 1.6 0 0 0 .32-1.77 1.6 1.6 0 0 0-1.47-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.47-1.05 1.6 1.6 0 0 0-.32-1.77l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.6 1.6 0 0 0 1.77.32H9a1.6 1.6 0 0 0 1-1.47V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.47 1.6 1.6 0 0 0 1.77-.32l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.6 1.6 0 0 0-.32 1.77V9a1.6 1.6 0 0 0 1.47 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.47 1Z" /></svg>
);

export const WalletIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}><path d="M20 8.5V7a1.5 1.5 0 0 0-1.5-1.5h-13A1.5 1.5 0 0 0 4 7v10a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 17v-1.5" /><path d="M21 8.5h-4.5a3.5 3.5 0 0 0 0 7H21z" /></svg>
);

export const TrendUpIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}><path d="M3 17 9.5 10.5l4 4L21 7" /><path d="M15 7h6v6" /></svg>
);

export const ChartIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>
);

/* ---------- Ações ---------- */

export const PlusIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}><path d="M12 5v14M5 12h14" /></svg>
);

export const PencilIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}><path d="M17 3.5a2.12 2.12 0 0 1 3 3L8 18.5 3.5 20 5 15.5Z" /><path d="M14.5 6 18 9.5" /></svg>
);

export const TrashIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}><path d="M4 7h16M9.5 7V4.5h5V7M6 7l1 13h10l1-13M10 11v6M14 11v6" /></svg>
);

export const RefreshIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}><path d="M20.5 12a8.5 8.5 0 1 1-2.5-6" /><path d="M20.5 4v5h-5" /></svg>
);

export const CheckIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}><path d="m4.5 12.5 5 5 10-11" /></svg>
);

export const CopyIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}><rect x="9" y="9" width="11" height="11" rx="1" /><path d="M5 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5" /></svg>
);

export const SendIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}><path d="M21 3 10.5 13.5M21 3l-6.5 18-4-8-8-4Z" /></svg>
);

export const DownloadIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}><path d="M12 3v12M7.5 10.5 12 15l4.5-4.5M4 20h16" /></svg>
);

export const UploadIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}><path d="M12 21V9M7.5 13.5 12 9l4.5 4.5M4 4h16" /></svg>
);

/* ---------- Contato / misc ---------- */

export const PhoneIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}><path d="M6 3.5h3l1.5 4-2 1.5a12 12 0 0 0 5.5 5.5l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4 5.7 2 2 0 0 1 6 3.5Z" /></svg>
);

export const MailIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}><rect x="2.5" y="5" width="19" height="14" rx="1.5" /><path d="m3 6.5 9 6 9-6" /></svg>
);

export const ShieldIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}><path d="M12 2.5 20 6v6c0 5-3.4 8.9-8 9.5C7.4 20.9 4 17 4 12V6Z" /><path d="m9 12 2 2 4-4" /></svg>
);

export const KeyIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}><circle cx="8" cy="12" r="4" /><path d="M12 12h9M18 12v3.5M15 12v2.5" /></svg>
);

export const UserPlusIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}><circle cx="10" cy="8" r="3.75" /><path d="M3 20.5a7 7 0 0 1 11.2-5.6" /><path d="M18.5 14v6M15.5 17h6" /></svg>
);

export const LockIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}><rect x="4" y="10" width="16" height="10.5" rx="1.5" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
);

export const UserIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}><circle cx="12" cy="8" r="3.75" /><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" /></svg>
);

export const LogoutIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}><path d="M15 16.5 19.5 12 15 7.5M19.5 12H9" /><path d="M12 3.5H6a1.5 1.5 0 0 0-1.5 1.5v14A1.5 1.5 0 0 0 6 20.5h6" /></svg>
);

export const ClockIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5.5l3.5 2" /></svg>
);

export const MapPinIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}><path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></svg>
);

export const StarIcon = ({ className }: IconProps) => (
  <svg fill="currentColor" className={className} viewBox="0 0 20 20" aria-hidden="true">
    <path d="M10 1.8l2.4 5 5.5.8-4 3.9.9 5.5-4.8-2.6-4.8 2.6.9-5.5-4-3.9 5.5-.8Z" />
  </svg>
);

export const AlertIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5M12 16.2v.3" /></svg>
);

export const InfoIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}><circle cx="12" cy="12" r="9" /><path d="M12 16.5V11M12 7.8v.3" /></svg>
);

export const CheckCircleIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></svg>
);

export const SearchIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}><circle cx="11" cy="11" r="7" /><path d="m16.5 16.5 4 4" /></svg>
);

export const FilterIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}><path d="M3 5h18l-7 8v6l-4 2v-8Z" /></svg>
);

export const ListIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></svg>
);

export const GridIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}><rect x="3.5" y="3.5" width="7" height="7" /><rect x="13.5" y="3.5" width="7" height="7" /><rect x="3.5" y="13.5" width="7" height="7" /><rect x="13.5" y="13.5" width="7" height="7" /></svg>
);
