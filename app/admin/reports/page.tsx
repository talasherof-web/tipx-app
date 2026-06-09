'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, Cell, Legend
} from 'recharts';

interface Branch { id: string; name: string; }
interface FinancialReport {
  id?: string;
  branch_id: string;
  month: string;
  revenue: number;
  expenses: number;
  labor_cost: number;
  fixed_costs: number;
  raw_materials: number;
  notes?: string;
}
interface Product {
  id?: string;
  branch_id: string;
  name: string;
  monthly_sales: number;
  market_growth_rate: number;
  market_share: number;
  month: string;
}


interface ImportRow {
  code: string;
  name: string;
  quantity: number;
  revenue: number;
}

const PRODUCT_CODE_MAP: Record<string, string> = {
  '6000': '�����',
  '6001': '������',
  '6002': '�����',
  '6003': '�������',
  '6004': '�����',
  '6005': '���������',
  '7000': '������',
  '7001': '����� ������',
  '8000': '������',
};

const MONTHS_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

function getIsraelDate() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
}

function monthKey(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
}

function prevMonthKey(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() - 1, 1).toISOString().split('T')[0];
}

function formatMonthLabel(monthStr: string): string {
  const d = new Date(monthStr + 'T00:00:00');
  return MONTHS_HE[d.getMonth()] + ' ' + d.getFullYear();
}

function pctChange(curr: number, prev: number): string {
  if (!prev || prev === 0) return '';
  const pct = ((curr - prev) / prev) * 100;
  return (pct > 0 ? '+' : '') + pct.toFixed(1) + '%';
}

function pctClass(curr: number, prev: number, inverse = false): string {
  if (!prev) return '';
  const positive = curr >= prev;
  const good = inverse ? !positive : positive;
  return good ? 'text-green-600' : 'text-red-600';
}

