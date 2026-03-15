import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { AppShell } from '@/components/layout/app-shell';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { AuthBoundary } from '@/components/auth-boundary';
import { PWARegistration } from '@/components/pwa-registration';

export const metadata: Metadata = {
  title: 'SiteCommand',
  description: 'Record instructions on a construction site',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'SiteCommand',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#1e40af',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased">
        <PWARegistration />
        <FirebaseClientProvider>
          <AuthBoundary>
            <AppShell>{children}</AppShell>
          </AuthBoundary>
        </FirebaseClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
