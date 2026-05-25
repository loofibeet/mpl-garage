import { useEffect, useState } from 'react';
import { Layout } from '../components/layout/Layout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input, Textarea, Select } from '../components/ui/Input';
import { Badge, statusVariant, priorityVariant } from '../components/ui/Badge';
import { useApp } from '../contexts/AppContext';
import { db } from '../lib/storage';
import { RepairJob, Company, Truck, Worker, JobPart, JobWorker } from '../lib/database.types';
import { Plus, ClipboardList, Calendar, Wrench, Trash2, Pencil, Eye, X } from 'lucide-react';

function generateJobNumber() {
  const now = new Date();
  return `JOB-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 9000) + 1000}`;
}

function removeWhere(table: string, field: string, value: string) {
  const rows = db.getAll<Record<string, unknown>>(table);
  localStorage.setItem(`garage_${table}`, JSON.stringify(rows.filter(r => r[field] !== value)));
}

const emptyForm = {
  job_number: '', truck_id: '', company_id: '', status: 'pending' as RepairJob['status'],
  priority: 'normal' as RepairJob['priority'], problem_description: '', diagnostics: '',
  repairs_completed: '', start_date: new Date().toISOString().split('T')[0], end_date: '',
  estimated_hours: '0', actual_hours: '0', notes: '',
};
const emptyPart = { part_name: '', part_number: '', quantity: '1', unit_price: '0', notes: '' };

