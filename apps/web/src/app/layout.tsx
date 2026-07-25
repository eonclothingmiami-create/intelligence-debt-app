import type { Metadata, Viewport } from 'next';
import { Fraunces, Manrope } from 'next/font/google';
import './globals.css';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';

const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');

const display = Fraunces({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
});

const body = Manrope({
  variable: '--font-body',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: {
    default: 'FIE — Business Financial OS',
    template: '%s · FIE',
  },
  description:
    'Sistema operativo financiero para tu negocio: punto de equilibrio, liquidez, publicidad plan vs real y recomendaciones holísticas.',
  applicationName: 'FIE OS',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'FIE OS',
  },
  manifest: `${basePath}/manifest.webmanifest`,
  icons: {
    icon: [{ url: `${basePath}/icons/icon-192.png`, sizes: '192x192', type: 'image/png' }],
    apple: [{ url: `${basePath}/icons/icon-192.png`, sizes: '192x192', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#0b2e24',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={`${display.variable} ${body.variable} antialiased`}>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
