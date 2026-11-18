import Link from 'next/link';

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href='/' className='flex items-center gap-2.5 rounded-10 outline-hidden focus-visible:ring-2 focus-visible:ring-primary-alpha-24'>
      <span className='grid size-8 place-items-center rounded-10 bg-primary-base text-label-sm text-static-white'>
        <svg viewBox='0 0 20 20' className='size-4' aria-hidden>
          <path d='M4 16V4l12 12V4' fill='none' stroke='currentColor' strokeWidth='2.4' strokeLinecap='round' strokeLinejoin='round' />
        </svg>
      </span>
      {!compact && (
        <span className='flex flex-col leading-none'>
          <span className='text-label-md tracking-tight text-text-strong-950'>NELI</span>
          <span className='mt-0.5 text-paragraph-xs text-text-sub-600'>National Electoral Interface</span>
        </span>
      )}
    </Link>
  );
}
