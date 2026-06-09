'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

const DAY_NAMES = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
const SHIFT_LABELS: Record<string, string> = { morning: 'בוקר', evening: 'ערב', off: 'חופש', rest: 'מנוחה' };

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateToStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

interface Branch { id: string; name: string; }
interface Employee { id: string; full_name: string; }
interface ShiftRequest {
  id: string;
  employee_id: string;
  day_of_week: number;
  shift_type: string;
  off_reason?: string;
  off_category?: string;
  is_approved?: boolean;
  employees?: { full_name: string };
}
interface FinalShift {
  id?: string;
  employee_id: string;
  day_of_week: number;
  shift_type: string;
  notes?: string;
}

export default function ShiftsPage() {
  const supabase = createClient();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [weekStart, setWeekStart] = useState('');
  const [weekData, setWeekData] = useState<any>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [requests, setRequests] = useState<ShiftRequest[]>([]);
  const [finalShifts, setFinalShifts] = useState<FinalShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<'requests'|'final'>('requests');

  useEffect(() => {
    loadBranches();
    const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
    setWeekStart(dateToStr(getWeekStart(today)));
  }, []);

  useEffect(() => {
    if (selectedBranch && weekStart) loadWeekData();
  }, [selectedBranch, weekStart]);

  async function loadBranches() {
    const { data } = await supabase.from('branches').select('id, name').eq('is_active', true);
    if (data) {
      setBranches(data);
      if (data.length > 0) setSelectedBranch(data[0].id);
    }
    setLoading(false);
  }

  async function loadWeekData() {
    if (!selectedBranch || !weekStart) return;
    setLoading(true);
    try {
      const { data: week } = await supabase
        .from('schedule_weeks')
        .select('*')
        .eq('branch_id', selectedBranch)
        .eq('week_start', weekStart)
        .single();
      setWeekData(week || null);

      const { data: emps } = await supabase
        .from('employees')
        .select('id, full_name')
        .eq('branch_id', selectedBranch)
        .eq('is_active', true);
      setEmployees(emps || []);

      if (week) {
        const { data: reqs } = await supabase
          .from('shift_requests')
          .select('*, employees(full_name)')
          .eq('week_id', week.id)
          .order('day_of_week');
        setRequests((reqs as ShiftRequest[]) || []);

        const { data: finals } = await supabase
          .from('final_shifts')
          .select('*')
          .eq('week_id', week.id);
        setFinalShifts((finals as FinalShift[]) || []);
      } else {
        setRequests([]);
        setFinalShifts([]);
      }
    } finally {
      setLoading(false);
    }
  }

  async function openWeek() {
    setSaving(true);
    try {
      const { data: emp } = await supabase
        .from('employees')
        .select('id')
        .eq('auth_user_id', (await supabase.auth.getUser()).data.user?.id || '')
        .single();

      const { data, error } = await supabase.from('schedule_weeks').insert({
        branch_id: selectedBranch,
        week_start: weekStart,
        is_open: true,
        opened_at: new Date().toISOString(),
        created_by: emp?.id,
      }).select().single();

      if (error) throw error;
      setWeekData(data);
      toast.success('השבוע נפתח לבקשות');
    } catch(e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleWeekOpen() {
    if (!weekData) return;
    const newState = !weekData.is_open;
    await supabase.from('schedule_weeks').update({ is_open: newState }).eq('id', weekData.id);
    setWeekData({ ...weekData, is_open: newState });
    toast.success(newState ? 'השבוע נפתח' : 'השבוע נסגר לבקשות');
  }

  async function approveRequest(id: string, approved: boolean) {
    await supabase.from('shift_requests').update({ is_approved: approved }).eq('id', id);
    setRequests(prev => prev.map(r => r.id === id ? { ...r, is_approved: approved } : r));
    toast.success(approved ? 'אושר' : 'נדחה');
  }

  async function saveFinalShift(empId: string, day: number, shiftType: string) {
    if (!weekData) return;
    // Validate no double shift
    const existingOtherShift = finalShifts.find(
      fs => fs.employee_id === empId && fs.day_of_week === day && fs.shift_type !== shiftType
    );
    
    const existing = finalShifts.find(fs => fs.employee_id === empId && fs.day_of_week === day);
    
    if (existing?.id) {
      await supabase.from('final_shifts').update({ shift_type: shiftType }).eq('id', existing.id);
    } else {
      await supabase.from('final_shifts').insert({
        week_id: weekData.id,
        branch_id: selectedBranch,
        employee_id: empId,
        day_of_week: day,
        shift_type: shiftType,
      });
    }
    setFinalShifts(prev => {
      const without = prev.filter(fs => !(fs.employee_id === empId && fs.day_of_week === day));
      return [...without, { employee_id: empId, day_of_week: day, shift_type: shiftType }];
    });
  }

  async function finalize() {
    if (!weekData) return;
    if (!confirm('לאשר ולשלוח את הסידור הסופי?')) return;
    setSaving(true);
    try {
      await supabase.from('schedule_weeks').update({ 
        is_finalized: true,
        finalized_at: new Date().toISOString(),
        is_open: false
      }).eq('id', weekData.id);
      setWeekData({ ...weekData, is_finalized: true, is_open: false });
      toast.success('הסידור אושר ונשלח!');
    } finally {
      setSaving(false);
    }
  }

  function copyToWhatsApp() {
    let text = `סידור עבודה שבוע ${weekStart}\n\n`;
    for (let day = 0; day <= 6; day++) {
      const dayShifts = finalShifts.filter(fs => fs.day_of_week === day);
      if (dayShifts.length > 0) {
        text += `*${DAY_NAMES[day]}*:\n`;
        dayShifts.forEach(fs => {
          const emp = employees.find(e => e.id === fs.employee_id);
          text += `  ${emp?.full_name || ''}: ${SHIFT_LABELS[fs.shift_type] || fs.shift_type}\n`;
        });
        text += '\n';
      }
    }
    navigator.clipboard.writeText(text).then(() => toast.success('הועתק! הדבק בווטסאפ'));
  }

  if (loading && !branches.length) return <div className="p-4">טוען...</div>;

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">ניהול משמרות</h1>

      <div className="grid grid-cols-2 gap-2">
        <select className="input" value={selectedBranch}
                onChange={e => setSelectedBranch(e.target.value)}>
          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <input
          type="date"
          className="input"
          value={weekStart}
          onChange={e => setWeekStart(e.target.value)}
        />
      </div>

      {/* Week status */}
      <div className="card">
        <div className="flex justify-between items-center">
          <div>
            <span className="font-medium">שבוע: </span>
            <span>{weekStart}</span>
          </div>
          {weekData ? (
            <div className="flex items-center gap-1">
              <span className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      background: weekData.is_finalized ? '#16A34A' : weekData.is_open ? '#D97706' : 'var(--surface)',
                      color: weekData.is_finalized || weekData.is_open ? 'white' : 'var(--text)'
                    }}>
                {weekData.is_finalized ? '✅ סופי' : weekData.is_open ? '🔓 פתוח' : '🔒 סגור'}
              </span>
              {!weekData.is_finalized && (
                <button className="btn-secondary text-xs px-2 py-1" onClick={toggleWeekOpen}>
                  {weekData.is_open ? 'סגור' : 'פתח'}
                </button>
              )}
            </div>
          ) : (
            <button className="btn-primary text-sm" onClick={openWeek} disabled={saving}>
              פתח שבוע
            </button>
          )}
        </div>
      </div>

      {weekData && (
        <>
          <div className="flex gap-1">
            <button
              className="px-3 py-1.5 rounded text-sm font-medium"
              style={{
                background: view === 'requests' ? 'var(--text)' : 'var(--surface)',
                color: view === 'requests' ? 'var(--bg)' : 'var(--text)',
              }}
              onClick={() => setView('requests')}
            >
              בקשות ({requests.length})
            </button>
            <button
              className="px-3 py-1.5 rounded text-sm font-medium"
              style={{
                background: view === 'final' ? 'var(--text)' : 'var(--surface)',
                color: view === 'final' ? 'var(--bg)' : 'var(--text)',
              }}
              onClick={() => setView('final')}
            >
              סידור סופי
            </button>
          </div>

          {/* Requests view */}
          {view === 'requests' && (
            <div className="space-y-2">
              {/* Medical first */}
              {requests
                .sort((a, b) => {
                  if (a.off_category === 'medical' && b.off_category !== 'medical') return -1;
                  if (a.off_category !== 'medical' && b.off_category === 'medical') return 1;
                  return 0;
                })
                .map(req => (
                  <div key={req.id} className="card">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium">{req.employees?.full_name}</div>
                        <div className="text-sm" style={{color: 'var(--muted)'}}>
                          {DAY_NAMES[req.day_of_week]} — {SHIFT_LABELS[req.shift_type]}
                          {req.off_category === 'medical' && ' 🏥'}
                          {req.day_of_week === 5 && req.shift_type === 'off' && (
                            <span className="text-red-500"> (שישי!)</span>
                          )}
                        </div>
                        {req.off_reason && (
                          <div className="text-xs" style={{color: 'var(--muted)'}}>{req.off_reason}</div>
                        )}
                      </div>
                      {req.shift_type === 'off' && (
                        <div className="flex gap-1">
                          <button
                            className="text-xs px-2 py-1 rounded"
                            style={{
                              background: req.is_approved === true ? '#16A34A' : 'transparent',
                              color: req.is_approved === true ? 'white' : '#16A34A',
                              border: '1px solid #16A34A'
                            }}
                            onClick={() => approveRequest(req.id, true)}
                          >אשר</button>
                          <button
                            className="text-xs px-2 py-1 rounded"
                            style={{
                              background: req.is_approved === false ? '#DC2626' : 'transparent',
                              color: req.is_approved === false ? 'white' : '#DC2626',
                              border: '1px solid #DC2626'
                            }}
                            onClick={() => approveRequest(req.id, false)}
                          >דחה</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              {requests.length === 0 && (
                <div className="card text-center" style={{color: 'var(--muted)'}}>אין בקשות עדיין</div>
              )}
            </div>
          )}

          {/* Final schedule view */}
          {view === 'final' && (
            <div className="space-y-3">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      <th className="p-1 text-start text-xs" style={{color: 'var(--muted)'}}>עובד</th>
                      {DAY_NAMES.slice(0,7).map((d, i) => (
                        <th key={i} className="p-1 text-center text-xs" style={{color: 'var(--muted)'}}>{d}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map(emp => (
                      <tr key={emp.id} className="border-t" style={{borderColor: 'var(--surface)'}}>
                        <td className="p-1 text-xs font-medium whitespace-nowrap">{emp.full_name}</td>
                        {[0,1,2,3,4,5,6].map(day => {
                          const shift = finalShifts.find(fs => fs.employee_id === emp.id && fs.day_of_week === day);
                          const approvedOff = requests.find(r => r.employee_id === emp.id && r.day_of_week === day && r.is_approved === true);
                          return (
                            <td key={day} className="p-0.5">
                              {day === 6 ? (
                                <span className="text-xs text-center block" style={{color: 'var(--muted)'}}>מנוחה</span>
                              ) : (
                                <select
                                  className="text-xs p-0.5 rounded border w-full"
                                  style={{
                                    borderColor: 'var(--border)',
                                    background: approvedOff ? '#f3f4f6' : 'var(--bg)',
                                    color: 'var(--text)',
                                    fontSize: '10px',
                                  }}
                                  value={shift?.shift_type || ''}
                                  onChange={e => saveFinalShift(emp.id, day, e.target.value)}
                                  disabled={weekData.is_finalized}
                                >
                                  <option value="">--</option>
                                  <option value="morning">בוקר</option>
                                  <option value="evening">ערב</option>
                                  <option value="off">חופש</option>
                                </select>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!weekData.is_finalized && (
                <div className="flex gap-2">
                  <button className="btn-primary flex-1" onClick={finalize} disabled={saving}>
                    ✅ שלח סידור סופי
                  </button>
                  <button className="btn-secondary" onClick={copyToWhatsApp}>
                    📋 העתק לווטסאפ
                  </button>
                </div>
              )}
              {weekData.is_finalized && (
                <button className="btn-secondary w-full" onClick={copyToWhatsApp}>
                  📋 העתק לווטסאפ
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}