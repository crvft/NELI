'use client';

import { Calligraph } from 'calligraph';
import { cn } from '@/utils/cn';

/**
 * Animated numeric text (Calligraph): digits roll to their new value when the
 * value changes. Static on first paint, so pages don't perform on every visit.
 */
export function AnimatedNumber({ value, className }: { value: string | number; className?: string }) {
  return (
    <Calligraph variant='number' animation='snappy' className={cn('tabular', className)}>
      {value}
    </Calligraph>
  );
}

/** Animated short text (e.g. a party code or name that changes with a filter). */
export function AnimatedText({ value, className }: { value: string; className?: string }) {
  return (
    <Calligraph variant='text' animation='smooth' className={className}>
      {value}
    </Calligraph>
  );
}
