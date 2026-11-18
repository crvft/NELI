'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { RiMoonLine, RiSunLine, RiComputerLine } from '@remixicon/react';
import * as SegmentedControl from '@/components/ui/segmented-control';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) return <div className='h-9 w-full' />;
  return (
    <SegmentedControl.Root value={theme} onValueChange={setTheme}>
      <SegmentedControl.List>
        <SegmentedControl.Trigger value='light' aria-label='Light theme'>
          <RiSunLine className='size-4' />
        </SegmentedControl.Trigger>
        <SegmentedControl.Trigger value='dark' aria-label='Dark theme'>
          <RiMoonLine className='size-4' />
        </SegmentedControl.Trigger>
        <SegmentedControl.Trigger value='system' aria-label='System theme'>
          <RiComputerLine className='size-4' />
        </SegmentedControl.Trigger>
      </SegmentedControl.List>
    </SegmentedControl.Root>
  );
}

export function ThemeIconButton() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === 'dark';
  return (
    <button
      type='button'
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      className='grid size-10 place-items-center rounded-10 text-text-sub-600 ring-1 ring-inset ring-stroke-soft-200 transition hover:bg-bg-weak-50 hover:text-text-strong-950'
    >
      {dark ? <RiSunLine className='size-5' /> : <RiMoonLine className='size-5' />}
    </button>
  );
}
