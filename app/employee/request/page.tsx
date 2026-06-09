'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

const DAY_NAMES = ['ראשון','שני','שלישי','רביעי','חמישי'];
const OFF_CATEGORIES = [
  { value: 'medical', label: 'מחלה/רפואי 🏥' },
  { value: 'personal', label: 'אישי' },
  { value: 'other', label: 'אחר' },
];

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

interface ShiftEntry {
  day_of_week: number;
  shift_type: string;
  off_reason: string;
  off_category: string;
}

export default function EmployeeRequestPage() {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [weekData, setWeekData] = useState<any>(null);
  const [employeeId, setEmployeeId] = useState('');
  const [shifts, setShifts] = useState<ShiftEntry[]>(
    [0,1,2,3,4].map(d => ({ day_of_week: d, shift_type: 'morning', off_reason: '', off_category: 'personal' }))
  );
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: emp } = await supabase
      .from('employees')
      .select('id, branch_id')
      .eq('auth_user_id', user.id)
      .single();
    
    if (!emp) { setLoading(false); return; }
    setEmployeeId(emp.id);

    const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
    const weekStartStr = getWeekStart(today).toISOString().split('T')[0];

    const { data: week } = await supabase
      .from('schedule_weeks')
      .select('*')
      .eq('branch_id', emp.branch_id)
      .eq('week_start', weekStartStr)
      .single();
    setWeekData(week);

    if (week) {
      // Load existing requests
      const { data: existing } = await supabase
        .from('shift_requests')
        .select('*')
        .eq('week_id', week.id)
        .eq('employee_id', emp.id);
      
      if (existing && existing.length > 0) {
        setSubmitted(true);
        setShifts(prev => prev.map(s => {
          const ex = existing.find(e => e.day_of_week === s.day_of_week);
          return ex ? { day_of_week: ex.day_of_week, shift_type: ex.shift_type, off_reason: ex.off_reason || '', off_category: ex.off_category || 'personal' } : s;
        }));
      }
    }
    setLoading(false);
  }

  function updateShift(day: number, field: string, value: string) {
    setShifts(prev => prev.map(s => 
      s.day_of_week === day ? { ...s, [field]: value } : s
    ));
  }

  async function submit() {
    // Validation
    const offCount = shifts.filter(s => s.shift_type === 'off').length;
    if (offCount > 1) {
      toast.error('לא ניתן לבקש יותר מיום חופש אחד בשבוע');
      return;
    }
    if (!weekData) { toast.error('אין שבוע פתוח'); return; }
    
    setSaving(true);
    try {
      // Delete existing and reinsert
      await supabase.from('shift_requests')
        .delete()
        .eq('week_id', weekData.id)
        .eq('employee_id', employeeId);

      const payload = shifts.map(s => ({
        employee_id: employeeId,
        week_id: weekData.id,
        day_of_week: s.day_of_week,
        shift_type: s.shift_type,
        off_reason: s.shift_type === 'off' ? s.off_reason : null,
        off_category: s.shift_type === 'off' ? s.off_category : null,
      }));

      const { error } = await supabase.from('shift_requests').insert(payload);
      if (error) throw error;

      toast.success('הבקשה הוגשה בהצלחה!');
      setSubmitted(true);
      router.push('/employee/dashboard');
    } catch(e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-4">טוען...</div>;

  if (!weekData || !weekData.is_open) {
    return (
      <div className="p-4">
        <div className="card text-center">
          <p className="text-lg font-medium mb-1">לא ניתן להגיש בקשה</p>
          <p className="text-sm" style={{color: 'var(--muted)'}}>
            {!weekData ? 'לא נפתח שבוע על ידי המנהל' : 'השבוע סגור להגשת בקשות'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">הגשת בקשה</h1>
        {submitted && (
          <span className="text-xs px-2 py-1 rounded-full text-white" style={{background: '#16A34A'}}>
            ✅ הוגש
          </span>
        )}
      </div>
      <p className="text-sm" style={{color: 'var(--muted)'}}>
        שבוע: {weekData.week_start} | ניתן לבקש עד יום חופש אחד
      </p>

      <div className="space-y-3">
        {shifts.map(shift => (
          <div key={shift.day_of_week} className="card">
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold">{DAY_NAMES[shift.day_of_week]}</span>
              <select
                className="input w-auto text-sm py-1 px-2"
                value={shift.shift_type}
                onChange={e => updateShift(shift.day_of_week, 'shift_type', e.target.value)}
              >
                <option value="morning">בוקר {shift.day_of_week < 5 ? '06:00–14:00' : '05:30–13:30'}</option>
                <option value="evening">ערב 10:00–17:00</option>
                {shift.day_of_week !== 5 && <option value="off">חופש</option>}
              </select>
            </div>
            {shift.shift_type === 'off' && (
              <div className="space-y-2 mt-2">
                <select
                  className="input text-sm"
                  value={shift.off_category}
                  onChange={e => updateShift(shift.day_of_week, 'off_category', e.target.value)}
                >
                  {OFF_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <input
                  className="input text-sm"
                  placeholder="סיבה (אופציונלי)"
                  value={shift.off_reason}
                  onChange={e => updateShift(shift.day_of_week, 'off_reason', e.target.value)}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        className="btn-primary w-full py-3 text-base"
        onClick={submit}
        disabled={saving}
      >
        {saving ? 'שולח...' : submitted ? 'עדכן בקשה' : 'הגש בקשה'}
      </button>
    </div>
  );
}