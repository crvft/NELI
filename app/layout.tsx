import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { ThemeProvider } from 'next-themes';
import './globals.css';
import { cn } from '@/utils/cn';
import { Provider as TooltipProvider } from '@/components/ui/tooltip';
import { Sidebar } from '@/components/shell/sidebar';
import { MobileHeader, MobileTabBar } from '@/components/shell/mobile-nav';
import { MotionProvider } from '@/components/motion/motion-provider';
import { SiteFooter } from '@/components/shell/site-footer';

export const metadata: Metadata = {
  title: {
    default: 'NELI — National Electoral Interface',
    template: '%s · NELI',
  },
  description:
    'Live election results, historical trends and track records for every elected and appointed official in Nigeria.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#171717' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang='en'
      suppressHydrationWarning
      className={cn(GeistSans.variable, GeistMono.variable, 'antialiased')}
    >
      <body className='bg-surface-1 text-text-strong-950 font-sans'>
        <ThemeProvider attribute='class' defaultTheme='system' enableSystem>
          <MotionProvider>
            <TooltipProvider>
              <div className='flex min-h-dvh'>
                <Sidebar />
                <div className='flex min-w-0 flex-1 flex-col'>
                  <MobileHeader />
                  <main className='flex flex-1 flex-col pb-24 lg:pb-0'>
                    <div className='flex-1'>{children}</div>
                    <SiteFooter />
                  </main>
                </div>
              </div>
              <MobileTabBar />
            </TooltipProvider>
          </MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
