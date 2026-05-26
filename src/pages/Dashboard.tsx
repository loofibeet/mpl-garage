import { useEffect, useState, useCallback } from 'react';
import { Layout } from '../components/layout/Layout';
import { StatCard, Card } from '../components/ui/Card';
import { Badge, statusVariant, priorityVariant } from '../components/ui/Badge';
import { useApp } from '../contexts/AppContext';
import { db } from '../lib/storage';
import { RepairJob, Company, Truck, Invoice } from '../lib/database.types';
import { ClipboardList, Truck as TruckIcon, Building2, FileText, AlertCircle, CheckCircle, Clock, Wrench } from 'lucide-react';

interface DashboardStats {
  totalJobs: number; activeJobs: number; pendingInvoices: number;
  totalRevenue: number; recentJobs: (RepairJob & { company?: Company; truck?: Truck })[]; todayJobs: number;
}

export function Dashboard() {
  const { t } = useApp();
  const [stats, setStats] = useState<DashboardStats>({ totalJobs: 0, activeJobs: 0, pendingInvoices: 0, totalRevenue: 0, recentJobs: [], todayJobs: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    const jobs      = db.getAll<RepairJob>('repair_jobs');
    const invoices  = db.getAll<Invoice>('invoices');
    const companies = db.getAll<Company>('companies');
    const trucks    = db.getAll<Truck>('trucks');
    const today     = new Date().toISOString().split('T')[0];
    const recentJobs = [...jobs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 8).map(job => ({ ...job, company: companies.find(c => c.id === job.company_id), truck: trucks.find(t => t.id === job.truck_id) }));
    setStats({ totalJobs: jobs.length, activeJobs: jobs.filter(j => j.status === 'in_progress').length, pendingInvoices: invoices.filter(i => ['draft', 'sent', 'overdue'].includes(i.status)).length, totalRevenue: invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.total || 0), 0), todayJobs: jobs.filter(j => j.start_date === today).length, recentJobs });
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    window.addEventListener('firebase-synced', load);
    return () => window.removeEventListener('firebase-synced', load);
  }, [load]);

  const priorityLabel = (p: string) => t(p as 'low' | 'normal' | 'high' | 'urgent');
  const statusLabel   = (s: string) => ({ pending: t('pending'), in_progress: t('inProgress'), completed: t('completed'), cancelled: t('cancelled') }[s] || s);

  return (
    <Layout title={t('dashboard')}>
      {loading ? (
        <div className="flex items-center justify-center h-64"><div className="flex items-center gap-3 text-slate-500 dark:text-slate-400"><div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />{t('loading')}</div></div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title={t('totalJobs')} value={stats.totalJobs} icon={<ClipboardList className="w-5 h-5 text-sky-600 dark:text-sky-400" />} iconBg="bg-sky-100 dark:bg-sky-900/30" />
            <StatCard title={t('activeJobs')} value={stats.activeJobs} icon={<Wrench className="w-5 h-5 text-orange-600 dark:text-orange-400" />} iconBg="bg-orange-100 dark:bg-orange-900/30" />
            <StatCard title={t('pendingInvoices')} value={stats.pendingInvoices} icon={<FileText className="w-5 h-5 text-amber-600 dark:text-amber-400" />} iconBg="bg-amber-100 dark:bg-amber-900/30" />
            <StatCard title={t('totalRevenue')} value={`$${stats.totalRevenue.toLocaleString()}`} icon={<CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />} iconBg="bg-emerald-100 dark:bg-emerald-900/30" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: <Clock className="w-4 h-4" />, label: t('todayJobs'), value: stats.todayJobs, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
              { icon: <AlertCircle className="w-4 h-4" />, label: t('inProgress'), value: stats.activeJobs, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20' },
              { icon: <TruckIcon className="w-4 h-4" />, label: t('pendingJobs'), value: stats.recentJobs.filter(j => j.status === 'pending').length, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
            ].map(item => (
              <Card key={item.label} className="p-4 flex items-center gap-4">
                <div className={`p-2.5 rounded-xl ${item.bg} ${item.color}`}>{item.icon}</div>
                <div><p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{item.value}</p><p className="text-xs text-slate-500 dark:text-slate-400">{item.label}</p></div>
              </Card>
            ))}
          </div>
          <Card>
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">{t('recentJobs')}</h3>
              <a href="/jobs" className="text-sm text-orange-500 hover:text-orange-600 font-medium">{t('viewAll')}</a>
            </div>
            {stats.recentJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400"><Building2 className="w-10 h-10 mb-3 opacity-40" /><p className="text-sm">{t('noData')}</p></div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {stats.recentJobs.map(job => (
                  <a key={job.id} href={`/jobs/${job.id}`} onClick={e => { e.preventDefault(); window.history.pushState({}, '', `/jobs/${job.id}`); window.dispatchEvent(new PopStateEvent('popstate')); }} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                    <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center flex-shrink-0"><TruckIcon className="w-5 h-5 text-slate-500 dark:text-slate-400" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2"><p className="font-medium text-slate-800 dark:text-slate-200 text-sm truncate">{job.job_number}</p><Badge variant={priorityVariant(job.priority)} className="flex-shrink-0">{priorityLabel(job.priority)}</Badge></div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{job.company?.name || '—'} · {job.truck?.make} {job.truck?.model} · {job.truck?.plate_number}</p>
                    </div>
                    <Badge variant={statusVariant(job.status)}>{statusLabel(job.status)}</Badge>
                  </a>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </Layout>
  );
}
