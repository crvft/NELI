/**
 * Icon set: Hugeicons (free, stroke rounded). One wrapper, one stroke weight,
 * sized by className (size-4 = 16px default control icon, size-3.5 compact).
 */
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import {
  Analytics01Icon,
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowLeft02Icon,
  ArrowRight01Icon,
  ArrowUpRight01Icon,
  BalanceScaleIcon,
  Calendar03Icon,
  CancelCircleIcon,
  ChartBarLineIcon,
  ChartLineData02Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  ComputerIcon,
  Cursor01Icon,
  InformationCircleIcon,
  LiveStreaming02Icon,
  MapsIcon,
  Moon02Icon,
  Search01Icon,
  Sun03Icon,
  UserStar01Icon,
  Sorting01Icon,
  Tick02Icon,
} from '@hugeicons/core-free-icons';

export type IconProps = { className?: string; strokeWidth?: number; 'aria-hidden'?: boolean };
export type IconComponent = (props: IconProps) => React.JSX.Element;

function make(icon: IconSvgElement, name: string): IconComponent {
  const C = ({ className, strokeWidth = 1.6 }: IconProps) => (
    <HugeiconsIcon icon={icon} className={className} strokeWidth={strokeWidth} aria-hidden focusable={false} />
  );
  C.displayName = name;
  return C;
}

export const IconLive = make(LiveStreaming02Icon, 'IconLive');
export const IconElections = make(ChartBarLineIcon, 'IconElections');
export const IconPeople = make(UserStar01Icon, 'IconPeople');
export const IconForecast = make(ChartLineData02Icon, 'IconForecast');
export const IconMap = make(MapsIcon, 'IconMap');
export const IconAnalytics = make(Analytics01Icon, 'IconAnalytics');
export const IconSun = make(Sun03Icon, 'IconSun');
export const IconMoon = make(Moon02Icon, 'IconMoon');
export const IconSystem = make(ComputerIcon, 'IconSystem');
export const IconSearch = make(Search01Icon, 'IconSearch');
export const IconBack = make(ArrowLeft02Icon, 'IconBack');
export const IconChevronLeft = make(ArrowLeft01Icon, 'IconChevronLeft');
export const IconChevronRight = make(ArrowRight01Icon, 'IconChevronRight');
export const IconChevronDown = make(ArrowDown01Icon, 'IconChevronDown');
export const IconExternal = make(ArrowUpRight01Icon, 'IconExternal');
export const IconCalendar = make(Calendar03Icon, 'IconCalendar');
export const IconInfo = make(InformationCircleIcon, 'IconInfo');
export const IconWon = make(CheckmarkCircle02Icon, 'IconWon');
export const IconLost = make(CancelCircleIcon, 'IconLost');
export const IconUpcoming = make(Clock01Icon, 'IconUpcoming');
export const IconCursor = make(Cursor01Icon, 'IconCursor');
export const IconScale = make(BalanceScaleIcon, 'IconScale');
export const IconSort = make(Sorting01Icon, 'IconSort');
export const IconCheck = make(Tick02Icon, 'IconCheck');
