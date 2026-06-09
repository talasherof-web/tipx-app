'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

const DAY_NAMES = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];

interface Branch { id: string; name: string; }
interface Supplier {
  id: string;
  name: string;
  contact_phone?: string;
  branch_id: string;
  supplier_schedules: { id: string; order_day: number; delivery_day: number }[];
}

function getIsraelDay(): number {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' })).getDay();
}

export default function OrdersPage() {
  const supabase = createClient();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editSupplier, setEditSupplier] = useState<Partial<Supplier & { schedules: {order_day: number; delivery_day: number}[] }>>({});
  const [saving, setSaving] = useState(false);
  const todayDay = getIsraelDay();

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [{ data: brs }, { data: sups }] = await Promise.all([
      supabase.from('branches').select('id, name').eq('is_active', true),
      supabase.from('suppliers').select('*, supplier_schedules(*)').eq('is_active', true).order('name'),
    ]);
    if (brs) setBranches(brs);
    if (sups) setSuppliers(sups as Supplier[]);
    setLoading(false);
  }

  async function saveSupplier() {
    if (!editSupplier.name || !editSupplier.branch_id) {
      toast.error('נא למלא שם וסניף');
      return;
    }
    setSaving(true);
    try {
      let supplierId = editSupplier.id;
      if (supplierId) {
        await supabase.from('suppliers').update({
          name: editSupplier.name,
          contact_phone: editSupplier.contact_phone || '',
          branch_id: editSupplier.branch_id,
        }).eq('id', supplierId);
        // Delete and re-insert schedules
        await supabase.from('supplier_schedules').delete().eq('supplier_id', supplierId);
      } else {
        const { data: newSup } = await supabase.from('suppliers').insert({
          name: editSupplier.name,
          contact_phone: editSupplier.contact_phone || '',
          branch_id: editSupplier.branch_id,
        }).select().single();
        supplierId = newSup?.id;
      }

      if (supplierId && editSupplier.schedules?.length) {
        await supabase.from('supplier_schedules').insert(
          editSupplier.schedules.map(s => ({ supplier_id: supplierId, order_day: s.order_day, delivery_day: s.delivery_day }))
        );
      }

      toast.success('הספק נשמר');
      setShowModal(false);
      setEditSupplier({});
      await loadData();
    } catch(e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeSupplier(id: string) {
    if (!confirm('להסיר ספק?')) return;
    await supabase.from('suppliers').update({ is_active: false }).eq('id', id);
    toast.success('הספק הוסר');
    await loadData();
  }

  // Group by branch
  const byBranch = branches.map(branch => ({
    ...branch,
    suppliers: suppliers.filter(s => s.branch_id === branch.id),
  }));

  // Today's deliveries
  const todayDeliveries = suppliers.filter(s =>
    s.supplier_schedules?.some(sch => sch.delivery_day === todayDay)
  );

  if (loading) return <div className="p-4">טוען...</div>;

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">הזמנות</h1>
        <button className="btn-primary" onClick={() => {
          setEditSupplier({ branch_id: branches[0]?.id || '', schedules: [{ order_day: 0, delivery_day: 1 }] });
          setShowModal(true);
        }}>+ ספק חדש</button>
      </div>

      {/* Today widget */}
      <div className="card">
        <h2 className="font-semibold mb-2">📦 הספקות היום - {DAY_NAMES[todayDay]}</h2>
        {todayDeliveries.length === 0 ? (
          <p className="text-sm" style={{color: 'var(--muted)'}}>אין הספקות היום</p>
        ) : (
          <div className="space-y-1">
            {todayDeliveries.map(s => (
              <div key={s.id} className="flex justify-between text-sm">
                <span className="font-medium">{s.name}</span>
                <span style={{color: 'var(--muted)'}}>{branches.find(b => b.id === s.branch_id)?.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Suppliers by branch */}
      {byBranch.map(branch => (
        <div key={branch.id}>
          <h2 className="text-lg font-semibold mb-2">{branch.name}</h2>
          <div className="space-y-2">
            {branch.suppliers.map(sup => (
              <div key={sup.id} className="card">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium">{sup.name}</div>
                    {sup.contact_phone && (
                      <div className="text-sm" style={{color: 'var(--muted)'}}>{sup.contact_phone}</div>
                    )}
                    <div className="flex flex-wrap gap-1 mt-1">
                      {sup.supplier_schedules?.map((sch, i) => (
                        <span key={i} className="text-xs px-1.5 py-0.5 rounded"
                              style={{background: 'var(--surface)', border: '1px solid var(--border)'}}>
                          הזמנה: {DAY_NAMES[sch.order_day]} → אספקה: {DAY_NAMES[sch.delivery_day]}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button className="text-xs px-2 py-1 rounded border" style={{borderColor: 'var(--border)'}}
                            onClick={() => {
                              setEditSupplier({ ...sup, schedules: sup.supplier_schedules || [] });
                              setShowModal(true);
                            }}>
                      עריכה
                    </button>
                    <button className="text-xs px-2 py-1 rounded"
                            style={{color: 'var(--danger)', border: '1px solid var(--danger)'}}
                            onClick={() => removeSupplier(sup.id)}>
                      הסר
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {branch.suppliers.length === 0 && (
              <p className="text-sm" style={{color: 'var(--muted)'}}>אין ספקים לסניף זה</p>
            )}
          </div>
        </div>
      ))}

      {/* Supplier Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
             style={{background: 'rgba(0,0,0,0.5)'}}>
          <div className="w-full max-w-sm card space-y-3 max-h-screen overflow-y-auto">
            <div className="flex justify-between">
              <h3 className="text-lg font-bold">{editSupplier.id ? 'עריכת ספק' : 'ספק חדש'}</h3>
              <button onClick={() => { setShowModal(false); setEditSupplier({}); }}>✕</button>
            </div>
            <div>
              <label className="text-sm font-medium">שם ספק</label>
              <input className="input mt-1" value={editSupplier.name || ''}
                     onChange={e => setEditSupplier(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium">טלפון</label>
              <input className="input mt-1" value={editSupplier.contact_phone || ''}
                     onChange={e => setEditSupplier(p => ({ ...p, contact_phone: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium">סניף</label>
              <select className="input mt-1" value={editSupplier.branch_id || ''}
                      onChange={e => setEditSupplier(p => ({ ...p, branch_id: e.target.value }))}>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-sm font-medium">מועדי הזמנה ואספקה</label>
                <button className="text-xs" style={{color: 'var(--accent)'}}
                        onClick={() => setEditSupplier(p => ({ ...p, schedules: [...(p.schedules || []), { order_day: 0, delivery_day: 1 }] }))}>
                  + הוסף
                </button>
              </div>
              {editSupplier.schedules?.map((sch, i) => (
                <div key={i} className="flex gap-1 mb-1">
                  <select className="input text-xs flex-1" value={sch.order_day}
                          onChange={e => {
                            const s = [...(editSupplier.schedules || [])];
                            s[i] = { ...s[i], order_day: parseInt(e.target.value) };
                            setEditSupplier(p => ({ ...p, schedules: s }));
                          }}>
                    {DAY_NAMES.map((d, di) => <option key={di} value={di}>{d}</option>)}
                  </select>
                  <span className="text-xs self-center">→</span>
                  <select className="input text-xs flex-1" value={sch.delivery_day}
                          onChange={e => {
                            const s = [...(editSupplier.schedules || [])];
                            s[i] = { ...s[i], delivery_day: parseInt(e.target.value) };
                            setEditSupplier(p => ({ ...p, schedules: s }));
                          }}>
                    {DAY_NAMES.map((d, di) => <option key={di} value={di}>{d}</option>)}
                  </select>
                  <button className="text-xs px-1" style={{color: 'var(--danger)'}}
                          onClick={() => setEditSupplier(p => ({ ...p, schedules: (p.schedules || []).filter((_, j) => j !== i) }))}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button className="btn-primary flex-1" onClick={saveSupplier} disabled={saving}>
                {saving ? 'שומר...' : 'שמור'}
              </button>
              <button className="btn-secondary" onClick={() => { setShowModal(false); setEditSupplier({}); }}>ביטול</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}