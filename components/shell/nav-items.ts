import { IconElections, IconForecast, IconLive, IconMap, IconPeople, type IconComponent } from '@/components/icons';

import type { Route } from 'next';

export type NavItem = { href: Route; label: string; short: string; icon: IconComponent; live?: boolean };

export const NAV: NavItem[] = [
  { href: '/', label: 'Live results', short: 'Live', icon: IconLive, live: true },
  { href: '/elections', label: 'Elections', short: 'Elections', icon: IconElections },
  { href: '/politicians', label: 'Politicians', short: 'People', icon: IconPeople },
  { href: '/forecasts', label: 'Forecasts', short: 'Forecasts', icon: IconForecast },
  { href: '/states', label: 'States', short: 'States', icon: IconMap },
];

export function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');
}
