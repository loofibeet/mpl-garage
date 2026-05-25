import { useEffect, useState } from 'react'; 
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
  const { t } = useApp();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  
  // Menu 3 points : Stocke l'ID de l'ouvrier dont le menu est ouvert
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  
  const [currentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); 
  const totalDays = new Date(year, month + 1, 0).getDate();
  const daysArray = Array.from({ length: totalDays }, (_, i) => i + 1);

  const [registry, setRegistry] = useState<AttendanceRegistry>({});
  const [detailPanel, setDetailPanel] = useState<{ worker: Worker; day: number } | null>(null);
  const [form, setForm] = useState({ name: '', hourly_rate: '20' });

  // Fermer le menu 3 points si on clique n'importe où ailleurs
  useEffect(() => {
    const handleOutsideClick = () => setActiveMenuId(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const load = () => {
    try {
      const allWorkers = db.getAll<Worker>('workers').sort((a, b) => a.name.localeCompare(b.name));
      setWorkers(allWorkers);
    } catch (err) {
      console.error("Erreur lors du chargement des ouvriers :", err);
    }
    
    const savedRegistry = localStorage.getItem(`attendance_${year}_${month}`);
    if (savedRegistry) {
      setRegistry(JSON.parse(savedRegistry));
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const saveRegistryUpdate = (updated: AttendanceRegistry) => {
    setRegistry(updated);
    localStorage.setItem(`attendance_${year}_${month}`, JSON.stringify(updated));
  };

  const handleAddWorker = () => {
    if (!form.name.trim()) return;
    const payload = {
      name: form.name,
      hourly_rate: parseFloat(form.hourly_rate) || 0,
      status: 'active',
      phone: '',
      specialization: '',
      notes: ''
    };
    try {
      db.insert('workers', payload);
    } catch (err) {
      console.error("Erreur insertion ouvrier :", err);
    }
    setForm({ name: '', hourly_rate: '20' });
    setModalOpen(false);
    load();
  };

  const handleRemoveWorker = (id: string, name: string) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer ${name} du système ?`)) {
      setWorkers(prevWorkers => prevWorkers.filter(w => w.id !== id));
      try {
        if (typeof db.delete === 'function') {
          db.delete('workers', id);
        } else if (typeof (db as any).remove === 'function') {
          (db as any).remove('workers', id);
        }
      } catch (dbError) {
        console.warn("Échec de la suppression en base, mise à jour UI uniquement :", dbError);
        try {
          db.delete('workers', Number(id) as any);
        } catch (r) {}
      }
    }
  };

  const getDayData = (workerId: string, dayNum: number): DayLog => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    const key = `${workerId}_${dateStr}`;
    
    return registry[key] || {
      status: 'present',
      hours: 6, 
      tips: 0,
      lunchMoney: false,
      notes: ''
    };
  };

  const updateDayData = (workerId: string, dayNum: number, fields: Partial<DayLog>) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    const key = `${workerId}_${dateStr}`;
    const base = getDayData(workerId, dayNum);
    
    const updatedRegistry = {
      ...registry,
      [key]: { ...base, ...fields }
    };
    saveRegistryUpdate(updatedRegistry);
  };

  const calculateMonthlySummary = (worker: Worker) => {
    let totalHours = 0;
    let totalTips = 0;
    let totalLunch = 0;
    let absentDays = 0;
    let totalEarnings = 0;

    daysArray.forEach(day => {
      const data = getDayData(worker.id, day);
      if (data.status === 'absent') {
        absentDays += 1;
      } else {
        const hourlyRate = data.rateOverride !== undefined ? data.rateOverride : worker.hourly_rate;
        totalHours += data.hours;
        totalTips += data.tips;
        if (data.lunchMoney) {
          totalLunch += 15; 
          totalEarnings += 15;
        }
        totalEarnings += data.hours * hourlyRate + data.tips;
      }
    });

    return { totalHours, totalTips, totalLunch, absentDays, totalEarnings };
  };

  // Traduction française du mois en cours
  const nomDuMois = currentDate.toLocaleString('fr-FR', { month: 'long' });
  const capitalisedMois = nomDuMois.charAt(0).toUpperCase() + nomDuMois.slice(1);

  return (
    <Layout title={`${capitalisedMois} ${year} - Planning des Ouvriers`}>
      <div className="space-y-6">
        
        {/* BARRE D'ACTIONS TOP */}
        <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-orange-500" />
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Vue d'ensemble de l'équipe</h2>
          </div>
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => setModalOpen(true)}>Ajouter un ouvrier</Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48 text-slate-400">
            <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mr-3" />
            Chargement de la matrice de données...
          </div>
        ) : workers.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-slate-500 mb-4">Aucun ouvrier enregistré dans la base de données pour le moment.</p>
            <Button icon={<Plus className="w-4 h-4" />} onClick={() => setModalOpen(true)}>Créer le premier profil</Button>
          </Card>
        ) : (
          /* TABLEAU DE BORD PRINCIPAL */
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-900">
            <table className="w-full border-collapse text-left text-sm">
              
              {/* EN-TÊTES DE COLONNES (Ouvriers) */}
              <thead className="bg-slate-50 dark:bg-slate-800/70 sticky top-0 border-b border-slate-200 dark:border-slate-700 z-10">
                <tr>
                  <th className="p-3 font-semibold text-slate-700 dark:text-slate-300 min-w-[120px] bg-slate-100 dark:bg-slate-800 sticky left-0 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                    Jours / Équipe
                  </th>
                  {workers.map(w => (
                    <th key={w.id} className="p-3 font-bold text-center text-slate-800 dark:text-slate-200 min-w-[160px] border-l border-slate-200 dark:border-slate-700 relative z-20">
                      <div className="flex items-center justify-between gap-1 w-full px-1">
                        
                        {/* Infos de l'ouvrier */}
                        <div className="flex flex-col items-start text-left flex-1 min-w-0">
                          <span className="truncate w-full text-slate-900 dark:text-slate-100">{w.name}</span>
                          <span className="text-[11px] font-medium text-slate-400 font-mono">{w.hourly_rate}€/h base</span>
                        </div>
                        
                        {/* MENU INTERACTIF 3 DOTS AVEC UI PREMIUM */}
                        <div className="relative">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation(); // Évite la fermeture immédiate du handler global
                              setActiveMenuId(activeMenuId === w.id ? null : w.id);
                            }}
                            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
                            title="Options"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {/* Dropdown contextuel de suppression */}
                          {activeMenuId === w.id && (
                            <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl py-1 z-30 animate-in fade-in slide-in-from-top-1 duration-100 text-left">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveWorker(w.id, w.name);
                                  setActiveMenuId(null);
                                }}
                                className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Supprimer le profil
                              </button>
                            </div>
                          )}
                        </div>

                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              {/* LIGNES DES JOURS DU MOIS */}
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {daysArray.map(day => {
                  const isToday = new Date().getDate() === day && new Date().getMonth() === month;
                  
                  return (
                    <tr key={day} className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors ${isToday ? 'bg-orange-50/40 dark:bg-orange-500/5' : ''}`}>
                      {/* Numéro du Jour */}
                      <td className={`p-2.5 font-mono font-bold sticky left-0 z-10 text-center shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] ${isToday ? 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400'}`}>
                        <div className="flex items-center justify-center gap-1">
                          <span>Jour {String(day).padStart(2, '0')}</span>
                          {isToday && <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />}
                        </div>
                      </td>

                      {/* Cellules d'heures de l'ouvrier */}
                      {workers.map(w => {
                        const dayData = getDayData(w.id, day);
                        const isAbsent = dayData.status === 'absent';
                        
                        return (
                          <td 
                            key={w.id} 
                            onClick={() => setDetailPanel({ worker: w, day })}
                            className="p-2 border-l border-slate-100 dark:border-slate-800 text-center cursor-pointer hover:bg-orange-500/10 dark:hover:bg-orange-500/20 transition-all select-none"
                          >
                            {isAbsent ? (
                              <div className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400 border border-red-200/50 dark:border-red-900/50 w-full">
                                <XCircle className="w-3.5 h-3.5" /> Absent
                              </div>
                            ) : (
                              <div className="inline-flex flex-col items-center justify-center p-1 rounded-lg w-full bg-slate-50/60 dark:bg-slate-800/40 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 text-xs">
                                <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> {dayData.hours} h
                                </div>
                                {(dayData.tips > 0 || dayData.lunchMoney) && (
                                  <div className="text-[10px] text-slate-400 mt-0.5 flex gap-1">
                                    {dayData.tips > 0 && <span>+{dayData.tips}€ P.</span>}
                                    {dayData.lunchMoney && <span title="Repas Inclus">🍴</span>}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}

                {/* TOTAUX MENSUELS COMPTABLES */}
                <tr className="bg-slate-100 dark:bg-slate-800 font-semibold border-t-2 border-slate-300 dark:border-slate-600 shadow-inner">
                  <td className="p-4 sticky left-0 bg-slate-200 dark:bg-slate-700 z-10 font-bold text-slate-700 dark:text-slate-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                    Totaux du Mois
                  </td>
                  {workers.map(w => {
                    const totals = calculateMonthlySummary(w);
                    return (
                      <td key={w.id} className="p-3 border-l border-slate-200 dark:border-slate-600 text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/90">
                        <div className="space-y-1 font-mono">
                          <div className="flex justify-between border-b border-slate-200/60 dark:border-slate-700 pb-0.5">
                            <span>Heures :</span>
                            <span className="font-bold text-slate-900 dark:text-slate-100">{totals.totalHours} h</span>
                          </div>
                          <div className="flex justify-between text-red-600 dark:text-red-400">
                            <span>Absences :</span>
                            <span>{totals.absentDays} j</span>
                          </div>
                          <div className="flex justify-between text-amber-600 dark:text-amber-400">
                            <span>Primes/Repas :</span>
                            <span>{totals.totalTips + totals.totalLunch}€</span>
                          </div>
                          <div className="flex justify-between text-sm pt-1 font-bold text-emerald-600 dark:text-emerald-400 border-t border-dashed border-slate-300 dark:border-slate-600">
                            <span className="flex items-center gap-0.5"><Landmark className="w-3 h-3" /> Net à Payer :</span>
                            <span>{totals.totalEarnings.toFixed(2)}€</span>
                          </div>
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

      {/* MODAL : ENREGISTRER UN NOUVEL OUVRIER */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Enregistrer un nouvel ouvrier">
        <div className="space-y-4">
          <Input 
            label="Nom complet de l'ouvrier *" 
            value={form.name} 
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} 
            placeholder="Ex: Jean Dupont" 
          />
          <Input 
            label="Tarif horaire de base (€)" 
            type="number" 
            value={form.hourly_rate} 
            onChange={e => setForm(f => ({ ...f, hourly_rate: e.target.value }))} 
            placeholder="20" 
          />
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)} className="flex-1 justify-center">Annuler</Button>
            <Button onClick={handleAddWorker} className="flex-1 justify-center">Ajouter au tableau</Button>
          </div>
        </div>
      </Modal>

      {/* MODAL : CONFIGURATION DE LA JOURNÉE D'UN OUVRIER */}
      <Modal 
        open={!!detailPanel} 
        onClose={() => setDetailPanel(null)} 
        title={detailPanel ? `${detailPanel.worker.name} — Jour ${String(detailPanel.day).padStart(2, '0')}` : ''}
      >
        {detailPanel && (() => {
          const currentDayLog = getDayData(detailPanel.worker.id, detailPanel.day);
          return (
            <div className="space-y-4">
              
              <Select
                label="Statut de présence"
                value={currentDayLog.status}
                onChange={e => updateDayData(detailPanel.worker.id, detailPanel.day, { status: e.target.value as 'present' | 'absent' })}
                options={[
                  { value: 'present', label: '🟢 Présent & Actif' },
                  { value: 'absent', label: '🔴 Absent confirmé' }
                ]}
              />

              {currentDayLog.status === 'present' && (
                <div className="space-y-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Heures effectuées"
                      type="number"
                      step="0.5"
                      value={currentDayLog.hours}
                      onChange={e => updateDayData(detailPanel.worker.id, detailPanel.day, { hours: parseFloat(e.target.value) || 0 })}
                    />
                    <Input
                      label="Primes / Pourboires (€)"
                      type="number"
                      value={currentDayLog.tips}
                      onChange={e => updateDayData(detailPanel.worker.id, detailPanel.day, { tips: parseFloat(e.target.value) || 0 })}
                    />
                  </div>

                  <Input
                    label="Modifier le taux horaire (€) - Optionnel"
                    placeholder={`Tarif de base actuel : ${detailPanel.worker.hourly_rate}€`}
                    type="number"
                    value={currentDayLog.rateOverride || ''}
                    onChange={e => updateDayData(detailPanel.worker.id, detailPanel.day, { rateOverride: e.target.value ? parseFloat(e.target.value) : undefined })}
                  />

                  <label className="flex items-center gap-3 p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={currentDayLog.lunchMoney}
                      onChange={e => updateDayData(detailPanel.worker.id, detailPanel.day, { lunchMoney: e.target.checked })}
                      className="w-4 h-4 rounded text-orange-500 focus:ring-orange-500 border-slate-300"
                    />
                    <div className="text-xs">
                      <p className="font-semibold text-slate-800 dark:text-slate-200">Inclure l'indemnité repas du jour</p>
                      <p className="text-slate-400">Ajoute une prime forfaitaire de +15.00€</p>
                    </div>
                  </label>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" /> Notes de suivi & Commentaires
                </label>
                <Textarea
                  value={currentDayLog.notes}
                  onChange={e => updateDayData(detailPanel.worker.id, detailPanel.day, { notes: e.target.value })}
                  rows={3}
                  placeholder="Exemple : Arrivé en retard, problèmes logistiques, remarques sur le chantier..."
                />
              </div>

              <div className="pt-2">
                <Button className="w-full justify-center" onClick={() => setDetailPanel(null)}>
                  Valider et mettre à jour le tableau
                </Button>
              </div>
            </div>
          );
        })()}
      </Modal>
    </Layout>
  );
}