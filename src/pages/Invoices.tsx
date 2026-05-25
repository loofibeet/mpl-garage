import { useEffect, useState, useRef } from 'react';
import { Layout } from '../components/layout/Layout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input, Textarea, Select } from '../components/ui/Input';
import { Badge, statusVariant } from '../components/ui/Badge';
import { useApp } from '../contexts/AppContext';
import { db } from '../lib/storage';
import { Invoice, Company, RepairJob, Truck, InvoiceLineItem } from '../lib/database.types';
import { Plus, FileText, Printer, Trash2, Pencil, Eye, X, MessageCircle } from 'lucide-react';

function generateInvoiceNumber() {
  const now = new Date();
  return `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${Math.floor(Math.random() * 9000) + 1000}`;
}

function removeWhere(table: string, field: string, value: string) {
  const rows = db.getAll<Record<string, unknown>>(table);
  localStorage.setItem(`garage_${table}`, JSON.stringify(rows.filter(r => r[field] !== value)));
}

const emptyForm = {
  invoice_number: '', job_id: '', company_id: '', status: 'draft' as Invoice['status'],
  issue_date: new Date().toISOString().split('T')[0], due_date: '', tax_rate: '0',
  discount: '0', notes: '', payment_method: '',
};
const emptyLine = { description: '', quantity: '1', unit_price: '0', item_type: 'service' as InvoiceLineItem['item_type'] };

