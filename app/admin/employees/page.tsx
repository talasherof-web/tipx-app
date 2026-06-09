'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface Employee {
  id: string;
  full_name: string;
  phone: string;
  role: string;
  is_active: boolean;
  branch_id: string;
  branches?: { name: string };
}
interface Branch { id: string; name: string; }

export default function EmployeesPage() {
  const supabase = createClient();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ full_name: '', phone: '', branch_id: '', role: 'employee', password: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [{ data: emps }, { data: brs }] = await Promise.all([
      supabase.from('employees').select('*, branches(name)').eq('is_active', true).order('full_name'),
      supabase.from('branches').select('id, name').eq('is_active', true),
    ]);
    if (emps) setEmployees(emps as Employee[]);
    if (brs) {
      setBranches(brs);
      if (brs.length > 0) setForm(f => ({ ...f, branch_id: brs[0].id }));
    }
    setLoading(false);
  }

  async function addEmployee() {
    if (!form.full_name || !form.phone || !form.password || !form.branch_id) {
      toast.error('נא למלא את כל השדות');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה');
      toast.success('העובד נוסף בהצלחה');
      setShowModal(false);
      setForm({ full_name: '', phone: '', branch_id: branches[0]?.id || '', role: 'employee', password: '' });
      await loadData();
    } catch (e: any) {
      toast.error(e.message || 'שגיאה בהוספת עובד');
    } finally {
      setSaving(false);
    }
  }

  async function deactivateEmployee(id: string) {
    if (!confirm('האם להסיר את העובד?')) return;
    await supabase.from('employees').update({ is_active: false }).eq('id', id);
    toast.success('העובד הוסר');
    await loadData();
  }

  async function changeRole(id: string, role: string) {
    await supabase.from('employees').update({ role }).eq('id', id);
    setEmployees(prev => prev.map(e => e.id === id ? { ...e, role } : e));
    toast.success('התפקיד עודכן');
  }

  if (loading) return <div className="p-4">טוען...</div>;

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">עובדים</h1>
        <button className="btn-primary" onClick={() => setShowModal(true)}>+ עובד חדש</button>
      </div>

      <div className="space-y-3">
        {employees.map(emp => (
          <div key={emp.id} className="card">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-bold">{emp.full_name}</div>
                <div className="text-sm" style={{color: 'var(--muted)'}}>{emp.phone}</div>
                <div className="text-sm" style={{color: 'var(--muted)'}}>{emp.branches?.name}</div>
              </div>
              <div className="flex flex-col gap-1 items-end">
                <select
                  className="input text-sm py-0.5 px-1"
                  value={emp.role}
                  onChange={e => changeRole(emp.id, e.target.value)}
                >
                  <option value="employee">עובד</option>
                  <option value="admin">מנהל</option>
                </select>
                <button
                  className="text-xs px-2 py-1 rounded"
                  style={{color: 'var(--danger)', border: '1px solid var(--danger)'}}
                  onClick={() => deactivateEmployee(emp.id)}
                >
                  הסר
                </button>
              </div>
            </div>
          </div>
        ))}
        {employees.length === 0 && (
          <div className="card text-center" style={{color: 'var(--muted)'}}>אין עובדים</div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
             style={{background: 'rgba(0,0,0,0.5)'}}>
          <div className="w-full max-w-sm card space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold">הוספת עובד</h3>
              <button onClick={() => setShowModal(false)}>✕</button>
            </div>
            {[
              { label: 'שם מלא', key: 'full_name', type: 'text' },
              { label: 'טלפון', key: 'phone', type: 'tel' },
              { label: 'סיסמה', key: 'password', type: 'password' },
            ].map(f => (
              <div key={f.key}>
                <label className="text-sm font-medium">{f.label}</label>
                <input
                  type={f.type}
                  className="input mt-1"
                  value={(form as any)[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                />
              </div>
            ))}
            <div>
              <label className="text-sm font-medium">סניף</label>
              <select className="input mt-1" value={form.branch_id}
                      onChange={e => setForm(p => ({ ...p, branch_id: e.target.value }))}>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">תפקיד</label>
              <select className="input mt-1" value={form.role}
                      onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                <option value="employee">עובד</option>
                <option value="admin">מנהל</option>
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <button className="btn-primary flex-1" onClick={addEmployee} disabled={saving}>
                {saving ? 'שומר...' : 'הוסף עובד'}
              </button>
              <button className="btn-secondary" onClick={() => setShowModal(false)}>ביטול</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}