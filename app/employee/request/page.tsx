'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { toast } from 'sonner';

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];
const SHIFT_LABELS: Record<string, string> = { morning: 'בוקר', evening: 'ערב', rest: 'מנוחה', off: 'חופש' };
const OFF_CATEGORIES = ['מחלה', 'חופשה', 'אחר'];

function formatWeekRange(weekStart: string): string {
  const d = new Date(weekStart);
  const start = new Date(d);
  const end = new Date(d);
  end.setDate(end.getDate() + 5);
  const fmt = (dt: Date) => dt.getDate() + '.' + (dt.getMonth() + 1);
  return fmt(start) + ' - ' + fmt(end);
}

type ShiftRow = { day_of_week: number; shift_type: string; off_reason: string; off_category: string; notes?: string };
type WeekData = { id: string; week_start: string; is_open: boolean; branch_id: string };
type Employee = { id: string; full_name: string; branch_id: string; role: string };

const defaultShifts = (): ShiftRow[] =>
  Array.from({ length: 6 }, (_, i) => ({
    day_of_week: i, shift_type: 'morning', off_reason: '', off_category: '', notes: '',
  }));

export default function EmployeeRequestPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const router = useRouter();

  const [emp, setEmp] = useState<Employee | null>(null);
  const [weekData, setWeekData] = useState<WeekData | null>(null);
  const [shifts, setShifts] = useState<ShiftRow[]>(defaultShifts());
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data: empData } = await supabase
        .from('employees')
        .select('id, full_name, branch_id, role')
        .eq('auth_user_id', user.id)
        .eq('is_active', true)
        .single();

      if (!empData) { router.push('/login'); return; }
      setEmp(empData);

      // Fetch the OPEN week for the employee's branch (not based on current date)
      const { data: week } = await supabase
        .from('schedule_weeks')
        .select('*')
        .eq('branch_id', empData.branch_id)
        .eq('is_open', true)
        .order('week_start', { ascending: false })
        .maybeSingle();

      setWeekData(week);

      if (week) {
        // Load existing shift requests for this week
        const { data: existingReqs } = await supabase
          .from('shift_requests')
          .select('*')
          .eq('week_id', week.id)
          .eq('employee_id', empData.id)
          .order('day_of_week');

        if (existingReqs && existingReqs.length > 0) {
          setSubmitted(true);
          const filled = defaultShifts().map((def) => {
            const found = existingReqs.find((r: ShiftRow) => r.day_of_week === def.day_of_week);
            return found
              ? { day_of_week: def.day_of_week, shift_type: found.shift_type || 'morning', off_reason: found.off_reason || '', off_category: found.off_category || '', notes: found.notes || '' }
              : def;
          });
          setShifts(filled);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [supabase, router]);

  useEffect(() => { loadData(); }, [loadData]);

  function updateShift(dayIndex: number, field: keyof ShiftRow, value: string) {
    setShifts(prev => prev.map((s, i) => i === dayIndex ? { ...s, [field]: value } : s));
  }

  async function submit() {
    if (!weekData || !emp) return;
    setSaving(true);
    try {
      // Delete existing and re-insert
      await supabase
        .from('shift_requests')
        .delete()
        .eq('week_id', weekData.id)
        .eq('employee_id', emp.id);

      const payload = shifts.map(s => ({
        employee_id: emp.id,
        week_id: weekData.id,
        day_of_week: s.day_of_week,
        shift_type: s.shift_type,
        off_reason: s.shift_type === 'off' ? (s.off_category || '') : '',
        off_category: s.shift_type === 'off' ? (s.off_category || '') : '',
        notes: s.notes || '',
        status: 'pending',
      }));

      const { error } = await supabase.from('shift_requests').insert(payload);
      if (error) throw error;

      toast.success('הבקשה נשלחה בהצלחה!');
      setSubmitted(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'שגיאה';
      toast.error('שגיאה: ' + msg);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-4 text-center">טוען...</div>;
  }

  if (!weekData || !weekData.is_open) {
    return (
      <div className="p-4">
        <div className="card text-center py-10">
          <div className="text-4xl mb-4">📅</div>
          <h2 className="text-xl font-semibold mb-2">אין שבוע פתוח כרגע</h2>
          <p className="text-gray-400">המנהל טרם פתח שבוע להגשת משמרות. בדוק שוב מאוחר יותר.</p>
        </div>
      </div>
    );
  }

  const weekRange = formatWeekRange(weekData.week_start);

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">הגשת משמרות</h1>
        <p className="text-gray-400 mt-1">שבוע {weekRange}</p>
      </div>

      {submitted && (
        <div className="card bg-green-900/30 border border-green-500/30 mb-4 p-3 text-center text-green-300">
          ✅ הבקשה הוגשה. ניתן לעדכן ולשלוח שוב.
        </div>
      )}

      <div className="space-y-3">
        {shifts.map((shift, i) => {
          const dayDate = new Date(weekData.week_start);
          dayDate.setDate(dayDate.getDate() + i);
          const dateLabel = dayDate.getDate() + '.' + (dayDate.getMonth() + 1);
          const isOff = shift.shift_type === 'off';
          return (
            <div key={i} className="card">
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold">{DAY_NAMES[i]} <span className="text-gray-400 text-sm mr-1">{dateLabel}</span></span>
                <select
                  value={shift.shift_type}
                  onChange={e => updateShift(i, 'shift_type', e.target.value)}
                  className="input text-sm"
                >
                  {Object.entries(SHIFT_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              {isOff && (
                <div className="mb-2">
                  <label className="block text-sm text-gray-400 mb-1">סיבה</label>
                  <select
                    value={shift.off_category}
                    onChange={e => updateShift(i, 'off_category', e.target.value)}
                    className="input w-full text-sm"
                  >
                    <option value="">בחר סיבה</option>
                    {OFF_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}
              <input
                type="text"
                placeholder="הערות (אופציונלי)"
                value={shift.notes}
                onChange={e => updateShift(i, 'notes', e.target.value)}
                className="input w-full text-sm"
              />
            </div>
          );
        })}
      </div>

      <button
        onClick={submit}
        disabled={saving}
        className="btn-primary w-full mt-6"
      >
        {saving ? 'שולח...' : submitted ? 'עדכן הגשה' : 'שלח בקשה'}
      </button>
    </div>
  );
}
