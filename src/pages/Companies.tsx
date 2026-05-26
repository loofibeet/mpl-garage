import { useEffect, useState } from 'react';
import { Layout } from '../components/layout/Layout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input, Textarea } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { useApp } from '../contexts/AppContext';
import { db } from '../lib/storage';
import { Company, Truck } from '../lib/database.types';
import { Plus, Building2, Phone, MapPin, Pencil, Trash2, Truck as TruckIcon, Eye } from 'lucide-react';

const emptyForm = { name: '', phone: '', email: '', address: '', city: '', notes: '' };

export function Companies() {
  const { t } = useApp();
  const [companies, setCompanies] = useState<(Company & { truck_count?: number })[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem,  setEditItem]  = useState<Company | null>(null);
  const [form,      setForm]      = useState(emptyForm);
  const [saving,    setSaving]    = useState(false);
  const [search,    setSearch]    = useState('');

  const load = () => {
    const allCompanies = db.getAll<Company>('companies').sort((a, b) => a.name.localeCompare(b.name));
    const allTrucks    = db.getAll<Truck>('trucks');
    setCompanies(allCompanies.map(c => ({ ...c, truck_count: allTrucks.filter(t => t.company_id === c.id).length })));
    setLoading(false);
  };

  useEffect(() => {
    load();
    window.addEventListener('firebase-synced', load);
    return () => window.removeEventListener('firebase-synced', load);
  }, []);

  const openCreate = () => { setEditItem(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit   = (c: Company) => { setEditItem(c); setForm({ name: c.name, phone: c.phone, email: c.email, address: c.address, city: c.city, notes: c.notes }); setModalOpen(true); };

  const handleSave = () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = { ...form, city: '' };
    if (editItem) { db.update('companies', editItem.id, payload); }
    else { db.insert('companies', payload); }
    setSaving(false); setModalOpen(false); load();
  };

  const handleDelete = (id: string) => {
    if (!confirm(t('deleteCompanyConfirm'))) return;
    db.remove('companies', id); load();
  };

  const filtered = companies.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.address.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout title={t('companies')}>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <input type="text" placeholder={t('searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/20" />
          <Button icon={<Plus className="w-4 h-4" />} onClick={openCreate}>{t('addCompany')}</Button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-48 text-slate-400"><div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mr-3" />{t('loading')}</div>
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center"><Building2 className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" /><p className="text-slate-500 dark:text-slate-400">{t('noData')}</p><Button className="mt-4" icon={<Plus className="w-4 h-4" />} onClick={openCreate}>{t('addCompany')}</Button></Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(company => (
              <Card key={company.id} className="p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center flex-shrink-0"><Building2 className="w-5 h-5 text-orange-600 dark:text-orange-400" /></div>
                    <div><h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm leading-tight">{company.name}</h3></div>
                  </div>
                  <Badge variant="info" className="flex-shrink-0"><TruckIcon className="w-3 h-3 mr-1" />{company.truck_count || 0}</Badge>
                </div>
                {company.phone && <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1"><Phone className="w-3.5 h-3.5" />{company.phone}</div>}
                {company.address && <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-3"><MapPin className="w-3.5 h-3.5" />{company.address}</div>}
                <div className="flex gap-2 pt-3 border-t border-slate-100 dark:border-slate-700/50">
                  <button onClick={() => { window.history.pushState({}, '', `/companies/${company.id}`); window.dispatchEvent(new PopStateEvent('popstate')); }} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-sky-600 dark:hover:text-sky-400 transition-colors px-2 py-1 rounded"><Eye className="w-3.5 h-3.5" /> {t('view')}</button>
                  <button onClick={() => openEdit(company)} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-orange-600 dark:hover:text-orange-400 transition-colors px-2 py-1 rounded"><Pencil className="w-3.5 h-3.5" /> {t('edit')}</button>
                  <button onClick={() => handleDelete(company.id)} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-600 dark:hover:text-red-400 transition-colors px-2 py-1 rounded ml-auto"><Trash2 className="w-3.5 h-3.5" /> {t('delete')}</button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? `${t('editCompanyTitle')}: ${editItem.name}` : t('addCompany')}>
        <div className="space-y-4">
          <Input label={t('name') + ' *'} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Dally Trans" />
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('phone')} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+1 234 567 890" />
            <Input label={t('email')} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="info@company.com" />
          </div>
          <Input label={t('address')} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder={t('address')} />
          <Textarea label={t('notes')} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} placeholder={t('notes')} />
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)} className="flex-1 justify-center">{t('cancel')}</Button>
            <Button onClick={handleSave} loading={saving} className="flex-1 justify-center">{t('save')}</Button>
          </div>
        </div>
      </Modal>
    </Layout>
  );
}
