'use client';

import { MotionConfig } from 'motion/react';

/** Reduced motion means fewer and gentler, not none: transforms drop, fades stay. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion='user'>{children}</MotionConfig>;
}
