'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface BranchSummary {
  id: string;
  name: string;
  city: string;
  currentRevenue: number;
  prevRevenue: number;
  currentExpenses: number;
  prevExpenses: number;
}

interface TodayOrder {
  branchName: string;
  supplierName: string;
  deliveryDay: number;
}

function getIsraelDate(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
}

function formatPercent(curr: number, prev: number): string {
  if (!prev) return '';
  const diff = ((curr - prev) / prev) * 100;
  return (diff > 0 ? '▲' : '▼') + Math.abs(diff).toFixed(1) + '%';
}

function getPercentClass(curr: number, prev: number): string {
  if (!prev) return '';
  return curr >= prev ? 'text-green-600' : 'text-red-600';
}

export default function AdminDashboard() {
  const supabase = createClient();
  const [branches, setBranches] = useState<BranchSummary[]>([]);
  const [todayOrders, setTodayOrders] = useState<TodayOrder[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Quick calculator state
  const [revenue, setRevenue] = useState('');
  const [rawMaterials, setRawMaterials] = useState('');
  const [labor, setLabor] = useState('');
  const [fixed, setFixed] = useState('');

  const today = getIsraelDate();
  const todayDay = today.getDay(); // 0=Sun
  const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const prevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().split('T')[0];

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const { data: branchList } = await supabase
        .from('branches')
        .select('id, name, city')
        .eq('is_active', true);

      if (!branchList) return;

      const summaries: BranchSummary[] = [];
      for (const branch of branchList) {
        const { data: reports } = await supabase
          .from('financial_reports')
          .select('month, revenue, expenses')
          .eq('branch_id', branch.id)
          .in('month', [currentMonth, prevMonth]);

        const curr = reports?.find(r => r.month.startsWith(currentMonth.substring(0,7)));
        const prev = reports?.find(r => r.month.startsWith(prevMonth.substring(0,7)));

        summaries.push({
          id: branch.id,
          name: branch.name,
          city: branch.city || '',
          currentRevenue: curr?.revenue || 0,
          prevRevenue: prev?.revenue || 0,
          currentExpenses: curr?.expenses || 0,
          prevExpenses: prev?.expenses || 0,
        });
      }
      setBranches(summaries);

      // Today's orders
      const { data: suppliers } = await supabase
        .from('suppliers')
        .select('id, name, branch_id, branches(name), supplier_schedules(delivery_day)')
        .eq('is_active', true);

      const orders: TodayOrder[] = [];
      if (suppliers) {
        for (const s of suppliers) {
          const schedules = (s as any).supplier_schedules || [];
          for (const sch of schedules) {
            if (sch.delivery_day === todayDay) {
              orders.push({
                branchName: (s as any).branches?.name || '',
                supplierName: s.name,
                deliveryDay: sch.delivery_day,
              });
            }
          }
        }
      }
      setTodayOrders(orders);
    } finally {
      setLoading(false);
    }
  }

  const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

  // Calculator
  const rev = parseFloat(revenue) || 0;
  const raw = parseFloat(rawMaterials) || 0;
  const lab = parseFloat(labor) || 0;
  const fix = parseFloat(fixed) || 0;
  const grossProfit = rev - raw;
  const netProfit = grossProfit - lab - fix;
  const grossMargin = rev > 0 ? (grossProfit / rev * 100).toFixed(1) : '0';
  const netMargin = rev > 0 ? (netProfit / rev * 100).toFixed(1) : '0';
  const breakEven = rev > 0 && grossMargin !== '0' ? ((lab + fix) / (parseFloat(grossMargin) / 100)).toFixed(0) : '0';

  const chartData = branches.map(b => ({
    name: b.name,
    'הכנסות': b.currentRevenue,
    'הוצאות': b.currentExpenses,
  }));

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        {[1,2,3].map(i => (
          <div key={i} className="card animate-pulse h-24 bg-gray-200 dark:bg-gray-700" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">דשבורד</h1>

      {/* Branch Summaries */}
      <section>
        <h2 className="text-lg font-semibold mb-2">סיכום סניפים - חודש נוכחי</h2>
        <div className="grid grid-cols-1 gap-3">
          {branches.map(branch => (
            <div key={branch.id} className="card">
              <div className="flex justify-between items-start mb-2">
                <span className="font-bold">{branch.name}</span>
                <span className="text-sm" style={{color: 'var(--muted)'}}>{branch.city}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <div style={{color: 'var(--muted)'}}>הכנסות</div>
                  <div className="font-semibold">₪{branch.currentRevenue.toLocaleString()}</div>
                  <div className={`text-xs ${getPercentClass(branch.currentRevenue, branch.prevRevenue)}`}>
                    {formatPercent(branch.currentRevenue, branch.prevRevenue)}
                  </div>
                </div>
                <div>
                  <div style={{color: 'var(--muted)'}}>הוצאות</div>
                  <div className="font-semibold">₪{branch.currentExpenses.toLocaleString()}</div>
                  <div className={`text-xs ${getPercentClass(branch.prevExpenses, branch.currentExpenses)}`}>
                    {formatPercent(branch.currentExpenses, branch.prevExpenses)}
                  </div>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t" style={{borderColor: 'var(--border)'}}>
                <span className="text-sm font-medium">רווח גולמי: </span>
                <span className={`font-bold ${branch.currentRevenue - branch.currentExpenses >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ₪{(branch.currentRevenue - branch.currentExpenses).toLocaleString()}
                </span>
              </div>
            </div>
          ))}
          {branches.length === 0 && (
            <div className="card text-center" style={{color: 'var(--muted)'}}>
              אין נתונים פיננסיים לחודש זה
            </div>
          )}
        </div>
      </section>

      {/* Mini Bar Chart */}
      {chartData.length > 0 && (
        <section className="card">
          <h2 className="text-lg font-semibold mb-3">השוואת סניפים</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} layout="vertical">
              <XAxis type="number" tickFormatter={v => '₪' + (v/1000).toFixed(0) + 'K'} tick={{fontSize: 10}} />
              <YAxis type="category" dataKey="name" tick={{fontSize: 11}} width={60} />
              <Tooltip formatter={(v: number) => '₪' + v.toLocaleString()} />
              <Bar dataKey="הכנסות" fill="#16A34A" radius={3} />
              <Bar dataKey="הוצאות" fill="#DC2626" radius={3} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* Today's Orders */}
      <section className="card">
        <h2 className="text-lg font-semibold mb-2">הזמנות היום - {dayNames[todayDay]}</h2>
        {todayOrders.length === 0 ? (
          <p style={{color: 'var(--muted)'}} className="text-sm">אין הזמנות להיום</p>
        ) : (
          <div className="space-y-2">
            {todayOrders.map((order, i) => (
              <div key={i} className="flex justify-between items-center text-sm py-1 border-b last:border-0"
                   style={{borderColor: 'var(--surface)'}}>
                <span className="font-medium">{order.supplierName}</span>
                <span style={{color: 'var(--muted)'}}>{order.branchName}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Quick Calculator */}
      <section className="card">
        <h2 className="text-lg font-semibold mb-3">🧮 מחשבון מהיר</h2>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className="text-xs" style={{color: 'var(--muted)'}}>הכנסות ₪</label>
            <input className="input text-sm" value={revenue} onChange={e => setRevenue(e.target.value)} placeholder="0" dir="ltr" />
          </div>
          <div>
            <label className="text-xs" style={{color: 'var(--muted)'}}>חומרי גלם ₪</label>
            <input className="input text-sm" value={rawMaterials} onChange={e => setRawMaterials(e.target.value)} placeholder="0" dir="ltr" />
          </div>
          <div>
            <label className="text-xs" style={{color: 'var(--muted)'}}>שכר עבודה ₪</label>
            <input className="input text-sm" value={labor} onChange={e => setLabor(e.target.value)} placeholder="0" dir="ltr" />
          </div>
          <div>
            <label className="text-xs" style={{color: 'var(--muted)'}}>עלויות קבועות ₪</label>
            <input className="input text-sm" value={fixed} onChange={e => setFixed(e.target.value)} placeholder="0" dir="ltr" />
          </div>
        </div>
        {rev > 0 && (
          <div className="space-y-1 text-sm border-t pt-2" style={{borderColor: 'var(--border)'}}>
            <div className="flex justify-between">
              <span>רווח גולמי:</span>
              <span className={grossProfit >= 0 ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                ₪{grossProfit.toLocaleString()} ({grossMargin}%)
              </span>
            </div>
            <div className="flex justify-between">
              <span>רווח נקי:</span>
              <span className={netProfit >= 0 ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                ₪{netProfit.toLocaleString()} ({netMargin}%)
              </span>
            </div>
            <div className="flex justify-between">
              <span>נקודת איזון:</span>
              <span className="font-bold">₪{parseInt(breakEven).toLocaleString()}</span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}