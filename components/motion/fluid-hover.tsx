'use client';

import * as React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { spring } from '@/lib/motion';
import { cn } from '@/utils/cn';

type Rect = { x: number; y: number; width: number; height: number };

type Props<T extends React.ElementType> = {
  as?: T;
  children: React.ReactNode;
  className?: string;
  /** 'under' paints the highlight behind transparent rows; 'over' tints solid cards. */
  layer?: 'under' | 'over';
  /** Corner radius of the highlight, matching the items */
  radius?: number | string;
  /** Route clicks in gaps to the lit item, within this many px (0 = off) */
  gapClick?: number;
} & Omit<React.ComponentPropsWithoutRef<T>, 'as' | 'children' | 'className'>;

const ITEM = '[data-fluid-item]';

function offsetWithin(el: HTMLElement, container: HTMLElement): Rect {
  // Layout offsets (not boxes) so a transform in flight doesn't skew the measurement.
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = el;
  while (node && node !== container) {
    x += node.offsetLeft;
    y += node.offsetTop;
    const parent = node.offsetParent as HTMLElement | null;
    if (parent && parent !== container && container.contains(parent)) {
      node = parent;
      continue;
    }
    if (parent !== container) {
      x -= container.offsetLeft;
      y -= container.offsetTop;
    }
    break;
  }
  return { x, y, width: el.offsetWidth, height: el.offsetHeight };
}

/**
 * Fluid hover: one highlight that glides between items under the pointer instead
 * of blinking. Mark clickable items with `data-fluid-item`; mark the current
 * (selected) item `data-selected` and it takes no part in hover. Pointer-only:
 * touch screens get nothing (they have no pointer at rest).
 */
export function FluidHover<T extends React.ElementType = 'div'>({ as, children, className, layer = 'under', radius = 10, gapClick = 0, ...rest }: Props<T>) {
  const Comp = (as ?? 'div') as React.ElementType;
  const ref = React.useRef<HTMLElement>(null);
  const active = React.useRef<HTMLElement | null>(null);
  const [rect, setRect] = React.useState<Rect | null>(null);
  const [session, setSession] = React.useState(0);
  const [enabled, setEnabled] = React.useState(false);
  const reduced = useReducedMotion();

  React.useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    const on = () => setEnabled(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const update = React.useCallback((target: EventTarget | null) => {
    const container = ref.current;
    if (!container) return;
    const item = (target as HTMLElement | null)?.closest?.(ITEM) as HTMLElement | null;
    if (!item || !container.contains(item) || item.hasAttribute('data-selected') || item.getAttribute('aria-disabled') === 'true') {
      active.current = null;
      setRect(null);
      return;
    }
    if (item === active.current) return;
    active.current = item;
    setRect(offsetWithin(item, container));
  }, []);

  const handlers = enabled
    ? {
        onPointerEnter: () => setSession((s) => s + 1),
        onPointerMove: (e: React.PointerEvent) => e.pointerType === 'mouse' && update(e.target),
        onPointerLeave: () => {
          active.current = null;
          setRect(null);
        },
        onClickCapture: (e: React.MouseEvent) => {
          if (!gapClick || !active.current || !rect) return;
          if ((e.target as HTMLElement).closest(ITEM)) return;
          const c = ref.current!.getBoundingClientRect();
          const px = e.clientX - c.left;
          const py = e.clientY - c.top;
          const dx = Math.max(rect.x - px, 0, px - (rect.x + rect.width));
          const dy = Math.max(rect.y - py, 0, py - (rect.y + rect.height));
          if (Math.hypot(dx, dy) > gapClick) return;
          const target = active.current.matches('a,button') ? active.current : active.current.querySelector<HTMLElement>('a,button');
          target?.click();
        },
      }
    : {};

  return (
    <Comp ref={ref} className={cn('relative', className)} {...handlers} {...rest}>
      <AnimatePresence>
        {enabled && rect && (
          <motion.span
            key={session}
            aria-hidden
            className={cn('pointer-events-none absolute left-0 top-0 block', layer === 'over' ? 'z-10 bg-hover' : 'z-0 bg-hover')}
            style={{ borderRadius: radius }}
            initial={{ opacity: 0, ...rect }}
            animate={{ opacity: 1, ...rect }}
            exit={{ opacity: 0, transition: spring.fast.exit }}
            transition={reduced ? { duration: 0, opacity: spring.fast } : spring.fast}
          />
        )}
      </AnimatePresence>
      {children}
    </Comp>
  );
}
