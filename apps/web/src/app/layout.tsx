import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Link from 'next/link';
import { TraceProvider } from '@/context/TraceContext';
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Api Gateway Client",
  description: "Testing BE architecture",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-screen bg-slate-950 text-slate-100">
        <TraceProvider>
          <nav className="border-b border-slate-800 bg-sky-600 px-8 py-4">
            <div className="max-w-4xl mx-auto flex items-center justify-between">
              <span className="font-bold text-indigo-400">NestJS Microservices Tester</span>
              <div className="flex gap-6 text-sm">
                <Link href="/" className="hover:text-emerald-400 transition">
                  1. Задачи (CQRS/ES)
                </Link>
                <Link href="/analytics" className="hover:text-sky-400 transition">
                  2. Аналитика (Redis)
                </Link>
                <Link href="/performance" className="hover:text-amber-400 transition">
                  3. Потоки и Воркеры
                </Link>
                <Link href="/auth-2fa" className="hover:text-rose-400 transition">
                  4. 2FA Auth
                </Link>
                <Link href="/tracing" className="hover:text-purple-400 transition">
                  5. Трассировка (Logs)
                </Link>
              </div>
            </div>
          </nav>

          <main className="max-w-4xl mx-auto p-8">{children}</main>
        </TraceProvider>
      </body>
    </html>
  );
}

