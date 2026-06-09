'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, '');
}

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !password) {
      toast.error('נא למלא טלפון וסיסמה');
      return;
    }
    setLoading(true);
    try {
      const email = digitsOnly(phone) + '@tipx.app';
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error('טלפון או סיסמה שגויים');
        return;
      }
      router.push('/');
      router.refresh();
    } catch {
      toast.error('שגיאה בהתחברות');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{background: 'var(--bg)'}}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">TipX</h1>
          <p className="text-sm" style={{color: 'var(--muted)'}}>מערכת ניהול מאפיות</p>
        </div>
        <div className="card">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">מספר טלפון</label>
              <input
                type="tel"
                className="input"
                placeholder="050-0000000"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                dir="ltr"
                autoComplete="tel"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">סיסמה</label>
              <input
                type="password"
                className="input"
                placeholder="הכנס סיסמה"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <button
              type="submit"
              className="btn-primary w-full py-3 text-base"
              disabled={loading}
            >
              {loading ? 'מתחבר...' : 'התחבר'}
            </button>
          </form>
        </div>
        <p className="text-center text-xs mt-4" style={{color: 'var(--muted)'}}>
          TipX v1.0.0
        </p>
      </div>
    </div>
  );
}