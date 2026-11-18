'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { useMounted } from '@/hooks/use-mounted';
import { IconMoon, IconSun, IconSystem } from '@/components/icons';
import * as SegmentedControl from '@/components/ui/segmented-control';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  if (!mounted) return <div className='h-9 w-full' />;
  return (
    <SegmentedControl.Root value={theme} onValueChange={setTheme}>
      <SegmentedControl.List>
        <SegmentedControl.Trigger value='light' aria-label='Light theme'>
          <IconSun className='size-4' />
        </SegmentedControl.Trigger>
        <SegmentedControl.Trigger value='dark' aria-label='Dark theme'>
          <IconMoon className='size-4' />
        </SegmentedControl.Trigger>
        <SegmentedControl.Trigger value='system' aria-label='System theme'>
          <IconSystem className='size-4' />
        </SegmentedControl.Trigger>
      </SegmentedControl.List>
    </SegmentedControl.Root>
  );
}

export function ThemeIconButton() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const dark = mounted && resolvedTheme === 'dark';
  return (
    <button
      type='button'
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      className='hit grid size-9 place-items-center rounded-10 text-text-sub-600 shadow-surface-2 transition-colors duration-[80ms] hover:bg-hover hover:text-text-strong-950'
    >
      {dark ? <IconSun className='size-[18px]' /> : <IconMoon className='size-[18px]' />}
    </button>
  );
}
