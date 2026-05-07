import * as React from 'react';

/**
 * Set de iconos del rediseño Turnia.
 * Estilo: lucide-style, stroke `currentColor`, tamaño y grosor parametrizables.
 * Inventario: ref docs/design/screens/tokens.jsx (línea 96).
 *
 * Uso:
 *   import { Icons, BellIcon } from '@/components/ui/icons';
 *   <Icons.bell size={18} />     // estilo del mockup
 *   <BellIcon size={18} />       // import nominal
 */

export type IconProps = Omit<React.SVGProps<SVGSVGElement>, 'children' | 'stroke' | 'fill'> & {
  size?: number;
  /** Grosor del trazo. Default 2. */
  stroke?: number;
  /** Si el icono está relleno (default 'none'). */
  fill?: string;
};

type IconBuilder = (children: React.ReactNode) => React.FC<IconProps>;

const buildIcon: IconBuilder = (children) => {
  const Comp: React.FC<IconProps> = ({
    size = 20,
    stroke = 2,
    fill = 'none',
    style,
    ...rest
  }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={style}
      {...rest}
    >
      {children}
    </svg>
  );
  return Comp;
};

// ─────────── Inventario ───────────

export const BellIcon = buildIcon(
  <>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </>
);

export const CalendarIcon = buildIcon(
  <>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </>
);

export const Calendar2Icon = buildIcon(
  <>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
    <circle cx="8" cy="14" r="1" fill="currentColor" />
    <circle cx="12" cy="14" r="1" fill="currentColor" />
    <circle cx="16" cy="14" r="1" fill="currentColor" />
  </>
);

export const HomeIcon = buildIcon(
  <>
    <path d="M3 12 12 4l9 8" />
    <path d="M5 10v10h14V10" />
  </>
);

export const UserIcon = buildIcon(
  <>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
  </>
);

export const UsersIcon = buildIcon(
  <>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M17 3.13a4 4 0 0 1 0 7.75" />
  </>
);

export const PlusIcon = buildIcon(<path d="M12 5v14M5 12h14" />);

export const SearchIcon = buildIcon(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </>
);

export const FilterIcon = buildIcon(<path d="M3 5h18l-7 9v6l-4-2v-4z" />);

export const ChevronRightIcon = buildIcon(<path d="m9 6 6 6-6 6" />);
export const ChevronLeftIcon = buildIcon(<path d="m15 6-6 6 6 6" />);
export const ChevronDownIcon = buildIcon(<path d="m6 9 6 6 6-6" />);
export const ChevronUpIcon = buildIcon(<path d="m18 15-6-6-6 6" />);

export const MoreIcon = buildIcon(
  <>
    <circle cx="5" cy="12" r="1.4" fill="currentColor" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" />
    <circle cx="19" cy="12" r="1.4" fill="currentColor" />
  </>
);

export const CheckIcon = buildIcon(<path d="m5 12 5 5L20 7" />);
export const XIcon = buildIcon(<path d="M18 6 6 18M6 6l12 12" />);

export const SwapIcon = buildIcon(
  <>
    <path d="M7 4 3 8l4 4" />
    <path d="M3 8h14a4 4 0 0 1 4 4" />
    <path d="m17 20 4-4-4-4" />
    <path d="M21 16H7a4 4 0 0 1-4-4" />
  </>
);

export const Swap2Icon = buildIcon(
  <>
    <path d="M7 16V4M3 8l4-4 4 4" />
    <path d="M17 8v12M21 16l-4 4-4-4" />
  </>
);

export const GiveawayIcon = buildIcon(
  <>
    <path d="M5 12h14" />
    <path d="m12 5-7 7 7 7" />
  </>
);

export const TakeOpenIcon = buildIcon(
  <>
    <path d="M19 12H5" />
    <path d="m12 19 7-7-7-7" />
  </>
);

export const ClockIcon = buildIcon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </>
);

export const PinIcon = buildIcon(
  <>
    <path d="M12 22s7-7 7-12a7 7 0 0 0-14 0c0 5 7 12 7 12z" />
    <circle cx="12" cy="10" r="2.5" />
  </>
);

export const InboxIcon = buildIcon(
  <>
    <path d="M22 12h-6l-2 3h-4l-2-3H2" />
    <path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.8 1.1z" />
  </>
);

export const SettingsIcon = buildIcon(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </>
);

export const LogoutIcon = buildIcon(
  <>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 17 5-5-5-5" />
    <path d="M21 12H9" />
  </>
);

export const DownloadIcon = buildIcon(
  <>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="m7 10 5 5 5-5" />
    <path d="M12 15V3" />
  </>
);

export const DocIcon = buildIcon(
  <>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
  </>
);

export const StethoscopeIcon = buildIcon(
  <>
    <path d="M11 2v2" />
    <path d="M5 2v2" />
    <path d="M5 3a3 3 0 0 0-3 3v3a4 4 0 0 0 8 0V6a3 3 0 0 0-3-3" />
    <path d="M11 3a3 3 0 0 1 3 3v3a4 4 0 0 1-8 0" />
    <path d="M8 13v2a5 5 0 0 0 10 0v-1" />
    <circle cx="18" cy="14" r="2" />
  </>
);

export const HospitalIcon = buildIcon(
  <>
    <path d="M12 6v4M9 8h6" />
    <path d="M3 21h18" />
    <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
    <path d="M9 21v-4h6v4" />
  </>
);

