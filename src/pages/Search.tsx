import { useState } from 'react';
import { Layout } from '../components/layout/Layout';
import { Card } from '../components/ui/Card';
import { Badge, statusVariant } from '../components/ui/Badge';
import { useApp } from '../contexts/AppContext';
import { supabase } from '../lib/supabase';
import { Company, Truck, RepairJob, Invoice } from '../lib/database.types';
import { Search as SearchIcon, Building2, Truck as TruckIcon, ClipboardList, FileText } from 'lucide-react';

interface SearchResults {
  companies: Company[];
  trucks: (Truck & { company?: Company })[];
  jobs: (RepairJob & { company?: Company; truck?: Truck })[];
  invoices: (Invoice & { company?: Company })[];
}

export function Search() {
  const { t } = useApp();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (q: string) => {
    setQuery(q);
    if (q.trim().length < 2) { setResults(null); return; }
    setLoading(true);
    const [compRes, truckRes, jobsRes, invRes] = await Promise.all([
      supabase.from('companies').select('*').or(`name.ilike.%${q}%,phone.ilike.%${q}%,city.ilike.%${q}%`).limit(5),
      supabase.from('trucks').select('*, companies(name)').or(`plate_number.ilike.%${q}%,vin.ilike.%${q}%,make.ilike.%${q}%,model.ilike.%${q}%`).limit(5),
      supabase.from('repair_jobs').select('*, companies(name), trucks(make,model,plate_number)').or(`job_number.ilike.%${q}%,problem_description.ilike.%${q}%`).limit(5),
      supabase.from('invoices').select('*, companies(name)').or(`invoice_number.ilike.%${q}%`).limit(5),
    ]);
    setResults({
      companies: compRes.data || [],
      trucks: (truckRes.data || []).map((truck: Truck & { companies?: Company }) => ({ ...truck, company: truck.companies })),
      jobs: (jobsRes.data || []).map((job: RepairJob & { companies?: Company; trucks?: Truck }) => ({ ...job, company: job.companies, truck: job.trucks })),
      invoices: (invRes.data || []).map((invoice: Invoice & { companies?: Company }) => ({ ...invoice, company: invoice.companies })),
    });
    setLoading(false);
  };

  const total = results ? results.companies.length + results.trucks.length + results.jobs.length + results.invoices.length : 0;
  const truckStatusLabel = (status: string) => ({ active: t('active'), in_repair: t('inRepair'), retired: t('retired') }[status] || status);
  const jobStatusLabel = (status: string) => ({ pending: t('pending'), in_progress: t('inProgress'), completed: t('completed'), cancelled: t('cancelled') }[status] || status);
  const invoiceStatusLabel = (status: string) => ({ draft: t('draft'), sent: t('sent'), paid: t('paid'), overdue: t('overdue'), cancelled: t('cancelled') }[status] || status);

  return (
    <Layout title={t('search')}>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="relative">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={e => handleSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            autoFocus
            className="w-full rounded-2xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 pl-12 pr-4 py-4 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/20 shadow-sm text-base"
          />
          {loading && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {results && total === 0 && (
          <Card className="p-10 text-center">
            <SearchIcon className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-slate-500 dark:text-slate-400">{t('noData')}</p>
          </Card>
        )}

        {results && results.companies.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5"><Building2 className="w-4 h-4" />{t('companies')}</p>
            <div className="space-y-2">
              {results.companies.map(c => (
                <Card key={c.id} className="p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => { window.history.pushState({}, '', `/companies/${c.id}`); window.dispatchEvent(new PopStateEvent('popstate')); }}>
                  <div className="flex items-center gap-3">
                    <Building2 className="w-5 h-5 text-orange-500 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-slate-800 dark:text-slate-200">{c.name}</p>
                      <p className="text-xs text-slate-500">{c.city} · {c.phone}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {results && results.trucks.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5"><TruckIcon className="w-4 h-4" />{t('trucks')}</p>
            <div className="space-y-2">
              {results.trucks.map(tr => (
                <Card key={tr.id} className="p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => { window.history.pushState({}, '', `/trucks/${tr.id}`); window.dispatchEvent(new PopStateEvent('popstate')); }}>
                  <div className="flex items-center gap-3">
                    <TruckIcon className="w-5 h-5 text-slate-500 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-slate-800 dark:text-slate-200">{tr.make} {tr.model} <span className="font-mono text-orange-500">({tr.plate_number})</span></p>
                      <p className="text-xs text-slate-500">{tr.company?.name} · VIN: {tr.vin || '—'}</p>
                    </div>
                    <Badge variant={statusVariant(tr.status)}>{truckStatusLabel(tr.status)}</Badge>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {results && results.jobs.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5"><ClipboardList className="w-4 h-4" />{t('jobs')}</p>
            <div className="space-y-2">
              {results.jobs.map(j => (
                <Card key={j.id} className="p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => { window.history.pushState({}, '', `/jobs`); window.dispatchEvent(new PopStateEvent('popstate')); }}>
                  <div className="flex items-center gap-3">
                    <ClipboardList className="w-5 h-5 text-orange-500 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium font-mono text-slate-800 dark:text-slate-200">{j.job_number}</p>
                      <p className="text-xs text-slate-500">{j.company?.name} · {j.truck?.plate_number}</p>
                    </div>
                    <Badge variant={statusVariant(j.status)}>{jobStatusLabel(j.status)}</Badge>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {results && results.invoices.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5"><FileText className="w-4 h-4" />{t('invoices')}</p>
            <div className="space-y-2">
              {results.invoices.map(inv => (
                <Card key={inv.id} className="p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => { window.history.pushState({}, '', `/invoices`); window.dispatchEvent(new PopStateEvent('popstate')); }}>
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-sky-500 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium font-mono text-slate-800 dark:text-slate-200">{inv.invoice_number}</p>
                      <p className="text-xs text-slate-500">{inv.company?.name} · {inv.total.toFixed(2)} EUR</p>
                    </div>
                    <Badge variant={statusVariant(inv.status)}>{invoiceStatusLabel(inv.status)}</Badge>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {!results && (
          <div className="text-center py-12 text-slate-400 dark:text-slate-500">
            <SearchIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">{t('typeToSearch')}</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
