import {
  RiLiveLine,
  RiBarChartBoxLine,
  RiUserStarLine,
  RiLineChartLine,
  RiMap2Line,
  type RemixiconComponentType,
} from '@remixicon/react';

export type NavItem = { href: string; label: string; short: string; icon: RemixiconComponentType; live?: boolean };

export const NAV: NavItem[] = [
  { href: '/', label: 'Live results', short: 'Live', icon: RiLiveLine, live: true },
  { href: '/elections', label: 'Elections', short: 'Elections', icon: RiBarChartBoxLine },
  { href: '/politicians', label: 'Politicians', short: 'People', icon: RiUserStarLine },
  { href: '/forecasts', label: 'Forecasts', short: 'Forecasts', icon: RiLineChartLine },
  { href: '/states', label: 'States', short: 'States', icon: RiMap2Line },
];

export function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');
}