export function Jobs() {
  const { t } = useApp();
  const [jobs,      setJobs]      = useState<(RepairJob & { company?: Company; truck?: Truck })[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [trucks,    setTrucks]    = useState<Truck[]>([]);
  const [workers,   setWorkers]   = useState<Worker[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailJob, setDetailJob] = useState<(RepairJob & { company?: Company; truck?: Truck }) | null>(null);
  const [detailParts,   setDetailParts]   = useState<JobPart[]>([]);
  const [detailWorkers, setDetailWorkers] = useState<(JobWorker & { worker?: Worker })[]>([]);
  const [editItem,  setEditItem]  = useState<RepairJob | null>(null);
  const [form,      setForm]      = useState(emptyForm);
  const [parts,     setParts]     = useState<typeof emptyPart[]>([]);
  const [assignedWorkers, setAssignedWorkers] = useState<{ worker_id: string; hours_worked: string }[]>([]);
  const [saving,    setSaving]    = useState(false);
  const [search,    setSearch]    = useState('');
  const [filterStatus,   setFilterStatus]   = useState('');
  const [filteredTrucks, setFilteredTrucks] = useState<Truck[]>([]);

  const load = () => {
    const allJobs      = db.getAll<RepairJob>('repair_jobs').sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const allCompanies = db.getAll<Company>('companies').sort((a, b) => a.name.localeCompare(b.name));
    const allTrucks    = db.getAll<Truck>('trucks').sort((a, b) => a.plate_number.localeCompare(b.plate_number));
    const allWorkers   = db.getAll<Worker>('workers').filter(w => w.status === 'active').sort((a, b) => a.name.localeCompare(b.name));
    setJobs(allJobs.map(j => ({ ...j, company: allCompanies.find(c => c.id === j.company_id), truck: allTrucks.find(t => t.id === j.truck_id) })));
    setCompanies(allCompanies);
    setTrucks(allTrucks);
    setWorkers(allWorkers);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditItem(null); setForm({ ...emptyForm, job_number: generateJobNumber() }); setParts([]); setAssignedWorkers([]); setModalOpen(true); };

  const openEdit = (job: RepairJob) => {
    setEditItem(job);
    setForm({ job_number: job.job_number, truck_id: job.truck_id, company_id: job.company_id, status: job.status, priority: job.priority, problem_description: job.problem_description, diagnostics: job.diagnostics, repairs_completed: job.repairs_completed, start_date: job.start_date, end_date: job.end_date || '', estimated_hours: String(job.estimated_hours), actual_hours: String(job.actual_hours), notes: job.notes });
    const existingParts = db.getAll<JobPart>('job_parts').filter(p => p.job_id === job.id);
    const existingJW    = db.getAll<JobWorker>('job_workers').filter(jw => jw.job_id === job.id);
    setParts(existingParts.map(p => ({ part_name: p.part_name, part_number: p.part_number, quantity: String(p.quantity), unit_price: String(p.unit_price), notes: p.notes })));
    setAssignedWorkers(existingJW.map(jw => ({ worker_id: jw.worker_id, hours_worked: String(jw.hours_worked) })));
    setFilteredTrucks(trucks.filter(t => t.company_id === job.company_id));
    setModalOpen(true);
  };

  const handleCompanyChange = (companyId: string) => { setForm(f => ({ ...f, company_id: companyId, truck_id: '' })); setFilteredTrucks(trucks.filter(t => t.company_id === companyId)); };

  const handleSave = () => {
    if (!form.truck_id || !form.company_id || !form.job_number) return;
    setSaving(true);
    const payload = { job_number: form.job_number, truck_id: form.truck_id, company_id: form.company_id, status: form.status, priority: form.priority, problem_description: form.problem_description, diagnostics: form.diagnostics, repairs_completed: form.repairs_completed, start_date: form.start_date, end_date: form.end_date || null, estimated_hours: parseFloat(form.estimated_hours) || 0, actual_hours: parseFloat(form.actual_hours) || 0, notes: form.notes };
    let jobId: string;
    if (editItem) { db.update('repair_jobs', editItem.id, payload); jobId = editItem.id; }
    else { const newJob = db.insert('repair_jobs', payload); jobId = newJob.id; }
    removeWhere('job_parts', 'job_id', jobId);
    parts.filter(p => p.part_name).forEach(p => db.insert('job_parts', { job_id: jobId, part_name: p.part_name, part_number: p.part_number, quantity: parseFloat(p.quantity) || 1, unit_price: parseFloat(p.unit_price) || 0, notes: p.notes }));
    removeWhere('job_workers', 'job_id', jobId);
    assignedWorkers.filter(w => w.worker_id).forEach(w => db.insert('job_workers', { job_id: jobId, worker_id: w.worker_id, hours_worked: parseFloat(w.hours_worked) || 0, notes: '' }));
    setSaving(false); setModalOpen(false); load();
  };

  const openDetail = (job: RepairJob & { company?: Company; truck?: Truck }) => {
    setDetailJob(job);
    const allWorkers = db.getAll<Worker>('workers');
    setDetailParts(db.getAll<JobPart>('job_parts').filter(p => p.job_id === job.id));
    setDetailWorkers(db.getAll<JobWorker>('job_workers').filter(jw => jw.job_id === job.id).map(jw => ({ ...jw, worker: allWorkers.find(w => w.id === jw.worker_id) })));
  };

  const handleDelete = (id: string) => {
    if (!confirm('Delete this work order?')) return;
    removeWhere('job_parts', 'job_id', id); removeWhere('job_workers', 'job_id', id); db.remove('repair_jobs', id); load();
  };

  const filtered = jobs.filter(j => { const q = search.toLowerCase(); return (!q || j.job_number.toLowerCase().includes(q) || j.company?.name.toLowerCase().includes(q) || j.truck?.plate_number.toLowerCase().includes(q)) && (!filterStatus || j.status === filterStatus); });

  const statusOptions   = [{ value: 'pending', label: t('pending') }, { value: 'in_progress', label: t('inProgress') }, { value: 'completed', label: t('completed') }, { value: 'cancelled', label: t('cancelled') }];
  const priorityOptions = [{ value: 'low', label: t('low') }, { value: 'normal', label: t('normal') }, { value: 'high', label: t('high') }, { value: 'urgent', label: t('urgent') }];
  const statusLabel   = (s: string) => statusOptions.find(o => o.value === s)?.label || s;
  const priorityLabel = (p: string) => priorityOptions.find(o => o.value === p)?.label || p;

  return (
    <Layout title={t('jobs')}>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <input type="text" placeholder="Search job #, company, plate..." value={search} onChange={e => setSearch(e.target.value)} className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/20" />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/20">
            <option value="">All Status</option>
            {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <Button icon={<Plus className="w-4 h-4" />} onClick={openCreate}>{t('addJob')}</Button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-48 text-slate-400"><div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mr-3" />{t('loading')}</div>
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center"><ClipboardList className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" /><p className="text-slate-500 dark:text-slate-400">{t('noData')}</p><Button className="mt-4" icon={<Plus className="w-4 h-4" />} onClick={openCreate}>{t('addJob')}</Button></Card>
        ) : (
          <div className="space-y-3">
            {filtered.map(job => (
              <Card key={job.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-orange-50 dark:bg-orange-900/20 rounded-xl flex items-center justify-center flex-shrink-0"><Wrench className="w-5 h-5 text-orange-500" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{job.job_number}</span>
                      <Badge variant={statusVariant(job.status)}>{statusLabel(job.status)}</Badge>
                      <Badge variant={priorityVariant(job.priority)}>{priorityLabel(job.priority)}</Badge>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{job.company?.name} · {job.truck?.make} {job.truck?.model} · <span className="font-mono">{job.truck?.plate_number}</span></p>
                    {job.problem_description && <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 line-clamp-2">{job.problem_description}</p>}
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{job.start_date}</span>
                      {job.actual_hours > 0 && <span>{job.actual_hours}h</span>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <button onClick={() => openDetail(job)} className="p-1.5 text-slate-400 hover:text-sky-600 rounded transition-colors"><Eye className="w-4 h-4" /></button>
                    <button onClick={() => openEdit(job)} className="p-1.5 text-slate-400 hover:text-orange-600 rounded transition-colors"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(job.id)} className="p-1.5 text-slate-400 hover:text-red-600 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Edit Work Order' : t('addJob')} size="xl">
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('jobNumber') + ' *'} value={form.job_number} onChange={e => setForm(f => ({ ...f, job_number: e.target.value }))} />
            <Select label={t('priority')} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as RepairJob['priority'] }))} options={priorityOptions} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label={t('company') + ' *'} value={form.company_id} onChange={e => handleCompanyChange(e.target.value)} options={[{ value: '', label: 'Select company...' }, ...companies.map(c => ({ value: c.id, label: c.name }))]} />
            <Select label={t('truck') + ' *'} value={form.truck_id} onChange={e => setForm(f => ({ ...f, truck_id: e.target.value }))} options={[{ value: '', label: 'Select truck...' }, ...(filteredTrucks.length > 0 ? filteredTrucks : trucks.filter(t => !form.company_id || t.company_id === form.company_id)).map(t => ({ value: t.id, label: `${t.plate_number} — ${t.make} ${t.model}` }))]} />
          </div>
          <Select label={t('status')} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as RepairJob['status'] }))} options={statusOptions} />
          <Textarea label={t('problemDescription')} value={form.problem_description} onChange={e => setForm(f => ({ ...f, problem_description: e.target.value }))} rows={2} />
          <Textarea label={t('diagnostics')} value={form.diagnostics} onChange={e => setForm(f => ({ ...f, diagnostics: e.target.value }))} rows={2} />
          <Textarea label={t('repairsCompleted')} value={form.repairs_completed} onChange={e => setForm(f => ({ ...f, repairs_completed: e.target.value }))} rows={2} />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Input label={t('startDate')} type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
            <Input label={t('endDate')} type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
            <Input label={t('estimatedHours')} type="number" step="0.5" value={form.estimated_hours} onChange={e => setForm(f => ({ ...f, estimated_hours: e.target.value }))} />
            <Input label={t('actualHours')} type="number" step="0.5" value={form.actual_hours} onChange={e => setForm(f => ({ ...f, actual_hours: e.target.value }))} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('parts')}</label>
              <Button size="sm" variant="outline" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setParts(p => [...p, { ...emptyPart }])}>{t('addPart')}</Button>
            </div>
            <div className="space-y-2">
              {parts.map((part, i) => (
                <div key={i} className="flex gap-2 items-end">
                  <div className="flex-1"><Input placeholder="Part name" value={part.part_name} onChange={e => setParts(p => p.map((x, xi) => xi === i ? { ...x, part_name: e.target.value } : x))} /></div>
                  <div className="w-24"><Input placeholder="Qty" type="number" value={part.quantity} onChange={e => setParts(p => p.map((x, xi) => xi === i ? { ...x, quantity: e.target.value } : x))} /></div>
                  <div className="w-24"><Input placeholder="Price" type="number" value={part.unit_price} onChange={e => setParts(p => p.map((x, xi) => xi === i ? { ...x, unit_price: e.target.value } : x))} /></div>
                  <button onClick={() => setParts(p => p.filter((_, xi) => xi !== i))} className="p-2 text-red-400 hover:text-red-600 mb-0.5"><X className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('workers')}</label>
              <Button size="sm" variant="outline" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setAssignedWorkers(w => [...w, { worker_id: '', hours_worked: '0' }])}>{t('assignWorker')}</Button>
            </div>
            <div className="space-y-2">
              {assignedWorkers.map((aw, i) => (
                <div key={i} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <select value={aw.worker_id} onChange={e => setAssignedWorkers(w => w.map((x, xi) => xi === i ? { ...x, worker_id: e.target.value } : x))} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-orange-400 focus:outline-none">
                      <option value="">Select worker...</option>
                      {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                  <div className="w-28"><Input placeholder="Hours" type="number" step="0.5" value={aw.hours_worked} onChange={e => setAssignedWorkers(w => w.map((x, xi) => xi === i ? { ...x, hours_worked: e.target.value } : x))} /></div>
                  <button onClick={() => setAssignedWorkers(w => w.filter((_, xi) => xi !== i))} className="p-2 text-red-400 hover:text-red-600 mb-0.5"><X className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>
          <Textarea label={t('notes')} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)} className="flex-1 justify-center">{t('cancel')}</Button>
            <Button onClick={handleSave} loading={saving} className="flex-1 justify-center">{t('save')}</Button>
          </div>
        </div>
      </Modal>

      {detailJob && (
        <Modal open={!!detailJob} onClose={() => setDetailJob(null)} title={`Work Order: ${detailJob.job_number}`} size="lg">
          <div className="space-y-5">
            <div className="flex gap-2 flex-wrap">
              <Badge variant={statusVariant(detailJob.status)}>{statusLabel(detailJob.status)}</Badge>
              <Badge variant={priorityVariant(detailJob.priority)}>{priorityLabel(detailJob.priority)}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-slate-500 dark:text-slate-400 text-xs mb-1">{t('company')}</p><p className="font-medium text-slate-800 dark:text-slate-200">{detailJob.company?.name}</p></div>
              <div><p className="text-slate-500 dark:text-slate-400 text-xs mb-1">{t('truck')}</p><p className="font-medium text-slate-800 dark:text-slate-200">{detailJob.truck?.make} {detailJob.truck?.model} · <span className="font-mono">{detailJob.truck?.plate_number}</span></p></div>
              <div><p className="text-slate-500 dark:text-slate-400 text-xs mb-1">{t('startDate')}</p><p className="font-medium text-slate-800 dark:text-slate-200">{detailJob.start_date}</p></div>
              <div><p className="text-slate-500 dark:text-slate-400 text-xs mb-1">{t('actualHours')}</p><p className="font-medium text-slate-800 dark:text-slate-200">{detailJob.actual_hours}h</p></div>
            </div>
            {detailJob.problem_description && <div><p className="text-xs text-slate-500 mb-1 font-medium">{t('problemDescription')}</p><p className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 rounded-lg p-3">{detailJob.problem_description}</p></div>}
            {detailJob.diagnostics && <div><p className="text-xs text-slate-500 mb-1 font-medium">{t('diagnostics')}</p><p className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 rounded-lg p-3">{detailJob.diagnostics}</p></div>}
            {detailJob.repairs_completed && <div><p className="text-xs text-slate-500 mb-1 font-medium">{t('repairsCompleted')}</p><p className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 rounded-lg p-3">{detailJob.repairs_completed}</p></div>}
            {detailParts.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 mb-2 font-medium">{t('parts')}</p>
                <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800"><tr><th className="text-left px-3 py-2 text-xs font-medium text-slate-500">{t('partName')}</th><th className="text-right px-3 py-2 text-xs font-medium text-slate-500">{t('quantity')}</th><th className="text-right px-3 py-2 text-xs font-medium text-slate-500">{t('unitPrice')}</th><th className="text-right px-3 py-2 text-xs font-medium text-slate-500">{t('total')}</th></tr></thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                      {detailParts.map(p => (<tr key={p.id}><td className="px-3 py-2 text-slate-700 dark:text-slate-300">{p.part_name}</td><td className="px-3 py-2 text-right text-slate-600 dark:text-slate-400">{p.quantity}</td><td className="px-3 py-2 text-right text-slate-600 dark:text-slate-400">${p.unit_price.toFixed(2)}</td><td className="px-3 py-2 text-right font-medium text-slate-700 dark:text-slate-300">${(p.quantity * p.unit_price).toFixed(2)}</td></tr>))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {detailWorkers.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 mb-2 font-medium">{t('workers')}</p>
                <div className="flex flex-wrap gap-2">
                  {detailWorkers.map(jw => (<div key={jw.id} className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-1.5 text-sm"><span className="font-medium text-slate-700 dark:text-slate-200">{jw.worker?.name}</span><span className="text-slate-500 dark:text-slate-400">· {jw.hours_worked}h</span></div>))}
                </div>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" icon={<Pencil className="w-4 h-4" />} onClick={() => { setDetailJob(null); openEdit(detailJob); }}>{t('edit')}</Button>
              <Button icon={<Wrench className="w-4 h-4" />} onClick={() => { setDetailJob(null); window.history.pushState({}, '', `/invoices/new?job=${detailJob.id}`); window.dispatchEvent(new PopStateEvent('popstate')); }}>{t('generateInvoice')}</Button>
            </div>
          </div>
        </Modal>
      )}
    </Layout>
  );
}
