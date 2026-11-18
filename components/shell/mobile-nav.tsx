'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/utils/cn';
import { NAV, isActive } from './nav-items';
import { Logo } from './logo';
import { ThemeIconButton } from './theme-toggle';

export function MobileHeader() {
  return (
    <header className='sticky top-0 z-30 flex h-16 items-center justify-between border-b border-stroke-soft-200 bg-surface-1/85 px-4 backdrop-blur-md lg:hidden'>
      <Logo />
      <ThemeIconButton />
    </header>
  );
}

export function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label='Main'
      className='fixed inset-x-0 bottom-0 z-30 border-t border-stroke-soft-200 bg-surface-1/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden'
    >
      <ul className='mx-auto grid max-w-lg grid-cols-5'>
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-16 flex-col items-center justify-center gap-1 text-label-xs transition',
                  active ? 'text-primary-base' : 'text-text-sub-600',
                )}
              >
                <span className='relative'>
                  <Icon className='size-6' />
                  {item.live && <span className='absolute -right-0.5 -top-0.5 size-2 rounded-full bg-error-base ring-2 ring-bg-white-0' />}
                </span>
                {item.short}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
