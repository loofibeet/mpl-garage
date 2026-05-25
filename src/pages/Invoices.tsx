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
  issue_date: new Date().toISOString().split('T')[0], due_date: '', tax_rate: '20',
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

    setModalOpen(false); load();
  };

  const handleDelete = (id: string) => {
    if (!confirm('Supprimer cette facture ?')) return;
    removeWhere('invoice_line_items', 'invoice_id', id);
    db.remove('invoices', id);
    load();
  };

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html><head><title>Facture — MPL</title><style>
      body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 50px; color: #1e293b; background: #fff; line-height: 1.5; }
      .header-container { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #ea580c; padding-bottom: 25px; margin-bottom: 35px; }
      .brand-title { font-size: 28px; font-weight: 800; color: #0f172a; margin: 0; text-transform: uppercase; letter-spacing: -0.5px; }
      .brand-subtitle { font-size: 12px; color: #ea580c; font-weight: 600; margin: 2px 0 0 0; text-transform: uppercase; letter-spacing: 1px; }
      .brand-details { font-size: 12px; color: #64748b; margin-top: 8px; line-height: 1.4; }
      .invoice-title-container { text-align: right; }
      .invoice-head { font-size: 32px; font-weight: 900; color: #0f172a; margin: 0; text-transform: uppercase; }
      .invoice-number { font-size: 16px; font-weight: 700; color: #ea580c; font-family: monospace; margin: 4px 0; }
      .info-grid { display: grid; grid-cols: 2; display: flex; justify-content: space-between; gap: 40px; margin-bottom: 40px; }
      .info-block { flex: 1; }
      .block-label { text-transform: uppercase; font-size: 11px; font-weight: 700; color: #94a3b8; tracking: 1px; margin-bottom: 6px; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px; }
      .info-text { font-size: 13px; color: #334155; margin: 3px 0; }
      .vehicle-badge { background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; border-radius: 8px; margin-top: 8px; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 30px; }
      th { background: #0f172a; color: #ffffff; text-transform: uppercase; font-size: 11px; font-weight: 700; padding: 12px 14px; text-align: left; letter-spacing: 0.5px; }
      th:nth-child(2), td:nth-child(2) { text-align: center; }
      th:nth-child(3), td:nth-child(3) { text-align: right; }
      th:nth-child(4), td:nth-child(4) { text-align: right; }
      td { padding: 12px 14px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #334155; }
      tr:nth-child(even) td { background: #f8fafc; }
      .totals-container { display: flex; justify-content: flex-end; margin-top: 20px; }
      .totals-box { width: 300px; background: #f8fafc; border-radius: 8px; padding: 16px; border: 1px solid #e2e8f0; }
      .total-row { display: flex; justify-content: space-between; font-size: 13px; color: #64748b; padding: 4px 0; }
      .total-grand { font-size: 18px; font-weight: 800; color: #0f172a; border-t: 2px solid #ea580c; margin-top: 8px; padding-top: 8px; }
      .notes-box { background: #f8fafc; border-left: 3px solid #ea580c; padding: 14px; border-radius: 0 8px 8px 0; font-size: 12px; color: #475569; margin-top: 40px; }
      .signatures { margin-top: 70px; display: grid; flex-direction: row; display: flex; justify-content: space-between; gap: 80px; }
      .sig-block { flex: 1; text-align: center; }
      .sig-line { border-top: 1px dashed #cbd5e1; margin-top: 60px; padding-top: 8px; font-size: 11px; color: #94a3b8; text-transform: uppercase; }
      @media print { body { padding: 0; } button { display: none; } }
    </style></head><body>${content.innerHTML}</body></html>`);
    win.document.close();
    win.print();
  };

  const handleWhatsApp = (inv: typeof invoices[0]) => {
    const msg = encodeURIComponent(`Facture ${inv.invoice_number}\nEntreprise: ${inv.company?.name}\nTotal: €${inv.total.toFixed(2)}\nStatut: ${inv.status}`);
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  const filtered = invoices.filter(inv => { const q = search.toLowerCase(); return !q || inv.invoice_number.toLowerCase().includes(q) || inv.company?.name.toLowerCase().includes(q); });

  const statusOptions  = [{ value: 'draft', label: 'Brouillon' }, { value: 'sent', label: 'Envoyée' }, { value: 'paid', label: 'Payée' }, { value: 'overdue', label: 'En retard' }, { value: 'cancelled', label: 'Annulée' }];
  const statusLabel    = (s: string) => statusOptions.find(o => o.value === s)?.label || s;
  const itemTypeOptions = [{ value: 'service', label: 'Main d\'œuvre' }, { value: 'part', label: 'Pièce rechange' }, { value: 'labor', label: 'Contrôle' }];
  const { subtotal, taxAmount, total } = calcTotals(lines, parseFloat(form.tax_rate) || 0, parseFloat(form.discount) || 0);

  return (
    <Layout title="Facturation & Devis">
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <input type="text" placeholder="Rechercher numéro, entreprise..." value={search} onChange={e => setSearch(e.target.value)} className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/20" />
          <Button icon={<Plus className="w-4 h-4" />} onClick={openCreate}>Émettre une facture</Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48 text-slate-400"><div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mr-3" />Chargement...</div>
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center"><FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" /><p className="text-slate-500 dark:text-slate-400">Aucune facture enregistrée.</p><Button className="mt-4" icon={<Plus className="w-4 h-4" />} onClick={openCreate}>Créer une facture</Button></Card>
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
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{inv.total.toFixed(2)} €</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button onClick={() => openDetail(inv)} className="p-1.5 text-slate-400 hover:text-sky-600 rounded transition-colors" title="Consulter"><Eye className="w-4 h-4" /></button>
                    <button onClick={() => openEdit(inv)} className="p-1.5 text-slate-400 hover:text-orange-600 rounded transition-colors" title="Modifier"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => handleWhatsApp(inv)} className="p-1.5 text-slate-400 hover:text-green-600 rounded transition-colors" title="Partager WhatsApp"><MessageCircle className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(inv.id)} className="p-1.5 text-slate-400 hover:text-red-600 rounded transition-colors" title="Supprimer"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* MODAL : CRÉER / MODIFIER UNE FACTURE */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Modifier la Facture' : 'Nouvelle Facture'} size="xl">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Numéro de facture *" value={form.invoice_number} onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))} />
            <Select label="Statut de paiement" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Invoice['status'] }))} options={statusOptions} />
          </div>
          <Select label="Client / Entreprise *" value={form.company_id} onChange={e => setForm(f => ({ ...f, company_id: e.target.value }))} options={[{ value: '', label: 'Sélectionner un client...' }, ...companies.map(c => ({ value: c.id, label: c.name }))]} />
          <Select label="Ordre de Réparation lié" value={form.job_id} onChange={e => setForm(f => ({ ...f, job_id: e.target.value }))} options={[{ value: '', label: 'Aucun' }, ...jobs.map(j => ({ value: j.id, label: `${j.job_number} — ${j.truck?.plate_number}` }))]} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Date d'émission" type="date" value={form.issue_date} onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))} />
            <Input label="Date d'échéance" type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Lignes de facturation</label>
              <Button size="sm" variant="outline" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setLines(l => [...l, { ...emptyLine }])}>Ajouter une ligne</Button>
            </div>
            <div className="space-y-2">
              {lines.map((line, i) => (
                <div key={i} className="flex gap-2 items-end">
                  <div className="flex-1"><Input placeholder="Description des travaux ou pièces" value={line.description} onChange={e => setLines(l => l.map((x, xi) => xi === i ? { ...x, description: e.target.value } : x))} /></div>
                  <div className="w-20"><Input placeholder="Qté" type="number" value={line.quantity} onChange={e => setLines(l => l.map((x, xi) => xi === i ? { ...x, quantity: e.target.value } : x))} /></div>
                  <div className="w-24"><Input placeholder="P.U (€)" type="number" value={line.unit_price} onChange={e => setLines(l => l.map((x, xi) => xi === i ? { ...x, unit_price: e.target.value } : x))} /></div>
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
            <Input label="TVA (%)" type="number" step="0.1" value={form.tax_rate} onChange={e => setForm(f => ({ ...f, tax_rate: e.target.value }))} />
            <Input label="Remise (€)" type="number" value={form.discount} onChange={e => setForm(f => ({ ...f, discount: e.target.value }))} />
            <Input label="Méthode de paiement" value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))} placeholder="Espèces, Virement..." />
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-600 dark:text-slate-400"><span>Sous-total HT</span><span>{subtotal.toFixed(2)} €</span></div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400"><span>TVA ({form.tax_rate}%)</span><span>{taxAmount.toFixed(2)} €</span></div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400"><span>Remise appliquée</span><span>-{(parseFloat(form.discount) || 0).toFixed(2)} €</span></div>
            <div className="flex justify-between font-bold text-slate-800 dark:text-slate-100 text-base border-t border-slate-200 dark:border-slate-700 pt-1.5"><span>Montant TTC</span><span>{total.toFixed(2)} €</span></div>
          </div>
          <Textarea label="Notes & Conditions de règlement" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Conditions de paiement, RIB..." />
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)} className="flex-1 justify-center">Annuler</Button>
            <Button onClick={handleSave} loading={saving} className="flex-1 justify-center">Enregistrer</Button>
          </div>
        </div>
      </Modal>

      {/* MODAL : VISUALISATION ET REÇU PRÊT POUR IMPRESSION (PDF READY) */}
      {detailInvoice && (
        <Modal open={!!detailInvoice} onClose={() => setDetailInvoice(null)} title="Aperçu avant Impression" size="lg">
          <div>
            <div className="flex gap-2 mb-6 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
              <Button icon={<Printer className="w-4 h-4" />} onClick={handlePrint}>Lancer l'impression PDF</Button>
              <Button variant="outline" icon={<MessageCircle className="w-4 h-4" />} onClick={() => handleWhatsApp(detailInvoice)}>Envoyer par WhatsApp</Button>
            </div>
            
            <div ref={printRef} className="bg-white p-2 text-slate-800">
              {/* EN-TÊTE PROFESSIONNEL TRUCKGARAGE PRO */}
              <div className="header-container">
                <div>
                  <h1 className="brand-title">MPL — Mécanique Poids Lourds</h1>
                  <p className="brand-subtitle font-mono">Réparation & Maintenance Industrielle</p>
                  <p className="brand-details">
                    Zone Artisanale des Transports<br />
                    Tél: +33 6 69 00 56 51 · ml.77.mpl@gmail.com<br />
                    Siret: 123 456 789 00012 — Code APE 4520B
                  </p>
                </div>
                <div className="invoice-title-container">
                  <h2 className="invoice-head">Facture</h2>
                  <p className="invoice-number">{detailInvoice.invoice_number}</p>
                  <div style={{ textTransform: 'uppercase', fontSize: '11px', fontWeight: 'bold', letterSpacing: '0.5px', marginTop: '6px' }}>
                    Statut : {statusLabel(detailInvoice.status)}
                  </div>
                </div>
              </div>

              {/* GRILLE D'INFORMATION EMETTEUR / CLIENT */}
              <div className="info-grid">
                <div className="info-block">
                  <div className="block-label">Facturé à :</div>
                  <p className="info-text" style={{ fontWeight: 'bold', fontSize: '14px', color: '#0f172a' }}>{detailInvoice.company?.name}</p>
                  <p className="info-text">{detailInvoice.company?.address}</p>
                  <p className="info-text">Tél: {detailInvoice.company?.phone}</p>
                </div>
                
                <div className="info-block" style={{ textAlign: 'right' }}>
                  <div className="block-label">Détails administratifs :</div>
                  <p className="info-text"><strong>Date d'émission :</strong> {detailInvoice.issue_date}</p>
                  {detailInvoice.due_date && <p className="info-text"><strong>Date d'échéance :</strong> {detailInvoice.due_date}</p>}
                  
                  {detailInvoice.job?.truck && (
                    <div className="vehicle-badge" style={{ textAlign: 'left' }}>
                      <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '2px' }}>Véhicule pris en charge :</span>
                      <strong style={{ fontSize: '13px', color: '#1e293b' }}>{detailInvoice.job.truck.make} {detailInvoice.job.truck.model}</strong>
                      <span style={{ fontFamily: 'monospace', display: 'block', fontSize: '12px', color: '#ea580c', fontWeight: 'bold', marginTop: '2px' }}>Matricule : {detailInvoice.job.truck.plate_number}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* TABLEAU DES LIGNES COMPTABLES */}
              {detailInvoice.lines && detailInvoice.lines.length > 0 && (
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Désignation des travaux / pièces</th>
                        <th style={{ width: '80px' }}>Qté</th>
                        <th style={{ width: '110px' }}>Prix Unitaire</th>
                        <th style={{ width: '120px' }}>Total HT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailInvoice.lines.map(line => (
                        <tr key={line.id}>
                          <td>
                            <div style={{ fontWeight: '600', color: '#0f172a' }}>{line.description}</div>
                            <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>Type: {line.item_type}</span>
                          </td>
                          <td>{line.quantity}</td>
                          <td>{line.unit_price.toFixed(2)} €</td>
                          <td style={{ fontWeight: '600' }}>{line.total.toFixed(2)} €</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* CADRE DES TOTALISATIONS FINANCIÈRES */}
              <div className="totals-container">
                <div className="totals-box">
                  <div className="total-row">
                    <span>Total Général HT :</span>
                    <span style={{ fontWeight: '600', color: '#334155' }}>{detailInvoice.subtotal.toFixed(2)} €</span>
                  </div>
                  {detailInvoice.tax_rate > 0 && (
                    <div className="total-row">
                      <span>TVA ({detailInvoice.tax_rate}%) :</span>
                      <span style={{ fontWeight: '600', color: '#334155' }}>{detailInvoice.tax_amount.toFixed(2)} €</span>
                    </div>
                  )}
                  {detailInvoice.discount > 0 && (
                    <div className="total-row" style={{ color: '#dc2626' }}>
                      <span>Remise exceptionnelle :</span>
                      <span>-{detailInvoice.discount.toFixed(2)} €</span>
                    </div>
                  )}
                  <div className="total-row total-grand">
                    <span>Net à Payer TTC :</span>
                    <span>{detailInvoice.total.toFixed(2)} €</span>
                  </div>
                  {detailInvoice.payment_method && (
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '6px', textAlign: 'right', fontStyle: 'italic' }}>
                      Mode de règlement : {detailInvoice.payment_method}
                    </div>
                  )}
                </div>
              </div>

              {/* BLOC NOTES */}
              {detailInvoice.notes && (
                <div className="notes-box">
                  <strong style={{ display: 'block', marginBottom: '4px', color: '#0f172a', textTransform: 'uppercase', fontSize: '11px' }}>Notes & Conditions de règlement :</strong>
                  {detailInvoice.notes}
                </div>
              )}

              {/* ESPACE DE SIGNATURE DE SÉCURITÉ */}
              <div className="signatures">
                <div className="sig-block">
                  <div className="sig-line">Cachet et Signature du Garage</div>
                </div>
                <div className="sig-block">
                  <div className="sig-line">Bon pour Accord — Signature Client</div>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </Layout>
  );
}