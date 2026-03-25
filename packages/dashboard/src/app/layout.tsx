import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Aurora QA — Dashboard',
  description: 'AI-powered autonomous quality engineering platform',
};

const navItems = [
  { href: '/', label: 'Dashboard', icon: '◈' },
  { href: '/runs', label: 'Runs', icon: '▶' },
  { href: '/agents', label: 'Agents', icon: '⚙' },
  { href: '/bugs', label: 'Bugs', icon: '🪲' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex">
        {/* Sidebar */}
        <aside className="w-56 border-r border-white/10 p-4 flex flex-col gap-1 shrink-0">
          <div className="flex items-center gap-2 mb-6 px-2">
            <span className="text-aurora-purple text-xl font-bold">◈</span>
            <span className="font-bold text-lg">Aurora QA</span>
          </div>
          <nav className="flex flex-col gap-1">
            {navItems.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
          <div className="mt-auto text-xs text-gray-600 px-2">
            v1.1.0 — 13 Agents
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 flex flex-col min-h-screen">
          {/* Top bar */}
          <header className="h-14 border-b border-white/10 flex items-center justify-between px-6">
            <span className="text-sm text-gray-400">Quality Engineering Platform</span>
            <div className="flex items-center gap-2 text-sm">
              <span className="status-dot running" />
              <span className="text-aurora-cyan">Live</span>
            </div>
          </header>

          {/* Page content */}
          <div className="flex-1 p-6 overflow-auto">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
