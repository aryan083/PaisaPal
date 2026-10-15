import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Link2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { approveInbox, fetchInbox, type ApiInboxItem, type ApiTransaction } from '@/lib/api';
import { formatToastMessage, getUserError } from '@/lib/userError';

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });

function statusLabel(status: ApiInboxItem['status']) {
  return status.replace('_', ' ');
}

export function InboxPage() {
  const [items, setItems] = useState<ApiInboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [creating, setCreating] = useState<string | null>(null);
  const [linking, setLinking] = useState<string | null>(null);
  const [form, setForm] = useState({ particulars: '', amount: '', date: '', category: 'Other', mode: 'Online' as 'Online' | 'Cash' });

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems((await fetchInbox({ limit: 100 })).items); }
    catch (error) { toast.error(formatToastMessage(getUserError(error, 'Could not load the review inbox'))); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => ({ actionable: items.filter(item => item.status === 'pending_bank' || item.status === 'needs_review').length, linked: items.filter(item => item.status === 'linked' || item.status === 'posted').length }), [items]);
  const ordered = useMemo(() => [...items].sort((a, b) => Number(!['pending_bank', 'needs_review'].includes(a.status)) - Number(!['pending_bank', 'needs_review'].includes(b.status))), [items]);

  const mutate = useCallback(async (item: ApiInboxItem, action: 'link' | 'create' | 'dismiss', transactionId?: string) => {
    try {
      await approveInbox(item.kind, item.id, action, action === 'link' ? { transactionId } : action === 'create' ? { transaction: { particulars: form.particulars || item.title, amount: form.amount ? Number(form.amount) : item.amount ?? 0, date: form.date || item.dateKey || undefined, category: form.category, modes: [form.mode] } } : {});
      toast.success(action === 'dismiss' ? 'Item dismissed' : action === 'link' ? 'Receipt linked' : 'Transaction created');
      setCreating(null); setLinking(null); await load();
    } catch (error) { toast.error(formatToastMessage(getUserError(error, 'Could not update inbox item'))); }
  }, [form, load]);

  const startCreate = useCallback((item: ApiInboxItem) => {
    setCreating(item.id); setLinking(null);
    setForm({ particulars: item.title, amount: item.amount?.toString() ?? '', date: item.dateKey ?? '', category: item.kind === 'rapido' ? 'Rapido' : 'Other', mode: item.parsed.claimedMode === 'Cash' ? 'Cash' : 'Online' });
  }, []);
  const startLink = useCallback((id: string) => { setLinking(id); setCreating(null); }, []);
  const toggleExpanded = useCallback((id: string) => setExpanded(current => current === id ? null : id), []);

  if (loading) return <div className="text-sm text-muted-foreground">Loading review inbox…</div>;
  return <section className="space-y-5"><header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-medium text-primary">Auto-ingest review</p><h1 className="text-display text-3xl text-foreground">Review inbox</h1><p className="mt-1 text-sm text-muted-foreground">Confirm unmatched receipts and quarantined messages without losing their audit trail.</p></div><div className="flex gap-2"><span className="rounded-full bg-amber-500/10 px-3 py-1 text-sm text-amber-600">{counts.actionable} actionable</span><span className="rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">{counts.linked} linked</span></div></header>
    {ordered.length === 0 ? <div className="card-base p-8 text-center text-muted-foreground">Your review inbox is clear.</div> : ordered.map(item => <article key={`${item.kind}-${item.id}`} className="card-base p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h2 className="font-semibold text-foreground">{item.title}</h2><span className="rounded-full bg-secondary px-2 py-0.5 text-xs capitalize text-muted-foreground">{statusLabel(item.status)}</span></div><p className="mt-1 text-sm text-muted-foreground">{item.detail} · {item.dateKey ?? 'Date unavailable'}</p></div><strong className="text-lg text-foreground">{item.amount === null ? 'Amount unavailable' : money.format(item.amount)}</strong></div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">{Object.entries(item.parsed).filter(([, value]) => value).map(([key, value]) => <span key={key} className="rounded bg-secondary px-2 py-1">{key}: {value}</span>)}{item.variance !== null && <span className="rounded bg-secondary px-2 py-1">Bank variance: {money.format(item.variance)}</span>}</div>
      <button type="button" onClick={() => toggleExpanded(item.id)} className="mt-3 flex items-center gap-1 text-sm text-primary"><ChevronDown className={`h-4 w-4 transition-transform ${expanded === item.id ? 'rotate-180' : ''}`} />Raw excerpt</button>{expanded === item.id && <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-secondary p-3 text-xs text-muted-foreground">{item.rawExcerpt || 'No raw message available.'}</pre>}
      {['pending_bank', 'needs_review'].includes(item.status) && <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => startLink(item.id)} className="inline-flex items-center gap-1 rounded-lg bg-secondary px-3 py-2 text-sm"><Link2 className="h-4 w-4" />Link</button><button type="button" onClick={() => startCreate(item)} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"><Plus className="h-4 w-4" />Create transaction</button><button type="button" onClick={() => void mutate(item, 'dismiss')} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-destructive"><X className="h-4 w-4" />Dismiss</button></div>}
      {(item.status === 'linked' || item.status === 'posted') && item.transactionId && <p className="mt-4 inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary"><Check className="h-3 w-3" />Linked to transaction {item.transactionId.slice(-6)}</p>}
      {linking === item.id && <CandidatePicker candidates={item.candidates} onSelect={(transaction) => void mutate(item, 'link', transaction._id)} />}
      {creating === item.id && <CreateForm form={form} setForm={setForm} onCancel={() => setCreating(null)} onSubmit={() => void mutate(item, 'create')} />}
    </article>)}</section>;
}

function CandidatePicker({ candidates, onSelect }: { candidates: ApiTransaction[]; onSelect: (transaction: ApiTransaction) => void }) { return <div className="mt-3 rounded-lg border border-border p-3"><p className="mb-2 text-sm font-medium">Suggested bank matches</p>{candidates.length ? candidates.map(tx => <button type="button" key={tx._id} onClick={() => onSelect(tx)} className="mb-1 flex w-full justify-between rounded p-2 text-left text-sm hover:bg-secondary"><span>{tx.particulars} · {tx.dateKey}</span><span>{money.format(tx.amount)}</span></button>) : <p className="text-sm text-muted-foreground">No nearby transactions found. Create a cash/manual transaction instead.</p>}</div>; }
function CreateForm({ form, setForm, onCancel, onSubmit }: { form: { particulars: string; amount: string; date: string; category: string; mode: 'Online' | 'Cash' }; setForm: React.Dispatch<React.SetStateAction<{ particulars: string; amount: string; date: string; category: string; mode: 'Online' | 'Cash' }>>; onCancel: () => void; onSubmit: () => void }) { return <div className="mt-3 grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-2"><input value={form.particulars} onChange={e => setForm(f => ({ ...f, particulars: e.target.value }))} placeholder="Description" className="rounded border border-border bg-background p-2 text-sm"/><input value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="Amount" type="number" className="rounded border border-border bg-background p-2 text-sm"/><input value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} type="date" className="rounded border border-border bg-background p-2 text-sm"/><select value={form.mode} onChange={e => setForm(f => ({ ...f, mode: e.target.value as 'Online' | 'Cash' }))} className="rounded border border-border bg-background p-2 text-sm"><option>Online</option><option>Cash</option></select><div className="flex gap-2 sm:col-span-2"><button type="button" onClick={onSubmit} className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground">Create & link</button><button type="button" onClick={onCancel} className="rounded px-3 py-2 text-sm">Cancel</button></div></div>; }