export const TrendIcon = buildIcon(
  <>
    <path d="m22 7-8.5 8.5-5-5L2 17" />
    <path d="M16 7h6v6" />
  </>
);

export const CopyIcon = buildIcon(
  <>
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </>
);

export const BeachIcon = buildIcon(
  <>
    <circle cx="12" cy="6" r="3" />
    <path d="M12 9v13" />
    <path d="M3 22h18" />
    <path d="M5 17c2-2 5-2 7 0s5 2 7 0" />
  </>
);

export const EduIcon = buildIcon(
  <>
    <path d="M22 10 12 5 2 10l10 5 10-5z" />
    <path d="M6 12v5c2 2 4 3 6 3s4-1 6-3v-5" />
  </>
);

export const CrossIcon = buildIcon(
  <>
    <rect x="9" y="3" width="6" height="18" rx="1" />
    <rect x="3" y="9" width="18" height="6" rx="1" />
  </>
);

export const ArrowRightIcon = buildIcon(
  <>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </>
);

export const ArrowLeftIcon = buildIcon(
  <>
    <path d="M19 12H5" />
    <path d="m12 19-7-7 7-7" />
  </>
);

export const SendIcon = buildIcon(
  <>
    <path d="m22 2-7 20-4-9-9-4z" />
    <path d="M22 2 11 13" />
  </>
);

export const ShieldIcon = buildIcon(
  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
);

export const SparkleIcon = buildIcon(
  <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />
);

export const EyeIcon = buildIcon(
  <>
    <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </>
);

export const ListIcon = buildIcon(
  <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
);

export const GridIcon = buildIcon(
  <>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </>
);

export const AlertIcon = buildIcon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v4M12 16h.01" />
  </>
);

export const BurgerIcon = buildIcon(<path d="M4 6h16M4 12h16M4 18h16" />);

export const FingerprintIcon = buildIcon(
  <>
    <path d="M3 11a9 9 0 0 1 18 0" />
    <path d="M5 14a7 7 0 0 1 14 0v1" />
    <path d="M7 17a5 5 0 0 1 10 0" />
    <path d="M9 20c0-3 1-5 3-5s3 2 3 5" />
  </>
);

export const BriefcaseIcon = buildIcon(
  <>
    <rect x="2" y="7" width="20" height="14" rx="2" />
    <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </>
);

export const ZapIcon = buildIcon(<path d="M13 2 3 14h7l-1 8 10-12h-7z" />);

export const RefreshIcon = buildIcon(
  <>
    <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
    <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
    <path d="M21 3v5h-5M3 21v-5h5" />
  </>
);

export const LockIcon = buildIcon(
  <>
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </>
);

export const MailIcon = buildIcon(
  <>
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m2 7 10 6 10-6" />
  </>
);

export const BuildingIcon = buildIcon(
  <>
    <rect x="4" y="2" width="16" height="20" rx="1" />
    <path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01" />
  </>
);

export const HistoryIcon = buildIcon(
  <>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5" />
    <path d="M12 7v5l3 2" />
  </>
);

export const SunIcon = buildIcon(
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </>
);

export const MoonIcon = buildIcon(
  <path d="M12 3a7 7 0 0 0 9 9 9 9 0 1 1-9-9Z" />
);

// ─────────── Namespace estilo mockup ───────────

/**
 * Acceso por nombre corto, equivalente al objeto `Icons` de docs/design/screens/tokens.jsx.
 * Útil para mantener uno-a-uno la equivalencia con los mockups.
 */
export const Icons = {
  bell: BellIcon,
  bell2: BellIcon,
  calendar: CalendarIcon,
  cal2: Calendar2Icon,
  home: HomeIcon,
  user: UserIcon,
  users: UsersIcon,
  plus: PlusIcon,
  search: SearchIcon,
  filter: FilterIcon,
  chevronR: ChevronRightIcon,
  chevronL: ChevronLeftIcon,
  chevronD: ChevronDownIcon,
  chevronU: ChevronUpIcon,
  more: MoreIcon,
  check: CheckIcon,
  x: XIcon,
  swap: SwapIcon,
  swap2: Swap2Icon,
  giveaway: GiveawayIcon,
  takeOpen: TakeOpenIcon,
  clock: ClockIcon,
  pin: PinIcon,
  inbox: InboxIcon,
  settings: SettingsIcon,
  logout: LogoutIcon,
  download: DownloadIcon,
  doc: DocIcon,
  stethoscope: StethoscopeIcon,
  hospital: HospitalIcon,
  trend: TrendIcon,
  copy: CopyIcon,
  beach: BeachIcon,
  edu: EduIcon,
  cross: CrossIcon,
  arrowR: ArrowRightIcon,
  arrowL: ArrowLeftIcon,
  send: SendIcon,
  shield: ShieldIcon,
  sparkle: SparkleIcon,
  eye: EyeIcon,
  list: ListIcon,
  grid: GridIcon,
  alert: AlertIcon,
  burger: BurgerIcon,
  fingerprint: FingerprintIcon,
  briefcase: BriefcaseIcon,
  zap: ZapIcon,
  refresh: RefreshIcon,
  lock: LockIcon,
  mail: MailIcon,
  building: BuildingIcon,
  history: HistoryIcon,
  sun: SunIcon,
  moon: MoonIcon,
} as const;

export type IconName = keyof typeof Icons;
