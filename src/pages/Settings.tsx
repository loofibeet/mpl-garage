import { useState } from 'react';
import { Layout } from '../components/layout/Layout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useApp } from '../contexts/AppContext';
import { db } from '../lib/storage';
import { Language } from '../lib/i18n';
import { User, Moon, Sun, Globe, Save, CheckCircle } from 'lucide-react';

export function Settings() {
  const { t, darkMode, toggleDarkMode, language, setLanguage, profile, refreshProfile } = useApp();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone]       = useState(
    () => {
      // load saved phone from local storage if exists
      const saved = localStorage.getItem(`profile_phone_${profile?.id}`);
      return saved || '';
    }
  );
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  const handleSaveProfile = () => {
    if (!profile) return;
    setSaving(true);

    // update full_name in users table
    db.update('users', profile.id, { full_name: fullName });

    // save phone separately (phone is not in the auth session object)
    localStorage.setItem(`profile_phone_${profile.id}`, phone);

    // update the session so the navbar name refreshes
    const session = JSON.parse(localStorage.getItem('garage_session') || '{}');
    localStorage.setItem('garage_session', JSON.stringify({ ...session, full_name: fullName }));

    refreshProfile();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const languages: { value: Language; label: string; native: string }[] = [
    { value: 'en', label: 'English',  native: 'English'  },
    { value: 'fr', label: 'French',   native: 'Français' },
    { value: 'ar', label: 'Arabic',   native: 'العربية'  },
  ];

  return (
    <Layout title={t('settings')}>
      <div className="max-w-2xl space-y-6">

        {/* Profile */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
              <User className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">{t('profile')}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Your account information</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl mb-4">
              <div className="w-12 h-12 rounded-full bg-orange-500 flex items-center justify-center text-white text-lg font-bold">
                {fullName ? fullName[0].toUpperCase() : 'U'}
              </div>
              <div>
                <p className="font-medium text-slate-800 dark:text-slate-200">{fullName || 'User'}</p>
                <p className="text-xs text-slate-500 capitalize">{profile?.role}</p>
              </div>
            </div>

            <Input
              label={t('name')}
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Your full name"
            />
            <Input
              label={t('phone')}
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+1 234 567 890"
            />
            <Button
              onClick={handleSaveProfile}
              loading={saving}
              icon={saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              variant={saved ? 'secondary' : 'primary'}
            >
              {saved ? 'Saved!' : t('save')}
            </Button>
          </div>
        </Card>

        {/* Appearance */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 bg-slate-100 dark:bg-slate-700 rounded-xl">
              {darkMode
                ? <Moon className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                : <Sun  className="w-5 h-5 text-amber-500" />}
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">{t('darkMode')}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Toggle dark or light theme</p>
            </div>
          </div>
          <button
            onClick={toggleDarkMode}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-orange-400 ${darkMode ? 'bg-orange-500' : 'bg-slate-300'}`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${darkMode ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </Card>

        {/* Language */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 bg-sky-100 dark:bg-sky-900/30 rounded-xl">
              <Globe className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">{t('language')}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Choose display language</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {languages.map(lang => (
              <button
                key={lang.value}
                onClick={() => setLanguage(lang.value)}
                className={`p-3 rounded-xl border-2 text-center transition-all ${
                  language === lang.value
                    ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                    : 'border-slate-200 dark:border-slate-600 hover:border-orange-300 dark:hover:border-orange-700'
                }`}
              >
                <p className={`text-sm font-semibold ${language === lang.value ? 'text-orange-600 dark:text-orange-400' : 'text-slate-700 dark:text-slate-300'}`}>
                  {lang.native}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{lang.label}</p>
              </button>
            ))}
          </div>
        </Card>

        {/* App info */}
        <div className="text-center text-xs text-slate-400 dark:text-slate-500 py-2">
          TruckGarage Pro v1.0 · Professional Garage Management
        </div>
      </div>
    </Layout>
  );
}
