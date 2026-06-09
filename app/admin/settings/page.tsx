'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface Branch { id: string; name: string; city: string; }

export default function SettingsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [newBranch, setNewBranch] = useState({ name: '', city: '' });
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadBranches();
    setDarkMode(document.documentElement.classList.contains('dark'));
  }, []);

  async function loadBranches() {
    const { data } = await supabase.from('branches').select('id, name, city').eq('is_active', true);
    if (data) setBranches(data as Branch[]);
  }

  async function addBranch() {
    if (!newBranch.name) { toast.error('נא להזין שם סניף'); return; }
    const { error } = await supabase.from('branches').insert(newBranch);
    if (error) { toast.error(error.message); return; }
    toast.success('הסניף נוסף');
    setNewBranch({ name: '', city: '' });
    await loadBranches();
  }

  async function deactivateBranch(id: string) {
    if (!confirm('לבטל סניף?')) return;
    await supabase.from('branches').update({ is_active: false }).eq('id', id);
    toast.success('הסניף בוטל');
    await loadBranches();
  }

  async function changePassword() {
    if (!oldPw || !newPw) { toast.error('נא למלא את כל השדות'); return; }
    if (newPw !== confirmPw) { toast.error('הסיסמאות לא תואמות'); return; }
    if (newPw.length < 6) { toast.error('סיסמה חייבת להיות לפחות 6 תווים'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      toast.success('הסיסמה שונתה בהצלחה');
      setOldPw(''); setNewPw(''); setConfirmPw('');
    } catch(e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  function toggleDarkMode() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('darkMode', isDark ? 'dark' : 'light');
    setDarkMode(isDark);
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-bold">הגדרות</h1>

      {/* Branches */}
      <section>
        <h2 className="text-lg font-semibold mb-2">ניהול סניפים</h2>
        <div className="space-y-2 mb-3">
          {branches.map(b => (
            <div key={b.id} className="card flex justify-between items-center">
              <div>
                <span className="font-medium">{b.name}</span>
                {b.city && <span className="text-sm ms-2" style={{color: 'var(--muted)'}}>{b.city}</span>}
              </div>
              <button className="text-xs px-2 py-1 rounded"
                      style={{color: 'var(--danger)', border: '1px solid var(--danger)'}}
                      onClick={() => deactivateBranch(b.id)}>
                בטל
              </button>
            </div>
          ))}
        </div>
        <div className="card space-y-2">
          <h3 className="font-medium">הוספת סניף</h3>
          <input className="input" placeholder="שם סניף" value={newBranch.name}
                 onChange={e => setNewBranch(p => ({ ...p, name: e.target.value }))} />
          <input className="input" placeholder="עיר (אופציונלי)" value={newBranch.city}
                 onChange={e => setNewBranch(p => ({ ...p, city: e.target.value }))} />
          <button className="btn-primary w-full" onClick={addBranch}>הוסף סניף</button>
        </div>
      </section>

      {/* Password Change */}
      <section className="card space-y-2">
        <h2 className="text-lg font-semibold">שינוי סיסמה</h2>
        <input className="input" type="password" placeholder="סיסמה נוכחית"
               value={oldPw} onChange={e => setOldPw(e.target.value)} />
        <input className="input" type="password" placeholder="סיסמה חדשה"
               value={newPw} onChange={e => setNewPw(e.target.value)} />
        <input className="input" type="password" placeholder="אימות סיסמה חדשה"
               value={confirmPw} onChange={e => setConfirmPw(e.target.value)} />
        <button className="btn-primary w-full" onClick={changePassword} disabled={saving}>
          {saving ? 'שומר...' : 'שמור סיסמה'}
        </button>
      </section>

      {/* Theme */}
      <section className="card">
        <h2 className="text-lg font-semibold mb-2">עיצוב</h2>
        <div className="flex justify-between items-center">
          <span>מצב כהה</span>
          <button
            onClick={toggleDarkMode}
            className="relative inline-flex items-center w-12 h-6 rounded-full transition-colors"
            style={{ background: darkMode ? 'var(--text)' : 'var(--surface)', border: '1.5px solid var(--border)' }}
          >
            <span className="inline-block w-4 h-4 rounded-full transition-transform"
                  style={{
                    background: darkMode ? 'var(--bg)' : 'var(--text)',
                    transform: darkMode ? 'translateX(-28px)' : 'translateX(-8px)',
                  }} />
          </button>
        </div>
      </section>

      {/* About */}
      <section className="card text-center space-y-1">
        <div className="text-2xl font-bold">TipX</div>
        <div className="text-sm" style={{color: 'var(--muted)'}}>v1.0.0</div>
        <div className="text-sm" style={{color: 'var(--muted)'}}>מערכת ניהול מאפיות</div>
      </section>

      <button className="w-full py-3 rounded-lg font-medium"
              style={{color: 'var(--danger)', border: '1.5px solid var(--danger)'}}
              onClick={logout}>
        יציאה מהמערכת
      </button>
    </div>
  );
}