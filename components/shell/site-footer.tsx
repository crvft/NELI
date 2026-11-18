/** Credit card at the foot of every page. */
export function SiteFooter() {
  return (
    <footer className='mx-auto flex w-full max-w-[1200px] justify-center px-4 pt-2 pb-8 sm:px-6'>
      <p className='bg-surface-2 text-paragraph-xs text-text-sub-600 shadow-surface-2 rounded-full px-4 py-2'>
        Built with love and okpa by{' '}
        <a
          href='https://x.com/crvft_'
          target='_blank'
          rel='noopener noreferrer'
          aria-label='Mico on X (@crvft_)'
          className='hit text-text-strong-950 decoration-stroke-sub-300 hover:decoration-text-strong-950 font-[550] underline underline-offset-[3px] transition-colors duration-[80ms]'
        >
          Mico
        </a>
      </p>
    </footer>
  );
}
