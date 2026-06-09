'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface BranchSummary {
  id: string;
  name: string;
  city: string;
  currentRevenue: number;
  currentExpenses: number;
  prevRevenue: number;
  prevExpenses: number;
}

interface TodayOrder {
  id: string;
  product_name: string;
  quantity: number;
  total_price: number;
  created_at: string;
}

function getIsraelDate(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
}

function formatPercent(n: number): string {
  return (n > 0 ? '+' : '') + n.toFixed(1) + '%';
}

function getPercentClass(n: number): string {
  return n > 0 ? 'text-green-400' : n < 0 ? 'text-red-400' : 'text-gray-400';
}

function pctChange(curr: number, prev: number): number {
  if (!prev) return 0;
  const diff = ((curr - prev) / prev) * 100;
  return isNaN(diff) ? 0 : diff;
}

function formatNum(n: number): string {
  return n.toLocaleString('he-IL', { maximumFractionDigits: 0 });
}

function monthKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return d.getFullYear() + '-' + m;
}

export default function AdminDashboard() {
  const supabase = createBrowserClient();
  const today = getIsraelDate();
  const todayDay = today.getDay(); // 0=Sun
  const currentMonth = monthKey(today);
  const prevD = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const prevMonth = monthKey(prevD);

  const [branches, setBranches] = useState<BranchSummary[]>([]);
  const [todayOrders, setTodayOrders] = useState<TodayOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick calculator state
  const [revenue, setRevenue] = useState('');
  const [rawMaterials, setRawMaterials] = useState('');
  const [fixed, setFixed] = useState('');

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: empData } = await supabase
          .from('employees')
          .select('branch_id')
          .eq('auth_user_id', user.id)
          .single();

        if (!empData) return;

        const { data: branchList } = await supabase
          .from('branches')
          .select('id, name, city')
          .eq('id', empData.branch_id);

        const summaries: BranchSummary[] = [];

        for (const branch of branchList || []) {
          const { data: reports } = await supabase
            .from('financial_reports')
            .select('month, revenue, expenses')
            .eq('branch_id', branch.id)
            .in('month', [currentMonth, prevMonth]);

          const curr = reports?.find(r => r.month.startsWith(currentMonth.substring(0, 7)));
          const prev = reports?.find(r => r.month.startsWith(prevMonth.substring(0, 7)));

          summaries.push({
            id: branch.id,
            name: branch.name,
            city: branch.city || '',
            currentRevenue: curr?.revenue || 0,
            currentExpenses: curr?.expenses || 0,
            prevRevenue: prev?.revenue || 0,
            prevExpenses: prev?.expenses || 0,
          });
        }

        setBranches(summaries);

        // Load today orders
        const todayStr = today.toISOString().split('T')[0];
        const { data: orders } = await supabase
          .from('orders')
          .select('id, product_name, quantity, total_price, created_at')
          .eq('branch_id', empData.branch_id)
          .gte('created_at', todayStr + 'T00:00:00')
          .lte('created_at', todayStr + 'T23:59:59')
          .order('created_at', { ascending: false });

        setTodayOrders((orders as TodayOrder[]) || []);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Calculator computations
  const rev = parseFloat(revenue) || 0;
  const raw = parseFloat(rawMaterials) || 0;
  const fix = parseFloat(fixed) || 0;
  const totalExpenses = raw + fix;
  const grossProfit = rev - raw;
  const netProfit = rev - totalExpenses;
  const grossMargin = rev > 0 ? (grossProfit / rev * 100).toFixed(1) : '0';
  const netMargin = rev > 0 ? (netProfit / rev * 100).toFixed(1) : '0';

  const chartData = branches.map(b => ({
    name: b.name,
    '\u05d4\u05db\u05e0\u05e1\u05d5\u05ea': b.currentRevenue,
    '\u05d4\u05d5\u05e6\u05d0\u05d5\u05ea': b.currentExpenses,
  }));

  const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="card animate-pulse h-24 bg-gray-200 dark:bg-gray-700" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">לוח בקרה</h1>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          {dayNames[todayDay]} · {today.getDate()}/{today.getMonth() + 1}/{today.getFullYear()}
        </p>
      </div>

      {/* Branch cards */}
      {branches.map(b => {
        const revChg = pctChange(b.currentRevenue, b.prevRevenue);
        const expChg = pctChange(b.currentExpenses, b.prevExpenses);
        const currProfit = b.currentRevenue - b.currentExpenses;
        const prevProfit = b.prevRevenue - b.prevExpenses;
        const profitChg = pctChange(currProfit, prevProfit);
        return (
          <div key={b.id} className="card">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-semibold text-lg">{b.name}</h2>
                <p className="text-sm" style={{ color: 'var(--muted)' }}>{b.city}</p>
              </div>
              <div className="text-xs px-2 py-1 rounded" style={{ background: 'var(--surface)', color: 'var(--muted)' }}>
                {currentMonth}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg text-center" style={{ background: 'var(--surface)' }}>
                <div className="text-xs mb-1" style={{ color: 'var(--muted)' }}>הכנסות</div>
                <div className="font-semibold">₪{formatNum(b.currentRevenue)}</div>
                <div className={`text-xs ${getPercentClass(revChg)}`}>{formatPercent(revChg)}</div>
              </div>
              <div className="p-3 rounded-lg text-center" style={{ background: 'var(--surface)' }}>
                <div className="text-xs mb-1" style={{ color: 'var(--muted)' }}>הוצאות</div>
                <div className="font-semibold">₪{formatNum(b.currentExpenses)}</div>
                <div className={`text-xs ${getPercentClass(-expChg)}`}>{formatPercent(expChg)}</div>
              </div>
              <div className={`p-3 rounded-lg text-center ${currProfit >= 0 ? 'bg-green-900/20' : 'bg-red-900/20'}`}>
                <div className="text-xs mb-1" style={{ color: 'var(--muted)' }}>רווח</div>
                <div className={`font-semibold ${currProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>₪{formatNum(currProfit)}</div>
                <div className={`text-xs ${getPercentClass(profitChg)}`}>{formatPercent(profitChg)}</div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Bar Chart */}
      {branches.length > 0 && (
        <div className="card">
          <h2 className="font-semibold mb-4">השוואת הכנסות/הוצאות</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={v => '₪' + (v/1000).toFixed(0) + 'K'} />
              <Tooltip formatter={(v: number) => '₪' + formatNum(v)} />
              <Bar dataKey="הכנסות" fill="#22c55e" radius={[4,4,0,0]} />
              <Bar dataKey="הוצאות" fill="#ef4444" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Quick Calculator - ריכוס יתרות */}
      <div className="card">
        <h2 className="font-semibold mb-4">ריכוס יתרות</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm mb-1" style={{ color: 'var(--muted)' }}>הכנסות (₪)</label>
            <input
              className="input w-full"
              value={revenue}
              onChange={e => setRevenue(e.target.value)}
              placeholder="0"
              type="number"
              min="0"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm mb-1" style={{ color: 'var(--muted)' }}>חומרי גלם (₪)</label>
            <input
              className="input w-full"
              value={rawMaterials}
              onChange={e => setRawMaterials(e.target.value)}
              placeholder="0"
              type="number"
              min="0"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm mb-1" style={{ color: 'var(--muted)' }}>עלויות קבועות (₪)</label>
            <input
              className="input w-full"
              value={fixed}
              onChange={e => setFixed(e.target.value)}
              placeholder="0"
              type="number"
              min="0"
              dir="ltr"
            />
          </div>

          {(rev > 0 || raw > 0 || fix > 0) && (
            <div className="mt-4 space-y-2 border-t pt-4" style={{ borderColor: 'var(--surface)' }}>
              <div className="flex justify-between items-center">
                <span className="text-sm" style={{ color: 'var(--muted)' }}>סה"כ הוצאות</span>
                <span className="font-medium text-red-400">₪{formatNum(totalExpenses)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm" style={{ color: 'var(--muted)' }}>רווח גולמי</span>
                <span className={`font-semibold text-lg ${grossProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ₪{formatNum(grossProfit)}
                  <span className="text-sm font-normal mr-2">({grossMargin}%)</span>
                </span>
              </div>
              <div className="flex justify-between items-center border-t pt-2" style={{ borderColor: 'var(--surface)' }}>
                <span className="font-medium">רווח נקי</span>
                <span className={`font-bold text-xl ${netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ₪{formatNum(netProfit)}
                  <span className="text-sm font-normal mr-2">({netMargin}%)</span>
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Today orders */}
      {todayOrders.length > 0 && (
        <div className="card">
          <h2 className="font-semibold mb-3">הזמנות היום ({todayOrders.length})</h2>
          <div className="space-y-2">
            {todayOrders.slice(0, 5).map(order => (
              <div key={order.id} className="flex justify-between items-center py-2 border-b last:border-0" style={{ borderColor: 'var(--surface)' }}>
                <div>
                  <div className="text-sm font-medium">{order.product_name}</div>
                  <div className="text-xs" style={{ color: 'var(--muted)' }}>כמות: {order.quantity}</div>
                </div>
                <div className="text-sm font-semibold text-green-400">₪{formatNum(order.total_price)}</div>
              </div>
            ))}
            {todayOrders.length > 5 && (
              <p className="text-xs text-center pt-2" style={{ color: 'var(--muted)' }}>ועוד {todayOrders.length - 5} הזמנות</p>
            )}
          </div>
        </div>
      )}

      {todayOrders.length === 0 && !loading && (
        <div className="card text-center py-6" style={{ color: 'var(--muted)' }}>
          <div className="text-3xl mb-2">📦</div>
          <p>אין הזמנות היום</p>
        </div>
      )}
    </div>
  );
}
