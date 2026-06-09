'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';

const navItems = [
  { href: '/admin/dashboard', label: 'דשבורד', icon: '🏠' },
  { href: '/admin/shifts', label: 'משמרות', icon: '📅' },
  { href: '/admin/employees', label: 'עובדים', icon: '👥' },
  { href: '/admin/orders', label: 'הזמנות', icon: '📦' },
  { href: '/admin/reports', label: 'דוחות', icon: '📊' },
  { href: '/admin/settings', label: 'הגדרות', icon: '⚙️' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [employeeName, setEmployeeName] = useState('');

  useEffect(() => {
    supabase.from('employees').select('full_name').then(({ data }) => {
      if (data?.[0]) setEmployeeName(data[0].full_name);
    });
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="min-h-screen flex flex-col" style={{background: 'var(--bg)'}}>
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b" 
              style={{background: 'var(--bg)', borderColor: 'var(--border)'}}>
        <span className="font-bold text-lg">TipX</span>
        <span className="text-sm" style={{color: 'var(--muted)'}}>{employeeName}</span>
        <button onClick={handleLogout} className="text-sm" style={{color: 'var(--danger)'}}>
          יציאה
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 pb-20 overflow-auto">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 right-0 left-0 flex justify-around items-center py-2 border-t z-10"
           style={{background: 'var(--bg)', borderColor: 'var(--border)'}}>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-all"
              style={{
                background: isActive ? 'var(--text)' : 'transparent',
                color: isActive ? 'var(--bg)' : 'var(--muted)',
                borderTop: isActive ? '2px solid var(--border)' : 'none',
              }}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}