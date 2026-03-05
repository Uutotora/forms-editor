import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import { Sidebar } from '@/components/Sidebar';
import { UnsavedDialog } from '@/components/UnsavedDialog';
import { Toast } from '@/components/Toast';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist-sans' });

export const metadata: Metadata = {
  title: 'Редактор вопросов — Росстат',
  description: 'Визуальный редактор вопросов анкеты Росстат',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={geist.variable}>
      <body className="bg-[#FAFAFA] font-sans antialiased">
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {children}
          </main>
        </div>
        <UnsavedDialog />
        <Toast />
      </body>
    </html>
  );
}
