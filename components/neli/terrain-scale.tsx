import { cn } from '@/utils/cn';

/** matplotlib "plasma", the palette of the Manhattan roof-height reference map */
export const PLASMA = ['#0d0887', '#46039f', '#7201a8', '#9c179e', '#bd3786', '#d8576b', '#ed7953', '#fb9f3a', '#fdca26', '#f0f921'];

/** The terrain view's colour scale: line colour by vote share. */
export function PlasmaScale({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className='h-2.5 rounded-full' style={{ background: `linear-gradient(90deg, ${PLASMA.join(', ')})` }} />
      <div className='text-paragraph-xs text-text-sub-600 tabular flex justify-between'>
        <span>0%</span>
        <span>25%</span>
        <span>50%</span>
        <span>75%</span>
        <span>100%</span>
      </div>
    </div>
  );
}
