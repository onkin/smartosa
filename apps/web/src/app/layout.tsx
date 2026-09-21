import {AppProviders} from '@/domains/shell';
import '@smartosa/brand/css/variables.css';
import type {Metadata} from 'next';
import {Source_Sans_3} from 'next/font/google';
import type {ReactNode} from 'react';
import './global.css';

const sourceSans = Source_Sans_3({
  display: 'swap',
  subsets: ['latin', 'cyrillic'],
  variable: '--font-source-sans',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  description: 'Домашняя панель камер и устройств',
  icons: {icon: '/favicon.svg'},
  title: 'Smartosa',
};

type Props = {
  children: ReactNode;
};

export default function RootLayout({children}: Props) {
  return (
    <html className={sourceSans.variable} lang="ru">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
