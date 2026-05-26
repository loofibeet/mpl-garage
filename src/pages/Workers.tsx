import { useEffect, useState, useCallback } from 'react'; 
import { Layout } from '../components/layout/Layout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input, Textarea, Select } from '../components/ui/Input';
import { useApp } from '../contexts/AppContext';
import { db } from '../lib/storage';
import { Worker } from '../lib/database.types';
import { Plus, Users, Landmark, FileText, CheckCircle2, XCircle, MoreVertical, Trash2 } from 'lucide-react';

interface DayLog {
  status: 'present' | 'absent';
  hours: number;
  rateOverride?: number;
  tips: number;
  lunchMoney: boolean;
  notes: string;
}

type AttendanceRegistry = Record<string, DayLog>;

export function Workers() {
  const { t, language } = useApp();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [currentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const daysArray = Array.from({ length: totalDays }, (_, i) => i + 1);
  const [registry, setRegistry] = useState<AttendanceRegistry>({});
  const [detailPanel, setDetailPanel] = useState<{ worker: Worker; day: number } | null>(null);
  const [form, setForm] = useState({ name: '', hourly_rate: '20' });

  useEffect(() => {
    const handleOutsideClick = () => setActiveMenuId(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const load = useCallback(() => {
    try {
      const allWorkers = db.getAll<Worker>('workers').sort((a, b) => a.name.localeCompare(b.name));
      setWorkers(allWorkers);
    } catch (err) {
      console.error('Error loading workers:', err);
    }
    const savedRegistry = localStorage.getItem(`attendance_${year}_${month}`);
    if (savedRegistry) setRegistry(JSON.parse(savedRegistry));
    setLoading(false);
  }, [year, month]);

  useEffect(() => {
    load();
    window.addEventListener('firebase-synced', load);
    return () => window.removeEventListener('firebase-synced', load);
  }, [load]);

  const saveRegistryUpdate = (updated: AttendanceRegistry) => {
    setRegistry(updated);
    localStorage.setItem(`attendance_${year}_${month}`, JSON.stringify(updated));
  };

  const handleAddWorker = () => {
    if (!form.name.trim()) return;
    const payload = { name: form.name, hourly_rate: parseFloat(form.hourly_rate) || 0, status: 'active', phone: '', specialization: '', notes: '' };
    try { db.insert('workers', payload); } catch (err) { console.error('Error inserting worker:', err); }
    setForm({ name: '', hourly_rate: '20' });
    setModalOpen(false);
    load();
  };

  const handleRemoveWorker = (id: string, name: string) => {
    if (window.confirm(`${t('deleteWorkerConfirm')} ${name}`)) {
      setWorkers(prev => prev.filter(w => w.id !== id));
      try { (db as any).remove('workers', id); } catch (e) { console.warn(e); }
    }
  };

  const getDayData = (workerId: string, dayNum: number): DayLog => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    return registry[`${workerId}_${dateStr}`] || { status: 'present', hours: 8, tips: 0, lunchMoney: false, notes: '' };
  };

  const updateDayData = (workerId: string, dayNum: number, fields: Partial<DayLog>) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    const key = `${workerId}_${dateStr}`;
    const updatedRegistry = { ...registry, [key]: { ...getDayData(workerId, dayNum), ...fields } };
    saveRegistryUpdate(updatedRegistry);
  };

  const calculateMonthlySummary = (worker: Worker) => {
    let totalHours = 0, totalTips = 0, totalLunch = 0, absentDays = 0, totalEarnings = 0;
    daysArray.forEach(day => {
      const data = getDayData(worker.id, day);
      if (data.status === 'absent') { absentDays += 1; }
      else {
        const hourlyRate = data.rateOverride !== undefined ? data.rateOverride : worker.hourly_rate;
        totalHours += data.hours; totalTips += data.tips;
        if (data.lunchMoney) { totalLunch += 15; totalEarnings += 15; }
        totalEarnings += data.hours * hourlyRate + data.tips;
      }
    });
    return { totalHours, totalTips, totalLunch, absentDays, totalEarnings };
  };

  const monthLocale = language === 'fr' ? 'fr-FR' : language === 'ar' ? 'ar' : 'en-US';
  const nomDuMois = currentDate.toLocaleString(monthLocale, { month: 'long' });
  const capitalisedMois = nomDuMois.charAt(0).toUpperCase() + nomDuMois.slice(1);

  return (
    <Layout title={`${capitalisedMois} ${year} - ${t('workerPlanning')}`}>
      <div className="space-y-6">
        <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-orange-500" />
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{t('teamOverview')}</h2>
          </div>
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => setModalOpen(true)}>{t('addWorker')}</Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48 text-slate-400"><div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mr-3" />{t('loadingMatrix')}</div>
        ) : workers.length === 0 ? (
          <Card className="p-12 text-center"><p className="text-slate-500 mb-4">{t('noWorkers')}</p><Button icon={<Plus className="w-4 h-4" />} onClick={() => setModalOpen(true)}>{t('createFirstProfile')}</Button></Card>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-900">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/70 sticky top-0 border-b border-slate-200 dark:border-slate-700 z-10">
                <tr>
                  <th className="p-3 font-semibold text-slate-700 dark:text-slate-300 min-w-[120px] bg-slate-100 dark:bg-slate-800 sticky left-0 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">{t('daysTeam')}</th>
                  {workers.map(w => (
                    <th key={w.id} className="p-3 font-bold text-center text-slate-800 dark:text-slate-200 min-w-[160px] border-l border-slate-200 dark:border-slate-700 relative z-20">
                      <div className="flex items-center justify-between gap-1 w-full px-1">
                        <div className="flex flex-col items-start text-left flex-1 min-w-0">
                          <span className="truncate w-full text-slate-900 dark:text-slate-100">{w.name}</span>
                          <span className="text-[11px] font-medium text-slate-400 font-mono">{w.hourly_rate} EUR/h {t('baseRate')}</span>
                        </div>
                        <div className="relative">
                          <button onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === w.id ? null : w.id); }} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all" title={t('options')}><MoreVertical className="w-4 h-4" /></button>
                          {activeMenuId === w.id && (
                            <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl py-1 z-30 text-left">
                              <button onClick={(e) => { e.stopPropagation(); handleRemoveWorker(w.id, w.name); setActiveMenuId(null); }} className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"><Trash2 className="w-3.5 h-3.5" /> {t('deleteProfile')}</button>
                            </div>
                          )}
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {daysArray.map(day => {
                  const isToday = new Date().getDate() === day && new Date().getMonth() === month;
                  return (
                    <tr key={day} className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors ${isToday ? 'bg-orange-50/40 dark:bg-orange-500/5' : ''}`}>
                      <td className={`p-2.5 font-mono font-bold sticky left-0 z-10 text-center shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] ${isToday ? 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400'}`}>
                        <div className="flex items-center justify-center gap-1"><span>{t('day')} {String(day).padStart(2, '0')}</span>{isToday && <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />}</div>
                      </td>
                      {workers.map(w => {
                        const dayData = getDayData(w.id, day);
                        const isAbsent = dayData.status === 'absent';
                        return (
                          <td key={w.id} onClick={() => setDetailPanel({ worker: w, day })} className="p-2 border-l border-slate-100 dark:border-slate-800 text-center cursor-pointer hover:bg-orange-500/10 dark:hover:bg-orange-500/20 transition-all select-none">
                            {isAbsent ? (
                              <div className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400 border border-red-200/50 dark:border-red-900/50 w-full"><XCircle className="w-3.5 h-3.5" /> {t('absent')}</div>
                            ) : (
                              <div className="inline-flex flex-col items-center justify-center p-1 rounded-lg w-full bg-slate-50/60 dark:bg-slate-800/40 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 text-xs">
                                <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium"><CheckCircle2 className="w-3.5 h-3.5" /> {dayData.hours} h</div>
                                {(dayData.tips > 0 || dayData.lunchMoney) && <div className="text-[10px] text-slate-400 mt-0.5 flex gap-1">{dayData.tips > 0 && <span>+{dayData.tips} EUR</span>}{dayData.lunchMoney && <span title={t('includeLunch')}>+15</span>}</div>}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                <tr className="bg-slate-100 dark:bg-slate-800 font-semibold border-t-2 border-slate-300 dark:border-slate-600 shadow-inner">
                  <td className="p-4 sticky left-0 bg-slate-200 dark:bg-slate-700 z-10 font-bold text-slate-700 dark:text-slate-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">{t('monthTotals')}</td>
                  {workers.map(w => {
                    const totals = calculateMonthlySummary(w);
                    return (
                      <td key={w.id} className="p-3 border-l border-slate-200 dark:border-slate-600 text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/90">
                        <div className="space-y-1 font-mono">
                          <div className="flex justify-between border-b border-slate-200/60 dark:border-slate-700 pb-0.5"><span>{t('hours')}:</span><span className="font-bold text-slate-900 dark:text-slate-100">{totals.totalHours} h</span></div>
                          <div className="flex justify-between text-red-600 dark:text-red-400"><span>{t('absences')}:</span><span>{totals.absentDays}</span></div>
                          <div className="flex justify-between text-amber-600 dark:text-amber-400"><span>{t('bonusesMeals')}:</span><span>{totals.totalTips + totals.totalLunch} EUR</span></div>
                          <div className="flex justify-between text-sm pt-1 font-bold text-emerald-600 dark:text-emerald-400 border-t border-dashed border-slate-300 dark:border-slate-600"><span className="flex items-center gap-0.5"><Landmark className="w-3 h-3" /> {t('netToPay')}:</span><span>{totals.totalEarnings.toFixed(2)} EUR</span></div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t('newWorkerTitle')}>
        <div className="space-y-4">
          <Input label={`${t('workerFullName')} *`} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={t('workerFullName')} />
          <Input label={`${t('hourlyRateBase')} (EUR)`} type="number" value={form.hourly_rate} onChange={e => setForm(f => ({ ...f, hourly_rate: e.target.value }))} placeholder="20" />
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)} className="flex-1 justify-center">{t('cancel')}</Button>
            <Button onClick={handleAddWorker} className="flex-1 justify-center">{t('addToBoard')}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!detailPanel} onClose={() => setDetailPanel(null)} title={detailPanel ? `${detailPanel.worker.name} - ${t('day')} ${String(detailPanel.day).padStart(2, '0')}` : ''}>
        {detailPanel && (() => {
          const currentDayLog = getDayData(detailPanel.worker.id, detailPanel.day);
          return (
            <div className="space-y-4">
              <Select label={t('presenceStatus')} value={currentDayLog.status} onChange={e => updateDayData(detailPanel.worker.id, detailPanel.day, { status: e.target.value as 'present' | 'absent' })} options={[{ value: 'present', label: t('presentActive') }, { value: 'absent', label: t('absentConfirmed') }]} />
              {currentDayLog.status === 'present' && (
                <div className="space-y-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="grid grid-cols-2 gap-3">
                    <Input label={t('hoursCompleted')} type="number" step="0.5" value={currentDayLog.hours} onChange={e => updateDayData(detailPanel.worker.id, detailPanel.day, { hours: parseFloat(e.target.value) || 0 })} />
                    <Input label={`${t('tips')} (EUR)`} type="number" value={currentDayLog.tips} onChange={e => updateDayData(detailPanel.worker.id, detailPanel.day, { tips: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <Input label={`${t('overrideHourlyRate')} (EUR)`} placeholder={`${t('currentBaseRate')}: ${detailPanel.worker.hourly_rate} EUR`} type="number" value={currentDayLog.rateOverride || ''} onChange={e => updateDayData(detailPanel.worker.id, detailPanel.day, { rateOverride: e.target.value ? parseFloat(e.target.value) : undefined })} />
                  <label className="flex items-center gap-3 p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer select-none">
                    <input type="checkbox" checked={currentDayLog.lunchMoney} onChange={e => updateDayData(detailPanel.worker.id, detailPanel.day, { lunchMoney: e.target.checked })} className="w-4 h-4 rounded text-orange-500 focus:ring-orange-500 border-slate-300" />
                    <div className="text-xs"><p className="font-semibold text-slate-800 dark:text-slate-200">{t('includeLunch')}</p><p className="text-slate-400">{t('lunchHelp')} +15.00 EUR</p></div>
                  </label>
                </div>
              )}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> {t('followUpNotes')}</label>
                <Textarea value={currentDayLog.notes} onChange={e => updateDayData(detailPanel.worker.id, detailPanel.day, { notes: e.target.value })} rows={3} placeholder={t('notesPlaceholder')} />
              </div>
              <div className="pt-2"><Button className="w-full justify-center" onClick={() => setDetailPanel(null)}>{t('validateUpdate')}</Button></div>
            </div>
          );
        })()}
      </Modal>
    </Layout>
  );
}