export default function ReportsPage() {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<'pl' | 'compare' | 'bcg' | 'calc' | 'import'>('pl');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [reports, setReports] = useState<FinancialReport[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editReport, setEditReport] = useState<Partial<FinancialReport>>({});
  const [saving, setSaving] = useState(false);

  // Calculator
  const [calcRevenue, setCalcRevenue] = useState('');
  const [calcRaw, setCalcRaw] = useState('');
  const [calcLabor, setCalcLabor] = useState('');
  const [calcFixed, setCalcFixed] = useState('');

  const today = getIsraelDate();


  // File import state
  const [importedRows, setImportedRows] = useState<ImportRow[]>([]);
  const [importError, setImportError] = useState('');
  const [importMonth, setImportMonth] = useState(monthKey(getIsraelDate()));

  useEffect(() => {
    loadBranches();
  }, []);

  useEffect(() => {
    if (selectedBranch) {
      loadReports();
      loadProducts();
    }
  }, [selectedBranch]);

  async function loadBranches() {
    const { data } = await supabase.from('branches').select('id, name').eq('is_active', true);
    if (data) {
      setBranches(data);
      if (data.length > 0) setSelectedBranch(data[0].id);
    }
    setLoading(false);
  }

  async function loadReports() {
    if (!selectedBranch) return;
    const { data } = await supabase
      .from('financial_reports')
      .select('*')
      .eq('branch_id', selectedBranch)
      .order('month', { ascending: false })
      .limit(12);
    if (data) setReports(data as FinancialReport[]);
  }

  async function loadProducts() {
    if (!selectedBranch) return;
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('branch_id', selectedBranch)
      .order('month', { ascending: false });
    if (data) setProducts(data as Product[]);
  }

  // Save financial report
  async function saveReport() {
    if (!editReport.month || !selectedBranch) {
      toast.error('נא לבחור חודש');
      return;
    }
    setSaving(true);
    try {
      const payload: FinancialReport = {
        branch_id: selectedBranch,
        month: editReport.month,
        revenue: parseFloat(String(editReport.revenue || 0)),
        expenses: parseFloat(String(editReport.expenses || 0)),
        labor_cost: parseFloat(String(editReport.labor_cost || 0)),
        fixed_costs: parseFloat(String(editReport.fixed_costs || 0)),
        raw_materials: parseFloat(String(editReport.raw_materials || 0)),
        notes: editReport.notes || '',
      };

      // Check if exists
      const { data: existing } = await supabase
        .from('financial_reports')
        .select('id')
        .eq('branch_id', selectedBranch)
        .eq('month', editReport.month)
        .single();

      if (existing) {
        await supabase.from('financial_reports').update(payload).eq('id', existing.id);
      } else {
        await supabase.from('financial_reports').insert(payload);
      }

      toast.success('הדוח נשמר בהצלחה');
      setShowModal(false);
      setEditReport({});
      await loadReports();
    } catch (e) {
      toast.error('שגיאה בשמירת הדוח');
    } finally {
      setSaving(false);
    }
  }

  // Charts data
  const chartData = [...reports].reverse().map(r => ({
    month: formatMonthLabel(r.month),
    'הכנסות': r.revenue,
    'הוצאות': r.expenses,
    'רווח': r.revenue - r.expenses,
  }));

  // BCG data
  const bcgData = products.map(p => ({
    name: p.name,
    x: p.market_share,
    y: p.market_growth_rate,
    size: p.monthly_sales,
  }));

  function getBcgQuadrant(x: number, y: number): string {
    if (x >= 50 && y >= 10) return '⭐ כוכב - השקע ותגדל';
    if (x >= 50 && y < 10) return '🐄 פרה - שמור על יציבות';
    if (x < 50 && y >= 10) return '❓ סימן שאלה - בחן לפני השקעה';
    return '🐕 כלב - שקול הפסקה';
  }

  // Calculator
  const rev = parseFloat(calcRevenue) || 0;
  const raw = parseFloat(calcRaw) || 0;
  const lab = parseFloat(calcLabor) || 0;
  const fix = parseFloat(calcFixed) || 0;
  const grossProfit = rev - raw;
  const netProfit = grossProfit - lab - fix;
  const grossMarginPct = rev > 0 ? (grossProfit / rev * 100) : 0;
  const netMarginPct = rev > 0 ? (netProfit / rev * 100) : 0;
  const breakEven = grossMarginPct > 0 ? (lab + fix) / (grossMarginPct / 100) : 0;

  // Current vs previous month comparison
  const currentMonthReport = reports.find(r => r.month.startsWith(monthKey(today).substring(0,7)));
  const prevMonthReport = reports.find(r => r.month.startsWith(prevMonthKey(today).substring(0,7)));


  // Parse CSV file
  function parseCSVFile(file: File | undefined) {
    if (!file) return;
    setImportError('');
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = (e.target?.result as string) || '';
        const lines = text.split('\n').filter(l => l.trim());
        const rows: ImportRow[] = [];
        for (const line of lines) {
          const parts = line.split(',');
          if (parts.length < 2) continue;
          const code = (parts[0] || '').trim().replace(/^["']|["']$/g, '');
          const name = (parts[1] || PRODUCT_CODE_MAP[code] || code).trim().replace(/^["']|["']$/g, '');
          const quantity = parseFloat((parts[2] || '0').trim().replace(/^["']|["']$/g, '')) || 0;
          const revenue = parseFloat((parts[3] || '0').trim().replace(/^["']|["']$/g, '')) || 0;
          if (code && (quantity > 0 || revenue > 0)) {
            rows.push({ code, name: name || PRODUCT_CODE_MAP[code] || code, quantity, revenue });
          }
        }
        if (rows.length === 0) {
          setImportError('�� ����� ������ �����. ��� ������� ����: ���,��,����,������');
        } else {
          setImportedRows(rows);
        }
      } catch {
        setImportError('����� ������ �����');
      }
    };
    reader.readAsText(file, 'utf-8');
  }

  async function saveImportedProducts() {
    if (!selectedBranch || importedRows.length === 0) return;
    try {
      const totalRevenue = importedRows.reduce((s, r) => s + r.revenue, 0);
      // Save each product row
      for (const row of importedRows) {
        const { data: existing } = await supabase
          .from('products')
          .select('id, monthly_sales')
          .eq('branch_id', selectedBranch)
          .eq('name', row.name)
          .eq('month', importMonth)
          .maybeSingle();
        
        const growthRate = 0; // Will be computed when comparing months
        const marketShare = totalRevenue > 0 ? (row.revenue / totalRevenue) * 100 : 0;
        
        if (existing) {
          await supabase.from('products').update({
            monthly_sales: row.revenue,
            market_share: marketShare,
          }).eq('id', existing.id);
        } else {
          await supabase.from('products').insert({
            branch_id: selectedBranch,
            name: row.name,
            monthly_sales: row.revenue,
            market_growth_rate: growthRate,
            market_share: marketShare,
            month: importMonth,
          });
        }
      }
      
      toast.success('������� ����� ������!');
      setImportedRows([]);
      loadProducts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '�����';
      toast.error('�����: ' + msg);
    }
  }

  const tabs = [
    { id: 'pl', label: 'רווח והפסד' },
    { id: 'compare', label: 'השוואת סניפים' },
    { id: 'bcg', label: 'BCG Matrix' },
    { id: 'calc', label: 'מחשבון' },
    { id: 'import', label: '����� ������' },
  ];

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">דוחות</h1>

      {/* Branch selector */}
      <select
        className="input"
        value={selectedBranch}
        onChange={e => setSelectedBranch(e.target.value)}
      >
        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all"
            style={{
              background: activeTab === tab.id ? 'var(--text)' : 'var(--surface)',
              color: activeTab === tab.id ? 'var(--bg)' : 'var(--text)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* P&L Tab */}
      {activeTab === 'pl' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">רווח והפסד חודשי</h2>
            <button
              className="btn-primary text-sm px-3 py-1.5"
              onClick={() => {
                setEditReport({ month: monthKey(today) });
                setShowModal(true);
              }}
            >
              + הוסף דוח
            </button>
          </div>

          {/* Current vs Previous comparison */}
          {currentMonthReport && (
            <div className="card">
              <h3 className="font-semibold mb-2">חודש נוכחי מול קודם</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  { label: 'הכנסות', curr: currentMonthReport.revenue, prev: prevMonthReport?.revenue || 0 },
                  { label: 'הוצאות', curr: currentMonthReport.expenses, prev: prevMonthReport?.expenses || 0, inverse: true },
                  { label: 'שכר', curr: currentMonthReport.labor_cost, prev: prevMonthReport?.labor_cost || 0, inverse: true },
                  { label: 'קבועות', curr: currentMonthReport.fixed_costs, prev: prevMonthReport?.fixed_costs || 0, inverse: true },
                  { label: 'חומרי גלם', curr: currentMonthReport.raw_materials, prev: prevMonthReport?.raw_materials || 0, inverse: true },
                  { label: 'רווח גולמי', curr: currentMonthReport.revenue - currentMonthReport.expenses, prev: (prevMonthReport?.revenue || 0) - (prevMonthReport?.expenses || 0) },
                ].map(item => (
                  <div key={item.label} className="p-2 rounded" style={{background: 'var(--surface)'}}>
                    <div style={{color: 'var(--muted)'}} className="text-xs">{item.label}</div>
                    <div className="font-bold">₪{item.curr.toLocaleString()}</div>
                    {item.prev !== undefined && item.prev !== 0 && (
                      <div className={`text-xs ${pctClass(item.curr, item.prev, item.inverse)}`}>
                        {pctChange(item.curr, item.prev)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bar Chart */}
          {chartData.length > 0 && (
            <div className="card">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData.slice(-6)}>
                  <XAxis dataKey="month" tick={{fontSize: 9}} />
                  <YAxis tick={{fontSize: 9}} tickFormatter={v => '₪' + (v/1000).toFixed(0) + 'K'} />
                  <Tooltip formatter={(v: number) => '₪' + v.toLocaleString()} />
                  <Legend />
                  <Bar dataKey="הכנסות" fill="#16A34A" radius={3} />
                  <Bar dataKey="הוצאות" fill="#DC2626" radius={3} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Reports table */}
          <div className="space-y-2">
            {reports.map(report => {
              const gross = report.revenue - report.expenses;
              const net = gross - report.labor_cost - report.fixed_costs;
              return (
                <div key={report.id} className="card cursor-pointer"
                     onClick={() => { setEditReport({...report}); setShowModal(true); }}>
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-semibold">{formatMonthLabel(report.month)}</span>
                    <span className={gross >= 0 ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                      רווח: ₪{gross.toLocaleString()}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-xs" style={{color: 'var(--muted)'}}>
                    <span>הכנסות: ₪{report.revenue.toLocaleString()}</span>
                    <span>הוצאות: ₪{report.expenses.toLocaleString()}</span>
                    <span>נקי: ₪{net.toLocaleString()}</span>
                  </div>
                </div>
              );
            })}
            {reports.length === 0 && (
              <div className="card text-center" style={{color: 'var(--muted)'}}>
                אין דוחות עדיין. לחץ "הוסף דוח" להתחלה.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Compare Tab */}
      {activeTab === 'compare' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">השוואת ביצועים - 6 חודשים</h2>
          <div className="card">
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData.slice(-6)}>
                <XAxis dataKey="month" tick={{fontSize: 9}} />
                <YAxis tick={{fontSize: 9}} tickFormatter={v => '₪' + (v/1000).toFixed(0) + 'K'} />
                <Tooltip formatter={(v: number) => '₪' + v.toLocaleString()} />
                <Legend />
                <Line type="monotone" dataKey="הכנסות" stroke="#16A34A" strokeWidth={2} dot />
                <Line type="monotone" dataKey="הוצאות" stroke="#DC2626" strokeWidth={2} dot />
                <Line type="monotone" dataKey="רווח גולמי" stroke="#2563EB" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {/* Auto analysis */}
          {chartData.length >= 2 && (() => {
            const last = chartData[chartData.length - 1];
            const prev = chartData[chartData.length - 2];
            const revTrend = last.הכנסות > prev.הכנסות ? 'עלייה' : 'ירידה';
            const pct = prev.הכנסות > 0 ? Math.abs((last.הכנסות - prev.הכנסות) / prev.הכנסות * 100).toFixed(1) : '0';
            return (
              <div className="card">
                <h3 className="font-semibold mb-1">ניתוח אוטומטי</h3>
                <p className="text-sm">
                  חלה <strong>{revTrend}</strong> של <strong>{pct}%</strong> בהכנסות מהחודש הקודם.{' '}
                  {last['רווח גולמי'] > prev['רווח גולמי'] 
                    ? 'הרווח הגולמי השתפר — כיוון חיובי.' 
                    : 'הרווח הגולמי ירד — יש לבחון את מבנה ההוצאות.'}
                </p>
              </div>
            );
          })()}
        </div>
      )}

      {/* BCG Matrix Tab */}
      {activeTab === 'bcg' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">BCG Matrix</h2>
          {bcgData.length === 0 ? (
            <div className="card text-center" style={{color: 'var(--muted)'}}>
              אין נתוני מוצרים. הזן מוצרים בדף הגדרות הסניף.
            </div>
          ) : (
            <>
              <div className="card">
                <div className="text-xs mb-2" style={{color: 'var(--muted)'}}>
                  X = נתח שוק (%) | Y = צמיחה (%) | גודל נקודה = מכירות
                </div>
                <ResponsiveContainer width="100%" height={250}>
                  <ScatterChart>
                    <XAxis type="number" dataKey="x" name="נתח שוק" domain={[0, 100]} tick={{fontSize: 9}} label={{value: 'נתח שוק %', position: 'insideBottom', offset: -5, fontSize: 9}} />
                    <YAxis type="number" dataKey="y" name="צמיחה" domain={[0, 30]} tick={{fontSize: 9}} label={{value: 'צמיחה %', angle: -90, position: 'insideLeft', fontSize: 9}} />
                    <Tooltip cursor={{strokeDasharray: '3 3'}} 
                             content={({ payload }) => {
                               if (!payload?.[0]) return null;
                               const d = payload[0].payload;
                               return (
                                 <div className="card text-xs p-2">
                                   <div className="font-bold">{d.name}</div>
                                   <div>{getBcgQuadrant(d.x, d.y)}</div>
                                 </div>
                               );
                             }} />
                    <Scatter data={bcgData} fill="#000">
                      {bcgData.map((entry, i) => (
                        <Cell key={i} fill={
                          entry.x >= 50 && entry.y >= 10 ? '#F59E0B' :
                          entry.x >= 50 && entry.y < 10 ? '#16A34A' :
                          entry.x < 50 && entry.y >= 10 ? '#3B82F6' : '#6B7280'
                        } />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="card" style={{borderColor: '#F59E0B'}}>⭐ כוכב — השקע ותגדל</div>
                <div className="card" style={{borderColor: '#16A34A'}}>🐄 פרה — שמור יציבות</div>
                <div className="card" style={{borderColor: '#3B82F6'}}>❓ סימן שאלה — בחן</div>
                <div className="card" style={{borderColor: '#6B7280'}}>🐕 כלב — שקול הפסקה</div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Calculator Tab */}
      {activeTab === 'calc' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">🧮 מחשבון רווחיות</h2>
          <div className="card space-y-3">
            {[
              { label: 'הכנסות ₪', val: calcRevenue, set: setCalcRevenue },
              { label: 'חומרי גלם ₪', val: calcRaw, set: setCalcRaw },
              { label: 'שכר עבודה ₪', val: calcLabor, set: setCalcLabor },
              { label: 'עלויות קבועות ₪', val: calcFixed, set: setCalcFixed },
            ].map(field => (
              <div key={field.label}>
                <label className="text-sm font-medium">{field.label}</label>
                <input
                  className="input mt-1"
                  type="number"
                  value={field.val}
                  onChange={e => field.set(e.target.value)}
                  placeholder="0"
                  dir="ltr"
                />
              </div>
            ))}
          </div>
          {rev > 0 && (
            <div className="card space-y-2">
              <h3 className="font-semibold">תוצאות</h3>
              {[
                { label: 'רווח גולמי', value: grossProfit, pct: grossMarginPct },
                { label: 'רווח נקי', value: netProfit, pct: netMarginPct },
              ].map(item => (
                <div key={item.label} className="flex justify-between items-center">
                  <span>{item.label}:</span>
                  <span className={`font-bold text-lg ${item.value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ₪{item.value.toLocaleString()} ({item.pct.toFixed(1)}%)
                  </span>
                </div>
              ))}
              <div className="flex justify-between items-center border-t pt-2" style={{borderColor: 'var(--border)'}}>
                <span>נקודת איזון:</span>
                <span className="font-bold text-lg">₪{Math.round(breakEven).toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal for adding/editing report */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
             style={{background: 'rgba(0,0,0,0.5)'}}>
          <div className="w-full max-w-md card space-y-3 max-h-screen overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold">
                {editReport.id ? 'עדכון דוח' : 'הוסף דוח חודשי'}
              </h3>
              <button onClick={() => { setShowModal(false); setEditReport({}); }}>✕</button>
            </div>
            <div>
              <label className="text-sm font-medium">חודש</label>
              <input
                type="month"
                className="input mt-1"
                value={editReport.month?.substring(0,7) || ''}
                onChange={e => setEditReport(p => ({ ...p, month: e.target.value + '-01' }))}
              />
            </div>
            {[
              { label: 'הכנסות ₪', key: 'revenue' },
              { label: 'סה"כ הוצאות ₪', key: 'expenses' },
              { label: 'חומרי גלם ₪', key: 'raw_materials' },
              { label: 'שכר עבודה ₪', key: 'labor_cost' },
              { label: 'עלויות קבועות ₪', key: 'fixed_costs' },
            ].map(field => (
              <div key={field.key}>
                <label className="text-sm font-medium">{field.label}</label>
                <input
                  type="number"
                  className="input mt-1"
                  value={(editReport as any)[field.key] || ''}
                  onChange={e => setEditReport(p => ({ ...p, [field.key]: parseFloat(e.target.value) || 0 }))}
                  placeholder="0"
                  dir="ltr"
                />
              </div>
            ))}
            <div>
              <label className="text-sm font-medium">הערות</label>
              <textarea
                className="input mt-1"
                rows={2}
                value={editReport.notes || ''}
                onChange={e => setEditReport(p => ({ ...p, notes: e.target.value }))}
                placeholder="הערות אופציונליות..."
              />
            </div>
            {/* Preview calculation */}
            {editReport.revenue && editReport.expenses && (
              <div className="p-2 rounded text-sm" style={{background: 'var(--surface)'}}>
                <div>רווח גולמי: <strong>₪{((editReport.revenue || 0) - (editReport.expenses || 0)).toLocaleString()}</strong></div>
                <div>רווח נקי: <strong>₪{((editReport.revenue || 0) - (editReport.expenses || 0) - (editReport.labor_cost || 0) - (editReport.fixed_costs || 0)).toLocaleString()}</strong></div>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button
                className="btn-primary flex-1"
                onClick={saveReport}
                disabled={saving}
              >
                {saving ? 'שומר...' : 'שמור דוח'}
              </button>
              <button
                className="btn-secondary"
                onClick={() => { setShowModal(false); setEditReport({}); }}
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'import' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">����� ������ �����</h2>
          <div className="card">
            <div className="mb-4">
              <label className="block text-sm mb-1" style={{color:'var(--muted)'}}>����</label>
              <input type="month" className="input" value={importMonth} onChange={e => setImportMonth(e.target.value)} />
            </div>
            <div className="mb-4">
              <label className="block text-sm mb-2" style={{color:'var(--muted)'}}>����� ���� CSV</label>
              <p className="text-xs mb-3" style={{color:'var(--muted)'}}>
                �����: ��� ����,�� ����,����,������<br/>
                �����: 6000,�����,70,4200
              </p>
              <input
                type="file"
                accept=".csv,.txt"
                className="input w-full"
                onChange={e => parseCSVFile(e.target.files?.[0])}
              />
            </div>
            {importError && <div className="text-red-400 text-sm mb-3">{importError}</div>}
          </div>

          {importedRows.length > 0 && (
            <div className="card">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold">������ ����� ({importedRows.length} ������)</h3>
                <button className="btn-primary text-sm px-3 py-1.5" onClick={saveImportedProducts}>
                  ����
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{color:'var(--muted)'}}>
                      <th className="text-right pb-2">���</th>
                      <th className="text-right pb-2">�� ����</th>
                      <th className="text-right pb-2">����</th>
                      <th className="text-right pb-2">������ (�")�)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importedRows.map((row, i) => (
                      <tr key={i} className="border-t" style={{borderColor:'var(--surface)'}}>
                        <td className="py-1.5">{row.code}</td>
                        <td className="py-1.5">{row.name}</td>
                        <td className="py-1.5">{row.quantity.toLocaleString()}</td>
                        <td className="py-1.5 text-green-400">�{row.revenue.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t font-semibold" style={{borderColor:'var(--muted)'}}>
                      <td colSpan={2} className="pt-2">��"�</td>
                      <td className="pt-2">{importedRows.reduce((s,r)=>s+r.quantity,0).toLocaleString()}</td>
                      <td className="pt-2 text-green-400">�{importedRows.reduce((s,r)=>s+r.revenue,0).toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}