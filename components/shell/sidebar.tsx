'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { RiInformationLine } from '@remixicon/react';
import { cn } from '@/utils/cn';
import { NAV, isActive } from './nav-items';
import { Logo } from './logo';
import { ThemeToggle } from './theme-toggle';
import { LiveDot } from '@/components/neli/live-dot';

export function Sidebar() {
  const pathname = usePathname();
  return (
    <div className='hidden w-[264px] shrink-0 border-r border-stroke-soft-200 bg-bg-white-0 lg:block'>
    <aside className='sticky top-0 flex h-dvh flex-col'>
      <div className='px-5 py-6'>
        <Logo />
      </div>
      <div className='mx-5 h-px bg-stroke-soft-200' />
      <nav className='flex flex-col gap-1 p-3' aria-label='Main'>
        <div className='px-2 pb-2 pt-3 text-subheading-xs uppercase text-text-soft-400'>Main</div>
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-label-sm transition',
                active ? 'bg-bg-weak-50 text-text-strong-950' : 'text-text-sub-600 hover:bg-bg-weak-50 hover:text-text-strong-950',
              )}
            >
              {active && <span className='absolute -left-3 top-2 h-5 w-1 rounded-r-full bg-primary-base' />}
              <Icon className={cn('size-5 shrink-0', active ? 'text-primary-base' : 'text-text-soft-400 group-hover:text-text-sub-600')} />
              <span className='flex-1'>{item.label}</span>
              {item.live && <LiveDot />}
            </Link>
          );
        })}
      </nav>
      <div className='mt-auto flex flex-col gap-3 p-5'>
        <div className='rounded-xl bg-bg-weak-50 p-3.5'>
          <div className='flex items-center gap-1.5 text-label-xs text-text-strong-950'>
            <RiInformationLine className='size-4 text-away-base' />
            Sample data
          </div>
          <p className='mt-1 text-paragraph-xs text-text-sub-600'>
            All names and figures are fictional, for designing the interface. Real INEC data comes next.
          </p>
        </div>
        <ThemeToggle />
      </div>
    </aside>
    </div>
  );
}
