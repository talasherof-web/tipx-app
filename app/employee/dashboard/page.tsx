'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

const DAY_NAMES = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
const SHIFT_LABELS: Record<string, string> = { morning: 'בוקר', evening: 'ערב', off: 'חופש', rest: 'מנוחה' };

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function EmployeeDashboard() {
  const supabase = createClient();
  const [employee, setEmployee] = useState<any>(null);
  const [weekData, setWeekData] = useState<any>(null);
  const [finalShifts, setFinalShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: emp } = await supabase
      .from('employees')
      .select('*, branches(name)')
      .eq('auth_user_id', user.id)
      .single();
    setEmployee(emp);

    if (!emp) { setLoading(false); return; }

    const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
    const weekStartDate = getWeekStart(today);
    const weekStartStr = weekStartDate.toISOString().split('T')[0];

    const { data: week } = await supabase
      .from('schedule_weeks')
      .select('*')
      .eq('branch_id', emp.branch_id)
      .eq('week_start', weekStartStr)
      .single();
    setWeekData(week);

    if (week) {
      const { data: finals } = await supabase
        .from('final_shifts')
        .select('*')
        .eq('week_id', week.id)
        .eq('employee_id', emp.id);
      setFinalShifts(finals || []);
    }
    setLoading(false);
  }

  if (loading) return <div className="p-4">טוען...</div>;

  return (
    <div className="p-4 space-y-4">
      <div className="card">
        <h1 className="text-2xl font-bold">{employee?.full_name}</h1>
        <p className="text-sm" style={{color: 'var(--muted)'}}>{employee?.branches?.name}</p>
      </div>

      {/* Week status */}
      {weekData ? (
        <div className="card">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold">סידור שבוע נוכחי</h2>
            <span className="text-xs px-2 py-0.5 rounded-full"
                  style={{
                    background: weekData.is_finalized ? '#16A34A' : weekData.is_open ? '#D97706' : 'var(--surface)',
                    color: weekData.is_finalized || weekData.is_open ? 'white' : 'var(--text)',
                  }}>
              {weekData.is_finalized ? '✅ סופי' : weekData.is_open ? '🔓 פתוח לבקשות' : '🔒 סגור'}
            </span>
          </div>

          {weekData.is_finalized && finalShifts.length > 0 ? (
            <div className="space-y-1">
              {[0,1,2,3,4,5,6].map(day => {
                const shift = finalShifts.find(fs => fs.day_of_week === day);
                return (
                  <div key={day} className="flex justify-between py-1 border-b last:border-0 text-sm"
                       style={{borderColor: 'var(--surface)'}}>
                    <span style={{color: 'var(--muted)'}}>{DAY_NAMES[day]}</span>
                    <span className="font-medium">{shift ? SHIFT_LABELS[shift.shift_type] || shift.shift_type : '—'}</span>
                  </div>
                );
              })}
            </div>
          ) : weekData.is_finalized ? (
            <p className="text-sm" style={{color: 'var(--muted)'}}>לא נמצאו משמרות לשבוע זה</p>
          ) : weekData.is_open ? (
            <div className="text-center py-2">
              <p className="text-sm mb-2" style={{color: 'var(--muted)'}}>השבוע פתוח להגשת בקשות</p>
              <Link href="/employee/request" className="btn-primary px-4 py-2 inline-block">
                הגש בקשה עכשיו
              </Link>
            </div>
          ) : (
            <p className="text-sm" style={{color: 'var(--muted)'}}>הסידור טרם פורסם</p>
          )}
        </div>
      ) : (
        <div className="card text-center" style={{color: 'var(--muted)'}}>
          <p className="text-sm">לא נפתח שבוע עדיין על ידי המנהל</p>
        </div>
      )}
    </div>
  );
}