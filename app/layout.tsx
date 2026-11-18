import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { ThemeProvider } from 'next-themes';
import './globals.css';
import { cn } from '@/utils/cn';
import { Provider as TooltipProvider } from '@/components/ui/tooltip';
import { Sidebar } from '@/components/shell/sidebar';
import { MobileHeader, MobileTabBar } from '@/components/shell/mobile-nav';

export const metadata: Metadata = {
  title: { default: 'NELI — National Electoral Interface', template: '%s · NELI' },
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang='en' suppressHydrationWarning className={cn(GeistSans.variable, GeistMono.variable, 'antialiased')}>
      <body className='bg-bg-weak-50 font-sans text-text-strong-950'>
        <ThemeProvider attribute='class' defaultTheme='system' enableSystem>
          <TooltipProvider>
            <div className='flex min-h-dvh'>
              <Sidebar />
              <div className='flex min-w-0 flex-1 flex-col'>
                <MobileHeader />
                <main className='flex-1 pb-24 lg:pb-0'>{children}</main>
              </div>
            </div>
            <MobileTabBar />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
