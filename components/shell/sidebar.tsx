'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IconInfo } from '@/components/icons';
import { FluidHover } from '@/components/motion/fluid-hover';
import { LiveDot } from '@/components/neli/live-dot';
import { cn } from '@/utils/cn';
import { NAV, isActive } from './nav-items';
import { Logo } from './logo';
import { ThemeToggle } from './theme-toggle';

export function Sidebar() {
  const pathname = usePathname();
  return (
    <div className='hidden w-[256px] shrink-0 border-r border-stroke-soft-200 bg-surface-1 lg:block'>
      <aside className='sticky top-0 flex h-dvh flex-col'>
        <div className='px-5 py-6'>
          <Logo />
        </div>
        <nav aria-label='Main' className='px-3'>
          <FluidHover as='ul' className='flex flex-col gap-0.5' radius={8} gapClick={8}>
            {NAV.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <li key={item.href} data-fluid-item data-selected={active ? '' : undefined} className='relative'>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-label-sm transition-colors duration-[80ms]',
                      active ? 'bg-selected text-text-strong-950' : 'text-text-sub-600 hover:text-text-strong-950',
                    )}
                  >
                    <Icon className={cn('size-[18px] shrink-0', active && 'text-primary-base')} />
                    <span className='flex-1'>{item.label}</span>
                    {item.live && <LiveDot />}
                  </Link>
                </li>
              );
            })}
          </FluidHover>
        </nav>
        <div className='mt-auto flex flex-col gap-3 p-4'>
          <div className='rounded-xl bg-surface-2 p-3.5 shadow-surface-2'>
            <div className='flex items-center gap-1.5 text-label-xs text-text-strong-950'>
              <IconInfo className='size-4 text-away-base' />
              Sample data
            </div>
            <p className='mt-1 text-paragraph-xs text-text-sub-600'>All names and figures are fictional, for designing the interface. Real INEC data comes next.</p>
          </div>
          <ThemeToggle />
        </div>
      </aside>
    </div>
  );
}
