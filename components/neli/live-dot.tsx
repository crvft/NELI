export function LiveDot({ label = false }: { label?: boolean }) {
  return (
    <span className='inline-flex items-center gap-1.5'>
      <span className='relative flex size-2'>
        <span className='absolute inline-flex size-full animate-ping rounded-full bg-error-base opacity-60 motion-reduce:hidden' />
        <span className='relative inline-flex size-2 rounded-full bg-error-base' />
      </span>
      {label && <span className='text-label-xs uppercase tracking-wide text-error-base'>Live</span>}
    </span>
  );
}