export function Invoices() {
  const { t } = useApp();
  const [invoices,  setInvoices]  = useState<(Invoice & { company?: Company; job?: RepairJob & { truck?: Truck } })[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [jobs,      setJobs]      = useState<(RepairJob & { truck?: Truck })[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailInvoice, setDetailInvoice] = useState<(Invoice & { company?: Company; job?: RepairJob & { truck?: Truck }; lines?: InvoiceLineItem[] }) | null>(null);
  const [editItem,  setEditItem]  = useState<Invoice | null>(null);
  const [form,      setForm]      = useState(emptyForm);
  const [lines,     setLines]     = useState<typeof emptyLine[]>([]);
  const [saving,    setSaving]    = useState(false);
  const [search,    setSearch]    = useState('');
  const printRef = useRef<HTMLDivElement>(null);

  const load = () => {
    const allInvoices  = db.getAll<Invoice>('invoices').sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const allCompanies = db.getAll<Company>('companies').sort((a, b) => a.name.localeCompare(b.name));
    const allTrucks    = db.getAll<Truck>('trucks');
    const allJobs      = db.getAll<RepairJob>('repair_jobs')
      .filter(j => ['completed', 'in_progress'].includes(j.status))
      .sort((a, b) => a.job_number.localeCompare(b.job_number));

    const jobsWithTruck = allJobs.map(j => ({ ...j, truck: allTrucks.find(t => t.id === j.truck_id) }));

    setInvoices(allInvoices.map(inv => ({
      ...inv,
      company: allCompanies.find(c => c.id === inv.company_id),
      job:     jobsWithTruck.find(j => j.id === inv.job_id),
    })));
    setCompanies(allCompanies);
    setJobs(jobsWithTruck);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const calcTotals = (lineItems: typeof emptyLine[], taxRate: number, discount: number) => {
    const subtotal  = lineItems.reduce((s, l) => s + (parseFloat(l.quantity) || 0) * (parseFloat(l.unit_price) || 0), 0);
    const taxAmount = subtotal * (taxRate / 100);
    const total     = subtotal + taxAmount - discount;
    return { subtotal, taxAmount, total };
  };

  const openCreate = () => { setEditItem(null); setForm({ ...emptyForm, invoice_number: generateInvoiceNumber() }); setLines([]); setModalOpen(true); };

  const openEdit = (inv: Invoice) => {
    setEditItem(inv);
    setForm({ invoice_number: inv.invoice_number, job_id: inv.job_id, company_id: inv.company_id, status: inv.status, issue_date: inv.issue_date, due_date: inv.due_date || '', tax_rate: String(inv.tax_rate), discount: String(inv.discount), notes: inv.notes, payment_method: inv.payment_method });
    const existingLines = db.getAll<InvoiceLineItem>('invoice_line_items').filter(l => l.invoice_id === inv.id);
    setLines(existingLines.map(l => ({ description: l.description, quantity: String(l.quantity), unit_price: String(l.unit_price), item_type: l.item_type })));
    setModalOpen(true);
  };

  const openDetail = (inv: typeof invoices[0]) => {
    const lineItems = db.getAll<InvoiceLineItem>('invoice_line_items').filter(l => l.invoice_id === inv.id);
    setDetailInvoice({ ...inv, lines: lineItems });
  };

  const handleSave = () => {
    if (!form.company_id || !form.invoice_number) return;
    setSaving(true);
    const { subtotal, taxAmount, total } = calcTotals(lines, parseFloat(form.tax_rate) || 0, parseFloat(form.discount) || 0);
    const payload = {
      invoice_number: form.invoice_number, job_id: form.job_id || null, company_id: form.company_id,
      status: form.status, issue_date: form.issue_date, due_date: form.due_date || null,
      tax_rate: parseFloat(form.tax_rate) || 0, discount: parseFloat(form.discount) || 0,
      subtotal, tax_amount: taxAmount, total, notes: form.notes, payment_method: form.payment_method,
    };

    let invId: string;
    if (editItem) { db.update('invoices', editItem.id, payload); invId = editItem.id; }
    else { const newInv = db.insert('invoices', payload); invId = newInv.id; }

    removeWhere('invoice_line_items', 'invoice_id', invId);
    lines.filter(l => l.description).forEach(l => {
      db.insert('invoice_line_items', {
        invoice_id: invId, description: l.description,
        quantity: parseFloat(l.quantity) || 1, unit_price: parseFloat(l.unit_price) || 0,
        total: (parseFloat(l.quantity) || 1) * (parseFloat(l.unit_price) || 0), item_type: l.item_type,
      });
    });

    setSaving(false); setModalOpen(false); load();
  };

  const handleDelete = (id: string) => {
    if (!confirm('Delete this invoice?')) return;
    removeWhere('invoice_line_items', 'invoice_id', id);
    db.remove('invoices', id);
    load();
  };

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html><head><title>Invoice</title><style>
      body { font-family: Arial, sans-serif; padding: 40px; color: #1e293b; }
      table { width: 100%; border-collapse: collapse; }
      th, td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: left; }
      th { background: #f8fafc; font-weight: 600; font-size: 12px; color: #64748b; }
      .total-row { font-weight: bold; font-size: 16px; }
      .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; background: #dcfce7; color: #166534; }
      @media print { button { display: none; } }
    </style></head><body>${content.innerHTML}</body></html>`);
    win.document.close();
    win.print();
  };

  const handleWhatsApp = (inv: typeof invoices[0]) => {
    const msg = encodeURIComponent(`Invoice ${inv.invoice_number}\nCompany: ${inv.company?.name}\nTotal: $${inv.total.toFixed(2)}\nStatus: ${inv.status}`);
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  const filtered = invoices.filter(inv => { const q = search.toLowerCase(); return !q || inv.invoice_number.toLowerCase().includes(q) || inv.company?.name.toLowerCase().includes(q); });

  const statusOptions  = [{ value: 'draft', label: t('draft') }, { value: 'sent', label: t('sent') }, { value: 'paid', label: t('paid') }, { value: 'overdue', label: t('overdue') }, { value: 'cancelled', label: t('cancelled') }];
  const statusLabel    = (s: string) => statusOptions.find(o => o.value === s)?.label || s;
  const itemTypeOptions = [{ value: 'service', label: 'Service' }, { value: 'part', label: 'Part' }, { value: 'labor', label: 'Labor' }];
  const { subtotal, taxAmount, total } = calcTotals(lines, parseFloat(form.tax_rate) || 0, parseFloat(form.discount) || 0);

  return (
    <Layout title={t('invoices')}>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <input type="text" placeholder="Search invoice #, company..." value={search} onChange={e => setSearch(e.target.value)} className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/20" />
          <Button icon={<Plus className="w-4 h-4" />} onClick={openCreate}>{t('addInvoice')}</Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48 text-slate-400"><div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mr-3" />{t('loading')}</div>
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center"><FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" /><p className="text-slate-500 dark:text-slate-400">{t('noData')}</p><Button className="mt-4" icon={<Plus className="w-4 h-4" />} onClick={openCreate}>{t('addInvoice')}</Button></Card>
        ) : (
          <div className="space-y-3">
            {filtered.map(inv => (
              <Card key={inv.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-sky-50 dark:bg-sky-900/20 rounded-xl flex items-center justify-center flex-shrink-0"><FileText className="w-5 h-5 text-sky-500" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm font-mono">{inv.invoice_number}</span>
                      <Badge variant={statusVariant(inv.status)}>{statusLabel(inv.status)}</Badge>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{inv.company?.name}</p>
                    {inv.job?.truck && <p className="text-xs text-slate-500 dark:text-slate-400">{inv.job.truck.make} {inv.job.truck.model} · <span className="font-mono">{inv.job.truck.plate_number}</span></p>}
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-xs text-slate-400">{inv.issue_date}</span>
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-200">${inv.total.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button onClick={() => openDetail(inv)} className="p-1.5 text-slate-400 hover:text-sky-600 rounded transition-colors"><Eye className="w-4 h-4" /></button>
                    <button onClick={() => openEdit(inv)} className="p-1.5 text-slate-400 hover:text-orange-600 rounded transition-colors"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => handleWhatsApp(inv)} className="p-1.5 text-slate-400 hover:text-green-600 rounded transition-colors"><MessageCircle className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(inv.id)} className="p-1.5 text-slate-400 hover:text-red-600 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Edit Invoice' : t('addInvoice')} size="xl">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('invoiceNumber') + ' *'} value={form.invoice_number} onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))} />
            <Select label={t('status')} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Invoice['status'] }))} options={statusOptions} />
          </div>
          <Select label={t('company') + ' *'} value={form.company_id} onChange={e => setForm(f => ({ ...f, company_id: e.target.value }))} options={[{ value: '', label: 'Select company...' }, ...companies.map(c => ({ value: c.id, label: c.name }))]} />
          <Select label="Linked Work Order" value={form.job_id} onChange={e => setForm(f => ({ ...f, job_id: e.target.value }))} options={[{ value: '', label: 'None' }, ...jobs.map(j => ({ value: j.id, label: `${j.job_number} — ${j.truck?.plate_number}` }))]} />
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('issueDate')} type="date" value={form.issue_date} onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))} />
            <Input label={t('dueDate')} type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Line Items</label>
              <Button size="sm" variant="outline" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setLines(l => [...l, { ...emptyLine }])}>Add Item</Button>
            </div>
            <div className="space-y-2">
              {lines.map((line, i) => (
                <div key={i} className="flex gap-2 items-end">
                  <div className="flex-1"><Input placeholder="Description" value={line.description} onChange={e => setLines(l => l.map((x, xi) => xi === i ? { ...x, description: e.target.value } : x))} /></div>
                  <div className="w-20"><Input placeholder="Qty" type="number" value={line.quantity} onChange={e => setLines(l => l.map((x, xi) => xi === i ? { ...x, quantity: e.target.value } : x))} /></div>
                  <div className="w-24"><Input placeholder="Price" type="number" value={line.unit_price} onChange={e => setLines(l => l.map((x, xi) => xi === i ? { ...x, unit_price: e.target.value } : x))} /></div>
                  <div className="w-28">
                    <select value={line.item_type} onChange={e => setLines(l => l.map((x, xi) => xi === i ? { ...x, item_type: e.target.value as InvoiceLineItem['item_type'] } : x))} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-orange-400 focus:outline-none">
                      {itemTypeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <button onClick={() => setLines(l => l.filter((_, xi) => xi !== i))} className="p-2 text-red-400 hover:text-red-600 mb-0.5"><X className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label={`${t('tax')} (%)`} type="number" step="0.1" value={form.tax_rate} onChange={e => setForm(f => ({ ...f, tax_rate: e.target.value }))} />
            <Input label={t('discount') + ' ($)'} type="number" value={form.discount} onChange={e => setForm(f => ({ ...f, discount: e.target.value }))} />
            <Input label={t('paymentMethod')} value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))} placeholder="Cash, Bank..." />
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-600 dark:text-slate-400"><span>{t('subtotal')}</span><span>${subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400"><span>{t('tax')} ({form.tax_rate}%)</span><span>${taxAmount.toFixed(2)}</span></div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400"><span>{t('discount')}</span><span>-${(parseFloat(form.discount) || 0).toFixed(2)}</span></div>
            <div className="flex justify-between font-bold text-slate-800 dark:text-slate-100 text-base border-t border-slate-200 dark:border-slate-700 pt-1.5"><span>{t('total')}</span><span>${total.toFixed(2)}</span></div>
          </div>
          <Textarea label={t('notes')} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Payment terms, notes..." />
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)} className="flex-1 justify-center">{t('cancel')}</Button>
            <Button onClick={handleSave} loading={saving} className="flex-1 justify-center">{t('save')}</Button>
          </div>
        </div>
      </Modal>

      {detailInvoice && (
        <Modal open={!!detailInvoice} onClose={() => setDetailInvoice(null)} title="Invoice" size="lg">
          <div>
            <div className="flex gap-2 mb-4">
              <Button icon={<Printer className="w-4 h-4" />} onClick={handlePrint}>{t('print')}</Button>
              <Button variant="outline" icon={<MessageCircle className="w-4 h-4" />} onClick={() => handleWhatsApp(detailInvoice)}>WhatsApp</Button>
            </div>
            <div ref={printRef} className="space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-2xl font-bold text-orange-500">TruckGarage Pro</h1>
                  <p className="text-slate-500 text-sm">Professional Truck Repair & Maintenance</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-slate-800 dark:text-slate-100 font-mono">{detailInvoice.invoice_number}</p>
                  <Badge variant={statusVariant(detailInvoice.status)}>{statusLabel(detailInvoice.status)}</Badge>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6 text-sm">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Bill To</p>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">{detailInvoice.company?.name}</p>
                  <p className="text-slate-500">{detailInvoice.company?.address}</p>
                  <p className="text-slate-500">{detailInvoice.company?.phone}</p>
                </div>
                <div className="text-right">
                  <div className="space-y-1">
                    <div><span className="text-slate-400 text-xs">Issue Date: </span><span className="font-medium">{detailInvoice.issue_date}</span></div>
                    {detailInvoice.due_date && <div><span className="text-slate-400 text-xs">Due Date: </span><span className="font-medium">{detailInvoice.due_date}</span></div>}
                    {detailInvoice.job?.truck && (
                      <div className="mt-2 bg-slate-50 dark:bg-slate-800 rounded-lg p-2 text-left">
                        <p className="text-xs text-slate-400">Vehicle</p>
                        <p className="font-medium text-sm">{detailInvoice.job.truck.make} {detailInvoice.job.truck.model}</p>
                        <p className="text-xs font-mono text-slate-500">{detailInvoice.job.truck.plate_number}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {detailInvoice.lines && detailInvoice.lines.length > 0 && (
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800"><tr><th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Description</th><th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Qty</th><th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Unit Price</th><th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Total</th></tr></thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                      {detailInvoice.lines.map(line => (<tr key={line.id}><td className="px-4 py-3 text-slate-700 dark:text-slate-300">{line.description}<span className="ml-2 text-xs text-slate-400">({line.item_type})</span></td><td className="px-4 py-3 text-center text-slate-600 dark:text-slate-400">{line.quantity}</td><td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">${line.unit_price.toFixed(2)}</td><td className="px-4 py-3 text-right font-medium text-slate-800 dark:text-slate-200">${line.total.toFixed(2)}</td></tr>))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="flex justify-end">
                <div className="w-64 space-y-2 text-sm">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400"><span>Subtotal</span><span>${detailInvoice.subtotal.toFixed(2)}</span></div>
                  {detailInvoice.tax_rate > 0 && <div className="flex justify-between text-slate-600 dark:text-slate-400"><span>Tax ({detailInvoice.tax_rate}%)</span><span>${detailInvoice.tax_amount.toFixed(2)}</span></div>}
                  {detailInvoice.discount > 0 && <div className="flex justify-between text-slate-600 dark:text-slate-400"><span>Discount</span><span>-${detailInvoice.discount.toFixed(2)}</span></div>}
                  <div className="flex justify-between font-bold text-slate-800 dark:text-slate-100 text-lg border-t border-slate-200 dark:border-slate-700 pt-2"><span>Total</span><span>${detailInvoice.total.toFixed(2)}</span></div>
                  {detailInvoice.payment_method && <div className="text-xs text-slate-400">Payment: {detailInvoice.payment_method}</div>}
                </div>
              </div>
              {detailInvoice.notes && (
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 text-sm text-slate-600 dark:text-slate-400">
                  <p className="font-medium text-slate-700 dark:text-slate-300 mb-1">Notes</p>{detailInvoice.notes}
                </div>
              )}
              <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                <div className="grid grid-cols-2 gap-8">
                  <div><p className="text-xs text-slate-400 mb-8">Authorized Signature</p><div className="border-t border-slate-300 pt-1"><p className="text-xs text-slate-400">Garage Manager</p></div></div>
                  <div><p className="text-xs text-slate-400 mb-8">Customer Signature</p><div className="border-t border-slate-300 pt-1"><p className="text-xs text-slate-400">Client Name & Stamp</p></div></div>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </Layout>
  );
}
