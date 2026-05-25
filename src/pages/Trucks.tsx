import { useEffect, useState } from 'react';
import { Layout } from '../components/layout/Layout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input, Textarea, Select } from '../components/ui/Input';
import { Badge, statusVariant } from '../components/ui/Badge';
import { useApp } from '../contexts/AppContext';
import { db } from '../lib/storage';
import { Truck, Company } from '../lib/database.types';
import { Plus, Truck as TruckIcon, Pencil, Trash2, Eye, Hash, Gauge } from 'lucide-react';

const emptyForm = {
  company_id: '', make: '', model: '', year: '', plate_number: '', vin: '',
  mileage: '0', status: 'active' as Truck['status'], color: '', notes: '',
};

export function Trucks() {
  const { t } = useApp();
  const [trucks,    setTrucks]    = useState<(Truck & { company?: Company })[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem,  setEditItem]  = useState<Truck | null>(null);
  const [form,      setForm]      = useState(emptyForm);
  const [saving,    setSaving]    = useState(false);
  const [search,    setSearch]    = useState('');
  const [filterCompany, setFilterCompany] = useState('');

  const load = () => {
    const allTrucks    = db.getAll<Truck>('trucks')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const allCompanies = db.getAll<Company>('companies')
      .sort((a, b) => a.name.localeCompare(b.name));

    setTrucks(allTrucks.map(tr => ({
      ...tr,
      company: allCompanies.find(c => c.id === tr.company_id),
    })));
    setCompanies(allCompanies);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditItem(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit   = (truck: Truck) => {
    setEditItem(truck);
    setForm({
      company_id: truck.company_id, make: truck.make, model: truck.model,
      year: String(truck.year || ''), plate_number: truck.plate_number, vin: truck.vin,
      mileage: String(truck.mileage), status: truck.status, color: truck.color, notes: truck.notes,
    });
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!form.plate_number.trim() || !form.company_id) return;
    setSaving(true);
    const payload = {
      company_id:   form.company_id,
      make:         form.make,
      model:        form.model,
      year:         form.year ? parseInt(form.year) : null,
      plate_number: form.plate_number,
      vin:          form.vin,
      mileage:      parseInt(form.mileage) || 0,
      status:       form.status,
      color:        form.color,
      notes:        form.notes,
    };
    if (editItem) {
      db.update('trucks', editItem.id, payload);
    } else {
      db.insert('trucks', payload);
    }
    setSaving(false);
    setModalOpen(false);
    load();
  };

  const handleDelete = (id: string) => {
    if (!confirm('Delete this truck?')) return;
    db.remove('trucks', id);
    load();
  };

  const statusOptions = [
    { value: 'active',    label: t('active')   },
    { value: 'in_repair', label: t('inRepair') },
    { value: 'retired',   label: t('retired')  },
  ];
  const statusLabel = (s: string) => statusOptions.find(o => o.value === s)?.label || s;

  const filtered = trucks.filter(tr => {
    const q = search.toLowerCase();
    const matchSearch  = !q
      || tr.plate_number.toLowerCase().includes(q)
      || tr.vin.toLowerCase().includes(q)
      || tr.make.toLowerCase().includes(q)
      || tr.model.toLowerCase().includes(q)
      || tr.company?.name.toLowerCase().includes(q);
    const matchCompany = !filterCompany || tr.company_id === filterCompany;
    return matchSearch && matchCompany;
  });

  return (
    <Layout title={t('trucks')}>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Search plate, VIN, make, model..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/20"
          />
          <select
            value={filterCompany}
            onChange={e => setFilterCompany(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/20"
          >
            <option value="">All Companies</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <Button icon={<Plus className="w-4 h-4" />} onClick={openCreate}>{t('addTruck')}</Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48 text-slate-400">
            <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mr-3" />{t('loading')}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center">
            <TruckIcon className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500 dark:text-slate-400">{t('noData')}</p>
            <Button className="mt-4" icon={<Plus className="w-4 h-4" />} onClick={openCreate}>{t('addTruck')}</Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(truck => (
              <Card key={truck.id} className="p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center flex-shrink-0">
                      <TruckIcon className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{truck.make} {truck.model}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{truck.company?.name}</p>
                    </div>
                  </div>
                  <Badge variant={statusVariant(truck.status)}>{statusLabel(truck.status)}</Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <Hash className="w-3.5 h-3.5 text-orange-400" />
                    <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{truck.plate_number}</span>
                  </div>
                  {truck.year && <div className="text-xs text-slate-500 dark:text-slate-400">{truck.year}</div>}
                  {truck.mileage > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <Gauge className="w-3.5 h-3.5" />{truck.mileage.toLocaleString()} km
                    </div>
                  )}
                  {truck.vin && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate col-span-2">VIN: {truck.vin}</div>
                  )}
                </div>

                <div className="flex gap-2 pt-3 mt-2 border-t border-slate-100 dark:border-slate-700/50">
                  <button
                    onClick={() => { window.history.pushState({}, '', `/trucks/${truck.id}`); window.dispatchEvent(new PopStateEvent('popstate')); }}
                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-sky-600 transition-colors px-2 py-1 rounded"
                  >
                    <Eye className="w-3.5 h-3.5" /> View
                  </button>
                  <button onClick={() => openEdit(truck)} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-orange-600 transition-colors px-2 py-1 rounded">
                    <Pencil className="w-3.5 h-3.5" /> {t('edit')}
                  </button>
                  <button onClick={() => handleDelete(truck.id)} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-600 transition-colors px-2 py-1 rounded ml-auto">
                    <Trash2 className="w-3.5 h-3.5" /> {t('delete')}
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Edit Truck' : t('addTruck')} size="lg">
        <div className="space-y-4">
          <Select
            label={t('company') + ' *'}
            value={form.company_id}
            onChange={e => setForm(f => ({ ...f, company_id: e.target.value }))}
            options={[{ value: '', label: 'Select company...' }, ...companies.map(c => ({ value: c.id, label: c.name }))]}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('make')}  value={form.make}  onChange={e => setForm(f => ({ ...f, make:  e.target.value }))} placeholder="Mercedes, Volvo..." />
            <Input label={t('model')} value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} placeholder="Actros, FH16..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('plateNumber') + ' *'} value={form.plate_number} onChange={e => setForm(f => ({ ...f, plate_number: e.target.value }))} placeholder="ABC-1234" />
            <Input label={t('year')} type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} placeholder="2020" min="1980" max="2030" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('vin')}     value={form.vin}     onChange={e => setForm(f => ({ ...f, vin:     e.target.value }))} placeholder="1HGBH41JXMN109186" />
            <Input label={t('mileage')} type="number" value={form.mileage} onChange={e => setForm(f => ({ ...f, mileage: e.target.value }))} placeholder="50000" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label={t('status')} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Truck['status'] }))} options={statusOptions} />
            <Input label={t('color')}   value={form.color}  onChange={e => setForm(f => ({ ...f, color:  e.target.value }))} placeholder="White, Red..." />
          </div>
          <Textarea label={t('notes')} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Additional notes..." />
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)} className="flex-1 justify-center">{t('cancel')}</Button>
            <Button onClick={handleSave} loading={saving} className="flex-1 justify-center">{t('save')}</Button>
          </div>
        </div>
      </Modal>
    </Layout>
  );
}
