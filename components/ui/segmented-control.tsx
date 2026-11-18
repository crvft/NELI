// AlignUI SegmentedControl v0.0.0

'use client';

import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { mergeRefs } from '@/utils/merge-refs';
import { Slottable } from '@radix-ui/react-slot';
import { cn } from '@/utils/cn';
import { useTabObserver } from '@/hooks/use-tab-observer';

const SegmentedControlRoot = TabsPrimitive.Root;
SegmentedControlRoot.displayName = 'SegmentedControlRoot';

const SegmentedControlList = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & {
    floatingBgClassName?: string;
  }
>(({ children, className, floatingBgClassName, ...rest }, forwardedRef) => {
  const [lineStyle, setLineStyle] = React.useState({ width: 0, left: 0 });

  const { mounted, listRef } = useTabObserver({
    onActiveTabChange: (_, activeTab) => {
      const { offsetWidth: width, offsetLeft: left } = activeTab;
      setLineStyle({ width, left });
    },
  });

  return (
    <TabsPrimitive.List
      ref={mergeRefs(forwardedRef, listRef)}
      className={cn(
        'relative isolate grid h-9 w-full auto-cols-fr grid-flow-col gap-1 rounded-10 bg-hover p-1',
        className,
      )}
      {...rest}
    >
      <Slottable>{children}</Slottable>

      {/* floating bg */}
      <div
        className={cn(
          'absolute inset-y-1 left-0 -z-10 rounded-md bg-surface-3 shadow-surface-3 transition-[transform,width] duration-[160ms] motion-reduce:transition-none',
          {
            hidden: !mounted,
          },
          floatingBgClassName,
        )}
        style={{
          transform: `translate3d(${lineStyle.left}px, 0, 0)`,
          width: `${lineStyle.width}px`,
          // spring.moderate: critically damped, lands exactly (tabs)
          transitionTimingFunction: 'var(--ease-moderate)',
        }}
        aria-hidden='true'
      />
    </TabsPrimitive.List>
  );
});
SegmentedControlList.displayName = 'SegmentedControlList';

const SegmentedControlTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...rest }, forwardedRef) => {
  return (
    <TabsPrimitive.Trigger
      ref={forwardedRef}
      className={cn(
        // base
        'peer',
        'relative z-10 h-7 whitespace-nowrap rounded-md px-1 text-label-sm text-text-sub-600 outline-hidden',
        'flex items-center justify-center gap-1.5',
        'hit transition-colors duration-[80ms]',
        // focus
        'focus-visible:shadow-[0_0_0_2px_var(--primary-alpha-24)]',
        // active
        'hover:text-text-strong-950 data-[state=active]:text-text-strong-950',
        className,
      )}
      {...rest}
    />
  );
});
SegmentedControlTrigger.displayName = 'SegmentedControlTrigger';

const SegmentedControlContent = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ ...rest }, forwardedRef) => {
  return <TabsPrimitive.Content ref={forwardedRef} {...rest} />;
});
SegmentedControlContent.displayName = 'SegmentedControlContent';

export {
  SegmentedControlRoot as Root,
  SegmentedControlList as List,
  SegmentedControlTrigger as Trigger,
  SegmentedControlContent as Content,
};
