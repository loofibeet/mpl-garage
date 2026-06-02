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
import { Plus, FileText, Printer, Trash2, Pencil, Eye, X } from 'lucide-react';

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
  issue_date: new Date().toISOString().split('T')[0], due_date: '', tax_rate: '20',
  discount: '0', notes: '', payment_method: '', payment_link: '',
};
const emptyLine = { description: '', quantity: '1', unit_price: '0', item_type: 'service' as InvoiceLineItem['item_type'] };
type InvoiceWithRelations = Invoice & { company?: Company; job?: RepairJob & { truck?: Truck }; lines?: InvoiceLineItem[] };

export function Invoices() {
  const { t, language } = useApp();
  const [invoices,  setInvoices]  = useState<InvoiceWithRelations[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [jobs,      setJobs]      = useState<(RepairJob & { truck?: Truck })[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailInvoice, setDetailInvoice] = useState<InvoiceWithRelations | null>(null);
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
    const allJobs      = db.getAll<RepairJob>('repair_jobs');

    const jobsWithTruck = allJobs.map(j => ({ ...j, truck: allTrucks.find(t => t.id === j.truck_id) }));

    setInvoices(allInvoices.map(inv => ({
      ...inv,
      company: allCompanies.find(c => c.id === inv.company_id),
      job:     jobsWithTruck.find(j => j.id === inv.job_id),
    })));
    setCompanies(allCompanies);
    setJobs(jobsWithTruck.filter(j => ['completed', 'in_progress'].includes(j.status)));
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
    setForm({ invoice_number: inv.invoice_number, job_id: inv.job_id || '', company_id: inv.company_id, status: inv.status, issue_date: inv.issue_date, due_date: inv.due_date || '', tax_rate: String(inv.tax_rate), discount: String(inv.discount), notes: inv.notes, payment_method: inv.payment_method, payment_link: inv.payment_link || '' });
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
      payment_link: form.payment_link.trim(),
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
    if (!confirm(t('deleteInvoiceConfirm'))) return;
    removeWhere('invoice_line_items', 'invoice_id', id);
    db.remove('invoices', id);
    load();
  };

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open('', '_blank');
    if (!win) return;
    
    const tailwindStyles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(style => style.outerHTML)
      .join('\n');

    win.document.write(`
      <html lang="${language}" dir="${language === 'ar' ? 'rtl' : 'ltr'}">
        <head>
          <title>${t('invoicePrintTitle')}</title>
          ${tailwindStyles}
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            @media print {
              body { padding: 0; margin: 0; }
              .no-print { display: none !important; }
              .print-shadow-none { box-shadow: none !important; border: none !important; }
            }
          </style>
        </head>
        <body class="p-6 sm:p-12 max-w-4xl mx-auto">
          ${content.innerHTML}
        </body>
      </html>
    `);
    win.document.close();
    
    setTimeout(() => {
      win.focus();
      win.print();
      win.close();
    }, 500);
  };

  const filtered = invoices.filter(inv => { const q = search.toLowerCase(); return !q || inv.invoice_number.toLowerCase().includes(q) || inv.company?.name.toLowerCase().includes(q); });

  const statusOptions  = [{ value: 'draft', label: t('draft') }, { value: 'sent', label: t('sent') }, { value: 'paid', label: t('paid') }, { value: 'overdue', label: t('overdue') }, { value: 'cancelled', label: t('cancelled') }];
  const statusLabel    = (s: string) => statusOptions.find(o => o.value === s)?.label || s;
  const itemTypeOptions = [{ value: 'service', label: t('service') }, { value: 'part', label: t('part') }, { value: 'labor', label: t('control') }];
  const itemTypeLabel = (s: string) => itemTypeOptions.find(o => o.value === s)?.label || s;
  const { subtotal, taxAmount, total } = calcTotals(lines, parseFloat(form.tax_rate) || 0, parseFloat(form.discount) || 0);

  return (
    <Layout title={t('invoicePageTitle')}>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <input type="text" placeholder={t('searchInvoicePlaceholder')} value={search} onChange={e => setSearch(e.target.value)} className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/20" />
          <Button icon={<Plus className="w-4 h-4" />} onClick={openCreate}>{t('issueInvoice')}</Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48 text-slate-400"><div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mr-3" />{t('loading')}</div>
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center"><FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" /><p className="text-slate-500 dark:text-slate-400">{t('noInvoices')}</p><Button className="mt-4" icon={<Plus className="w-4 h-4" />} onClick={openCreate}>{t('createInvoice')}</Button></Card>
        ) : (
          <div className="space-y-3">
            {filtered.map(inv => (
              <Card key={inv.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-orange-50 dark:bg-orange-900/20 rounded-xl flex items-center justify-center flex-shrink-0"><FileText className="w-5 h-5 text-orange-500" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm font-mono">{inv.invoice_number}</span>
                      <Badge variant={statusVariant(inv.status)}>{statusLabel(inv.status)}</Badge>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{inv.company?.name}</p>
                    {inv.job?.truck && <p className="text-xs text-slate-500 dark:text-slate-400">{inv.job.truck.make} {inv.job.truck.model} · <span className="font-mono">{inv.job.truck.plate_number}</span></p>}
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-xs text-slate-400">{inv.issue_date}</span>
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{inv.total.toFixed(2)} EUR</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button onClick={() => openDetail(inv)} className="p-1.5 text-slate-400 hover:text-sky-600 rounded transition-colors" title={t('view')}><Eye className="w-4 h-4" /></button>
                    <button onClick={() => openEdit(inv)} className="p-1.5 text-slate-400 hover:text-orange-600 rounded transition-colors" title={t('edit')}><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(inv.id)} className="p-1.5 text-slate-400 hover:text-red-600 rounded transition-colors" title={t('delete')}><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* MODAL : CRÉER / MODIFIER UNE FACTURE */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? t('editInvoiceTitle') : t('newInvoice')} size="xl">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={`${t('invoiceNumber')} *`} value={form.invoice_number} onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))} />
            <Select label={t('paymentStatus')} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Invoice['status'] }))} options={statusOptions} />
          </div>
          <Select label={`${t('clientCompany')} *`} value={form.company_id} onChange={e => setForm(f => ({ ...f, company_id: e.target.value }))} options={[{ value: '', label: t('selectCompany') }, ...companies.map(c => ({ value: c.id, label: c.name }))]} />
          <Select label={t('linkedRepairOrder')} value={form.job_id} onChange={e => setForm(f => ({ ...f, job_id: e.target.value }))} options={[{ value: '', label: t('noLinkedJob') }, ...jobs.map(j => ({ value: j.id, label: `${j.job_number} - ${j.truck?.plate_number}` }))]} />
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('issueDate')} type="date" value={form.issue_date} onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))} />
            <Input label={t('dueDate')} type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('billingLines')}</label>
              <Button size="sm" variant="outline" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setLines(l => [...l, { ...emptyLine }])}>{t('addLine')}</Button>
            </div>
            <div className="space-y-2">
              {lines.map((line, i) => (
                <div key={i} className="flex gap-2 items-end">
                  <div className="flex-1"><Input placeholder={t('lineDescriptionPlaceholder')} value={line.description} onChange={e => setLines(l => l.map((x, xi) => xi === i ? { ...x, description: e.target.value } : x))} /></div>
                  <div className="w-20"><Input placeholder={t('quantity')} type="number" value={line.quantity} onChange={e => setLines(l => l.map((x, xi) => xi === i ? { ...x, quantity: e.target.value } : x))} /></div>
                  <div className="w-24"><Input placeholder={t('unitPrice')} type="number" value={line.unit_price} onChange={e => setLines(l => l.map((x, xi) => xi === i ? { ...x, unit_price: e.target.value } : x))} /></div>
                  <div className="w-32">
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
            <Input label={`${t('vat')} (%)`} type="number" step="0.1" value={form.tax_rate} onChange={e => setForm(f => ({ ...f, tax_rate: e.target.value }))} />
            <Input label={`${t('discountAmount')} (EUR)`} type="number" value={form.discount} onChange={e => setForm(f => ({ ...f, discount: e.target.value }))} />
            <Input label={t('paymentMethod')} value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))} placeholder={t('paymentMethod')} />
          </div>
          <Input label={t('paymentLink')} type="url" value={form.payment_link} onChange={e => setForm(f => ({ ...f, payment_link: e.target.value }))} placeholder={t('paymentLinkPlaceholder')} />
          <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-600 dark:text-slate-400"><span>{t('subtotalExTax')}</span><span>{subtotal.toFixed(2)} EUR</span></div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400"><span>{t('vat')} ({form.tax_rate}%)</span><span>{taxAmount.toFixed(2)} EUR</span></div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400"><span>{t('appliedDiscount')}</span><span>-{(parseFloat(form.discount) || 0).toFixed(2)} EUR</span></div>
            <div className="flex justify-between font-bold text-slate-800 dark:text-slate-100 text-base border-t border-slate-200 dark:border-slate-700 pt-1.5"><span>{t('amountInclTax')}</span><span>{total.toFixed(2)} EUR</span></div>
          </div>
          <Textarea label={t('paymentTermsNotes')} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder={t('paymentTermsPlaceholder')} />
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)} className="flex-1 justify-center">{t('cancel')}</Button>
            <Button onClick={handleSave} loading={saving} className="flex-1 justify-center">{t('save')}</Button>
          </div>
        </div>
      </Modal>

      {/* MODAL : VISUALISATION EN-TÊTE ET CONTENU OPTIMISÉS */}
      {detailInvoice && (
        <Modal open={!!detailInvoice} onClose={() => setDetailInvoice(null)} title={t('invoicePreview')} size="lg">
          <div className="text-slate-800 dark:text-slate-100">
            <div className="flex gap-2 mb-6 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800 no-print">
              <Button icon={<Printer className="w-4 h-4" />} onClick={handlePrint}>{t('printPdf')}</Button>
            </div>
            
            <div ref={printRef} className="bg-white p-4 sm:p-6 text-slate-900 border border-slate-100 rounded-xl print-shadow-none">
              
              {/* EN-TÊTE MPL AVEC FIX TRANSPARENCE LOGO */}
              <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-orange-600 pb-5 mb-6 gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 bg-white rounded-xl overflow-hidden flex items-center justify-center p-1 border border-slate-200">
                    <img src="/mpl-logo.png" alt="MPL" className="object-contain w-full h-full" />
                  </div>
                  <div>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tight m-0">MPL — Mécanique Poids Lourds</h1>
                    <p className="text-xs text-orange-600 font-bold uppercase tracking-wider m-0 mt-0.5">Repair & Industrial Maintenance</p>
                    <p className="text-xs text-slate-500 mt-2 leading-relaxed max-w-sm">
                      Zone Artisanale des Transports<br />
                      Tel: +33 6 69 00 56 51 · ml.77.mpl@gmail.com<br />
                      Siret: 123 456 789 00012 - Code APE 4520B
                    </p>
                  </div>
                </div>
                <div className="sm:text-right w-full sm:w-auto">
                  <h2 className="text-2xl sm:text-3xl font-black text-slate-900 uppercase m-0">{t('invoiceDocument')}</h2>
                  <p className="text-base sm:text-lg font-bold text-orange-600 font-mono m-0 mt-1">{detailInvoice.invoice_number}</p>
                  <div className="text-xs uppercase font-extrabold tracking-wider mt-2 bg-slate-100 inline-block px-2.5 py-1 rounded text-slate-700">
                    {t('status')}: {statusLabel(detailInvoice.status)}
                  </div>
                </div>
              </div>

              {/* GRILLE CLIENT / EMETTEUR */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="uppercase text-[10px] font-bold text-slate-400 tracking-wider mb-2 border-b border-slate-200/60 pb-1">{t('billedTo')}</div>
                  <p className="text-base font-bold text-slate-900 mb-1">{detailInvoice.company?.name}</p>
                  <p className="text-xs text-slate-600 leading-relaxed mb-1">{detailInvoice.company?.address}</p>
                  <p className="text-xs font-semibold text-slate-700">{t('phone')}: {detailInvoice.company?.phone}</p>
                </div>
                
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col justify-between">
                  <div>
                    <div className="uppercase text-[10px] font-bold text-slate-400 tracking-wider mb-2 border-b border-slate-200/60 pb-1">{t('adminDetails')}</div>
                    <div className="text-xs text-slate-600 space-y-1">
                      <p><strong>{t('issueDate')}:</strong> {detailInvoice.issue_date}</p>
                      {detailInvoice.due_date && <p><strong>{t('dueDate')}:</strong> {detailInvoice.due_date}</p>}
                    </div>
                  </div>
                  
                  {detailInvoice.job?.truck && (
                    <div className="mt-3 bg-white border border-slate-200 p-2.5 rounded-lg shadow-sm">
                      <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-tight">{t('vehicleServiced')}</span>
                      <strong className="text-xs text-slate-800 block mt-0.5">{detailInvoice.job.truck.make} {detailInvoice.job.truck.model}</strong>
                      <span className="font-mono text-xs text-orange-600 font-bold block mt-0.5">{t('licensePlate')} : {detailInvoice.job.truck.plate_number}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* NOUVELLE SECTION : DESCRIPTION DES TRAVAUX RÉALISÉS */}
              {detailInvoice.job && (detailInvoice.job.problem_description || detailInvoice.job.repairs_completed) && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 text-xs space-y-2">
                  <div className="uppercase text-[10px] font-bold text-orange-600 tracking-wider border-b border-slate-200 pb-1 mb-2">
                    {t('workInterventions')}
                  </div>
                  {detailInvoice.job.problem_description && (
                    <p className="text-slate-700"><strong>{t('symptomsProblem')}:</strong> {detailInvoice.job.problem_description}</p>
                  )}
                  {detailInvoice.job.diagnostics && (
                    <p className="text-slate-700"><strong>{t('diagnostics')}:</strong> {detailInvoice.job.diagnostics}</p>
                  )}
                  {detailInvoice.job.repairs_completed && (
                    <p className="text-slate-900 bg-white p-2 rounded border border-slate-200 mt-1">
                      <strong>{t('repairsCompleted')}:</strong> {detailInvoice.job.repairs_completed}
                    </p>
                  )}
                </div>
              )}

              {/* TABLEAU COMPTABLE */}
              {detailInvoice.lines && detailInvoice.lines.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden mb-6 shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[500px]">
                      <thead>
                        <tr className="bg-slate-900 text-white">
                          <th className="text-[11px] uppercase font-bold tracking-wider px-4 py-3">{t('designation')}</th>
                          <th className="text-[11px] uppercase font-bold tracking-wider px-4 py-3 text-center w-20">{t('quantity')}</th>
                          <th className="text-[11px] uppercase font-bold tracking-wider px-4 py-3 text-right w-28">{t('priceUnit')}</th>
                          <th className="text-[11px] uppercase font-bold tracking-wider px-4 py-3 text-right w-32">{t('totalExTax')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-xs">
                        {detailInvoice.lines.map(line => (
                          <tr key={line.id} className="odd:bg-white even:bg-slate-50/60 hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-semibold text-slate-900">{line.description}</div>
                              <span className="text-[9px] bg-slate-100 text-slate-500 rounded px-1.5 py-0.5 uppercase font-medium mt-1 inline-block">{t('itemTypeLabel')}: {itemTypeLabel(line.item_type)}</span>
                            </td>
                            <td className="px-4 py-3 text-center font-medium text-slate-700">{line.quantity}</td>
                            <td className="px-4 py-3 text-right text-slate-600">{line.unit_price.toFixed(2)} EUR</td>
                            <td className="px-4 py-3 text-right font-bold text-slate-900">{line.total.toFixed(2)} EUR</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TOTALISATIONS */}
              <div className="flex justify-end mb-6">
                <div className="w-full sm:w-72 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-500 font-medium">
                    <span>{t('generalTotalExTax')}</span>
                    <span className="font-semibold text-slate-800">{detailInvoice.subtotal.toFixed(2)} EUR</span>
                  </div>
                  {detailInvoice.tax_rate > 0 && (
                    <div className="flex justify-between text-slate-500 font-medium">
                      <span>{t('vat')} ({detailInvoice.tax_rate}%):</span>
                      <span className="font-semibold text-slate-800">{detailInvoice.tax_amount.toFixed(2)} EUR</span>
                    </div>
                  )}
                  {detailInvoice.discount > 0 && (
                    <div className="flex justify-between text-red-600 font-medium">
                      <span>{t('exceptionalDiscount')}</span>
                      <span className="font-bold">-{detailInvoice.discount.toFixed(2)} EUR</span>
                    </div>
                  )}
                  <div className="flex justify-between font-black text-slate-900 text-sm border-t border-orange-500 pt-2 mt-1">
                    <span>{t('netToPay')}:</span>
                    <span className="text-orange-600">{detailInvoice.total.toFixed(2)} EUR</span>
                  </div>
                  {detailInvoice.payment_method && (
                    <div className="text-[10px] text-slate-400 pt-2 border-t border-slate-200/60 text-right italic font-medium">
                      {t('paymentMode')} {detailInvoice.payment_method}
                    </div>
                  )}
                  {detailInvoice.payment_link?.trim() && (
                    <div className="text-[10px] text-slate-500 pt-2 border-t border-slate-200/60 text-right font-medium">
                      <span className="block text-slate-400 italic">{t('paymentLink')}</span>
                      <a className="text-orange-600 break-all" href={detailInvoice.payment_link} target="_blank" rel="noreferrer">{detailInvoice.payment_link}</a>
                    </div>
                  )}
                </div>
              </div>

              {/* BLOC NOTES */}
              {detailInvoice.notes && (
                <div className="bg-slate-50 border-l-4 border-orange-500 p-3 rounded-r-xl text-xs text-slate-600 mb-6 leading-relaxed">
                  <strong className="block text-[10px] uppercase font-bold text-slate-900 tracking-wider mb-1">{t('paymentTermsNotes')}:</strong>
                  {detailInvoice.notes}
                </div>
              )}

              {/* SIGNATURES */}
              <div className="flex flex-col sm:flex-row justify-between gap-6 mt-12 pt-4 border-t border-slate-100">
                <div className="flex-1 text-center sm:text-left">
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-12">{t('garageStamp')}</div>
                  <div className="border-t border-dashed border-slate-300 w-3/4 mx-auto sm:mx-0"></div>
                </div>
                <div className="flex-1 text-center sm:text-right">
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-12">{t('clientSignature')}</div>
                  <div className="border-t border-dashed border-slate-300 w-3/4 mx-auto sm:mr-0"></div>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </Layout>
  );
}
