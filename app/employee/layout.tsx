'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

const navItems = [
  { href: '/employee/dashboard', label: 'דשבורד', icon: '🏠' },
  { href: '/employee/request', label: 'הגשת בקשה', icon: '📅' },
];

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="min-h-screen flex flex-col" style={{background: 'var(--bg)'}}>
      <header className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b"
              style={{background: 'var(--bg)', borderColor: 'var(--border)'}}>
        <span className="font-bold text-lg">TipX</span>
        <button onClick={handleLogout} className="text-sm" style={{color: 'var(--danger)'}}>
          יציאה
        </button>
      </header>
      <main className="flex-1 pb-20 overflow-auto">{children}</main>
      <nav className="fixed bottom-0 right-0 left-0 flex justify-around items-center py-2 border-t z-10"
           style={{background: 'var(--bg)', borderColor: 'var(--border)'}}>
        {navItems.map(item => {
          const isActive = pathname === item.href;
          return (
            <Link key={item.href} href={item.href}
                  className="flex flex-col items-center gap-1 px-4 py-1 rounded-lg"
                  style={{
                    background: isActive ? 'var(--text)' : 'transparent',
                    color: isActive ? 'var(--bg)' : 'var(--muted)',
                  }}>
              <span className="text-xl">{item.icon}</span>
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}